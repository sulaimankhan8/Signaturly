import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import crypto from "crypto";
import { api, createUser } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { Invoice } from "../../src/models/Invoice.model.js";
import { ProviderPlan } from "../../src/models/ProviderPlan.model.js";
import { PlanSetting } from "../../src/models/PlanSetting.model.js";
import { applyPlanSettings } from "../../src/config/plans.js";
import { loadPlans } from "../../src/services/planCatalogue.service.js";
import { applyOrderPaid } from "../../src/services/billingEvents.service.js";
import { env } from "../../src/config/env.js";

// A plan that renews by itself, a plan paid for one period at a time, and moving between the two.

const DAY_MS = 24 * 60 * 60 * 1000;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const subOf = (userId) => Subscription.findOne({ userId });
const paymentsOf = async (userId) => (await Payment.find({ userId }).sort({ createdAt: 1 })).map((p) => [p.kind, p.amount]);

const checkout = (user, plan, renew) => api().post("/api/billing/checkout").set(user.auth).send({ plan, renew });
const devPay = (user, item, renew) => api().post("/api/billing/dev-pay").set(user.auth).send({ kind: "plan", item, renew });
const renewalOf = async (user) => (await api().get("/api/billing/subscription").set(user.auth)).body.data.renewal;
const stop = (user) => api().post("/api/billing/auto-renew/stop").set(user.auth).send({});

let counter = 0;
const razorpay = (event, payload) => {
  counter += 1;
  const body = JSON.stringify({ event, payload, created_at: nowSeconds() + counter });
  const signature = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex");
  return api()
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set({ "x-razorpay-signature": signature, "x-razorpay-event-id": `rzp_auto_${counter}` })
    .send(body);
};

// The database is emptied before each test; the plan list in memory has to follow it
beforeEach(() => loadPlans());
afterAll(() => applyPlanSettings([]));

