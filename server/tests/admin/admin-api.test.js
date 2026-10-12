import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";
import { api, createUser, PASSWORD, sendDocument, signAs, flushEvents } from "../helpers.js";
import { User } from "../../src/models/User.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { Job } from "../../src/models/Job.model.js";
import { AdminAction } from "../../src/models/AdminAction.model.js";
import { registerJobHandler } from "../../src/jobs/queue.js";
import { issueInvoiceForPayment } from "../../src/services/invoice.service.js";
import { codeAt } from "../../src/services/twoFactor.service.js";
import { indiaDay, indiaDayStart } from "../../src/services/admin.service.js";
import { env } from "../../src/config/env.js";

// The admin app's API (plan tasks AD-01 to AD-12 and AD-28 to AD-31).

const DAY = 24 * 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();

const adminLogin = (email, extra = {}) => api().post("/api/admin/login").send({ email, password: PASSWORD, adminSecret: env.adminSecret, ...extra });

const asAdmin = async () => {
  const admin = await createUser({ role: "superadmin" });
  const login = await adminLogin(admin.email);
  if (login.status !== 200) throw new Error(`admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
  const headers = { Authorization: `Bearer ${login.body.adminToken}` };
  return {
    ...admin,
    get: (url) => api().get(`/api/admin${url}`).set(headers),
    post: (url, body = {}) => api().post(`/api/admin${url}`).set(headers).send(body),
    patch: (url, body = {}) => api().patch(`/api/admin${url}`).set(headers).send(body),
  };
};

// Many accounts at once, without the cost of hashing a password for each
const people = (count, extra = () => ({})) =>
  User.insertMany(Array.from({ length: count }, (_, i) => ({ name: `Person ${String(i).padStart(2, "0")}`, email: `person${String(i).padStart(2, "0")}@example.test`, password: "not-used", ...extra(i) })));

const payment = (userId, extra = {}) =>
  Payment.create({ userId, provider: "razorpay", providerPaymentId: `pay_${crypto.randomBytes(6).toString("hex")}`, kind: "purchase", plan: "pro_monthly", amount: 299, currency: "INR", ...extra });

const before = { require2fa: env.adminRequire2fa, hook: env.clientDeployHookUrl };
afterEach(() => {
  env.adminRequire2fa = before.require2fa;
  env.clientDeployHookUrl = before.hook;
  vi.unstubAllGlobals();
});

describe("AD-03 the list of users", () => {
  it("is paged, so an account beyond the first page can be reached", async () => {
    const admin = await asAdmin();
    await people(30);

    const res = await admin.get("/users?pageSize=10&page=3&sort=email&order=asc");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 30, page: 3, pageSize: 10 });
    expect(res.body.data.items.map((u) => u.email)).toEqual(Array.from({ length: 10 }, (_, i) => `person${20 + i}@example.test`));
  });

  it("leaves admins out and creates nothing by being read", async () => {
    const admin = await asAdmin();
    await people(3);

    const res = await admin.get("/users");
    expect(res.body.data.items.map((u) => u.email)).not.toContain(admin.email);
    expect(res.body.data.items.every((u) => u.plan === "free" && u.monthlyQuota === 5)).toBe(true);
    expect(await Subscription.countDocuments()).toBe(0);
  });

  it("treats search text as text, not as a pattern", async () => {
    const admin = await asAdmin();
    await people(3);
    await User.create({ name: "A.B (Traders)", email: "ab@example.test", password: PASSWORD });

    const literal = await admin.get(`/users?search=${encodeURIComponent("a.b (")}`);
    expect(literal.status).toBe(200);
    expect(literal.body.data.items.map((u) => u.email)).toEqual(["ab@example.test"]);

    const pattern = await admin.get(`/users?search=${encodeURIComponent(".*")}`);
    expect(pattern.status).toBe(200);
    expect(pattern.body.data.total).toBe(0);
  });

  it("filters by plan across every account, not only the newest", async () => {
    const admin = await asAdmin();
    const users = await people(30);
    await admin.patch(`/users/${users[0]._id}/plan`, { plan: "pro_monthly", reason: "Trial for a pilot customer" });

    const pro = await admin.get("/users?plan=pro_monthly");
    expect(pro.body.data.items.map((u) => u.email)).toEqual(["person00@example.test"]);
    expect((await admin.get("/users?plan=free&pageSize=5")).body.data.total).toBe(29);
  });

  it("marks closed and suspended accounts", async () => {
    const admin = await asAdmin();
    const users = await people(3);
    await User.updateOne({ _id: users[0]._id }, { deletedAt: new Date() });
    await User.updateOne({ _id: users[1]._id }, { suspendedAt: new Date() });

    const all = (await admin.get("/users?sort=email&order=asc")).body.data.items;
    expect(all.map((u) => u.state)).toEqual(["closed", "suspended", "active"]);
    expect((await admin.get("/users?status=closed")).body.data.total).toBe(1);
    expect((await admin.get("/users?status=active")).body.data.total).toBe(1);
  });
});

describe("AD-02 admin inputs are checked", () => {
  it("answers 400, never 500, to a malformed id or page", async () => {
    const admin = await asAdmin();
    for (const url of ["/users/not-an-id", "/documents/123", "/invoices/x/pdf", "/users?page=0", "/users?plan=gold", "/audit-logs?from=yesterday", "/documents?owner=me"]) {
      expect((await admin.get(url)).status, url).toBe(400);
    }
    expect((await admin.post("/jobs/nope/retry")).status).toBe(400);
    expect((await admin.patch(`/users/${oid()}/plan`, { plan: "gold", reason: "testing" })).status).toBe(400);
  });

  it("answers 404 for an id that names nothing", async () => {
    const admin = await asAdmin();
    for (const url of [`/users/${oid()}`, `/documents/${oid()}`, `/documents/${oid()}/bsa-certificate`, `/invoices/${oid()}/pdf`]) {
      expect((await admin.get(url)).status, url).toBe(404);
    }
  });
});

describe("AD-05 granting a plan", () => {
  const reason = "Agreed with the customer by email";

  it("gives the plan's own allowance and ends when the days run out", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.get(`/users/${user.id}`);
    const resetBefore = (await Subscription.findOne({ userId: user.id }))?.quotaResetDate;

    const res = await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly", days: 90, reason });
    expect(res.status).toBe(200);

    const sub = await Subscription.findOne({ userId: user.id });
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", monthlyQuota: 50, complimentary: true });
    expect(Math.round((sub.currentPeriodEnd - Date.now()) / DAY)).toBe(90);
    // The date the monthly count starts again is not what "days" means
    if (resetBefore) expect(sub.quotaResetDate).toEqual(resetBefore);
    expect(Math.round((sub.quotaResetDate - Date.now()) / DAY)).toBeLessThanOrEqual(31);
  });

  it("uses the plan's own period when no days are given", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.patch(`/users/${user.id}/plan`, { plan: "pro_annual", reason });
    const sub = await Subscription.findOne({ userId: user.id });
    expect(Math.round((sub.currentPeriodEnd - Date.now()) / DAY)).toBe(365);
  });

  it("changes the allowance only when a custom one is sent", async () => {
    const admin = await asAdmin();
    const user = await createUser();

    await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly", customQuota: 500, reason });
    expect((await Subscription.findOne({ userId: user.id })).monthlyQuota).toBe(500);

    await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly", reason });
    expect((await Subscription.findOne({ userId: user.id })).monthlyQuota).toBe(50);
  });

  it("takes seats for the plan sold by the seat, and pools their documents", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.patch(`/users/${user.id}/plan`, { plan: "business_monthly", seats: 3, reason });
    expect(await Subscription.findOne({ userId: user.id })).toMatchObject({ plan: "business_monthly", seats: 3, monthlyQuota: 300 });
  });

  it("refuses a change with no reason", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    const res = await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/why/i);
    expect(await Subscription.countDocuments({ plan: "pro_monthly" })).toBe(0);
  });

  it("does not make a subscription for an account that does not exist", async () => {
    const admin = await asAdmin();
    expect((await admin.patch(`/users/${oid()}/plan`, { plan: "pro_monthly", reason })).status).toBe(404);
    expect(await Subscription.countDocuments()).toBe(0);
  });

  it("is recorded with the admin and the reason, and shown on the account", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly", days: 30, reason });

    const line = await AdminAction.findOne({ action: "user.plan_granted" });
    expect(line).toMatchObject({ adminEmail: admin.email, targetType: "user", targetId: user.id });
    expect(line.summary).toContain(user.email);
    expect(line.summary).toContain("from Free to Pro");
    expect(line.summary).toContain(reason);

    const details = (await admin.get(`/users/${user.id}`)).body.data;
    expect(details.subscription).toMatchObject({ plan: "pro_monthly", monthlyQuota: 50, complimentary: true });
    expect(details.grants[0]).toMatchObject({ plan: "pro_monthly", adminEmail: admin.email, reason, quota: 50 });
  });
});

describe("AD-08 the overview's figures", () => {
  it("come from the payments ledger and the subscriptions as they are", async () => {
    const admin = await asAdmin();
    const [paying, team, gifted, free] = await people(4);

    await Subscription.create({ userId: paying._id, plan: "pro_monthly", status: "active", monthlyQuota: 50 });
    await Subscription.create({ userId: team._id, plan: "business_monthly", status: "active", seats: 4, monthlyQuota: 400 });
    await Subscription.create({ userId: gifted._id, plan: "pro_monthly", status: "active", monthlyQuota: 50, complimentary: true });
    await Subscription.create({ userId: free._id, plan: "free", status: "free" });
    // An admin's own plan is not business
    await Subscription.create({ userId: admin.id, plan: "enterprise", status: "active" });

    const now = new Date();
    const monthStart = indiaDayStart(`${indiaDay(now).slice(0, 7)}-01`);
    await payment(paying._id, { occurredAt: now });
    await payment(team._id, { kind: "topup", plan: null, item: "docs_10", amount: 79, occurredAt: now });
    await payment(paying._id, { kind: "failed", amount: 299, occurredAt: now });
    await payment(team._id, { plan: "pro_annual", amount: 2990, occurredAt: new Date(monthStart.getTime() - DAY) });

    const { data } = (await admin.get("/overview?range=7d")).body;

    expect(data.accounts).toMatchObject({ total: 4, onPaidPlan: 3, free: 1 });
    expect(data.money).toMatchObject({ currency: "INR", receivedThisMonth: 378, receivedLastMonth: 2990, failedPayments30d: 1 });
    expect(data.money.byKind).toMatchObject({ purchase: { amount: 299, payments: 1 }, topup: { amount: 79, payments: 1 } });
    // Pro at 299, four Business seats at 499 each; the plan given by an admin earns nothing
    expect(data.money.mrrEstimate).toBe(299 + 4 * 499);

    const row = (plan) => data.plans.find((p) => p.plan === plan);
    expect(row("pro_monthly")).toMatchObject({ accounts: 2, complimentary: 1, monthlyValue: 299 });
    expect(row("business_monthly")).toMatchObject({ accounts: 1, seats: 4, monthlyValue: 1996 });
    expect(row("enterprise")).toMatchObject({ accounts: 0 });
    expect(data.days).toHaveLength(7);
    expect(data.days.at(-1)).toMatchObject({ day: indiaDay(now), received: 378 });
  });

  it("puts each event on the day it happened in India", async () => {
    const admin = await asAdmin();
    const owner = (await people(1))[0];

    // Three days ago in India: one agreement completed at 23:45, the next at 00:15 the day after.
    // In UTC both fall on the same date.
    const day = indiaDay(new Date(Date.now() - 3 * DAY));
    const nextDay = indiaDay(new Date(indiaDayStart(day).getTime() + DAY));
    const lateEvening = new Date(indiaDayStart(day).getTime() + (23 * 60 + 45) * 60 * 1000);
    const afterMidnight = new Date(lateEvening.getTime() + 30 * 60 * 1000);
    expect(lateEvening.toISOString().slice(0, 10)).toBe(afterMidnight.toISOString().slice(0, 10));

    const document = async (at, extra = {}) => {
      const _id = oid();
      await Pdf.collection.insertOne({ _id, userId: owner._id, originalFileName: "a.pdf", status: "signed", createdAt: at, updatedAt: at, deletedAt: null, ...extra });
      await PdfAudit.collection.insertOne({ pdfId: _id, event: "completed", createdAt: at, updatedAt: at });
    };
    await document(lateEvening);
    await document(afterMidnight);
    // Made with a test API key: not counted
    await document(afterMidnight, { testMode: true });

    const { data } = (await admin.get("/overview?range=7d")).body;
    const on = (d) => data.days.find((entry) => entry.day === d);
    expect(on(day)).toMatchObject({ documentsCompleted: 1, documentsCreated: 1 });
    expect(on(nextDay)).toMatchObject({ documentsCompleted: 1, documentsCreated: 1 });
    expect(data.documents).toMatchObject({ total: 2, byStatus: { signed: 2 } });
  });
});

describe("AD-06 documents: details, never contents", () => {
  const signer = { name: "Asha Rao", email: "asha@example.test" };

  it("lists and opens a document without saying where its file is kept or handing out a signing link", async () => {
    const admin = await asAdmin();
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer]);
    const stored = await Pdf.findById(pdfId);

    const list = await admin.get(`/documents?search=${encodeURIComponent("agreement")}`);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0]).toMatchObject({ name: "agreement.pdf", status: "pending", signers: 1, owner: { email: sender.email } });

    const details = await admin.get(`/documents/${pdfId}`);
    expect(details.status).toBe(200);
    expect(details.body.data.recipients[0]).toMatchObject({ name: signer.name, email: signer.email, status: "sent" });
    expect(details.body.data.trail.map((entry) => entry.event)).toEqual(expect.arrayContaining(["created", "sent"]));

    for (const body of [list.body, details.body, (await admin.get(`/users/${sender.id}`)).body]) {
      const text = JSON.stringify(body);
      expect(text).not.toContain(stored.storagePath);
      expect(text).not.toContain("storagePath");
      expect(text).not.toContain(recipients[0].token);
    }
  });

  it("finds a document by its owner and by status", async () => {
    const admin = await asAdmin();
    const sender = await createUser();
    await sendDocument(sender, [signer]);

    expect((await admin.get(`/documents?search=${encodeURIComponent(sender.email)}`)).body.data.total).toBe(1);
    expect((await admin.get(`/documents?owner=${sender.id}&status=pending`)).body.data.total).toBe(1);
    expect((await admin.get("/documents?status=signed")).body.data.total).toBe(0);
  });

  it("reports the audit chain as it really is", async () => {
    const admin = await asAdmin();
    const sender = await createUser();
    const { pdfId, recipients } = await sendDocument(sender, [signer]);
    expect((await signAs(recipients[0].token, ["sig-1"])).status).toBe(200);
    await flushEvents();

    const intact = (await admin.get(`/documents/${pdfId}`)).body.data.chain;
    expect(intact.intact).toBe(true);
    expect(intact.entries).toBeGreaterThan(2);

    // Someone edits a line directly in the database
    const second = await PdfAudit.findOne({ pdfId, seq: 2 });
    await PdfAudit.collection.updateOne({ _id: second._id }, { $set: { actorName: "Somebody Else" } });

    const broken = (await admin.get(`/documents/${pdfId}`)).body.data.chain;
    expect(broken).toMatchObject({ intact: false, brokenAtSeq: 2 });
    expect(broken.reason).toMatch(/altered/);
  });

  it("gives the evidence certificate as a PDF and records that it was taken", async () => {
    const admin = await asAdmin();
    const sender = await createUser();
    const { pdfId } = await sendDocument(sender, [signer]);

    const res = await admin.get(`/documents/${pdfId}/bsa-certificate`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(await AdminAction.findOne({ action: "document.certificate_downloaded" })).toMatchObject({ targetId: pdfId, adminEmail: admin.email });
  });
});

describe("AD-07 the audit log", () => {
  it("names each event, is paged, and can be narrowed", async () => {
    const admin = await asAdmin();
    const sender = await createUser();
    const { pdfId } = await sendDocument(sender, [{ name: "Asha Rao", email: "asha@example.test" }]);
    await sendDocument(sender, [{ name: "Vikram Shah", email: "vikram@example.test" }]);

    const all = (await admin.get("/audit-logs?pageSize=2")).body.data;
    expect(all.total).toBeGreaterThanOrEqual(4);
    expect(all.items).toHaveLength(2);
    expect(all.items[0].document).toMatchObject({ name: "agreement.pdf" });

    const sent = (await admin.get("/audit-logs?event=sent")).body.data;
    expect(sent.total).toBe(2);
    expect(sent.items.every((entry) => entry.event === "sent")).toBe(true);

    const one = (await admin.get(`/audit-logs?document=${pdfId}`)).body.data;
    expect(one.items.every((entry) => String(entry.document.id) === pdfId)).toBe(true);

    const today = indiaDay(new Date());
    expect((await admin.get(`/audit-logs?from=${today}&to=${today}`)).body.data.total).toBe(all.total);
    expect((await admin.get("/audit-logs?to=2020-01-01")).body.data.total).toBe(0);
  });
});

describe("AD-12 signing in to the admin app", () => {
  const stepNow = () => Math.floor(Date.now() / 1000 / 30);

  const switchOnTwoStep = async (account) => {
    const begun = await api().post("/api/auth/2fa/begin").set(account.auth);
    const secret = begun.body.data.secret;
    const confirmed = await api().post("/api/auth/2fa/confirm").set(account.auth).send({ code: codeAt(secret, stepNow()) });
    if (confirmed.status !== 200) throw new Error(`could not confirm: ${JSON.stringify(confirmed.body)}`);
    return secret;
  };

  it("asks for the code when the account has two-step sign-in, and refuses a wrong one", async () => {
    const admin = await createUser({ role: "superadmin" });
    const secret = await switchOnTwoStep(admin);

    const without = await adminLogin(admin.email);
    expect(without.status).toBe(401);
    expect(without.body.message).toMatch(/^TWO_FACTOR_CODE_NEEDED/);
    expect(without.body.adminToken).toBeUndefined();

    const wrong = await adminLogin(admin.email, { code: "000000" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toMatch(/^TWO_FACTOR_CODE_WRONG/);

    const right = await adminLogin(admin.email, { code: codeAt(secret, stepNow() + 1) });
    expect(right.status).toBe(200);
    expect(right.body.adminToken).toBeTruthy();
  });

  it("where the second step is required, refuses an admin who has not set it up", async () => {
    env.adminRequire2fa = true;
    const admin = await createUser({ role: "superadmin" });

    const res = await adminLogin(admin.email);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/^TWO_FACTOR_SETUP_NEEDED/);

    const secret = await switchOnTwoStep(admin);
    expect((await adminLogin(admin.email, { code: codeAt(secret, stepNow() + 1) })).status).toBe(200);
  });

  it("records who signed in and every sign-in that was refused", async () => {
    const admin = await createUser({ role: "superadmin" });
    const user = await createUser();

    expect((await adminLogin(admin.email)).status).toBe(200);
    expect((await api().post("/api/admin/login").send({ email: admin.email, password: PASSWORD, adminSecret: "wrong-key" })).status).toBe(401);
    expect((await adminLogin(user.email)).status).toBe(401);

    expect(await AdminAction.findOne({ action: "admin.signed_in" })).toMatchObject({ adminEmail: admin.email });
    const refused = await AdminAction.find({ action: "admin.sign_in_refused" }).sort({ at: 1 });
    expect(refused.map((line) => line.summary)).toEqual([
      `Sign-in refused for ${admin.email}: wrong admin key`,
      `Sign-in refused for ${user.email}: not an admin account`,
    ]);
    // Neither the password nor the key is kept
    expect(JSON.stringify(refused)).not.toContain("wrong-key");
    expect(JSON.stringify(refused)).not.toContain(PASSWORD);
  });

  it("stops an admin session when the admin's own account is closed", async () => {
    const admin = await asAdmin();
    await User.updateOne({ _id: admin.id }, { deletedAt: new Date() });
    expect((await admin.get("/users")).status).toBe(403);
    expect((await adminLogin(admin.email)).status).toBe(401);
  });
});

describe("AD-11 the record of admin actions", () => {
  it("lists what was done, newest first, and can be narrowed to one account", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.patch(`/users/${user.id}/plan`, { plan: "pro_monthly", reason: "Pilot customer" });
    await admin.post(`/users/${user.id}/reset-quota`);

    const all = (await admin.get("/activity")).body.data;
    expect(all.items.map((line) => line.action)).toEqual(["user.usage_reset", "user.plan_granted", "admin.signed_in"]);
    expect(all.actions).toEqual(["admin.signed_in", "user.plan_granted", "user.usage_reset"]);

    const forUser = (await admin.get(`/activity?target=${user.id}`)).body.data;
    expect(forUser.total).toBe(2);
    expect((await admin.get("/activity?action=user.plan_granted")).body.data.total).toBe(1);
  });

  it("notes that an account was opened once, however often the page is reloaded", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.get(`/users/${user.id}`);
    await admin.get(`/users/${user.id}`);
    expect(await AdminAction.countDocuments({ action: "user.opened", targetId: user.id })).toBe(1);
  });

  it("can be added to and never changed", async () => {
    const admin = await asAdmin();
    const line = await AdminAction.findOne({ action: "admin.signed_in", adminEmail: admin.email });

    await expect(AdminAction.updateOne({ _id: line._id }, { summary: "nothing happened" })).rejects.toThrow(/cannot be changed/);
    await expect(AdminAction.deleteMany({})).rejects.toThrow(/cannot be changed/);
    line.summary = "nothing happened";
    await expect(line.save()).rejects.toThrow(/cannot be changed/);
    expect((await AdminAction.findById(line._id)).summary).toBe(`${admin.email} signed in`);
  });
});

describe("AD-30 suspending an account", () => {
  const signer = { name: "Asha Rao", email: "asha@example.test" };

  it("stops the account at once, and lets its signers finish", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    const { recipients } = await sendDocument(user, [signer]);

    expect((await admin.post(`/users/${user.id}/suspend`, {})).status).toBe(400);
    expect((await admin.post(`/users/${user.id}/suspend`, { reason: "Sending spam" })).status).toBe(200);
    expect((await admin.post(`/users/${user.id}/suspend`, { reason: "Sending spam" })).status).toBe(409);

    // The token it already holds stops working, and so do signing in and renewing the session
    expect((await api().get("/api/pdf/my-documents").set(user.auth)).status).toBe(401);
    const login = await api().post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/^ACCOUNT_SUSPENDED/);
    expect((await api().post("/api/auth/refresh-token").set("Cookie", user.cookies)).status).toBe(401);

    // The people it asked to sign did nothing wrong
    expect((await api().get(`/api/signing/${recipients[0].token}`)).status).toBe(200);
    expect((await signAs(recipients[0].token, ["sig-1"])).status).toBe(200);

    expect((await admin.get(`/users/${user.id}`)).body.data.user).toMatchObject({ state: "suspended", suspendedReason: "Sending spam" });
    expect(await AdminAction.findOne({ action: "user.suspended" })).toMatchObject({ targetId: user.id });
  });

  it("is lifted by restoring the account", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await admin.post(`/users/${user.id}/suspend`, { reason: "Checking a report" });

    expect((await admin.post(`/users/${user.id}/restore`)).status).toBe(200);
    expect((await admin.post(`/users/${user.id}/restore`)).status).toBe(409);
    expect((await api().post("/api/auth/login").send({ email: user.email, password: PASSWORD })).status).toBe(200);
  });
});

describe("AD-28 payments", () => {
  it("lists what the providers reported, with each invoice, and hands the invoice over as a PDF", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    const paid = await payment(user.id);
    await payment(user.id, { kind: "failed" });
    const invoice = await issueInvoiceForPayment(paid._id);

    const all = (await admin.get("/payments")).body.data;
    expect(all.total).toBe(2);
    const row = all.items.find((p) => p.kind === "purchase");
    expect(row).toMatchObject({ amount: 299, currency: "INR", provider: "razorpay", account: { email: user.email }, invoice: { number: invoice.number } });

    expect((await admin.get("/payments?kind=failed")).body.data.total).toBe(1);
    expect((await admin.get(`/payments?user=${oid()}`)).body.data.total).toBe(0);

    const pdf = await admin.get(`/invoices/${row.invoice.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
  });
});

