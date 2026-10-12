import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import crypto from "crypto";
import { api, createUser, PASSWORD, flushEvents, emailsTo } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { Invoice } from "../../src/models/Invoice.model.js";
import { ProviderPlan } from "../../src/models/ProviderPlan.model.js";
import { AddOnSetting } from "../../src/models/AddOnSetting.model.js";
import { AdminAction } from "../../src/models/AdminAction.model.js";
import { PLANS, TOPUP_PACKS, applyPlanSettings, applyAddOnSettings, priceOf } from "../../src/config/plans.js";
import { loadPlans } from "../../src/services/planCatalogue.service.js";
import { reconcileAutoRenewals } from "../../src/services/autoRenew.service.js";
import { env } from "../../src/config/env.js";

// The three things sold (a plan as a subscription, a plan prepaid, a top-up), set from the
// admin app, kept in step with Razorpay, and confirmed when the customer comes back from checkout.

const DAY_MS = 24 * 60 * 60 * 1000;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const subOf = (userId) => Subscription.findOne({ userId });
const paymentsOf = async (userId) => (await Payment.find({ userId }).sort({ createdAt: 1 })).map((p) => [p.kind, p.amount, p.item]);

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

const checkout = (user, body) => api().post("/api/billing/checkout").set(user.auth).send(body);
const devPay = (user, body) => api().post("/api/billing/dev-pay").set(user.auth).send(body);
const confirm = (user, body) => api().post("/api/billing/checkout/confirm").set(user.auth).send(body);

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
// Razorpay as this server talks to it. `answers` maps "METHOD /path" (or a path prefix) to what Razorpay says.
const withRazorpay = (answers = {}) => {
  env.razorpayKeyId = "rzp_test_key";
  env.razorpayKeySecret = "rzp_test_secret";
  const calls = [];
  let made = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
    const path = String(url).replace("https://api.razorpay.com/v1", "");
    const method = options.method || "GET";
    calls.push({ method, path, sent: options.body ? JSON.parse(options.body) : null });
    made += 1;
    const key = Object.keys(answers).find((known) => `${method} ${path}`.startsWith(known));
    if (key) return typeof answers[key] === "function" ? answers[key](calls.at(-1)) : json(answers[key]);
    if (method === "POST" && path === "/plans") return json({ id: `plan_rzp_${made}` });
    if (method === "POST" && path === "/subscriptions") return json({ id: `sub_rzp_${made}`, status: "created" });
    if (method === "POST" && path === "/orders") return json({ id: `order_rzp_${made}`, amount: calls.at(-1).sent.amount });
    return new Response(JSON.stringify({ error: { description: "Not found" } }), { status: 404 });
  });
  return calls;
};
const signed = (text) => crypto.createHmac("sha256", "rzp_test_secret").update(text).digest("hex");

// The database is emptied before each test; the price list in memory has to follow it
beforeEach(() => loadPlans());
afterEach(() => {
  vi.restoreAllMocks();
  env.razorpayKeyId = undefined;
  env.razorpayKeySecret = undefined;
});
afterAll(() => {
  applyPlanSettings([]);
  applyAddOnSettings([]);
});

describe("how a plan is sold", () => {
  it("is sold both ways unless an admin says otherwise, and the price list says which", async () => {
    const admin = await asAdmin();
    const listed = async () => Object.fromEntries((await api().get("/api/public/plans")).body.data.plans.map((plan) => [plan.id, plan.billing]));

    expect(await listed()).toMatchObject({
      free: { subscription: false, prepaid: false },
      pro_monthly: { subscription: true, prepaid: true },
      business_monthly: { subscription: true, prepaid: true },
      enterprise: { subscription: false, prepaid: false },
    });

    const res = await admin.patch("/plans/pro_monthly", { sellPrepaid: false });
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toMatchObject({ sellSubscription: true, sellPrepaid: false, billing: { subscription: true, prepaid: false } });
    expect((await listed()).pro_monthly).toEqual({ subscription: true, prepaid: false });
    expect((await AdminAction.findOne({ action: "plan.changed" }).lean()).summary).toContain("no longer sold for one period");
  });

  it("refuses the way of buying that the plan does not allow", async () => {
    const admin = await asAdmin();
    const user = await createUser();

    await admin.patch("/plans/pro_monthly", { sellPrepaid: false });
    expect((await checkout(user, { plan: "pro_monthly", renew: "once" })).status).toBe(400);
    expect((await checkout(user, { plan: "pro_monthly", renew: "auto" })).status).toBe(200);

    await admin.patch("/plans/pro_annual", { sellSubscription: false });
    expect((await checkout(user, { plan: "pro_annual", renew: "auto" })).status).toBe(400);
    expect((await checkout(user, { plan: "pro_annual", renew: "once" })).status).toBe(200);

    // A plan on sale has to be sold some way
    expect((await admin.patch("/plans/pro_annual", { sellPrepaid: false })).status).toBe(400);
    expect(PLANS.pro_annual.sellPrepaid).not.toBe(false);
  });
});

