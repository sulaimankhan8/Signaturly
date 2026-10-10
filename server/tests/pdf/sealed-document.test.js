import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { api, createUser, sendDocument, signAs, flushEvents, reloadPdf, uploadPdf, makePdfBuffer } from "../helpers.js";
import { inspectSeal } from "../../src/services/pdfSeal.service.js";
import { readFile } from "../../src/services/storage.service.js";
import { originalKeyOf } from "../../src/services/documentFiles.service.js";
import { sha256FromBuffer } from "../../src/services/hash.service.js";
import { Template } from "../../src/models/Template.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";

const two = [
  { name: "First Signer", email: "first@example.test" },
  { name: "Second Signer", email: "second@example.test" },
];
const fields = [
  { id: "sig-1", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "first@example.test" },
  { id: "sig-2", type: "signature", page: 1, xPercent: 0.5, yPercent: 0.7, widthPercent: 0.2, heightPercent: 0.05, recipientEmail: "second@example.test" },
];

const complete = async () => {
  const sender = await createUser();
  const sent = await sendDocument(sender, two, { fields });
  await signAs(sent.recipients[0].token, ["sig-1"]);
  await signAs(sent.recipients[1].token, ["sig-2"]);
  await flushEvents();
  return { sender, ...sent, pdf: await reloadPdf(sent.pdfId) };
};

