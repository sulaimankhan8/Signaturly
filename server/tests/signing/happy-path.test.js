import { describe, it, expect } from "vitest";
import {
  api,
  createUser,
  sendDocument,
  signAs,
  flushEvents,
  emailsTo,
  reloadPdf,
  reloadRecipient,
} from "../helpers.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";

describe("send and sign, start to finish", () => {
  it("lets one signer open the link, sign, and download the result", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [{ name: "Asha Rao", email: "asha@example.test" }]);
    const [signer] = recipients;

    expect(emailsTo("asha@example.test")).toHaveLength(1);
    expect(emailsTo("asha@example.test")[0].text).toContain(`/sign/${signer.token}`);

    const session = await api().get(`/api/signing/${signer.token}`);
    expect(session.status).toBe(200);
    expect(session.body.data.document.fields).toHaveLength(1);
    expect(session.body.data.document.pdfUrl).toMatch(/^\/uploads\/.+\?exp=\d+&sig=[a-f0-9]{64}$/);

    const file = await api().get(session.body.data.document.pdfUrl);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/pdf");

    const signed = await signAs(signer.token, ["sig-1"]);
    expect(signed.status).toBe(200);
    expect(signed.body.data.isFinal).toBe(true);

    await flushEvents();

    expect((await reloadPdf(pdfId)).status).toBe("signed");
    const stored = await reloadRecipient(signer._id);
    expect(stored.status).toBe("signed");
    expect(stored.consent.accepted).toBe(true);
    expect(stored.consent.version).toBeTruthy();

    // Signer and sender flows end with a completion email pointing at the signer's own link
    const completion = emailsTo("asha@example.test").find((m) => /Completed/.test(m.subject));
    expect(completion.text).toContain(`/sign/${signer.token}`);

    const audit = await PdfAudit.find({ pdfId });
    expect(audit.some((a) => a.event === "signed" && a.authMethod === "Email link")).toBe(true);
  });

  it("completes only after every signer has signed, ignoring viewers", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(
      sender,
      [
        { name: "First Signer", email: "first@example.test" },
        { name: "Second Signer", email: "second@example.test" },
        { name: "Watcher", email: "watcher@example.test", role: "viewer" },
      ],
      {
        fields: [
          { id: "sig-1", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "first@example.test" },
          { id: "sig-2", type: "signature", page: 1, xPercent: 0.5, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "second@example.test" },
        ],
      }
    );

    const first = await signAs(recipients[0].token, ["sig-1"]);
    expect(first.body.data.isFinal).toBe(false);
    expect((await reloadPdf(pdfId)).status).toBe("partially_signed");

    const second = await signAs(recipients[1].token, ["sig-2"]);
    expect(second.body.data.isFinal).toBe(true);
    expect((await reloadPdf(pdfId)).status).toBe("signed");
  });
});
