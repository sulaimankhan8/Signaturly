import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "crypto";
import { api, createUser, PASSWORD } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { PlanSetting } from "../../src/models/PlanSetting.model.js";
import { AdminAction } from "../../src/models/AdminAction.model.js";
import { PLANS, UNLIMITED, PRICE_GRACE_MS, applyPlanSettings, priceOf } from "../../src/config/plans.js";
import { loadPlans } from "../../src/services/planCatalogue.service.js";
import { getOrCreateSubscription } from "../../src/services/subscription.service.js";
import { applyRenewal } from "../../src/services/billingEvents.service.js";
import { can, limitOf, canUsePack, describeEntitlements } from "../../src/services/entitlements.service.js";
import { env } from "../../src/config/env.js";

// Plans and prices changed from the admin app.

const asAdmin = async () => {
  const admin = await createUser({ role: "superadmin" });
  const login = await api().post("/api/admin/login").send({ email: admin.email, password: PASSWORD, adminSecret: env.adminSecret });
  if (login.status !== 200) throw new Error(`admin login failed: ${login.status} ${JSON.stringify(login.body)}`);
  const headers = { Authorization: `Bearer ${login.body.adminToken}` };
  return {
    ...admin,
    get: (url) => api().get(`/api/admin${url}`).set(headers),
    post: (url, body = {}) => api().post(`/api/admin${url}`).set(headers).send(body),
    patch: (url, body = {}) => api().patch(`/api/admin${url}`).set(headers).send(body),
  };
};

const subOf = (userId) => Subscription.findOne({ userId });
const checkout = (user, plan) => api().post("/api/billing/checkout").set(user.auth).send({ plan });
const devPay = (user, item) => api().post("/api/billing/dev-pay").set(user.auth).send({ kind: "plan", item });

const razorpayCaptured = (userId, amountPaise, plan) => {
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: `pay_${crypto.randomBytes(6).toString("hex")}`, amount: amountPaise, currency: "INR", notes: { userId, plan } } } },
  });
  const signature = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(payload).digest("hex");
  return api()
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set({ "x-razorpay-signature": signature, "x-razorpay-event-id": `evt_${crypto.randomBytes(6).toString("hex")}` })
    .send(payload);
};

const newPlan = (extra = {}) => ({ id: "startup_monthly", name: "Startup", tier: "business", interval: "month", documentsPerMonth: 200, priceInr: 999, purchasable: true, ...extra });

// The database is emptied before each test; the list in memory has to follow it
beforeEach(() => loadPlans());
afterAll(() => applyPlanSettings([]));

describe("the list of plans", () => {
  it("shows every plan with who holds it and what may be changed", async () => {
    const admin = await asAdmin();
    const [buyer] = [await createUser(), await createUser()];
    await devPay(buyer, "pro_monthly");

    const res = await admin.get("/plans");
    expect(res.status).toBe(200);
    const plans = Object.fromEntries(res.body.data.plans.map((plan) => [plan.id, plan]));

    expect(Object.keys(plans)).toEqual(["free", "pro_monthly", "pro_annual", "business_monthly", "business_annual", "enterprise", "lifetime"]);
    expect(plans.pro_monthly).toMatchObject({ name: "Pro", priceInr: 299, documentsPerMonth: 50, accounts: 1, shipped: true, changedAt: null });
    expect(plans.free).toMatchObject({ accounts: 1, canChange: ["name", "tagline", "highlight", "documentsPerMonth", "features", "limits"] });
    expect(plans.lifetime.canChange).toEqual(["name", "tier", "features", "limits"]);
    expect(plans.pro_monthly.canChange).toEqual(expect.arrayContaining(["priceInr", "tier", "interval", "perSeat", "features", "limits"]));

    // What each plan includes, and what each tier gives by itself, for the form to start from
    expect(plans.pro_monthly).toMatchObject({ features: { "templates.own": true, bulkSend: true, api: false, workspaces: false }, limits: { bulkSendMax: 25 } });
    expect(res.body.data.tiers.map((tier) => tier.id)).toEqual(["free", "pro", "business", "enterprise"]);
    expect(res.body.data.tiers[2]).toMatchObject({ name: "Business", features: { workspaces: true, api: false }, limits: { bulkSendMax: 500 } });
    expect(res.body.data.features.map((feature) => feature.id).sort()).toEqual(["api", "bulkSend", "templates.own", "workspaces"]);
  });

  it("is closed to anyone without an admin session", async () => {
    const user = await createUser();
    expect((await api().get("/api/admin/plans")).status).toBe(401);
    expect((await api().patch("/api/admin/plans/pro_monthly").set(user.auth).send({ priceInr: 1 })).status).toBe(401);
    expect(PLANS.pro_monthly.priceInr).toBe(299);
  });
});