describe("top-up packs set from the admin app", () => {
  it("lists the shipped packs, and adds, reprices and withdraws a pack", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    expect((await admin.get("/plans")).body.data.addOns.map((pack) => [pack.id, pack.documents, pack.priceInr, pack.onSale, pack.shipped])).toEqual([
      ["docs_10", 10, 79, true, true],
      ["docs_50", 50, 349, true, true],
      ["docs_200", 200, 1299, true, true],
    ]);

    const added = await admin.post("/add-ons", { id: "docs_25", documents: 25, priceInr: 179 });
    expect(added.status).toBe(201);
    expect(added.body.data.addOn).toMatchObject({ id: "docs_25", documents: 25, priceInr: 179, onSale: true, shipped: false });
    expect((await api().get("/api/public/plans")).body.data.topups.map((pack) => pack.id)).toEqual(["docs_10", "docs_25", "docs_50", "docs_200"]);

    expect((await devPay(user, { kind: "topup", item: "docs_25" })).status).toBe(200);
    expect((await subOf(user.id)).extraDocuments).toBe(25);

    expect((await admin.patch("/add-ons/docs_10", { priceInr: 89 })).status).toBe(200);
    expect(priceOf("topup", "docs_10")).toMatchObject({ amountInr: 89 });
    expect((await checkout(user, { kind: "topup", item: "docs_10" })).body.data.amount).toBe(89);

    // Withdrawn: not listed, not sold, and still on record for the payments that named it
    expect((await admin.patch("/add-ons/docs_25", { onSale: false })).body.data.addOn.onSale).toBe(false);
    expect((await api().get("/api/public/plans")).body.data.topups.map((pack) => pack.id)).not.toContain("docs_25");
    expect((await checkout(user, { kind: "topup", item: "docs_25" })).status).toBe(400);
    expect(TOPUP_PACKS.docs_25.documents).toBe(25);
    expect((await Invoice.findOne({ userId: user.id }).lean()).description).toBe("25 extra documents");

    expect(await AdminAction.countDocuments({ action: { $in: ["addon.added", "addon.changed"] } })).toBe(3);
  });

  it("sells several of a pack in one payment, and grants and bills for that many", async () => {
    const user = await createUser();
    const order = await checkout(user, { kind: "topup", item: "docs_10", quantity: 3 });
    expect(order.body.data).toMatchObject({ isMock: true, amount: 237, quantity: 3, description: "3 packs of 10 extra documents" });

    expect((await devPay(user, { kind: "topup", item: "docs_10", quantity: 3 })).status).toBe(200);
    expect((await subOf(user.id)).extraDocuments).toBe(30);
    expect(await Payment.findOne({ userId: user.id }).lean()).toMatchObject({ kind: "topup", item: "docs_10", quantity: 3, amount: 237 });
    expect((await Invoice.findOne({ userId: user.id }).lean()).description).toBe("30 extra documents (3 packs of 10)");

    // One pack is what is bought when no number is given, and no more than twenty at once
    expect((await checkout(user, { kind: "topup", item: "docs_10" })).body.data).toMatchObject({ amount: 79, quantity: 1, description: "10 extra documents" });
    expect((await checkout(user, { kind: "topup", item: "docs_10", quantity: 500 })).body.data).toMatchObject({ amount: 1580, quantity: 20 });

    // A payment for one pack does not buy three
    const captured = (paymentId, amount, quantity) => {
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, amount, currency: "INR", notes: { userId: user.id, kind: "topup", item: "docs_10", quantity } } } } });
      return api()
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set({ "x-razorpay-signature": crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex"), "x-razorpay-event-id": `evt_${paymentId}` })
        .send(body);
    };
    await captured("pay_short", 7900, "3");
    expect((await subOf(user.id)).extraDocuments).toBe(30);
    await captured("pay_three", 23700, "3");
    expect((await subOf(user.id)).extraDocuments).toBe(60);
  });

  it("refuses a pack that is not one, or an id already in use, and needs an admin", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    for (const body of [{ id: "docs_10", documents: 10, priceInr: 50 }, { id: "Bad Id", documents: 10, priceInr: 50 }, { id: "docs_x", documents: 0, priceInr: 50 }, { id: "docs_x", documents: 10, priceInr: 0 }, { id: "constructor", documents: 10, priceInr: 50 }]) {
      expect((await admin.post("/add-ons", body)).status, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
    expect((await admin.patch("/add-ons/no_such_pack", { priceInr: 10 })).status).toBe(404);
    expect((await admin.patch("/add-ons/docs_10", { priceInr: 79 })).status).toBe(400); // already so
    expect((await api().post("/api/admin/add-ons").set(user.auth).send({ id: "docs_9", documents: 9, priceInr: 9 })).status).toBe(401);
    expect(await AddOnSetting.countDocuments()).toBe(0);
  });
});