describe("buying a plan that renews by itself (simulated provider)", () => {
  it("grants the plan, records the first payment, and says when and for how much it renews", async () => {
    const user = await createUser();
    const order = await checkout(user, "pro_monthly", "auto");
    expect(order.body.data).toMatchObject({ isMock: true, mode: "subscription", plan: "pro_monthly", amount: 299, interval: "month", startsOn: null });
    expect((await subOf(user.id))?.plan || "free").toBe("free"); // starting checkout grants nothing

    expect((await devPay(user, "pro_monthly", "auto")).status).toBe(200);
    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: true, renewalAmountInr: 299, monthlyQuota: 50 });
    expect(sub.razorpaySubscriptionId).toMatch(/^sim_sub_/);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299]]);
    expect(await Invoice.countDocuments({ userId: user.id })).toBe(1);

    const renewal = await renewalOf(user);
    expect(renewal).toMatchObject({ mode: "auto", interval: "month", amountInr: 299, canStop: true, canStart: false, canAddPeriod: false, overdue: false });
    expect(new Date(renewal.nextChargeOn).getTime()).toBe(sub.currentPeriodEnd.getTime());
  });

  it("extends the plan and issues an invoice at each automatic charge", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly", "auto");
    const firstEnd = (await subOf(user.id)).currentPeriodEnd.getTime();

    expect((await api().post("/api/billing/dev-renew").set(user.auth).send({})).status).toBe(200);
    const sub = await subOf(user.id);
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(firstEnd + 29 * DAY_MS);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: true });
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299], ["renewal", 299]]);
    expect(await Invoice.countDocuments({ userId: user.id })).toBe(2);
  });

  it("refuses a single period, or a second subscription, while the plan already renews", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly", "auto");

    expect((await checkout(user, "pro_monthly", "once")).status).toBe(409);
    expect((await checkout(user, "pro_annual", "once")).status).toBe(409);
    expect((await checkout(user, "pro_monthly", "auto")).status).toBe(409);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299]]);
  });

  it("does not offer auto-renew for a plan priced by agreement, one no longer sold, or one that is not a plan", async () => {
    const user = await createUser();
    for (const plan of ["enterprise", "lifetime", "free", "no-such-plan"]) {
      expect((await checkout(user, plan, "auto")).status, plan).toBe(400);
    }
    expect((await devPay(user, "enterprise", "auto")).status).toBe(400);
    expect((await subOf(user.id))?.autoRenew || false).toBe(false);
  });

  it("renews a plan sold by the seat for the seats it was subscribed with", async () => {
    const user = await createUser();
    const order = await api().post("/api/billing/checkout").set(user.auth).send({ plan: "business_monthly", renew: "auto", seats: 3 });
    expect(order.body.data).toMatchObject({ isMock: true, mode: "subscription", plan: "business_monthly", seats: 3, amount: 1497 });

    await api().post("/api/billing/dev-pay").set(user.auth).send({ kind: "plan", item: "business_monthly", renew: "auto", seats: 3 });
    expect(await subOf(user.id)).toMatchObject({ plan: "business_monthly", seats: 3, monthlyQuota: 300, autoRenew: true, renewalAmountInr: 1497 });
    expect(await paymentsOf(user.id)).toEqual([["purchase", 1497]]);
    expect(await renewalOf(user)).toMatchObject({ mode: "auto", amountInr: 1497, canAddPeriod: false });

    // Each renewal is for the same seats, and keeps their pooled allowance
    await api().post("/api/billing/dev-renew").set(user.auth).send({});
    expect(await subOf(user.id)).toMatchObject({ seats: 3, monthlyQuota: 300, autoRenew: true });
    expect(await paymentsOf(user.id)).toEqual([["purchase", 1497], ["renewal", 1497]]);
  });

  it("asks for auto-renew to be turned off before seats are added, and carries the new number when it is turned on again", async () => {
    const user = await createUser();
    const pay = (body) => api().post("/api/billing/dev-pay").set(user.auth).send(body);
    await pay({ kind: "plan", item: "business_monthly", renew: "auto", seats: 2 });

    const refused = await api().post("/api/billing/checkout").set(user.auth).send({ kind: "seats", item: "1" });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/renews automatically for 2 seats/);

    await stop(user);
    expect((await pay({ kind: "seats", item: "1" })).status).toBe(200);
    expect((await subOf(user.id)).seats).toBe(3);

    // Turned on again with time still paid for: nothing is charged now, and the renewal is for three seats
    const order = await api().post("/api/billing/checkout").set(user.auth).send({ plan: "business_monthly", renew: "auto" });
    expect(order.body.data).toMatchObject({ seats: 3, amount: 1497 });
    expect(order.body.data.startsOn).toBeTruthy();
    await pay({ kind: "plan", item: "business_monthly", renew: "auto" });
    expect(await subOf(user.id)).toMatchObject({ seats: 3, autoRenew: true, renewalAmountInr: 1497 });
  });

  it("stops renewing and keeps the time paid for", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly", "auto");
    const end = (await subOf(user.id)).currentPeriodEnd.getTime();

    const res = await stop(user);
    expect(res.status).toBe(200);
    expect(res.body.data.renewal).toMatchObject({ mode: "once", canStart: true, canAddPeriod: true });

    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: false, renewalAmountInr: null, cancelAtPeriodEnd: true });
    expect(sub.currentPeriodEnd.getTime()).toBe(end);
    expect((await stop(user)).status).toBe(409);
    // Nothing is left to simulate a charge on
    expect((await api().post("/api/billing/dev-renew").set(user.auth).send({})).status).toBe(400);
  });
});

