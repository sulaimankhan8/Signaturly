import { describe, it, expect } from "vitest";
import {
  api,
  createUser,
  sendDocument,
  signAs,
  makePdfBuffer,
  uploadPdf,
  reloadRecipient,
  flushEvents,
} from "../helpers.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Template } from "../../src/models/Template.model.js";
import { env } from "../../src/config/env.js";
import { saveFile } from "../../src/services/storage.service.js";
import { processAutomatedReminders } from "../../src/services/reminder.service.js";
import { emailOutbox } from "../../src/config/email.js";

// New finding: request values went straight into database lookups.
describe("request input is validated before it reaches the database", () => {
  it("rejects an operator object in place of a signing token", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [{ name: "Otp", email: "otp@example.test", authType: "otp" }]);

    for (const path of ["/api/sign/otp/send", "/api/sign/otp/verify", "/api/sign/otp/verify-passcode"]) {
      const res = await api().post(path).send({ token: { $ne: null }, otp: "123456", passcode: "x" });
      expect(res.status, path).toBe(400);
    }
    expect((await reloadRecipient(recipients[0]._id)).authVerified).toBe(false);
  });

  it("rejects operator keys anywhere in a request body", async () => {
    const res = await api().post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).toBe(400);

    const nested = await api().post("/api/auth/forgot-password").send({ email: "a@example.test", extra: { deep: { $where: "1" } } });
    expect(nested.status).toBe(400);
  });

  it("rejects malformed signing tokens in the URL", async () => {
    expect((await api().get("/api/signing/short")).status).toBe(400);
    expect((await api().get(`/api/signing/${"a".repeat(64)}`)).status).toBe(404);
  });
});

// Audit finding H6: the public verification page leaked signer details and the file.
describe("H6 public verification reveals only what it must", () => {
  it("confirms a known document without emails, IP addresses or a download link", async () => {
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [{ name: "Asha Rao", email: "asha.rao@example.test" }]);
    await signAs(recipients[0].token, ["sig-1"]);
    await flushEvents();

    const pdf = await Pdf.findById(pdfId);
    const res = await api().post("/api/verify/document").send({ hash: pdf.originalHash });

    expect(res.status).toBe(200);
    expect(res.body.isAuthentic).toBe(true);
    expect(res.body.signedDocUrl).toBeNull();
    expect(res.body.documentId).toBeUndefined();

    const text = JSON.stringify(res.body);
    expect(text).not.toContain("asha.rao@example.test");
    expect(text).not.toContain(sender.email);
    expect(text).not.toContain("/uploads/");
    expect(text).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    expect(text).not.toContain("::ffff");
    expect(res.body.signers[0].name).toBe("Asha R.");
    expect(res.body.signers[0].authMethod).toBe("Email link");
  });

  it("does not look documents up by database id", async () => {
    const sender = await createUser();
    const doc = await uploadPdf(sender);

    const res = await api().post("/api/verify/document").send({ hash: doc.id });
    expect(res.status).toBe(400);
  });

  it("reports an unknown hash as not found", async () => {
    const res = await api().post("/api/verify/document").send({ hash: "f".repeat(64) });
    expect(res.body.isAuthentic).toBe(false);
  });
});

// Audit finding H3: nothing was rate limited.
describe("H3 rate limits", () => {
  it("slows repeated sign-in attempts", async () => {
    const account = await createUser();
    env.rateLimitDisabled = false;

    let last;
    for (let i = 0; i < 11; i++) {
      last = await api().post("/api/auth/login").send({ email: account.email, password: "wrong-password-x" });
    }
    expect(last.status).toBe(429);
  });

  it("slows repeated password-reset requests", async () => {
    env.rateLimitDisabled = false;
    let last;
    for (let i = 0; i < 6; i++) {
      last = await api().post("/api/auth/forgot-password").send({ email: "x@example.test" });
    }
    expect(last.status).toBe(429);
  });
});