describe("AD-29 background work", () => {
  it("shows jobs without what they carry, and runs a failed one again", async () => {
    const admin = await asAdmin();
    let runs = 0;
    registerJobHandler("test.once_broken", async () => {
      runs += 1;
    });
    const failed = await Job.create({ type: "test.once_broken", payload: { recipientEmail: "asha@example.test" }, status: "failed", attempts: 5, lastError: "SMTP connection refused", finishedAt: new Date() });
    const done = await Job.create({ type: "test.once_broken", status: "done", finishedAt: new Date() });

    const list = (await admin.get("/jobs?status=failed")).body.data;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ type: "test.once_broken", status: "failed", lastError: "SMTP connection refused" });
    expect(JSON.stringify(list)).not.toContain("asha@example.test");
    expect(list.types).toContain("test.once_broken");

    const again = await admin.post(`/jobs/${failed._id}/retry`);
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ status: "done" });
    expect(runs).toBe(1);
    expect(await AdminAction.findOne({ action: "job.run_again" })).toMatchObject({ targetId: String(failed._id) });

    // Only a job that gave up can be run again
    expect((await admin.post(`/jobs/${done._id}/retry`)).status).toBe(409);
    expect(runs).toBe(1);
  });

  it("says how the service is running from what is true now", async () => {
    const admin = await asAdmin();
    await Job.create({ type: "email.reminder", status: "failed", attempts: 5, finishedAt: new Date() });
    await Job.create({ type: "email.reminder", status: "pending", runAfter: new Date(Date.now() - 60000) });

    const { data } = (await admin.get("/system")).body;
    expect(data).toMatchObject({ database: "connected", environment: "test", storage: "local" });
    expect(data.jobs.byStatus).toMatchObject({ failed: 1, pending: 1 });
    expect(data.jobs.oldestWaiting).toMatchObject({ type: "email.reminder" });
    expect(data.attention.failedJobs).toBe(1);
    expect(data.switchedOn).toMatchObject({ adminTwoStep: false, publicPageRebuild: false });
  });
});