describe("a plan paid for one period at a time", () => {
  it("does not renew, and says so", async () => {
    const user = await createUser();
    expect((await checkout(user, "pro_monthly")).body.data).toMatchObject({ isMock: true, amount: 299, kind: "plan" });
    await devPay(user, "pro_monthly");

    expect(await subOf(user.id)).toMatchObject({ plan: "pro_monthly", autoRenew: false, razorpaySubscriptionId: null });
    const renewal = await renewalOf(user);
    expect(renewal).toMatchObject({ mode: "once", interval: "month", amountInr: 299, canStart: true, canAddPeriod: true, canStop: false, nextChargeOn: null });
  });

  it("adds a period bought early to the end of the time left, and applies one payment once", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    const firstEnd = (await subOf(user.id)).currentPeriodEnd.getTime();

    await devPay(user, "pro_monthly");
    const secondEnd = (await subOf(user.id)).currentPeriodEnd.getTime();
    expect(secondEnd - firstEnd).toBe(30 * DAY_MS);

    // The provider reporting the same payment twice adds nothing more
    const payment = { providerPaymentId: "pay_twice", amount: 299, currency: "INR" };
    expect(await applyOrderPaid({ provider: "razorpay", userId: user.id, kind: "plan", item: "pro_monthly", payment })).toEqual({ granted: true });
    expect(await applyOrderPaid({ provider: "razorpay", userId: user.id, kind: "plan", item: "pro_monthly", payment })).toEqual({ granted: false, reason: "already granted" });
    expect((await subOf(user.id)).currentPeriodEnd.getTime() - secondEnd).toBe(30 * DAY_MS);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299], ["purchase", 299], ["purchase", 299]]);
  });

  it("starts a different plan from today", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    // Pro by the year is the same plan and would carry on from the month (plan-prices.test.js); Business is another
    await api().post("/api/billing/dev-pay").set(user.auth).send({ kind: "plan", item: "business_annual", seats: 2 });
    const sub = await subOf(user.id);
    expect(sub.plan).toBe("business_annual");
    expect(Math.abs(sub.currentPeriodEnd.getTime() - (Date.now() + 365 * DAY_MS))).toBeLessThan(60 * 1000);
  });

  it("turns on auto-renew without charging for the time already paid for", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    const end = (await subOf(user.id)).currentPeriodEnd;

    const order = await checkout(user, "pro_monthly", "auto");
    expect(new Date(order.body.data.startsOn).getTime()).toBe(end.getTime());

    await devPay(user, "pro_monthly", "auto");
    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", autoRenew: true, renewalAmountInr: 299, cancelAtPeriodEnd: false });
    expect(sub.currentPeriodEnd.getTime()).toBe(end.getTime());
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299]]);
    expect(await renewalOf(user)).toMatchObject({ mode: "auto", amountInr: 299 });
  });

  it("can be bought again after auto-renew was turned off", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly", "auto");
    await stop(user);
    const end = (await subOf(user.id)).currentPeriodEnd.getTime();

    expect((await devPay(user, "pro_monthly")).status).toBe(200);
    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", autoRenew: false, cancelAtPeriodEnd: false, razorpaySubscriptionId: null });
    expect(sub.currentPeriodEnd.getTime() - end).toBe(30 * DAY_MS);
  });
});