describe("wallet credit of the customer's own choosing", () => {
  it("adds any whole amount the price list allows, and exactly what was paid", async () => {
    const user = await createUser();
    expect((await api().get("/api/public/plans")).body.data.walletCustom).toEqual({ minInr: 100, maxInr: 50000 });

    const order = await checkout(user, { kind: "wallet", item: "custom", amountInr: 2200 });
    expect(order.body.data).toMatchObject({ isMock: true, amount: 2200, description: "Wallet credit of Rs. 2200" });

    expect((await devPay(user, { kind: "wallet", item: "custom", amountInr: 2200 })).status).toBe(200);
    expect((await api().get("/api/billing/wallet").set(user.auth)).body.data.balancePaise).toBe(220000);
    expect(await paymentsOf(user.id)).toEqual([["wallet", 2200, "custom"]]);
    expect((await Invoice.findOne({ userId: user.id }).lean())).toMatchObject({ description: "Wallet credit of Rs. 2200", totalPaise: 220000 });

    // The set amounts are still sold as they were
    await devPay(user, { kind: "wallet", item: "wallet_200" });
    expect((await api().get("/api/billing/wallet").set(user.auth)).body.data.balancePaise).toBe(240000);
  });

  it("refuses an amount outside the range or with paise, and a payment that is not for the amount named", async () => {
    const user = await createUser();
    for (const amountInr of [0, 99, 2200.5, 50001, "lots", undefined]) {
      expect((await checkout(user, { kind: "wallet", item: "custom", amountInr })).status, String(amountInr)).toBe(400);
      expect((await devPay(user, { kind: "wallet", item: "custom", amountInr })).status, String(amountInr)).toBe(400);
    }

    const captured = (paymentId, amount, named) => {
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, amount, currency: "INR", notes: { userId: user.id, kind: "wallet", item: "custom", amount: named } } } } });
      return api()
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set({ "x-razorpay-signature": crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex"), "x-razorpay-event-id": `evt_${paymentId}` })
        .send(body);
    };
    await captured("pay_less", 10000, "2200");
    expect((await api().get("/api/billing/wallet").set(user.auth)).body.data.balancePaise).toBe(0);
    await captured("pay_exact", 220000, "2200");
    expect((await api().get("/api/billing/wallet").set(user.auth)).body.data.balancePaise).toBe(220000);
  });
});

