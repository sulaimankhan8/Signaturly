import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { api, createUser, PASSWORD, flushEvents, emailsTo } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { PlanSetting } from "../../src/models/PlanSetting.model.js";
import { SalesEnquiry } from "../../src/models/SalesEnquiry.model.js";
import { PLANS, applyPlanSettings, priceOf, sameOffer, yearlyPlanOf, monthlyPlanOf, yearlyIdFor } from "../../src/config/plans.js";
import { loadPlans } from "../../src/services/planCatalogue.service.js";
import { includesOf } from "../../src/services/entitlements.service.js";
import { env } from "../../src/config/env.js";

// A plan is said once and has a monthly price and, where it is sold by the year, a yearly one.
// The yearly price is a record of its own, tied to its plan, and takes everything but its
// price from it.

const DAY_MS = 24 * 60 * 60 * 1000;
const subOf = (userId) => Subscription.findOne({ userId });
const paymentsOf = async (userId) => (await Payment.find({ userId }).sort({ createdAt: 1 })).map((p) => [p.kind, p.plan, p.amount]);
const publicPlans = async () => Object.fromEntries((await api().get("/api/public/plans")).body.data.plans.map((plan) => [plan.id, plan]));

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

const checkout = (user, plan, renew, extra = {}) => api().post("/api/billing/checkout").set(user.auth).send({ plan, renew, ...extra });
const devPay = (user, item, renew, extra = {}) => api().post("/api/billing/dev-pay").set(user.auth).send({ kind: "plan", item, renew, ...extra });

// The database is emptied before each test; the list in memory has to follow it
beforeEach(() => loadPlans());
afterAll(() => applyPlanSettings([]));

