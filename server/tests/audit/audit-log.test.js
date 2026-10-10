import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { api, createUser, sendDocument, signAs, uploadPdf, flushEvents, latestOtpFor } from "../helpers.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { verifyAuditChainIntegrity, appendAuditEvent } from "../../src/services/auditLedger.service.js";

const signer = { name: "Asha Rao", email: "asha@example.test" };

const completeOne = async () => {
  const sender = await createUser();
  const sent = await sendDocument(sender, [signer]);
  await api().get(`/api/signing/${sent.recipients[0].token}`);
  await signAs(sent.recipients[0].token, ["sig-1"]);
  await flushEvents();
  return { sender, ...sent };
};

// Audit finding H7: the audit trail was partial, unkeyed and deletable.
describe("H7 the audit log is complete, chained and append-only", () => {
  it("records every event in order, each with a position and a hash", async () => {
    const { pdfId } = await completeOne();

    const logs = await PdfAudit.find({ pdfId }).sort({ seq: 1 });
    expect(logs.map((l) => l.event)).toEqual(["created", "sent", "viewed", "signed", "sealed", "completed"]);
    expect(logs.map((l) => l.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(logs.every((l) => /^[a-f0-9]{64}$/.test(l.eventHash))).toBe(true);
    logs.slice(1).forEach((l, i) => expect(l.previousEventHash).toBe(logs[i].eventHash));

    expect(await verifyAuditChainIntegrity(pdfId)).toMatchObject({ isChainValid: true, logsCount: 6 });
  });

  it("writes one entry per signature, with the consent version and both file hashes", async () => {
    const { pdfId } = await completeOne();

    const signed = await PdfAudit.find({ pdfId, event: "signed" });
    expect(signed).toHaveLength(1);
    expect(signed[0].consentVersion).toBeTruthy();
    expect(signed[0].originalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signed[0].signedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signed[0].signedHash).not.toBe(signed[0].originalHash);
    // Signature images are not copied into the log
    expect(JSON.stringify(signed[0].fieldsMeta)).not.toContain("data:image");
  });

  it("records a passed identity check as its own entry", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [{ ...signer, authType: "otp" }]);
    const token = recipients[0].token;

    await api().post("/api/sign/otp/send").send({ token });
    await api().post("/api/sign/otp/verify").send({ token, otp: latestOtpFor(signer.email) });

    const entry = await PdfAudit.findOne({ pdfId, event: "identity_verified" });
    expect(entry.authMethod).toBe("email_otp");
    expect(entry.otpVerified).toBe(true);
  });

  it.each([
    ["a changed description", { description: "Nothing happened." }],
    ["a changed actor", { actorEmail: "someone.else@example.test" }],
    ["a changed time", { signedAt: new Date("2020-01-01T00:00:00Z") }],
    ["a changed file hash", { signedHash: "0".repeat(64) }],
    ["a changed IP address", { ipAddress: "203.0.113.9" }],
  ])("detects %s", async (_label, change) => {
    const { pdfId } = await completeOne();
    const target = await PdfAudit.findOne({ pdfId, event: "signed" });

    // Written straight to the database, as someone with database access would
    await PdfAudit.collection.updateOne({ _id: target._id }, { $set: change });

    const result = await verifyAuditChainIntegrity(pdfId);
    expect(result.isChainValid).toBe(false);
    expect(result.brokenAtSeq).toBe(target.seq);
  });

  it("detects a removed entry and an entry inserted without the key", async () => {
    const first = await completeOne();
    const viewed = await PdfAudit.findOne({ pdfId: first.pdfId, event: "viewed" });
    await PdfAudit.collection.deleteOne({ _id: viewed._id });
    expect((await verifyAuditChainIntegrity(first.pdfId)).isChainValid).toBe(false);

    const second = await completeOne();
    await PdfAudit.collection.insertOne({
      pdfId: new mongoose.Types.ObjectId(second.pdfId),
      event: "voided",
      description: "Forged entry",
      signedAt: new Date(),
    });
    expect((await verifyAuditChainIntegrity(second.pdfId)).isChainValid).toBe(false);
  });

  it("refuses updates and deletes through the application", async () => {
    const { pdfId } = await completeOne();

    await expect(PdfAudit.updateOne({ pdfId }, { description: "x" })).rejects.toThrow(/AUDIT_APPEND_ONLY/);
    await expect(PdfAudit.deleteMany({ pdfId })).rejects.toThrow(/AUDIT_APPEND_ONLY/);
    await expect(PdfAudit.findOneAndDelete({ pdfId })).rejects.toThrow(/AUDIT_APPEND_ONLY/);

    const entry = await PdfAudit.findOne({ pdfId });
    entry.description = "edited";
    await expect(entry.save()).rejects.toThrow(/AUDIT_APPEND_ONLY/);
  });

  it("keeps positions unique when many entries are written at once", async () => {
    const sender = await createUser();
    const doc = await uploadPdf(sender);

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        appendAuditEvent({ pdfId: doc.id, event: "downloaded", description: `Download ${i}` })
      )
    );

    const logs = await PdfAudit.find({ pdfId: doc.id }).sort({ seq: 1 });
    expect(logs.map((l) => l.seq)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect((await verifyAuditChainIntegrity(doc.id)).isChainValid).toBe(true);
  });
});

describe("H7 deleting a document keeps its audit log", () => {
  it("hides the document from its owner and stops its links, but keeps the record", async () => {
    const { sender, pdfId, recipients } = await completeOne();

    expect((await api().delete(`/api/pdf/${pdfId}`).set(sender.auth)).status).toBe(200);

    const list = await api().get("/api/pdf/my-documents").set(sender.auth);
    expect(list.body.data).toHaveLength(0);
    expect((await api().get(`/api/pdf/${pdfId}`).set(sender.auth)).status).toBe(404);
    expect((await api().get(`/api/signing/${recipients[0].token}`)).status).toBe(410);

    expect((await Pdf.findById(pdfId)).deletedAt).toBeInstanceOf(Date);
    const logs = await PdfAudit.find({ pdfId }).sort({ seq: 1 });
    expect(logs.at(-1).event).toBe("deleted");
    expect((await verifyAuditChainIntegrity(pdfId)).isChainValid).toBe(true);
  });

  it("refuses to delete a document that is still out for signature", async () => {
    const sender = await createUser();
    const { pdfId } = await sendDocument(sender, [signer]);
    expect((await api().delete(`/api/pdf/${pdfId}`).set(sender.auth)).status).toBe(409);
  });

  it("does not let another user delete or read the audit log", async () => {
    const { pdfId } = await completeOne();
    const stranger = await createUser();

    expect((await api().delete(`/api/pdf/${pdfId}`).set(stranger.auth)).status).toBe(403);
    expect((await api().get(`/api/pdf/${pdfId}/audit`).set(stranger.auth)).status).toBe(403);
    expect((await api().get(`/api/pdf/${pdfId}/audit-certificate`).set(stranger.auth)).status).toBe(403);
  });
});