describe("a plan and a top-up in one payment", () => {
  it("prepaid: charges the two together, grants both once, and names both on one invoice", async () => {
    const user = await createUser();
    const order = await checkout(user, { plan: "pro_monthly", renew: "once", addOn: "docs_10" });
    expect(order.body.data).toMatchObject({ isMock: true, amount: 378, addOn: "docs_10", description: "PactDoc Pro plan, one month, with 10 extra documents" });

    expect((await devPay(user, { kind: "plan", item: "pro_monthly", renew: "once", addOn: "docs_10" })).status).toBe(200);
    expect(await subOf(user.id)).toMatchObject({ plan: "pro_monthly", status: "active", monthlyQuota: 50, extraDocuments: 10, autoRenew: false });
    expect(await paymentsOf(user.id)).toEqual([["purchase", 378, "docs_10"]]);
    const invoices = await Invoice.find({ userId: user.id }).lean();
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ description: "PactDoc Pro plan, one month, with 10 extra documents", totalPaise: 37800 });
  });

  it("subscription: adds the pack to the first charge only, and renews for the plan alone", async () => {
    const user = await createUser();
    expect((await checkout(user, { plan: "pro_monthly", renew: "auto", addOn: "docs_50" })).body.data).toMatchObject({ mode: "subscription", amount: 648, renewsAtInr: 299, addOn: "docs_50" });

    await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto", addOn: "docs_50" });
    expect(await subOf(user.id)).toMatchObject({ plan: "pro_monthly", autoRenew: true, renewalAmountInr: 299, extraDocuments: 50 });

    await api().post("/api/billing/dev-renew").set(user.auth).send({});
    expect((await subOf(user.id)).extraDocuments).toBe(50);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 648, "docs_50"], ["renewal", 299, null]]);
  });

  it("refuses a pack that is not on sale, and adds none where nothing is charged today", async () => {
    const user = await createUser();
    expect((await checkout(user, { plan: "pro_monthly", renew: "once", addOn: "no_such_pack" })).status).toBe(400);
    expect((await checkout(user, { plan: "pro_monthly", renew: "auto", addOn: "no_such_pack" })).status).toBe(400);

    // Turning auto-renew on with time already paid for charges nothing today
    await devPay(user, { kind: "plan", item: "pro_monthly" });
    expect((await checkout(user, { plan: "pro_monthly", renew: "auto", addOn: "docs_10" })).status).toBe(400);
    expect((await checkout(user, { plan: "pro_monthly", renew: "auto" })).status).toBe(200);
  });

  it("grants nothing for a payment that is not the two prices added together", async () => {
    const user = await createUser();
    const captured = (paymentId, amount) => {
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, amount, currency: "INR", notes: { userId: user.id, kind: "plan", plan: "pro_monthly", topup: "docs_10" } } } } });
      return api()
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set({ "x-razorpay-signature": crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex"), "x-razorpay-event-id": `evt_${paymentId}` })
        .send(body);
    };

    await captured("pay_plan_only", 29900);
    expect((await subOf(user.id))?.plan || "free").toBe("free");
    await captured("pay_both", 37800);
    expect(await subOf(user.id)).toMatchObject({ plan: "pro_monthly", extraDocuments: 10 });
  });
});

