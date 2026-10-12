import { describe, it, expect } from "vitest";
import { api, createUser, PASSWORD, sendDocument, signAs, uploadPdf, flushEvents } from "../helpers.js";
import { User } from "../../src/models/User.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { fileExists } from "../../src/services/storage.service.js";
import { originalKeyOf } from "../../src/services/documentFiles.service.js";
import { verifyAuditChainIntegrity } from "../../src/services/auditLedger.service.js";
import { env } from "../../src/config/env.js";

const signer = { name: "Asha Rao", email: "asha@example.test" };

// Audit finding M10: no way to export or delete an account.
describe("M10 account export", () => {
  it("returns the account's own data and nothing about anyone else's", async () => {
    const me = await createUser();
    const other = await createUser();
    const mine = await sendDocument(me, [signer]);
    await uploadPdf(other, { filename: "theirs.pdf" });

    const res = await api().get("/api/user/export").set(me.auth);
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.profile.email).toBe(me.email);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].id).toBe(mine.pdfId);
    expect(data.documents[0].recipients[0]).toMatchObject({ name: "Asha Rao", email: "asha@example.test" });

    const text = JSON.stringify(data);
    expect(text).not.toContain(other.email);
    expect(text).not.toContain("theirs.pdf");
    // No secrets or signing links
    expect(text).not.toMatch(/password|refreshToken|token"/i);
    expect(text).not.toContain(mine.recipients[0].token);
  });

  it("requires a login", async () => {
    expect((await api().get("/api/user/export")).status).toBe(401);
  });
});

describe("M10 account deletion", () => {
  it("needs the right password", async () => {
    const me = await createUser();
    const res = await api().post("/api/user/delete-account").set(me.auth).send({ password: "not-my-password" });
    expect(res.status).toBe(401);
    expect((await User.findById(me.id)).deletedAt).toBeNull();
  });

  it("is refused while a document is still out for signature", async () => {
    const me = await createUser();
    await sendDocument(me, [signer]);
    const res = await api().post("/api/user/delete-account").set(me.auth).send({ password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it("anonymises the profile, ends every session and keeps the audit logs", async () => {
    const me = await createUser();
    const draft = await uploadPdf(me, { filename: "draft.pdf" });
    const done = await sendDocument(me, [signer]);
    await signAs(done.recipients[0].token, ["sig-1"]);
    await flushEvents();

    const draftPdf = await Pdf.findById(draft.id);
    const donePdf = await Pdf.findById(done.pdfId);

    const res = await api().post("/api/user/delete-account").set(me.auth).send({ password: PASSWORD });
    expect(res.status).toBe(200);

    const stored = await User.findById(me.id).select("+refreshTokenHash");
    expect(stored.name).toBe("Deleted user");
    expect(stored.email).not.toBe(me.email);
    expect(stored.deletedAt).toBeInstanceOf(Date);
    expect(stored.refreshTokenHash).toBeUndefined();

    // The old token, the old password and the old refresh cookie all stop working
    expect((await api().get("/api/pdf/my-documents").set(me.auth)).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: me.email, password: PASSWORD })).status).toBe(401);
    const cookie = me.cookies.find((c) => c.startsWith("refreshToken=")).split(";")[0];
    expect((await api().post("/api/auth/refresh-token").set("Cookie", cookie)).status).toBe(401);

    // A file nobody else was party to is erased; a completed agreement is retained
    expect(await fileExists(originalKeyOf(draftPdf))).toBe(false);
    expect(await fileExists(donePdf.sealedKey)).toBe(true);

    // Signing links stop, audit logs stay and still verify
    expect((await api().get(`/api/signing/${done.recipients[0].token}`)).status).toBe(410);
    expect(await PdfAudit.countDocuments({ pdfId: done.pdfId })).toBeGreaterThan(5);
    expect((await verifyAuditChainIntegrity(done.pdfId)).isChainValid).toBe(true);
    expect((await PdfAudit.findOne({ pdfId: draft.id, event: "deleted" })).description).toContain("erased");
  });

  it("frees the email address for a new account", async () => {
    const me = await createUser({ email: "reuse@example.test" });
    await api().post("/api/user/delete-account").set(me.auth).send({ password: PASSWORD });

    const again = await api().post("/api/auth/register").send({ name: "New", email: "reuse@example.test", password: PASSWORD });
    expect(again.status).toBe(201);
  });
});

// Plan task P2-17: admin plan changes record who made them.
describe("admin plan grants", () => {
  it("records which admin granted a plan", async () => {
    const admin = await createUser({ role: "superadmin" });
    const user = await createUser();
    const login = await api().post("/api/admin/login").send({ email: admin.email, password: PASSWORD, adminSecret: env.adminSecret });

    const res = await api()
      .patch(`/api/admin/users/${user.id}/plan`)
      .set("Authorization", `Bearer ${login.body.adminToken}`)
      .send({ plan: "pro_annual", reason: "Agreed with the customer" });
    expect(res.status).toBe(200);

    const sub = await Subscription.findOne({ userId: user.id });
    expect(sub.plan).toBe("pro_annual");
    expect(sub.adminGrants).toHaveLength(1);
    expect(String(sub.adminGrants[0].adminId)).toBe(admin.id);
    expect(sub.adminGrants[0].plan).toBe("pro_annual");
  });
});
