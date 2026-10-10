import { describe, it, expect } from "vitest";
import { api, createUser, uploadPdf, sendDocument, signatureField, PNG_DATA_URL, signAs, reloadRecipient } from "../helpers.js";

const selfSign = (account, pdfId, fields) =>
  api().post("/api/pdf/sign").set(account.auth).send({ pdfId, fields });

const field = (signatureUrl) => ({ ...signatureField("f1", "x@example.test"), signatureUrl, value: signatureUrl });

// Audit finding C6: self-sign accepted any document id.
describe("C6 only the owner can sign their own unsent document", () => {
  it("refuses another user's document", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const doc = await uploadPdf(owner);

    const res = await selfSign(attacker, doc.id, [field(PNG_DATA_URL)]);
    expect(res.status).toBe(403);
  });

  it("lets the owner sign a draft and returns an expiring link", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);

    const res = await selfSign(owner, doc.id, [field(PNG_DATA_URL)]);
    expect(res.status).toBe(200);
    expect(res.body.data.signedPdfUrl).toMatch(/-sealed\.pdf\?exp=\d+&sig=/);
    expect((await api().get(res.body.data.signedPdfUrl)).status).toBe(200);
  });

  it("refuses to alter a document that is out for signature or completed", async () => {
    const owner = await createUser();
    const { pdfId, recipients } = await sendDocument(owner, [{ name: "Signer", email: "s@example.test" }]);

    expect((await selfSign(owner, pdfId, [field(PNG_DATA_URL)])).status).toBe(409);

    await signAs(recipients[0].token, ["sig-1"]);
    expect((await selfSign(owner, pdfId, [field(PNG_DATA_URL)])).status).toBe(409);
  });

  it("rejects malformed document ids", async () => {
    const owner = await createUser();
    expect((await selfSign(owner, "not-an-id", [])).status).toBe(400);
  });
});

// Audit finding H4: the server fetched any URL, or read any path, given as a signature image.
describe("H4 signature images come only from the request itself", () => {
  it.each([
    ["a remote address", "http://169.254.169.254/latest/meta-data/"],
    ["an https address", "https://example.test/signature.png"],
    ["a local file path", "/etc/passwd"],
    ["a relative path", "../.env"],
    ["a non-image data URL", "data:text/html;base64,PGgxPmhpPC9oMT4="],
  ])("rejects %s", async (_label, source) => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);

    const res = await selfSign(owner, doc.id, [field(source)]);
    expect(res.status).toBe(422);
  });

  it("rejects bytes that are not a real PNG or JPEG", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);
    const fake = `data:image/png;base64,${Buffer.from("this is not an image").toString("base64")}`;

    expect((await selfSign(owner, doc.id, [field(fake)])).status).toBe(422);
  });

  it("leaves a public signer unsigned when their image is rejected", async () => {
    const owner = await createUser();
    const { recipients } = await sendDocument(owner, [{ name: "Signer", email: "s@example.test" }]);

    const res = await api()
      .post(`/api/signing/${recipients[0].token}/sign`)
      .send({ consent: true, fields: [{ id: "sig-1", signatureUrl: "http://attacker.test/x.png" }] });

    expect(res.status).toBe(422);
    expect((await reloadRecipient(recipients[0]._id)).status).not.toBe("signed");
  });

  it("refuses a stored image from someone else's folder", async () => {
    const owner = await createUser();
    const other = await createUser();
    const doc = await uploadPdf(owner);

    const res = await selfSign(owner, doc.id, [field(`/uploads/${other.id}/whatever.png`)]);
    expect(res.status).toBe(422);
  });
});