describe("Razorpay kept in step from the admin app", () => {
  it("creates a plan at Razorpay when it is saved, shows where it stands, and versions a new price", async () => {
    const admin = await asAdmin();
    const calls = withRazorpay();

    // Nothing has been subscribed to yet, so nothing is at Razorpay
    let pro = (await admin.get("/plans")).body.data.plans.find((plan) => plan.id === "pro_monthly");
    expect(pro.razorpay).toMatchObject({ needed: true, configured: true, current: null, versions: [] });
    expect((await admin.get("/plans")).body.data.plans.find((plan) => plan.id === "free").razorpay.needed).toBe(false);

    // The button creates it
    const sent = await admin.post("/plans/pro_monthly/razorpay");
    expect(sent.body.data.razorpay).toMatchObject({ state: "synced" });
    expect(calls.filter((call) => call.path === "/plans")).toHaveLength(1);
    pro = (await admin.get("/plans")).body.data.plans.find((plan) => plan.id === "pro_monthly");
    expect(pro.razorpay.current).toMatchObject({ providerPlanId: sent.body.data.razorpay.providerPlanId, priceInr: 299, interval: "month", current: true });

    // Sending it again makes no second one
    await admin.post("/plans/pro_monthly/razorpay");
    expect(calls.filter((call) => call.path === "/plans")).toHaveLength(1);

    // A new price is a new plan at Razorpay, made on save; the old one stays for those subscribed to it
    const saved = await admin.patch("/plans/pro_monthly", { priceInr: 349 });
    expect(saved.body.data.razorpay).toMatchObject({ state: "synced" });
    expect(calls.filter((call) => call.path === "/plans")).toHaveLength(2);
    expect(calls.filter((call) => call.path === "/plans")[1].sent.item.amount).toBe(34900);
    pro = (await admin.get("/plans")).body.data.plans.find((plan) => plan.id === "pro_monthly");
    expect(pro.razorpay.versions.map((version) => [version.priceInr, version.current])).toEqual(expect.arrayContaining([[349, true], [299, false]]));
    expect(await ProviderPlan.countDocuments({ planId: "pro_monthly" })).toBe(2);
    expect(await AdminAction.countDocuments({ action: "plan.sent_to_razorpay" })).toBe(2);
  });

  it("saves the plan even when Razorpay refuses it, and says what Razorpay said", async () => {
    const admin = await asAdmin();
    withRazorpay({ "POST /plans": () => new Response(JSON.stringify({ error: { description: "Subscriptions are not enabled for this account" } }), { status: 400 }) });

    const saved = await admin.patch("/plans/pro_monthly", { priceInr: 349 });
    expect(saved.status).toBe(200);
    expect(saved.body.data.razorpay).toEqual({ state: "failed", reason: "Subscriptions are not enabled for this account" });
    expect(PLANS.pro_monthly.priceInr).toBe(349);

    const sent = await admin.post("/plans/pro_monthly/razorpay");
    expect(sent.body.message).toContain("Subscriptions are not enabled for this account");
    // The customer is told only that the provider could not be reached
    const user = await createUser();
    const refused = await checkout(user, { plan: "pro_monthly", renew: "auto" });
    expect(refused.status).toBe(502);
    expect(refused.body.message).not.toContain("not enabled");
  });

  it("says so when the server has no Razorpay keys, or the plan is not a subscription", async () => {
    const admin = await asAdmin();
    expect((await admin.post("/plans/pro_monthly/razorpay")).body.data.razorpay).toEqual({ state: "not_configured" });
    expect((await admin.post("/plans/enterprise/razorpay")).body.data.razorpay).toEqual({ state: "not_needed" });
    expect((await admin.post("/plans/no_such_plan/razorpay")).status).toBe(404);
  });
});