describe("AD-10 what the app is told about itself", () => {
  it("names the admin who is signed in and every plan, with prices in rupees", async () => {
    const admin = await asAdmin();
    const { data } = (await admin.get("/meta")).body;

    expect(data.admin).toMatchObject({ email: admin.email, role: "superadmin" });
    expect(data.plans.map((plan) => plan.id)).toEqual(["free", "pro_monthly", "pro_annual", "business_monthly", "business_annual", "enterprise", "lifetime"]);
    expect(data.plans.find((plan) => plan.id === "business_monthly")).toMatchObject({ priceInr: 499, perSeat: true, documentsPerMonth: 100 });
    expect(data.plans.find((plan) => plan.id === "lifetime")).toMatchObject({ legacy: true, documentsPerMonth: null });
    expect(data.documentStatuses).toContain("voided");
  });
});

describe("AD-31 rebuilding the public template pages", () => {
  it("asks for nothing when no deploy hook is set", async () => {
    const admin = await asAdmin();
    env.clientDeployHookUrl = "";
    const res = await admin.post("/templates/rebuild");
    expect(res.body.data).toEqual({ configured: false, queued: false });
    expect(await Job.countDocuments({ type: "client.rebuild" })).toBe(0);
  });

  it("calls the hook once for changes made close together", async () => {
    const admin = await asAdmin();
    env.clientDeployHookUrl = "https://deploy.example.test/hook";
    const calls = [];
    vi.stubGlobal("fetch", async (url, options) => {
      calls.push([url, options.method]);
      return { ok: true, status: 201 };
    });

    const slot = () => Math.floor(Date.now() / (5 * 60 * 1000));
    const startedIn = slot();
    const first = await admin.post("/templates/rebuild");
    const second = await admin.post("/templates/rebuild");
    await flushEvents();

    expect(first.body.data).toEqual({ configured: true, queued: true });
    // Unless the two calls happened to straddle a five-minute mark
    if (slot() === startedIn) {
      expect(second.body.data).toEqual({ configured: true, queued: false });
      expect(calls).toEqual([["https://deploy.example.test/hook", "POST"]]);
    }
    expect(await AdminAction.countDocuments({ action: "template.pages_rebuild" })).toBe(2);
  });
});