describe("auto-renew through Razorpay", () => {
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  // Razorpay as this server talks to it: plans, subscriptions, and cancelling one
  const withRazorpay = (status = "active") => {
    env.razorpayKeyId = "rzp_test_key";
    env.razorpayKeySecret = "rzp_test_secret";
    const calls = [];
    let made = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      const path = String(url).replace("https://api.razorpay.com/v1", "");
      const sent = options.body ? JSON.parse(options.body) : null;
      calls.push({ method: options.method || "GET", path, sent });
      made += 1;
      if (path === "/plans") return json({ id: `plan_rzp_${made}` });
      if (path === "/subscriptions") return json({ id: `sub_rzp_${made}`, status: "created" });
      if (/^\/subscriptions\/[^/]+$/.test(path)) return json({ id: path.split("/")[2], status });
      if (/^\/subscriptions\/[^/]+\/cancel$/.test(path)) return json({ id: path.split("/")[2], status: "active" });
      return new Response("", { status: 404 });
    });
    return calls;
  };

  afterEach(() => {
    vi.restoreAllMocks();
    env.razorpayKeyId = undefined;
    env.razorpayKeySecret = undefined;
  });

  const subscription = (id, planId, userId, extra = {}) => ({ entity: { id, plan_id: planId, notes: { userId, plan: "pro_monthly", kind: "auto_renew" }, ...extra } });
  const payment = (id, amount = 29900, extra = {}) => ({ entity: { id, amount, currency: "INR", ...extra } });

  it("makes a Razorpay plan once for a price, and a subscription for each customer", async () => {
    const calls = withRazorpay();
    const [first, second] = [await createUser(), await createUser()];

    const order = (await checkout(first, "pro_monthly", "auto")).body.data;
    expect(order).toMatchObject({ isMock: false, gateway: "razorpay", mode: "subscription", keyId: "rzp_test_key", amountPaise: 29900 });
    expect(order.subscriptionId).toMatch(/^sub_rzp_/);
    await checkout(second, "pro_monthly", "auto");

    expect(calls.filter((call) => call.path === "/plans")).toHaveLength(1);
    expect(calls.find((call) => call.path === "/plans").sent).toMatchObject({ period: "monthly", interval: 1, item: { amount: 29900, currency: "INR" } });
    const made = calls.filter((call) => call.path === "/subscriptions");
    expect(made).toHaveLength(2);
    expect(made[0].sent).toMatchObject({ quantity: 1, notes: { userId: first.id, plan: "pro_monthly", seats: "1" } });
    expect(made[0].sent.start_at).toBeUndefined();
    expect(made[0].sent.plan_id).toBe(made[1].sent.plan_id);
    expect(await ProviderPlan.findOne({ planId: "pro_monthly" }).lean()).toMatchObject({ provider: "razorpay", priceInr: 299, interval: "month", providerPlanId: made[0].sent.plan_id });

    // Nothing is granted until Razorpay reports to the webhook
    expect((await subOf(first.id))?.plan || "free").toBe("free");
  });

  it("starts the subscription when the time already paid for ends", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    const end = (await subOf(user.id)).currentPeriodEnd;

    const calls = withRazorpay();
    await checkout(user, "pro_monthly", "auto");
    expect(calls.find((call) => call.path === "/subscriptions").sent.start_at).toBe(Math.floor(end.getTime() / 1000));
  });

  it("follows approval, the first charge and each renewal, counting each payment once", async () => {
    withRazorpay();
    const user = await createUser();
    const { subscriptionId } = (await checkout(user, "pro_monthly", "auto")).body.data;
    const { providerPlanId } = await ProviderPlan.findOne({ planId: "pro_monthly" }).lean();
    const firstEnd = nowSeconds() + 30 * 86400;

    await razorpay("subscription.authenticated", { subscription: subscription(subscriptionId, providerPlanId, user.id) });
    await razorpay("subscription.activated", { subscription: subscription(subscriptionId, providerPlanId, user.id, { current_end: firstEnd }) });
    await razorpay("subscription.charged", { subscription: subscription(subscriptionId, providerPlanId, user.id, { current_end: firstEnd, paid_count: 1 }), payment: payment("pay_first") });
    // The same charge is also announced as a captured payment, against Razorpay's own invoice
    await razorpay("payment.captured", { payment: payment("pay_first", 29900, { invoice_id: "inv_1", notes: { userId: user.id, plan: "pro_monthly" } }) });

    let sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: true, renewalAmountInr: 299, razorpaySubscriptionId: subscriptionId });
    expect(sub.currentPeriodEnd.getTime()).toBe(firstEnd * 1000);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299]]);

    const secondEnd = firstEnd + 30 * 86400;
    await razorpay("subscription.charged", { subscription: subscription(subscriptionId, providerPlanId, user.id, { current_end: secondEnd, paid_count: 2 }), payment: payment("pay_second") });
    sub = await subOf(user.id);
    expect(sub.currentPeriodEnd.getTime()).toBe(secondEnd * 1000);
    expect(await paymentsOf(user.id)).toEqual([["purchase", 299], ["renewal", 299]]);
  });

  it("keeps a customer's price when the plan's price is changed, and charges new subscribers the new one", async () => {
    const calls = withRazorpay();
    const [early, late] = [await createUser(), await createUser()];
    const { subscriptionId } = (await checkout(early, "pro_monthly", "auto")).body.data;
    const old = await ProviderPlan.findOne({ planId: "pro_monthly", priceInr: 299 }).lean();
    await razorpay("subscription.activated", { subscription: subscription(subscriptionId, old.providerPlanId, early.id, { current_end: nowSeconds() + 30 * 86400 }), payment: payment("pay_early") });

    await PlanSetting.create({ planId: "pro_monthly", name: "Pro", tier: "pro", documentsPerMonth: 50, priceInr: 349, interval: "month", purchasable: true });
    await loadPlans();

    expect((await checkout(late, "pro_monthly", "auto")).body.data.amountPaise).toBe(34900);
    expect(calls.filter((call) => call.path === "/plans")).toHaveLength(2);
    expect(await ProviderPlan.countDocuments({ planId: "pro_monthly" })).toBe(2);

    // The earlier subscriber's renewals are still what they agreed to
    await razorpay("subscription.charged", { subscription: subscription(subscriptionId, old.providerPlanId, early.id, { current_end: nowSeconds() + 60 * 86400, paid_count: 2 }), payment: payment("pay_early_2") });
    expect(await subOf(early.id)).toMatchObject({ autoRenew: true, renewalAmountInr: 299 });
    expect(await renewalOf(early)).toMatchObject({ mode: "auto", amountInr: 299 });
    expect(await paymentsOf(early.id)).toEqual([["purchase", 299], ["renewal", 299]]);
  });

  it("subscribes a plan sold by the seat with its seats as the quantity, and grants those seats", async () => {
    const calls = withRazorpay();
    const user = await createUser();
    const order = (await api().post("/api/billing/checkout").set(user.auth).send({ plan: "business_monthly", renew: "auto", seats: 4 })).body.data;
    expect(order).toMatchObject({ mode: "subscription", seats: 4, amountPaise: 199600 });
    expect(calls.find((call) => call.path === "/plans").sent.item.amount).toBe(49900);
    expect(calls.find((call) => call.path === "/subscriptions").sent).toMatchObject({ quantity: 4, notes: { seats: "4" } });

    const { providerPlanId } = await ProviderPlan.findOne({ planId: "business_monthly" }).lean();
    const entity = { id: order.subscriptionId, plan_id: providerPlanId, quantity: 4, current_end: nowSeconds() + 30 * 86400, paid_count: 1, notes: { userId: user.id, plan: "business_monthly", seats: "4" } };
    await razorpay("subscription.charged", { subscription: { entity }, payment: payment("pay_team", 199600) });

    expect(await subOf(user.id)).toMatchObject({ plan: "business_monthly", seats: 4, monthlyQuota: 400, autoRenew: true, renewalAmountInr: 1996 });
    expect(await paymentsOf(user.id)).toEqual([["purchase", 1996]]);
  });

  it("grants nothing for a subscription on a Razorpay plan this server did not make", async () => {
    withRazorpay();
    const user = await createUser();
    await razorpay("subscription.activated", { subscription: subscription("sub_other", "plan_from_elsewhere", user.id, { current_end: nowSeconds() + 30 * 86400 }), payment: payment("pay_other") });
    expect((await subOf(user.id))?.plan || "free").toBe("free");
    expect(await Payment.countDocuments({ userId: user.id })).toBe(0);
  });

  it("ends a running subscription with its period, and calls off one that has not started", async () => {
    let calls = withRazorpay("active");
    const running = await createUser();
    const started = (await checkout(running, "pro_monthly", "auto")).body.data;
    const { providerPlanId } = await ProviderPlan.findOne({ planId: "pro_monthly" }).lean();
    await razorpay("subscription.activated", { subscription: subscription(started.subscriptionId, providerPlanId, running.id, { current_end: nowSeconds() + 30 * 86400 }), payment: payment("pay_running") });

    expect((await stop(running)).status).toBe(200);
    expect(calls.find((call) => call.path.endsWith("/cancel"))).toMatchObject({ method: "POST", path: `/subscriptions/${started.subscriptionId}/cancel`, sent: { cancel_at_cycle_end: 1 } });
    expect(await subOf(running.id)).toMatchObject({ plan: "pro_monthly", autoRenew: false, cancelAtPeriodEnd: true });

    // Razorpay's own word that it has ended changes nothing while the paid time lasts
    await razorpay("subscription.cancelled", { subscription: subscription(started.subscriptionId, providerPlanId, running.id) });
    expect(await subOf(running.id)).toMatchObject({ plan: "pro_monthly", status: "active" });

    vi.restoreAllMocks();
    calls = withRazorpay("authenticated");
    const waiting = await createUser();
    await devPay(waiting, "pro_monthly");
    const later = (await checkout(waiting, "pro_monthly", "auto")).body.data;
    await razorpay("subscription.authenticated", { subscription: subscription(later.subscriptionId, providerPlanId, waiting.id) });
    expect((await subOf(waiting.id)).autoRenew).toBe(true);

    expect((await stop(waiting)).status).toBe(200);
    expect(calls.find((call) => call.path.endsWith("/cancel")).sent).toEqual({ cancel_at_cycle_end: 0 });
    expect(await subOf(waiting.id)).toMatchObject({ plan: "pro_monthly", status: "active", autoRenew: false });
  });
});