describe("confirming a payment when the customer comes back from checkout", () => {
  it("applies a single payment at once, once, and to the account the order was made for", async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const order = { id: "order_1", amount: 7900, currency: "INR", notes: { userId: buyer.id, kind: "topup", item: "docs_10" } };
    const payment = { id: "pay_1", order_id: "order_1", amount: 7900, currency: "INR", status: "captured" };
    withRazorpay({ "GET /orders/order_1": order, "GET /payments/pay_1": payment });
    const returned = { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: signed("order_1|pay_1") };

    // Someone else cannot claim it, and a signature that is not Razorpay's confirms nothing
    expect((await confirm(stranger, returned)).status).toBe(403);
    expect((await confirm(buyer, { ...returned, razorpay_signature: signed("order_1|pay_2") })).status).toBe(400);
    expect((await subOf(buyer.id))?.extraDocuments || 0).toBe(0);

    const res = await confirm(buyer, returned);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ confirmed: true });
    expect((await subOf(buyer.id)).extraDocuments).toBe(10);

    // Confirmed again, and then reported by Razorpay itself: nothing more is added
    await confirm(buyer, returned);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
    await api()
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set({ "x-razorpay-signature": crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex"), "x-razorpay-event-id": "evt_pay_1" })
      .send(body);
    expect((await subOf(buyer.id)).extraDocuments).toBe(10);
    expect(await Payment.countDocuments({ userId: buyer.id })).toBe(1);
  });

  it("leaves a payment not yet taken to Razorpay's own notice", async () => {
    const buyer = await createUser();
    withRazorpay({
      "GET /orders/order_2": { id: "order_2", amount: 7900, currency: "INR", notes: { userId: buyer.id, kind: "topup", item: "docs_10" } },
      "GET /payments/pay_2": { id: "pay_2", order_id: "order_2", amount: 7900, currency: "INR", status: "authorized" },
    });
    const res = await confirm(buyer, { razorpay_payment_id: "pay_2", razorpay_order_id: "order_2", razorpay_signature: signed("order_2|pay_2") });
    expect(res.body.data).toEqual({ confirmed: false });
    expect((await subOf(buyer.id))?.extraDocuments || 0).toBe(0);
  });

  it("starts a subscription at once from the first payment, with the pack bought with it", async () => {
    const calls = withRazorpay();
    const buyer = await createUser();
    const started = (await checkout(buyer, { plan: "pro_monthly", renew: "auto", addOn: "docs_10" })).body.data;
    expect(started).toMatchObject({ mode: "subscription", amountPaise: 37800 });
    const made = calls.find((call) => call.path === "/subscriptions").sent;
    expect(made.addons).toEqual([{ item: { name: "10 extra documents", amount: 7900, currency: "INR" } }]);
    expect(made.notes).toMatchObject({ userId: buyer.id, plan: "pro_monthly", topup: "docs_10" });

    const end = nowSeconds() + 30 * 86400;
    vi.restoreAllMocks();
    withRazorpay({
      "GET /payments/pay_sub": { id: "pay_sub", amount: 37800, currency: "INR", status: "captured" },
      [`GET /subscriptions/${started.subscriptionId}`]: { id: started.subscriptionId, plan_id: made.plan_id, status: "active", quantity: 1, current_end: end, paid_count: 1, notes: made.notes },
    });

    const res = await confirm(buyer, { razorpay_payment_id: "pay_sub", razorpay_subscription_id: started.subscriptionId, razorpay_signature: signed(`pay_sub|${started.subscriptionId}`) });
    expect(res.body.data).toEqual({ confirmed: true });
    const sub = await subOf(buyer.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: true, renewalAmountInr: 299, extraDocuments: 10, razorpaySubscriptionId: started.subscriptionId });
    expect(sub.currentPeriodEnd.getTime()).toBe(end * 1000);
    expect(await paymentsOf(buyer.id)).toEqual([["purchase", 378, "docs_10"]]);
  });

  it("needs the signature, and a server with Razorpay set up", async () => {
    const buyer = await createUser();
    expect((await confirm(buyer, { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1" })).status).toBe(400);
    expect((await confirm(buyer, { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_subscription_id: "sub_1", razorpay_signature: signed("x") })).status).toBe(400);
    expect((await confirm(buyer, { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: signed("order_1|pay_1") })).status).toBe(400);
    expect((await api().post("/api/billing/checkout/confirm").send({})).status).toBe(401);
  });
});

describe("a renewal nobody reported", () => {
  it("is found at Razorpay and applied, so the account is not moved to Free", async () => {
    const user = await createUser();
    await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto" });
    const lapsed = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await Subscription.updateOne({ userId: user.id }, { razorpaySubscriptionId: "sub_real", currentPeriodEnd: lapsed });

    const end = nowSeconds() + 30 * 86400;
    withRazorpay({
      "GET /subscriptions/sub_real": { id: "sub_real", status: "active", current_end: end },
      "GET /invoices": { items: [{ status: "paid", payment_id: "pay_missed", amount_paid: 29900, currency: "INR" }] },
    });

    expect(await reconcileAutoRenewals()).toMatchObject({ checked: 1, renewed: 1 });
    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: true });
    expect(sub.currentPeriodEnd.getTime()).toBe(end * 1000);
    expect(await Payment.countDocuments({ userId: user.id, providerPaymentId: "pay_missed", kind: "renewal" })).toBe(1);

    // Asked again, with nothing new to find
    expect(await reconcileAutoRenewals()).toMatchObject({ checked: 0 });
  });

  it("marks a charge Razorpay could not take, and ends one Razorpay has ended", async () => {
    const [halted, ended] = [await createUser(), await createUser()];
    for (const [user, id] of [[halted, "sub_halted"], [ended, "sub_ended"]]) {
      await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto" });
      await Subscription.updateOne({ userId: user.id }, { razorpaySubscriptionId: id, currentPeriodEnd: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    }
    withRazorpay({ "GET /subscriptions/sub_halted": { id: "sub_halted", status: "halted" }, "GET /subscriptions/sub_ended": { id: "sub_ended", status: "cancelled" } });

    expect(await reconcileAutoRenewals()).toMatchObject({ checked: 2, overdue: 1, ended: 1 });
    expect(await subOf(halted.id)).toMatchObject({ plan: "pro_monthly", status: "past_due", autoRenew: true });
    expect((await subOf(halted.id)).gracePeriodEnd.getTime()).toBeGreaterThan(Date.now() + 2 * DAY_MS);
    expect(await subOf(ended.id)).toMatchObject({ plan: "free", autoRenew: false });
  });

  it("asks nothing of Razorpay for a simulated subscription, or one whose time has not run out", async () => {
    const user = await createUser();
    await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto" });
    const calls = withRazorpay();
    expect(await reconcileAutoRenewals()).toMatchObject({ checked: 0 });
    expect(calls).toHaveLength(0);
  });
});

describe("subscriptions in the admin app", () => {
  it("lists who renews, who is overdue and who turned it off, and lets an admin turn it off for a customer", async () => {
    const admin = await asAdmin();
    const [renewing, overdue, ending, prepaid] = [await createUser(), await createUser(), await createUser(), await createUser()];
    for (const user of [renewing, overdue, ending]) await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto" });
    await devPay(prepaid, { kind: "plan", item: "pro_monthly" });
    await Subscription.updateOne({ userId: overdue.id }, { status: "past_due", gracePeriodEnd: new Date(Date.now() + 2 * DAY_MS) });
    await api().post("/api/billing/auto-renew/stop").set(ending.auth).send({});

    const all = (await admin.get("/subscriptions")).body.data;
    expect(all.total).toBe(3);
    expect(Object.fromEntries(all.items.map((sub) => [sub.account.email, sub.state]))).toEqual({ [renewing.email]: "active", [overdue.email]: "overdue", [ending.email]: "ending" });
    expect(all.items.find((sub) => sub.account.email === renewing.email)).toMatchObject({ plan: "pro_monthly", amountInr: 299, simulated: true, seats: null });
    expect((await admin.get("/subscriptions?state=overdue")).body.data.items.map((sub) => sub.account.email)).toEqual([overdue.email]);
    expect((await admin.get("/subscriptions?plan=pro_annual")).body.data.total).toBe(0);

    // Turned off on the customer's behalf, with a reason, and written down
    expect((await admin.post(`/users/${renewing.id}/auto-renew/stop`, {})).status).toBe(400);
    const stopped = await admin.post(`/users/${renewing.id}/auto-renew/stop`, { reason: "Asked for by the customer on a call" });
    expect(stopped.status).toBe(200);
    expect(stopped.body.data.subscription).toMatchObject({ plan: "pro_monthly", autoRenew: false, cancelAtPeriodEnd: true });
    expect((await AdminAction.findOne({ action: "user.auto_renew_stopped" }).lean()).summary).toContain("Asked for by the customer on a call");
    expect((await admin.post(`/users/${renewing.id}/auto-renew/stop`, { reason: "Again" })).status).toBe(409);
    expect((await admin.post(`/users/${prepaid.id}/auto-renew/stop`, { reason: "Not renewing" })).status).toBe(409);
  });
});

describe("emails about payments and renewal", () => {
  it("tells the customer when a payment is received, when auto-renew starts, and when it is turned off", async () => {
    const user = await createUser();
    await devPay(user, { kind: "plan", item: "pro_monthly", renew: "auto" });
    await flushEvents();
    let subjects = emailsTo(user.email).map((email) => email.subject);
    expect(subjects).toEqual(expect.arrayContaining([expect.stringMatching(/Payment received: Rs\. 299/), expect.stringMatching(/Auto-renew is on/)]));

    await api().post("/api/billing/auto-renew/stop").set(user.auth).send({});
    await flushEvents();
    subjects = emailsTo(user.email).map((email) => email.subject);
    expect(subjects).toEqual(expect.arrayContaining([expect.stringMatching(/Auto-renew is off/)]));
    expect(subjects.filter((subject) => /Payment received/.test(subject))).toHaveLength(1);
  });
});