const download = async (url) => {
  const res = await api().get(url).buffer(true).parse((r, cb) => {
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  return res.body;
};

const verifyUpload = (buffer) =>
  api().post("/api/verify/document").attach("file", buffer, { filename: "check.pdf", contentType: "application/pdf" });

// Audit findings C7 and H9: no seal, and one signed file overwritten by every signer.
describe("C7 / H9 a completed document is versioned and sealed", () => {
  it("keeps the original, stores one version per signer, and seals the result", async () => {
    const { pdf } = await complete();

    expect(pdf.versions).toHaveLength(2);
    expect(pdf.versions[0].hash).not.toBe(pdf.versions[1].hash);
    expect(pdf.sealedKey).toMatch(/-sealed\.pdf$/);
    expect(pdf.sealedHash).toMatch(/^[a-f0-9]{64}$/);

    // The upload itself is untouched
    expect(sha256FromBuffer(await readFile(originalKeyOf(pdf)))).toBe(pdf.originalHash);

    const sealed = await readFile(pdf.sealedKey);
    expect(sha256FromBuffer(sealed)).toBe(pdf.sealedHash);
    expect(inspectSeal(sealed)).toMatchObject({ present: true, intact: true, issuedByThisService: true });

    // The signing record follows the document's own pages
    expect((await PDFDocument.load(sealed)).getPageCount()).toBeGreaterThan(pdf.pageCount);
  });

  it("gives signers and the owner the sealed copy once complete", async () => {
    const { sender, recipients, pdf } = await complete();

    const session = await api().get(`/api/signing/${recipients[0].token}`);
    expect(session.body.data.document.isSealed).toBe(true);
    expect(session.body.data.document.pdfUrl).toContain("-sealed.pdf");
    expect(sha256FromBuffer(await download(session.body.data.document.pdfUrl))).toBe(pdf.sealedHash);

    const list = await api().get("/api/pdf/my-documents").set(sender.auth);
    expect(list.body.data[0].signedUrl).toContain("-sealed.pdf");
    expect(list.body.data[0].isSealed).toBe(true);
  });

  it("shows the second signer the first signer's version, not the original", async () => {
    const sender = await createUser();
    const sent = await sendDocument(sender, two, { fields });
    await signAs(sent.recipients[0].token, ["sig-1"]);

    const pdf = await reloadPdf(sent.pdfId);
    const session = await api().get(`/api/signing/${sent.recipients[1].token}`);
    expect(sha256FromBuffer(await download(session.body.data.document.pdfUrl))).toBe(pdf.versions[0].hash);
    expect(pdf.sealedKey).toBeNull();
  });

  it("seals a document its owner signs alone", async () => {
    const owner = await createUser();
    const doc = await uploadPdf(owner);
    const res = await api()
      .post("/api/pdf/sign")
      .set(owner.auth)
      .send({ pdfId: doc.id, fields: [{ ...fields[0], signatureUrl: (await import("../helpers.js")).PNG_DATA_URL }] });

    expect(res.status).toBe(200);
    expect(inspectSeal(await download(res.body.data.signedPdfUrl))).toMatchObject({ intact: true, issuedByThisService: true });
  });
});

// Plan task P2-05: verification by upload checks the seal and the stored hash.
describe("verification by upload", () => {
  it("confirms the sealed copy", async () => {
    const { pdf } = await complete();
    const res = await verifyUpload(await readFile(pdf.sealedKey));

    expect(res.body.isAuthentic).toBe(true);
    expect(res.body.fileStatus).toBe("sealed_copy");
    expect(res.body.seal).toMatchObject({ present: true, intact: true, issuedByThisService: true });
    expect(res.body.chainIntegrity.isChainValid).toBe(true);
  });

  it("rejects an edited copy and says it was changed after sealing", async () => {
    const { pdf } = await complete();
    const edited = Buffer.from(await readFile(pdf.sealedKey));
    edited[edited.length - 40] ^= 0x01;

    const res = await verifyUpload(edited);
    expect(res.body.isAuthentic).toBe(false);
    expect(res.body.reason).toContain("MODIFIED_AFTER_SEALING");
  });

  it("is not fooled by a forged file that quotes a genuine hash", async () => {
    const { pdf } = await complete();
    const forged = Buffer.concat([await makePdfBuffer(), Buffer.from(`\n% ${pdf.sealedHash} ${pdf.originalHash}\n`)]);

    const res = await verifyUpload(forged);
    expect(res.body.isAuthentic).toBe(false);
  });

  it("recognises the original upload and says it is unsigned", async () => {
    const { pdf } = await complete();
    const res = await verifyUpload(await readFile(originalKeyOf(pdf)));
    expect(res.body.isAuthentic).toBe(true);
    expect(res.body.fileStatus).toBe("original_upload");
  });

  it("finds a document by the hash printed on its signing record", async () => {
    const { pdf } = await complete();
    const res = await api().post("/api/verify/document").send({ hash: pdf.versions.at(-1).hash });
    expect(res.body.isAuthentic).toBe(true);
    expect(res.body.fileStatus).toBe("final_signed_version");
    expect(res.body.isSealed).toBe(true);
  });
});

describe("signing record", () => {
  it("is generated for the owner from the full log", async () => {
    const { sender, pdfId } = await complete();
    const res = await api().get(`/api/pdf/${pdfId}/audit-certificate`).set(sender.auth).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect((await PDFDocument.load(res.body)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("does not fail on names in other scripts", async () => {
    const sender = await createUser();
    const sent = await sendDocument(sender, [{ name: "आशा राव", email: "asha@example.test" }]);
    const res = await signAs(sent.recipients[0].token, ["sig-1"]);

    expect(res.status).toBe(200);
    expect((await reloadPdf(sent.pdfId)).sealedKey).toBeTruthy();
  });
});

describe("templates", () => {
  it("cannot be created from another user's document", async () => {
    const owner = await createUser();
    const attacker = await createUser();
    await api().get("/api/billing/subscription").set(attacker.auth);
    await Subscription.updateOne({ userId: attacker.id }, { plan: "pro_monthly", status: "active" });
    const doc = await uploadPdf(owner);

    const res = await api()
      .post("/api/templates")
      .set(attacker.auth)
      .send({ name: "Stolen", sourcePdfId: doc.id, roles: [], fields: [] });

    expect(res.status).toBe(404);
    expect(await Template.countDocuments({ userId: attacker.id })).toBe(0);
  });
});
