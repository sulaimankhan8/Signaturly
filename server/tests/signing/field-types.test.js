import { describe, it, expect } from "vitest";
import { api, createUser, uploadPdf, sendDocument, PNG_DATA_URL, reloadPdf, reloadRecipient } from "../helpers.js";
import { formatDate } from "../../src/utils/format.js";

const at = (y) => ({ page: 1, xPercent: 0.1, yPercent: y, widthPercent: 0.2, heightPercent: 0.04 });
const signer = { name: "Asha Rao", email: "asha@example.test" };
const mine = (id, type, y, extra = {}) => ({ id, type, ...at(y), recipientEmail: signer.email, ...extra });

const sign = (token, fields) => api().post(`/api/signing/${token}/sign`).send({ consent: true, fields });

describe("each kind of field, as the signer fills it", () => {
  it("lets an optional checkbox stay empty", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [signer], {
      fields: [mine("sig", "signature", 0.7), mine("marketing", "checkbox", 0.5)],
    });
    const res = await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }]);
    expect(res.status).toBe(200);
  });

  it("insists on a checkbox the sender marked required", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [signer], {
      fields: [mine("sig", "signature", 0.7), mine("terms", "checkbox", 0.5, { required: true })],
    });
    expect((await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }])).status).toBe(422);
    expect((await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }, { id: "terms", checked: true }])).status).toBe(200);
  });

  it("takes one answer to a radio question", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer], {
      fields: [
        mine("sig", "signature", 0.7),
        mine("yes", "radio", 0.3, { groupId: "agree" }),
        mine("no", "radio", 0.35, { groupId: "agree" }),
      ],
    });
    // Not answered: refused
    expect((await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }])).status).toBe(422);

    // Both ticked: only the first stands
    const res = await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }, { id: "yes", checked: true }, { id: "no", checked: true }]);
    expect(res.status).toBe(200);
    const fields = (await reloadPdf(pdfId)).fields;
    expect(fields.filter((f) => f.type === "radio" && f.checked).map((f) => f.id)).toEqual(["yes"]);
  });

  it("dates the signature by the server's clock, not by what the signer sent", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer], {
      fields: [mine("sig", "signature", 0.7), mine("when", "date", 0.6), mine("who", "name", 0.55)],
    });
    const res = await sign(recipients[0].token, [
      { id: "sig", signatureUrl: PNG_DATA_URL },
      { id: "when", value: "01 Jan 2020" },
      { id: "who", value: "Somebody Else" },
    ]);
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((await reloadPdf(pdfId)).fields.map((f) => [f.id, f]));
    expect(byId.when.value).toBe(formatDate(new Date()));
    expect(byId.who.value).toBe("Asha Rao");
  });

  it("checks a number field and a dropdown choice", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [signer], {
      fields: [
        mine("sig", "signature", 0.7),
        mine("rent", "text", 0.3, { format: "number" }),
        mine("city", "dropdown", 0.4, { options: ["Pune", "Mumbai"] }),
      ],
    });
    const base = [{ id: "sig", signatureUrl: PNG_DATA_URL }];
    expect((await sign(recipients[0].token, [...base, { id: "rent", value: "eighteen" }, { id: "city", value: "Pune" }])).status).toBe(422);
    expect((await sign(recipients[0].token, [...base, { id: "rent", value: "18,500" }, { id: "city", value: "Delhi" }])).status).toBe(422);
    expect((await sign(recipients[0].token, [...base, { id: "rent", value: "18,500" }, { id: "city", value: "Pune" }])).status).toBe(200);
    expect((await reloadRecipient(recipients[0]._id)).status).toBe("signed");
  });

  it("keeps the sender's read-only words", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer], {
      fields: [mine("sig", "signature", 0.7), mine("address", "text", 0.3, { value: "Flat 302, Pune", readOnly: true })],
    });
    expect((await sign(recipients[0].token, [{ id: "sig", signatureUrl: PNG_DATA_URL }, { id: "address", value: "Somewhere else" }])).status).toBe(200);
    expect((await reloadPdf(pdfId)).fields.find((f) => f.id === "address").value).toBe("Flat 302, Pune");
  });

  it("shows each signer only their own fields", async () => {
    const sender = await createUser();
    const people = [signer, { name: "Ravi Rao", email: "ravi@example.test" }];
    const { recipients } = await sendDocument(sender, people, {
      fields: [mine("a", "signature", 0.7), { id: "b", type: "signature", ...at(0.8), recipientEmail: "ravi@example.test" }],
    });
    const session = await api().get(`/api/signing/${recipients[1].token}`);
    expect(session.body.data.document.fields.map((f) => f.id)).toEqual(["b"]);
  });
});

describe("sending refuses fields that would go astray", () => {
  const send = async (recipients, fields) => {
    const sender = await createUser();
    const doc = await uploadPdf(sender);
    return api().post(`/api/send/${doc.id}`).set(sender.auth).send({ recipients, fields });
  };

  it("a field that names nobody", async () => {
    const res = await send([signer], [{ id: "x", type: "signature", ...at(0.5), recipientEmail: "nobody@example.test" }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not assigned/);
  });

  it("a field for someone who only views", async () => {
    const res = await send([signer, { name: "Viewer", email: "viewer@example.test", role: "viewer" }], [
      { id: "x", type: "text", ...at(0.5), recipientEmail: "viewer@example.test" },
    ]);
    expect(res.status).toBe(400);
  });

  it("a field on a page the document does not have", async () => {
    const res = await send([signer], [{ id: "x", type: "signature", ...at(0.5), page: 4, recipientEmail: signer.email }]);
    expect(res.status).toBe(400);
  });

  it("keeps two recipients who share an address apart, by the editor's ids", async () => {
    const sender = await createUser();
    const doc = await uploadPdf(sender);
    const res = await api()
      .post(`/api/send/${doc.id}`)
      .set(sender.auth)
      .send({
        recipients: [
          { id: "one", name: "Asha Rao", email: "family@example.test" },
          { id: "two", name: "Ravi Rao", email: "family@example.test" },
        ],
        fields: [
          { id: "f1", type: "signature", ...at(0.5), recipientId: "one" },
          { id: "f2", type: "signature", ...at(0.7), recipientId: "two" },
        ],
      });
    expect(res.status).toBe(200);
    const stored = await reloadPdf(doc.id);
    const owners = new Set(stored.fields.map((f) => String(f.recipientId)));
    expect(owners.size).toBe(2);
  });
});