// Audit finding M2: no upload limits.
describe("M2 uploads are checked", () => {
  it("rejects a file that only claims to be a PDF", async () => {
    const account = await createUser();
    const res = await api()
      .post("/api/pdf/upload")
      .set(account.auth)
      .attach("pdf", Buffer.from("<html>not a pdf</html>"), { filename: "fake.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(422);
  });

  it("rejects files over 25 MB", async () => {
    const account = await createUser();
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(26 * 1024 * 1024)]);
    const res = await api()
      .post("/api/pdf/upload")
      .set(account.auth)
      .attach("pdf", big, { filename: "big.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(413);
  });

  it("rejects oversized JSON bodies", async () => {
    const res = await api().post("/api/auth/login").send({ email: "a@example.test", password: "x".repeat(3 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it("keeps awkward file names inside the owner's folder", async () => {
    const account = await createUser();
    const doc = await uploadPdf(account, { filename: "../../etc/evil name.pdf" });
    const pdf = await Pdf.findById(doc.id);
    expect(pdf.storagePath.replace(/\\/g, "/")).toContain(`/${account.id}/`);
    expect(pdf.storagePath).not.toContain("..");
  });
});

// Audit finding M3: quota was counted after sending and not atomically.
describe("M3 plan limits hold under parallel sends", () => {
  it("allows exactly the remaining number of documents", async () => {
    const account = await createUser();
    await api().get("/api/billing/subscription").set(account.auth);
    await Subscription.updateOne({ userId: account.id }, { usedThisMonth: 12, monthlyQuota: 15 });

    const docs = await Promise.all(Array.from({ length: 6 }, () => uploadPdf(account)));
    const results = await Promise.all(
      docs.map((d) =>
        api()
          .post(`/api/send/${d.id}`)
          .set(account.auth)
          .send({ recipients: [{ name: "S", email: "s@example.test" }], fields: [] })
      )
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 403)).toHaveLength(3);
    expect((await Subscription.findOne({ userId: account.id })).usedThisMonth).toBe(15);
  });

  it("does not charge for a send that fails", async () => {
    const account = await createUser();
    const doc = await uploadPdf(account);
    const res = await api().post(`/api/send/${doc.id}`).set(account.auth).send({ recipients: [], fields: [] });
    expect(res.status).toBe(400);
    expect((await Subscription.findOne({ userId: account.id })).usedThisMonth).toBe(0);
  });

  it("counts bulk sends and keeps signing links out of the response", async () => {
    const account = await createUser();
    await api().get("/api/billing/subscription").set(account.auth);
    await Subscription.updateOne({ userId: account.id }, { plan: "pro_monthly", status: "active", usedThisMonth: 0 });

    const key = `templates/${account.id}/bulk.pdf`;
    const path = await saveFile(key, await makePdfBuffer());
    const template = await Template.create({
      userId: account.id,
      name: "Bulk",
      sourcePdfPath: path,
      originalFileName: "bulk.pdf",
      pageCount: 1,
      roles: [{ id: "role-1", name: "signer" }],
      fields: [{ id: "f1", roleId: "role-1", roleName: "signer", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.8, widthPercent: 0.2, heightPercent: 0.05 }],
    });

    const res = await api()
      .post("/api/bulk/send")
      .set(account.auth)
      .send({ templateId: template._id.toString(), recipients: [{ name: "A", email: "a@example.test" }, { name: "B", email: "b@example.test" }, { name: "Bad", email: "not-an-email" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.totalDispatched).toBe(2);
    expect(JSON.stringify(res.body)).not.toContain("/sign/");
    expect((await Subscription.findOne({ userId: account.id })).usedThisMonth).toBe(2);

    const stored = await Recipient.find({ email: "a@example.test" });
    expect(stored[0].tokenExpiresAt).toBeInstanceOf(Date);
  });
});

// Audit finding M5: reminder bookkeeping was dropped by the schema.
describe("M5 reminders are sent once per window", () => {
  it("does not remind the same signer twice in a row", async () => {
    const sender = await createUser();
    const { recipients } = await sendDocument(sender, [{ name: "Slow", email: "slow@example.test" }]);
    // Reminders start two days after sending
    await Recipient.collection.updateOne({ _id: recipients[0]._id }, { $set: { createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } });
    emailOutbox.length = 0;

    await processAutomatedReminders();
    await flushEvents();
    await processAutomatedReminders();
    await flushEvents();

    expect(emailOutbox.filter((m) => m.to === "slow@example.test" && /Reminder/.test(m.subject))).toHaveLength(1);
    const stored = await reloadRecipient(recipients[0]._id);
    expect(stored.reminderCount).toBe(1);
    expect(stored.lastRemindedAt).toBeInstanceOf(Date);
  });
});

// Audit finding M8: the health check needed a login.
describe("M8 health check", () => {
  it("answers without a token", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