describe("changing a plan", () => {
  it("charges the new price from the next checkout, and says so publicly and in the record", async () => {
    const admin = await asAdmin();
    const res = await admin.patch("/plans/pro_monthly", { priceInr: 349, name: "Pro Plus" });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toMatchObject({ id: "pro_monthly", name: "Pro Plus", priceInr: 349, tier: "pro", interval: "month" });

    const user = await createUser();
    expect((await checkout(user, "pro_monthly")).body.data).toMatchObject({ amount: 349, planName: "Pro Plus" });

    const listed = (await api().get("/api/public/plans")).body.data.plans.find((plan) => plan.id === "pro_monthly");
    expect(listed).toMatchObject({ name: "Pro Plus", priceInr: 349 });

    const line = await AdminAction.findOne({ action: "plan.changed" }).lean();
    expect(line).toMatchObject({ adminEmail: admin.email, targetType: "plan", targetId: "pro_monthly" });
    expect(line.summary).toBe('Changed the plan Pro Plus (pro_monthly): name "Pro" to "Pro Plus"; price Rs. 299 to Rs. 349');
  });

  it("is kept across a restart, and reaches a copy of the server that did not make the change", async () => {
    const admin = await asAdmin();
    await admin.patch("/plans/pro_monthly", { priceInr: 349 });

    applyPlanSettings([]); // a server that has just started knows only the shipped plans
    expect(PLANS.pro_monthly.priceInr).toBe(299);
    await loadPlans();
    expect(PLANS.pro_monthly).toMatchObject({ priceInr: 349, tier: "pro", interval: "month", documentsPerMonth: 50 });
  });

  it("honours a checkout opened at the old price for a short while, and no other amount", async () => {
    const admin = await asAdmin();
    const [early, late, cheap] = [await createUser(), await createUser(), await createUser()];
    await admin.patch("/plans/pro_monthly", { priceInr: 349 });

    await razorpayCaptured(early.id, 29900, "pro_monthly");
    expect((await subOf(early.id)).plan).toBe("pro_monthly");

    await razorpayCaptured(cheap.id, 19900, "pro_monthly");
    expect((await subOf(cheap.id))?.plan || "free").toBe("free");

    // Once the old price's time is up, only the new one pays for the plan
    await PlanSetting.updateOne({ planId: "pro_monthly" }, { $set: { "earlierPrices.0.until": new Date(Date.now() - 1000) } });
    await loadPlans();
    await razorpayCaptured(late.id, 29900, "pro_monthly");
    expect((await subOf(late.id))?.plan || "free").toBe("free");
    await razorpayCaptured(late.id, 34900, "pro_monthly");
    expect((await subOf(late.id)).plan).toBe("pro_monthly");

    const kept = await PlanSetting.findOne({ planId: "pro_monthly" }).lean();
    expect(kept.earlierPrices).toHaveLength(1);
    expect(kept.earlierPrices[0].priceInr).toBe(299);
    expect(PRICE_GRACE_MS).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("gives a new allowance to new buyers at once and to paying accounts from their next period", async () => {
    const admin = await asAdmin();
    const [holder, buyer] = [await createUser(), await createUser()];
    await devPay(holder, "pro_monthly");

    expect((await admin.patch("/plans/pro_monthly", { documentsPerMonth: 80 })).status).toBe(200);
    expect((await subOf(holder.id)).monthlyQuota).toBe(50);

    await devPay(buyer, "pro_monthly");
    expect((await subOf(buyer.id)).monthlyQuota).toBe(80);

    await applyRenewal({ provider: "razorpay", userId: holder.id, payment: { providerPaymentId: "pay_renewal", amount: 299, currency: "INR" } });
    expect((await subOf(holder.id)).monthlyQuota).toBe(80);

    // No monthly limit is sent as null
    await admin.patch("/plans/pro_monthly", { documentsPerMonth: null });
    expect(PLANS.pro_monthly.documentsPerMonth).toBe(UNLIMITED);
  });

  it("moves Free accounts to Free's new allowance, except those given an allowance of their own", async () => {
    const admin = await asAdmin();
    const [standard, special, later] = [await createUser(), await createUser(), await createUser()];
    await getOrCreateSubscription(standard.id);
    await admin.patch(`/users/${special.id}/plan`, { plan: "free", reason: "Agreed by email", customQuota: 12 });

    const res = await admin.patch("/plans/free", { documentsPerMonth: 3 });
    expect(res.body.data).toMatchObject({ accountsMoved: 1, plan: { documentsPerMonth: 3 } });

    expect((await subOf(standard.id)).monthlyQuota).toBe(3);
    expect((await subOf(special.id)).monthlyQuota).toBe(12);
    expect((await getOrCreateSubscription(later.id)).monthlyQuota).toBe(3);
  });

  it("takes a plan off sale, and brings nothing in for it after that", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    // A plan is retired at both its prices: the yearly one is not a plan of its own to retire
    expect((await admin.patch("/plans/pro_annual", { legacy: true })).status).toBe(400);
    expect((await admin.patch("/plans/pro_monthly", { legacy: true })).body.data.plan).toMatchObject({ legacy: true, purchasable: false });

    for (const id of ["pro_monthly", "pro_annual"]) {
      expect(priceOf("plan", id), id).toBeNull();
      expect((await checkout(user, id)).status, id).toBe(400);
    }
    const listed = (await api().get("/api/public/plans")).body.data.plans.map((plan) => plan.id);
    expect(listed).not.toContain("pro_monthly");
    expect(listed).not.toContain("pro_annual");
    // The accounts that hold it can still be found by it
    expect((await admin.get("/users?plan=pro_annual")).status).toBe(200);
  });

  it("refuses what would break a promise already made or sell a plan that cannot be sold", async () => {
    const admin = await asAdmin();
    const refused = [
      ["free", { priceInr: 99 }, 400],
      ["free", { purchasable: true }, 400],
      ["free", { documentsPerMonth: null }, 400],
      ["free", { tier: "pro" }, 400],
      ["lifetime", { priceInr: 10 }, 400],
      ["lifetime", { documentsPerMonth: 100 }, 400],
      ["enterprise", { purchasable: true }, 400], // priced "from"
      ["pro_monthly", { priceInr: null, purchasable: true }, 400],
      ["pro_monthly", { priceInr: 0 }, 400],
      ["pro_monthly", { priceInr: 299.5 }, 400],
      ["pro_monthly", { documentsPerMonth: 0 }, 400],
      ["pro_monthly", { tier: "free" }, 400],
      ["pro_monthly", { tier: "gold" }, 400],
      ["pro_monthly", { interval: "week" }, 400],
      ["pro_monthly", { limits: { bulkSendMax: 0 } }, 400], // bulk send to nobody
      ["pro_monthly", { features: { bulkSend: true } }, 400], // already so
      ["pro_monthly", { colour: "red" }, 400], // nothing left to change once what is unknown is dropped
      ["pro_monthly", { priceInr: 299 }, 400], // already so
      ["no_such_plan", { priceInr: 10 }, 404],
      ["__proto__", { priceInr: 10 }, 400],
    ];
    for (const [id, body, status] of refused) {
      const res = await admin.patch(`/plans/${id}`, body);
      expect(res.status, `${id} ${JSON.stringify(body)}`).toBe(status);
    }
    expect(await PlanSetting.countDocuments()).toBe(0);
    expect(PLANS.pro_monthly).toMatchObject({ priceInr: 299, tier: "pro", documentsPerMonth: 50 });
  });
});

describe("changing what a plan includes", () => {
  it("gives every account on the plan a feature the moment it is added, and takes one away the same way", async () => {
    const admin = await asAdmin();
    const holder = await createUser();
    await devPay(holder, "pro_monthly");
    expect(can(await subOf(holder.id), "api")).toBe(false);

    const res = await admin.patch("/plans/pro_monthly", { features: { api: true, bulkSend: false } });
    expect(res.status).toBe(200);
    expect(res.body.data.plan.features).toEqual({ "templates.own": true, bulkSend: false, api: true, workspaces: false });

    const sub = await subOf(holder.id);
    expect(can(sub, "api")).toBe(true);
    expect(can(sub, "bulkSend")).toBe(false);
    expect(can(sub, "templates.own")).toBe(true);
    // The routes answer the same way: an API key can now be made, a bulk send cannot be started
    expect((await api().post("/api/developer/keys").set(holder.auth).send({ name: "Mine" })).status).not.toBe(403);

    // The plan's yearly price is the same plan and has what it has; another plan is untouched
    const listed = Object.fromEntries((await api().get("/api/public/plans")).body.data.plans.map((plan) => [plan.id, plan]));
    expect(listed.pro_monthly.features).toMatchObject({ api: true, bulkSend: false });
    expect(listed.pro_annual.features).toMatchObject({ api: true, bulkSend: false });
    expect(listed.business_monthly.features).toMatchObject({ api: false, bulkSend: true });

    const line = await AdminAction.findOne({ action: "plan.changed" }).lean();
    expect(line.summary).toBe("Changed the plan Pro (pro_monthly): Bulk send removed; API keys and webhooks added");
  });

  it("sets a plan's own limit on a bulk send, and lets Free be given a feature", async () => {
    const admin = await asAdmin();
    const [pro, free] = [await createUser(), await createUser()];
    await devPay(pro, "pro_monthly");

    await admin.patch("/plans/pro_monthly", { limits: { bulkSendMax: 60 } });
    expect(limitOf(await subOf(pro.id), "bulkSendMax")).toBe(60);

    // Bulk send on a plan whose tier allows none needs its limit said
    expect((await admin.patch("/plans/free", { features: { bulkSend: true } })).status).toBe(400);
    expect((await admin.patch("/plans/free", { features: { bulkSend: true }, limits: { bulkSendMax: 5 } })).status).toBe(200);
    const sub = await getOrCreateSubscription(free.id);
    expect(describeEntitlements(sub)).toMatchObject({ plan: "free", tier: "free", features: { bulkSend: true, api: false }, limits: { bulkSendMax: 5 } });
  });

  it("moves a plan to another level, which brings that level's features, packs and limits", async () => {
    const admin = await asAdmin();
    const holder = await createUser();
    await devPay(holder, "pro_monthly");
    await admin.patch("/plans/pro_monthly", { features: { bulkSend: false } });

    const res = await admin.patch("/plans/pro_monthly", { tier: "enterprise" });
    expect(res.body.data.plan).toMatchObject({ tier: "enterprise", features: { "templates.own": true, bulkSend: true, api: true, workspaces: true }, limits: { bulkSendMax: 5000 } });

    const sub = await subOf(holder.id);
    expect(describeEntitlements(sub).tier).toBe("enterprise");
    expect(canUsePack(sub, "starter")).toBe(true);
    expect((await PlanSetting.findOne({ planId: "pro_monthly" }).lean()).features).toBeNull();

    // Lifetime's level and features can be set; what was sold with it cannot
    expect((await admin.patch("/plans/lifetime", { tier: "business", name: "Founders" })).body.data.plan).toMatchObject({ name: "Founders", tier: "business", documentsPerMonth: null });
  });

  it("changes the period for the next buyer only, and per-seat selling only while nobody is on the plan", async () => {
    const admin = await asAdmin();
    const [holder, buyer] = [await createUser(), await createUser()];
    // A plan with no yearly price beside it can itself be sold by the year instead
    await admin.post("/plans", newPlan());
    await devPay(holder, "startup_monthly");
    const paidUntil = (await subOf(holder.id)).currentPeriodEnd;

    expect((await admin.patch("/plans/startup_monthly", { interval: "year" })).body.data.plan.interval).toBe("year");
    expect((await subOf(holder.id)).currentPeriodEnd).toEqual(paidUntil);
    await devPay(buyer, "startup_monthly");
    expect((await subOf(buyer.id)).currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 300 * 86400000);
    // One that has a yearly price stays sold by the month
    expect((await admin.patch("/plans/pro_monthly", { interval: "year" })).status).toBe(400);

    expect((await admin.patch("/plans/startup_monthly", { perSeat: true })).status).toBe(409);
    expect(PLANS.startup_monthly.perSeat).toBeFalsy();
    // Nobody is on Pro at either price, so it can be sold by the seat; its yearly price follows it
    expect((await admin.patch("/plans/pro_annual", { perSeat: true })).status).toBe(400);
    expect((await admin.patch("/plans/pro_monthly", { perSeat: true })).body.data.plan.perSeat).toBe(true);
    expect((await checkout(await createUser(), "pro_annual")).body.data).toMatchObject({ amount: 2990, seats: 1 });
  });
});

describe("adding a plan", () => {
  it("makes a plan that can be bought, given to an account, and that includes what its tier does", async () => {
    const admin = await asAdmin();
    const [buyer, given] = [await createUser(), await createUser()];

    const res = await admin.post("/plans", newPlan());
    expect(res.status).toBe(201);
    expect(res.body.data.plan).toMatchObject({ id: "startup_monthly", name: "Startup", tier: "business", priceInr: 999, documentsPerMonth: 200, perSeat: false, purchasable: true, legacy: false });

    expect((await checkout(buyer, "startup_monthly")).body.data).toMatchObject({ amount: 999, planName: "Startup" });
    expect((await devPay(buyer, "startup_monthly")).status).toBe(200);
    const bought = await subOf(buyer.id);
    expect(bought).toMatchObject({ plan: "startup_monthly", status: "active", monthlyQuota: 200 });
    expect(can(bought, "workspaces")).toBe(true);
    expect(can(bought, "api")).toBe(false);

    // A plan can be made with features of its own, apart from its level
    const own = await admin.post("/plans", newPlan({ id: "api_starter", name: "API Starter", tier: "pro", features: { api: true }, limits: { bulkSendMax: 10 }, purchasable: false }));
    expect(own.body.data.plan).toMatchObject({ tier: "pro", features: { "templates.own": true, bulkSend: true, api: true, workspaces: false }, limits: { bulkSendMax: 10 } });

    expect((await admin.patch(`/users/${given.id}/plan`, { plan: "startup_monthly", reason: "Pilot customer" })).status).toBe(200);
    expect((await admin.get("/users?plan=startup_monthly")).body.data.total).toBe(2);

    const listed = (await admin.get("/plans")).body.data.plans.find((plan) => plan.id === "startup_monthly");
    expect(listed).toMatchObject({ accounts: 2, shipped: false });
    expect((await admin.get("/meta")).body.data.plans.map((plan) => plan.id)).toContain("startup_monthly");
    expect(await AdminAction.countDocuments({ action: "plan.added", targetId: "startup_monthly" })).toBe(1);
  });

  it("refuses an id already in use, an id that is not one, and a plan that cannot be sold as written", async () => {
    const admin = await asAdmin();
    expect((await admin.post("/plans", newPlan({ id: "pro_monthly" }))).status).toBe(409);
    expect((await admin.post("/plans", newPlan())).status).toBe(201);
    expect((await admin.post("/plans", newPlan())).status).toBe(409);

    for (const extra of [{ id: "Startup Plan" }, { id: "ab" }, { id: "constructor" }, { tier: "free" }, { tier: "gold" }, { interval: "week" }, { priceInr: null }, { priceIsFrom: true }, { name: " " }]) {
      const res = await admin.post("/plans", newPlan({ id: "another_plan", ...extra }));
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect(await PlanSetting.countDocuments()).toBe(1);
  });

  it("keeps a plan nobody has singled out following its tier", async () => {
    const admin = await asAdmin();
    await admin.patch("/plans/pro_monthly", { features: { api: true } });
    await admin.patch("/plans/pro_monthly", { features: { api: false } });
    await admin.patch("/plans/pro_monthly", { limits: { bulkSendMax: 25 }, priceInr: 310 });
    expect(await PlanSetting.findOne({ planId: "pro_monthly" }).lean()).toMatchObject({ features: null, bulkSendMax: null, priceInr: 310 });
  });
});