describe("a plan and its yearly price", () => {
  it("ships Pro and Business with a yearly price each, which is the same plan", async () => {
    expect(yearlyPlanOf("pro_monthly")).toBe("pro_annual");
    expect(yearlyPlanOf("business_monthly")).toBe("business_annual");
    expect(yearlyPlanOf("enterprise")).toBeNull();
    expect(monthlyPlanOf("pro_annual")).toBe("pro_monthly");
    expect(monthlyPlanOf("pro_monthly")).toBeNull();
    expect(yearlyIdFor("pro_monthly")).toBe("pro_annual");
    expect(yearlyIdFor("startup")).toBe("startup_annual");

    expect(sameOffer("pro_monthly", "pro_annual")).toBe(true);
    expect(sameOffer("pro_annual", "pro_annual")).toBe(true);
    expect(sameOffer("pro_monthly", "business_monthly")).toBe(false);
    expect(sameOffer("pro_monthly", "nothing")).toBe(false);

    // Everything but the price is the plan's
    for (const [monthly, yearly] of [["pro_monthly", "pro_annual"], ["business_monthly", "business_annual"]]) {
      expect(PLANS[yearly]).toMatchObject({ name: PLANS[monthly].name, tier: PLANS[monthly].tier, documentsPerMonth: PLANS[monthly].documentsPerMonth, interval: "year", purchasable: true });
      expect(Boolean(PLANS[yearly].perSeat)).toBe(Boolean(PLANS[monthly].perSeat));
      expect(includesOf(PLANS[yearly])).toEqual(includesOf(PLANS[monthly]));
    }
    expect(priceOf("plan", "pro_annual")).toMatchObject({ amountInr: 2990, description: "PactDoc Pro plan, one year" });
    expect(priceOf("plan", "business_annual", { seats: 3 })).toMatchObject({ amountInr: 14970, seats: 3 });

    const listed = await publicPlans();
    expect(listed.pro_annual).toMatchObject({ name: "Pro", label: "Pro, yearly", yearlyOf: "pro_monthly", interval: "year", priceInr: 2990, highlight: true });
    expect(listed.pro_monthly).toMatchObject({ label: "Pro", yearlyOf: null, tagline: expect.any(String), highlight: true });
    expect(listed.business_annual).toMatchObject({ yearlyOf: "business_monthly", perSeat: true, priceInr: 4990 });
  });

  it("changes what a plan is in one place, and both prices follow", async () => {
    const admin = await asAdmin();
    const res = await admin.patch("/plans/pro_monthly", { name: "Solo", documentsPerMonth: 80, tagline: "For one person", features: { api: true } });
    expect(res.status).toBe(200);

    const listed = await publicPlans();
    for (const id of ["pro_monthly", "pro_annual"]) {
      expect(listed[id], id).toMatchObject({ name: "Solo", documentsPerMonth: 80, tagline: "For one person" });
      expect(listed[id].features.api, id).toBe(true);
    }
    expect(listed.pro_annual.priceInr).toBe(2990);
    expect(priceOf("plan", "pro_annual").description).toBe("PactDoc Solo plan, one year");

    // Whatever an older record of the yearly price says about the plan is not what counts
    await PlanSetting.updateOne({ planId: "pro_annual" }, { $set: { planId: "pro_annual", name: "Pro, paid yearly", tier: "enterprise", documentsPerMonth: 5, priceInr: 2500, interval: "year", purchasable: true, priceIsFrom: true } }, { upsert: true });
    await loadPlans();
    expect(PLANS.pro_annual).toMatchObject({ name: "Solo", tier: "pro", documentsPerMonth: 80, priceInr: 2500, priceIsFrom: false, yearlyOf: "pro_monthly" });
  });

  it("sets the yearly price with the plan, and only its price and sale apart from it", async () => {
    const admin = await asAdmin();

    const changed = await admin.patch("/plans/pro_monthly", { priceInr: 349, yearly: { priceInr: 3490, purchasable: true } });
    expect(changed.status).toBe(200);
    expect(PLANS.pro_monthly.priceInr).toBe(349);
    expect(PLANS.pro_annual).toMatchObject({ priceInr: 3490, purchasable: true });

    // The yearly record itself takes a price and how it is sold, and nothing about the plan
    expect((await admin.patch("/plans/pro_annual", { priceInr: 3290 })).status).toBe(200);
    expect(PLANS.pro_annual.priceInr).toBe(3290);
    for (const about of [{ name: "Pro Year" }, { tier: "business" }, { documentsPerMonth: 500 }, { legacy: true }, { features: { api: true } }, { yearly: { priceInr: 100 } }]) {
      expect((await admin.patch("/plans/pro_annual", about)).status, JSON.stringify(about)).toBe(400);
    }

    // A year that costs more than twelve months is refused, whichever of the two prices moved
    expect((await admin.patch("/plans/pro_monthly", { yearly: { priceInr: 349 * 12 + 1 } })).status).toBe(400);
    expect((await admin.patch("/plans/pro_monthly", { priceInr: 200 })).status).toBe(400);
    expect(PLANS.pro_monthly.priceInr).toBe(349);
    expect((await admin.patch("/plans/pro_monthly", { priceInr: 300, yearly: { priceInr: 3000 } })).status).toBe(200);

    // Not sold by the year: off sale, and kept for whoever is on it
    expect((await admin.patch("/plans/pro_monthly", { yearly: null })).status).toBe(200);
    expect(PLANS.pro_annual).toMatchObject({ priceInr: 3000, purchasable: false });
    expect(priceOf("plan", "pro_annual")).toBeNull();
    expect((await checkout(await createUser(), "pro_annual", "once")).status).toBe(400);
    expect((await publicPlans()).pro_annual.purchasable).toBe(false);

    // Free, Lifetime and a yearly price have no yearly price of their own; a plan that has one stays monthly
    expect((await admin.patch("/plans/free", { yearly: { priceInr: 100 } })).status).toBe(400);
    expect((await admin.patch("/plans/business_monthly", { interval: "year" })).status).toBe(400);
  });

  it("gives a plan added here a yearly price too, and lists the two together for the admin", async () => {
    const admin = await asAdmin();
    const added = await admin.post("/plans", { id: "studio", name: "Studio", tier: "pro", interval: "month", documentsPerMonth: 120, priceInr: 599, purchasable: true, tagline: "For small studios", yearly: { priceInr: 5990, purchasable: true } });
    expect(added.status).toBe(201);
    expect(PLANS.studio_annual).toMatchObject({ name: "Studio", yearlyOf: "studio", interval: "year", priceInr: 5990, documentsPerMonth: 120, purchasable: true });

    const { plans } = (await admin.get("/plans")).body.data;
    const yearly = plans.find((plan) => plan.id === "studio_annual");
    expect(yearly).toMatchObject({ yearlyOf: "studio", label: "Studio, yearly", canChange: ["priceInr", "purchasable", "sellSubscription", "sellPrepaid"], shipped: false });
    expect(plans.find((plan) => plan.id === "studio")).toMatchObject({ yearlyOf: null, tagline: "For small studios" });

    // Retiring the plan retires it at both prices
    expect((await admin.patch("/plans/studio", { legacy: true })).status).toBe(200);
    expect(PLANS.studio_annual).toMatchObject({ legacy: true, purchasable: false });
    expect(Object.keys(await publicPlans())).not.toContain("studio_annual");

    // An id already used for something else is not taken over
    await admin.post("/plans", { id: "desk_annual", name: "Desk year", tier: "pro", interval: "year", documentsPerMonth: 10, priceInr: 900 });
    expect((await admin.post("/plans", { id: "desk", name: "Desk", tier: "pro", interval: "month", documentsPerMonth: 10, priceInr: 99, yearly: { priceInr: 990 } })).status).toBe(409);
  });
});

