import { describe, it, expect, vi } from "vitest";
import {
  api,
  createUser,
  sendDocument,
  signAs,
  PNG_DATA_URL,
  reloadRecipient,
  reloadPdf,
  flushEvents,
  emailsTo,
} from "../helpers.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { PDFDocument } from "pdf-lib";
import { readFile } from "../../src/services/storage.service.js";

const two = [
  { name: "First Signer", email: "first@example.test" },
  { name: "Second Signer", email: "second@example.test" },
];

const twoFields = [
  { id: "sig-1", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "first@example.test" },
  { id: "sig-2", type: "signature", page: 1, xPercent: 0.5, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "second@example.test" },
];

// Audit finding H8: signing rules lived only in the browser.
describe("H8 signing rules are enforced on the server", () => {
  it("makes sequential signers wait their turn", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, two, { signingOrder: true, fields: twoFields });

    const early = await signAs(recipients[1].token, ["sig-2"]);
    expect(early.status).toBe(409);
    expect((await reloadRecipient(recipients[1]._id)).status).not.toBe("signed");

    expect((await signAs(recipients[0].token, ["sig-1"])).status).toBe(200);
    await flushEvents();
    // The second signer is invited only now
    expect(emailsTo("second@example.test").length).toBeGreaterThan(0);
    expect((await signAs(recipients[1].token, ["sig-2"])).status).toBe(200);
  });

  it("refuses to sign twice", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, two, { fields: twoFields });

    expect((await signAs(recipients[0].token, ["sig-1"])).status).toBe(200);
    expect((await signAs(recipients[0].token, ["sig-1"])).status).toBe(409);
  });

  it("refuses to sign without consent, and stores the consent given", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [two[0]]);
    const token = recipients[0].token;

    const noConsent = await api().post(`/api/signing/${token}/sign`).send({ fields: [{ id: "sig-1", signatureUrl: PNG_DATA_URL }] });
    expect(noConsent.status).toBe(400);
    const falseConsent = await api().post(`/api/signing/${token}/sign`).send({ consent: false, fields: [{ id: "sig-1", signatureUrl: PNG_DATA_URL }] });
    expect(falseConsent.status).toBe(400);
    expect((await reloadRecipient(recipients[0]._id)).status).not.toBe("signed");

    await signAs(token, ["sig-1"]).set("User-Agent", "vitest-agent");
    const stored = await reloadRecipient(recipients[0]._id);
    expect(stored.consent.accepted).toBe(true);
    expect(stored.consent.acceptedAt).toBeInstanceOf(Date);
    expect(stored.consent.userAgent).toBe("vitest-agent");
  });

  it("refuses to complete with a required field left empty", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [two[0]], {
      fields: [
        twoFields[0],
        { id: "name-1", type: "text", page: 1, xPercent: 0.1, yPercent: 0.5, widthPercent: 0.3, heightPercent: 0.04, required: true, recipientEmail: "first@example.test" },
      ],
    });

    const res = await signAs(recipients[0].token, ["sig-1"]);
    expect(res.status).toBe(422);
    expect((await reloadRecipient(recipients[0]._id)).status).not.toBe("signed");
  });

  it("stops signing after a decline, a void, or completion", async () => {
    const sender = await createUser();

    const declined = await sendDocument(sender, two, { fields: twoFields });
    expect((await api().post(`/api/signing/${declined.recipients[0].token}/decline`).send({ reason: "Terms wrong" })).status).toBe(200);
    expect((await signAs(declined.recipients[1].token, ["sig-2"])).status).toBe(409);
    expect((await signAs(declined.recipients[0].token, ["sig-1"])).status).toBe(409);

    const voided = await sendDocument(sender, two, { fields: twoFields });
    expect((await api().post(`/api/send/${voided.pdfId}/void`).set(sender.auth)).status).toBe(200);
    expect((await signAs(voided.recipients[0].token, ["sig-1"])).status).toBe(410);
    expect((await api().get(`/api/signing/${voided.recipients[0].token}`)).status).toBe(410);
  });

  it("does not let a viewer sign or decline", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(
      sender,
      [two[0], { name: "Watcher", email: "watch@example.test", role: "viewer" }],
      { fields: [twoFields[0]] }
    );
    const viewer = recipients.find((r) => r.role === "viewer");

    expect((await signAs(viewer.token, ["sig-1"])).status).toBe(403);
    expect((await api().post(`/api/signing/${viewer.token}/decline`).send({ reason: "x" })).status).toBe(403);
  });

  it("refuses to re-send a document that is already out for signature", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [two[0]]);

    const again = await api()
      .post(`/api/send/${pdfId}`)
      .set(sender.auth)
      .send({ recipients: [{ name: "Mallory", email: "mallory@example.test" }], fields: [] });

    expect(again.status).toBe(409);
    expect(await Recipient.countDocuments({ pdfId })).toBe(1);
    expect((await reloadRecipient(recipients[0]._id)).email).toBe("first@example.test");
  });
});