describe("moving a plan between its monthly and its yearly price", () => {
  it("adds a prepaid year after the days of a month still paid for", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    const firstEnd = (await subOf(user.id)).currentPeriodEnd.getTime();

    expect((await devPay(user, "pro_annual")).status).toBe(200);
    const sub = await subOf(user.id);
    expect(sub.plan).toBe("pro_annual");
    expect(sub.currentPeriodEnd.getTime() - firstEnd).toBe(365 * DAY_MS);
    expect(await paymentsOf(user.id)).toEqual([["purchase", "pro_monthly", 299], ["purchase", "pro_annual", 2990]]);

    // And back: a month after the year
    await devPay(user, "pro_monthly");
    expect((await subOf(user.id)).currentPeriodEnd.getTime() - firstEnd).toBe(395 * DAY_MS);
  });

  it("keeps the time on a plan sold by the seat while the seats stay as they are", async () => {
    const user = await createUser();
    await devPay(user, "business_monthly", "once", { seats: 3 });
    const firstEnd = (await subOf(user.id)).currentPeriodEnd.getTime();

    await devPay(user, "business_annual", "once", { seats: 3 });
    expect((await subOf(user.id)).currentPeriodEnd.getTime() - firstEnd).toBe(365 * DAY_MS);

    // A different number of seats starts afresh
    await devPay(user, "business_monthly", "once", { seats: 5 });
    const sub = await subOf(user.id);
    expect(sub.seats).toBe(5);
    expect(Math.abs(sub.currentPeriodEnd.getTime() - (Date.now() + 30 * DAY_MS))).toBeLessThan(60 * 1000);
  });

  it("subscribes by the year from the day the paid month ends, charging nothing today", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly");
    const paidUntil = (await subOf(user.id)).currentPeriodEnd;

    const order = await checkout(user, "pro_annual", "auto");
    expect(order.body.data).toMatchObject({ mode: "subscription", plan: "pro_annual", interval: "year", renewsAtInr: 2990 });
    expect(new Date(order.body.data.startsOn)).toEqual(paidUntil);

    expect((await devPay(user, "pro_annual", "auto")).status).toBe(200);
    const sub = await subOf(user.id);
    expect(sub).toMatchObject({ plan: "pro_annual", autoRenew: true, renewalAmountInr: 2990 });
    expect(sub.currentPeriodEnd).toEqual(paidUntil);
    // Nothing was paid for the year yet
    expect(await paymentsOf(user.id)).toEqual([["purchase", "pro_monthly", 299]]);
  });

  it("moves a plan that renews to its other price in one step, and to no other plan", async () => {
    const user = await createUser();
    await devPay(user, "pro_monthly", "auto");
    const before = await subOf(user.id);

    // Another plan, or the same price again, still means turning auto-renew off first
    expect((await checkout(user, "business_monthly", "auto", { seats: 2 })).status).toBe(409);
    expect((await checkout(user, "pro_monthly", "auto")).status).toBe(409);

    expect((await checkout(user, "pro_annual", "auto")).status).toBe(200);
    expect((await devPay(user, "pro_annual", "auto")).status).toBe(200);
    const after = await subOf(user.id);
    expect(after).toMatchObject({ plan: "pro_annual", autoRenew: true, renewalAmountInr: 2990, status: "active" });
    expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
    expect(after.razorpaySubscriptionId).not.toBe(before.razorpaySubscriptionId);

    const renewal = (await api().get("/api/billing/subscription").set(user.auth)).body.data.renewal;
    expect(renewal).toMatchObject({ mode: "auto", interval: "year", amountInr: 2990 });
  });
});

describe("contact sales", () => {
  const enquiry = (extra = {}) => ({ name: "Asha Rao", email: "asha@example.test", company: "Rao & Co", teamSize: "51-200", message: "Single sign-on for 80 people.", plan: "enterprise", ...extra });

  it("keeps an enquiry, sends it on, and lets an admin follow it up", async () => {
    env.salesEmail = "sales@example.test";
    const sent = await api().post("/api/public/sales-enquiries").send(enquiry());
    expect(sent.status).toBe(201);
    await flushEvents();

    const [mail] = emailsTo("sales@example.test");
    expect(mail).toMatchObject({ replyTo: "asha@example.test", subject: "Sales enquiry from Asha Rao (Rao & Co)" });
    expect(mail.text).toContain("Single sign-on for 80 people.");

    const admin = await asAdmin();
    const list = (await admin.get("/sales-enquiries")).body.data;
    expect(list).toMatchObject({ total: 1, waiting: 1 });
    expect(list.items[0]).toMatchObject({ name: "Asha Rao", email: "asha@example.test", company: "Rao & Co", teamSize: "51-200", plan: "enterprise", planName: "Enterprise", status: "new" });

    const id = list.items[0].id;
    expect((await admin.patch(`/sales-enquiries/${id}`, {})).status).toBe(400);
    const marked = await admin.patch(`/sales-enquiries/${id}`, { status: "contacted", note: "Replied with a quote" });
    expect(marked.body.data.enquiry).toMatchObject({ status: "contacted", note: "Replied with a quote" });
    expect((await admin.patch(`/sales-enquiries/${id}`, { status: "contacted", note: "Replied with a quote" })).status).toBe(400);
    expect((await admin.get("/sales-enquiries?status=new")).body.data).toMatchObject({ total: 0, waiting: 0 });
    expect((await admin.get("/sales-enquiries?status=contacted")).body.data.total).toBe(1);
    env.salesEmail = "";
  });

  it("refuses what is not an enquiry, and keeps nothing from a program filling in forms", async () => {
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ name: "" }))).status).toBe(400);
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ email: "not an address" }))).status).toBe(400);
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ teamSize: "lots" }))).status).toBe(400);
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ message: "x".repeat(2001) }))).status).toBe(400);
    expect(await SalesEnquiry.countDocuments()).toBe(0);

    // The box no person sees was filled in: thanked like anyone else, and not kept
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ website: "https://example.test" }))).status).toBe(201);
    expect(await SalesEnquiry.countDocuments()).toBe(0);

    // A plan that is not on the list is not recorded as one; the enquiry is still taken
    expect((await api().post("/api/public/sales-enquiries").send(enquiry({ plan: "made_up" }))).status).toBe(201);
    expect((await SalesEnquiry.findOne().lean()).plan).toBe("");

    // Only an admin reads them
    const user = await createUser();
    expect((await api().get("/api/admin/sales-enquiries").set(user.auth)).status).toBeGreaterThanOrEqual(401);
  });
});