// Audit finding M4: fields were matched to signers by name as well as id.
describe("M4 fields belong to exactly one signer", () => {
  it("keeps two signers with the same name out of each other's fields", async () => {
    const sender = await createUser();
    const sameName = [
      { name: "Priya Sharma", email: "priya.one@example.test" },
      { name: "Priya Sharma", email: "priya.two@example.test" },
    ];
    const fields = [
      { ...twoFields[0], recipientEmail: "priya.one@example.test" },
      { ...twoFields[1], recipientEmail: "priya.two@example.test" },
    ];
    const { pdfId, recipients } = await sendDocument(sender, sameName, { fields });

    // The first signer also submits a value for the second signer's field
    const res = await signAs(recipients[0].token, ["sig-1", "sig-2"]);
    expect(res.status).toBe(200);

    const pdf = await reloadPdf(pdfId);
    const other = pdf.fields.find((f) => f.id === "sig-2");
    expect(other.signedBy).toBeUndefined();
    expect(other.signatureUrl || "").toBe("");
    expect(pdf.status).toBe("partially_signed");
  });
});

// Audit findings H8 and H11: order of operations and parallel signing.
describe("stamping and locking", () => {
  it("leaves the signer unsigned when stamping fails", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [two[0]]);

    // Remove the stored file so stamping cannot succeed
    const pdf = await Pdf.findById(pdfId);
    const fs = await import("fs");
    fs.unlinkSync(pdf.storagePath);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await signAs(recipients[0].token, ["sig-1"]);
    spy.mockRestore();

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect((await reloadRecipient(recipients[0]._id)).status).not.toBe("signed");
    expect((await reloadPdf(pdfId)).status).toBe("pending");
    expect((await reloadPdf(pdfId)).signLockUntil).toBeNull();
  });

  it("keeps both signatures when two people sign at the same moment", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, two, { fields: twoFields });

    const [a, b] = await Promise.all([
      signAs(recipients[0].token, ["sig-1"]),
      signAs(recipients[1].token, ["sig-2"]),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const pdf = await reloadPdf(pdfId);
    expect(pdf.status).toBe("signed");
    expect(pdf.fields.every((f) => f.signedBy)).toBe(true);
    // Exactly one of them completed the document
    expect([a.body.data.isFinal, b.body.data.isFinal].filter(Boolean)).toHaveLength(1);

    // Both images are in the final file
    // One stored version per signer, the second built on the first
    expect(pdf.versions).toHaveLength(2);
    const signedDoc = await PDFDocument.load(await readFile(pdf.versions[1].key));
    const images = signedDoc.context
      .enumerateIndirectObjects()
      .filter(([, obj]) => obj.dict?.get?.(signedDoc.context.obj("Subtype"))?.toString() === "/Image");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });
});

// Audit finding M7: signing links never expired.
describe("M7 signing links expire", () => {
  it("gives every link an expiry and refuses it afterwards", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [two[0]]);

    const stored = await reloadRecipient(recipients[0]._id);
    expect(stored.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.token).toMatch(/^[a-f0-9]{64}$/);

    await Recipient.updateOne({ _id: stored._id }, { tokenExpiresAt: new Date(Date.now() - 1000) });
    expect((await api().get(`/api/signing/${stored.token}`)).status).toBe(410);
    expect((await signAs(stored.token, ["sig-1"])).status).toBe(410);
  });

  it("issues a new link and a new invitation when the signer's email is corrected", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [two[0]]);
    const oldToken = recipients[0].token;

    const res = await api()
      .patch(`/api/send/recipients/${recipients[0]._id}/email`)
      .set(sender.auth)
      .send({ email: "corrected@example.test" });
    expect(res.status).toBe(200);
    await flushEvents();

    expect((await api().get(`/api/signing/${oldToken}`)).status).toBe(404);
    const updated = await reloadRecipient(recipients[0]._id);
    expect(emailsTo("corrected@example.test")[0].text).toContain(updated.token);
  });

  it("refuses a signing deadline in the past", async () => {
    const sender = await createUser();
    const upload = await (await import("../helpers.js")).uploadPdf(sender);
    const res = await api()
      .post(`/api/send/${upload.id}`)
      .set(sender.auth)
      .send({ recipients: [two[0]], fields: [], expiresAt: "2001-01-01" });
    expect(res.status).toBe(400);
  });
});
