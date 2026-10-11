import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { api, createUser, sendDocument, uploadPdf, flushEvents, emailsTo } from "../helpers.js";
import { setPlan } from "../templates/fixtures.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { Invoice } from "../../src/models/Invoice.model.js";
import { Wallet, WalletEntry } from "../../src/models/Wallet.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { User } from "../../src/models/User.model.js";
import { env } from "../../src/config/env.js";
import { PLANS, TOPUP_PACKS, UNLIMITED, priceOf, publicCatalogue } from "../../src/config/plans.js";
import { getOrCreateSubscription, reserveQuota, releaseQuota } from "../../src/services/subscription.service.js";
import { creditWallet, debitWallet, getWallet, auditWallet } from "../../src/services/wallet.service.js";
import { issueInvoiceForPayment, splitTax, financialYearOf, isGstin } from "../../src/services/invoice.service.js";
import { up as migratePlans } from "../../src/migrations/001-plans-2026-10.js";
import { runMigrations, AppliedMigration } from "../../src/migrations/index.js";
import { messageOutbox } from "../../src/services/messaging/index.js";

const subOf = (userId) => Subscription.findOne({ userId });
const future = (days) => new Date(Date.now() + days * 86400000);
const past = (days) => new Date(Date.now() - days * 86400000);

const devPay = (user, kind, item) => api().post("/api/billing/dev-pay").set(user.auth).send({ kind, item });

const razorpay = (body, eventId) => {
  const payload = JSON.stringify(body);
  const signature = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(payload).digest("hex");
  return api()
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set({ "x-razorpay-signature": signature, "x-razorpay-event-id": eventId })
    .send(payload);
};

const captured = (userId, paymentId, amount, notes) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, amount, currency: "INR", notes: { userId, ...notes } } } },
});

const paymentFor = (userId, amount = 299, extra = {}) =>
  Payment.create({ userId, provider: "razorpay", providerPaymentId: `pay_${crypto.randomBytes(6).toString("hex")}`, kind: "purchase", plan: "pro_monthly", amount, currency: "INR", ...extra });

const sellerBefore = { gstin: env.sellerGstin, state: env.sellerStateCode, name: env.sellerLegalName, charging: env.usageChargingEnabled, messaging: env.messagingEnabled };
afterEach(() => {
  env.sellerGstin = sellerBefore.gstin;
  env.sellerStateCode = sellerBefore.state;
  env.sellerLegalName = sellerBefore.name;
  env.usageChargingEnabled = sellerBefore.charging;
  env.messagingEnabled = sellerBefore.messaging;
});

// ============================================================================================
describe("P4-13 the plan catalogue", () => {
  it("gives Free 5 documents, Pro 50 for Rs. 299, and keeps lifetime unlimited", () => {
    expect(PLANS.free).toMatchObject({ documentsPerMonth: 5, priceInr: 0 });
    expect(PLANS.pro_monthly).toMatchObject({ documentsPerMonth: 50, priceInr: 299, interval: "month" });
    expect(PLANS.lifetime.documentsPerMonth).toBe(UNLIMITED);
  });

  it("starts a new account on Free with 5 documents a month", async () => {
    const user = await createUser();
    expect(await getOrCreateSubscription(user.id)).toMatchObject({ plan: "free", monthlyQuota: 5, extraDocuments: 0 });
  });

  it("does not sell the lifetime plan, or Enterprise by button", async () => {
    const user = await createUser();
    expect(priceOf("plan", "lifetime")).toBeNull();
    expect(priceOf("plan", "enterprise")).toBeNull();

    for (const plan of ["lifetime", "enterprise", "no-such-plan", "__proto__"]) {
      const res = await api().post("/api/billing/checkout").set(user.auth).send({ plan });
      expect(res.status, plan).toBe(400);
    }
    expect((await devPay(user, "plan", "lifetime")).status).toBe(400);
    expect((await subOf(user.id))?.plan || "free").toBe("free");

    // A signed payment event naming the lifetime plan grants nothing either
    await razorpay(captured(user.id, "pay_ltd", 549900, { plan: "lifetime" }), "evt_ltd");
    expect((await subOf(user.id))?.plan || "free").toBe("free");
  });

  it("starts checkout for Pro at the catalogue price, and grants it when paid", async () => {
    const user = await createUser();
    const order = await api().post("/api/billing/checkout").set(user.auth).send({ plan: "pro_monthly" });
    expect(order.body.data).toMatchObject({ isMock: true, amount: 299, currency: "INR", kind: "plan", item: "pro_monthly" });
    expect((await subOf(user.id))?.plan || "free").toBe("free"); // starting checkout grants nothing

    expect((await devPay(user, "plan", "pro_monthly")).status).toBe(200);
    expect(await subOf(user.id)).toMatchObject({ plan: "pro_monthly", status: "active", monthlyQuota: 50 });
  });

  it("grants nothing for a payment that does not match the price of what it names", async () => {
    const user = await createUser();
    await razorpay(captured(user.id, "pay_cheap", 100, { plan: "pro_monthly" }), "evt_cheap");
    expect((await subOf(user.id))?.plan || "free").toBe("free");

    await razorpay(captured(user.id, "pay_ok", 29900, { plan: "pro_monthly" }), "evt_ok");
    expect((await subOf(user.id)).plan).toBe("pro_monthly");
  });

  it("lists plans publicly, without the plan that is no longer sold", async () => {
    const res = await api().get("/api/public/plans");
    expect(res.status).toBe(200);
    const { plans, topups, pricesIncludeGst } = res.body.data;
    expect(pricesIncludeGst).toBe(true);
    expect(plans.map((p) => p.id).sort()).toEqual(["business_monthly", "enterprise", "free", "pro_annual", "pro_monthly"]);
    expect(plans.find((p) => p.id === "business_monthly")).toMatchObject({ priceInr: 499, perSeat: true, purchasable: true });
    expect(plans.find((p) => p.id === "pro_monthly")).toMatchObject({ priceInr: 299, documentsPerMonth: 50, purchasable: true });
    expect(plans.find((p) => p.id === "enterprise")).toMatchObject({ documentsPerMonth: null, purchasable: false });
    expect(topups).toEqual(publicCatalogue().topups);
  });
});

describe("P4-13 moving existing accounts to the new plans", () => {
  const seed = async () => {
    const id = () => new Subscription()._id; // any fresh object id
    const rows = {
      free: { plan: "free", status: "free", monthlyQuota: 15, usedThisMonth: 9 },
      paidUp: { plan: "pro_monthly", status: "active", monthlyQuota: 999999, currentPeriodEnd: future(20) },
      yearly: { plan: "pro_annual", status: "active", monthlyQuota: 999999, currentPeriodEnd: future(200) },
      lapsed: { plan: "pro_monthly", status: "past_due", monthlyQuota: 999999, currentPeriodEnd: past(2) },
      lifetime: { plan: "lifetime", status: "active", monthlyQuota: 999999, currentPeriodEnd: future(30000) },
      enterprise: { plan: "enterprise", status: "active", monthlyQuota: 999999, currentPeriodEnd: future(10) },
      unknown: { plan: "starter_2024", status: "active", monthlyQuota: 100 },
    };
    const ids = {};
    for (const [name, row] of Object.entries(rows)) {
      ids[name] = id();
      // Written through the driver, as old rows are: no defaults, and plan values the schema no longer lists
      await Subscription.collection.insertOne({ _id: ids[name], userId: id(), ...row });
    }
    const read = async (name) => Subscription.collection.findOne({ _id: ids[name] });
    return { read };
  };

  it("maps every old plan value and takes away nothing that was paid for", async () => {
    const { read } = await seed();
    const counts = await migratePlans();
    expect(counts).toEqual({ free: 1, grandfathered: 2, moved: 1, unchanged: 2, unknown: 1 });

    expect(await read("free")).toMatchObject({ plan: "free", monthlyQuota: 5, usedThisMonth: 9, extraDocuments: 0 });

    // Inside a period they already paid for: unlimited until it ends
    const paidUp = await read("paidUp");
    expect(paidUp.monthlyQuota).toBe(999999);
    expect(paidUp.quotaGrandfatheredUntil.getTime()).toBe(paidUp.currentPeriodEnd.getTime());
    expect((await read("yearly")).quotaGrandfatheredUntil).toBeInstanceOf(Date);

    expect(await read("lapsed")).toMatchObject({ plan: "pro_monthly", monthlyQuota: 50 });
    expect(await read("lifetime")).toMatchObject({ plan: "lifetime", monthlyQuota: 999999 });
    expect(await read("enterprise")).toMatchObject({ plan: "enterprise", monthlyQuota: 999999 });
    expect(await read("unknown")).toMatchObject({ plan: "free", previousPlan: "starter_2024", monthlyQuota: 5 });
  });

  it("changes nothing when run a second time", async () => {
    const { read } = await seed();
    await migratePlans();
    const before = await Promise.all(["free", "paidUp", "yearly", "lapsed", "lifetime", "enterprise", "unknown"].map(read));
    await migratePlans();
    const after = await Promise.all(["free", "paidUp", "yearly", "lapsed", "lifetime", "enterprise", "unknown"].map(read));
    expect(after).toEqual(before);
  });

  it("is run once by the migration runner", async () => {
    await seed();
    const first = await runMigrations();
    expect(first.map((m) => m.name)).toEqual(["001-plans-2026-10", "002-workspaces-2026-10"]);
    expect(await runMigrations()).toEqual([]);
    expect(await AppliedMigration.countDocuments()).toBe(2);
  });

  it("ends the unlimited period when the time already paid for runs out", async () => {
    const user = await createUser();
    await getOrCreateSubscription(user.id);
    await Subscription.updateOne({ userId: user.id }, { plan: "pro_monthly", status: "active", monthlyQuota: 999999, currentPeriodEnd: future(20), quotaGrandfatheredUntil: future(20) });
    expect((await getOrCreateSubscription(user.id)).monthlyQuota).toBe(999999);

    await Subscription.updateOne({ userId: user.id }, { quotaGrandfatheredUntil: past(1), currentPeriodEnd: future(5) });
    const sub = await getOrCreateSubscription(user.id);
    expect(sub.monthlyQuota).toBe(50);
    expect(sub.quotaGrandfatheredUntil).toBeNull();
  });
});

// ============================================================================================
describe("P4-14 documents are metered, and top-ups extend the month", () => {
  it("stops a Free account at 5 documents and says how to send more", async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i++) await sendDocument(user, [{ name: "Signer", email: `s${i}@example.test` }]);

    const doc = await uploadPdf(user);
    const refused = await api().post(`/api/send/${doc.id}`).set(user.auth).send({ recipients: [{ name: "Signer", email: "six@example.test" }], fields: [] });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toContain("5 of 5");
    expect(refused.body.message).toMatch(/Upgrade your plan or buy extra documents/);
    expect((await subOf(user.id)).usedThisMonth).toBe(5);
  });

  it("meters Pro at 50, where it used to be unlimited", async () => {
    const user = await createUser();
    await setPlan(user.id, "pro_monthly");
    await Subscription.updateOne({ userId: user.id }, { monthlyQuota: 50, usedThisMonth: 50 });
    await expect(reserveQuota(user.id, 1)).rejects.toThrow(/quota exceeded/);

    await setPlan(user.id, "lifetime");
    await Subscription.updateOne({ userId: user.id }, { monthlyQuota: UNLIMITED, usedThisMonth: 5000 });
    await expect(reserveQuota(user.id, 100)).resolves.toBeTruthy();
  });

  it("uses a top-up only after the month's allowance, and keeps the rest", async () => {
    const user = await createUser();
    expect((await devPay(user, "topup", "docs_10")).status).toBe(200);
    expect(await subOf(user.id)).toMatchObject({ extraDocuments: 10, usedThisMonth: 0, plan: "free" });

    await reserveQuota(user.id, 4);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 4, extraDocuments: 10 });

    // Three more: one from the allowance, two from the top-up
    await reserveQuota(user.id, 3);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 7, extraDocuments: 8 });

    // A send that failed gives its documents back where they came from
    await releaseQuota(user.id, 3);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 4, extraDocuments: 10 });

    await reserveQuota(user.id, 11);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 15, extraDocuments: 0 });
    await expect(reserveQuota(user.id, 1)).rejects.toThrow(/quota exceeded/);
  });

  it("starts a new month with a fresh allowance and the unused top-up", async () => {
    const user = await createUser();
    await devPay(user, "topup", "docs_10");
    await reserveQuota(user.id, 8); // 5 from the allowance, 3 from the top-up
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 8, extraDocuments: 7 });

    // The reset date passes
    await Subscription.updateOne({ userId: user.id }, { quotaResetDate: past(1) });
    const sub = await getOrCreateSubscription(user.id);
    expect(sub).toMatchObject({ usedThisMonth: 0, monthlyQuota: 5, extraDocuments: 7 });
    expect(sub.quotaResetDate.getTime()).toBeGreaterThan(Date.now());

    await reserveQuota(user.id, 5);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 5, extraDocuments: 7 });
  });

  it("never lets sends that arrive together pass the limit", async () => {
    const user = await createUser();
    await getOrCreateSubscription(user.id);
    await Subscription.updateOne({ userId: user.id }, { monthlyQuota: 5, extraDocuments: 3, usedThisMonth: 0 });

    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserveQuota(user.id, 1)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(8);
    expect(await subOf(user.id)).toMatchObject({ usedThisMonth: 8, extraDocuments: 0 });
  });

  it("credits a top-up once, however often the provider reports the payment", async () => {
    const user = await createUser();
    const event = captured(user.id, "pay_topup", TOPUP_PACKS.docs_50.priceInr * 100, { kind: "topup", item: "docs_50" });
    expect((await razorpay(event, "evt_t1")).status).toBe(200);
    expect((await razorpay(event, "evt_t2")).status).toBe(200); // a second event for the same payment
    expect((await subOf(user.id)).extraDocuments).toBe(50);
    expect(await Payment.countDocuments({ userId: user.id, kind: "topup" })).toBe(1);
  });

  it("shows usage on the subscription", async () => {
    const user = await createUser();
    await devPay(user, "topup", "docs_10");
    await reserveQuota(user.id, 2);
    const { usage, entitlements, catalogue } = (await api().get("/api/billing/subscription").set(user.auth)).body.data;
    expect(usage).toMatchObject({ usedThisMonth: 2, monthlyQuota: 5, extraDocuments: 10, remaining: 13 });
    expect(entitlements.tier).toBe("free");
    expect(catalogue.plans.length).toBeGreaterThan(0);
  });
});

// ============================================================================================
describe("A-32 a Razorpay payment is matched to the order this server created", () => {
  const order = (userId, notes, amount) => ({ id: "order_real", amount, currency: "INR", notes: { userId, ...notes } });
  const paidThroughCheckout = (paymentId, amount, paymentNotes) => ({
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: "order_real", amount, currency: "INR", notes: paymentNotes } } },
  });
  const withRazorpay = (answer) => {
    env.razorpayKeyId = "rzp_test_key";
    env.razorpayKeySecret = "rzp_test_secret";
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) !== "https://api.razorpay.com/v1/orders/order_real") return new Response("", { status: 404 });
      return answer();
    });
  };
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  afterEach(() => {
    vi.restoreAllMocks();
    env.razorpayKeyId = undefined;
    env.razorpayKeySecret = undefined;
  });

  it("grants what the order says, to whom the order says, whatever the payment's own notes claim", async () => {
    const buyer = await createUser();
    const stranger = await createUser();
    const asked = withRazorpay(() => json(order(buyer.id, { kind: "topup", item: "docs_10" }, 7900)));

    // The browser paid for 10 documents and wrote in its notes that it bought 200, for someone else
    const res = await razorpay(paidThroughCheckout("pay_checkout", 7900, { userId: stranger.id, kind: "topup", item: "docs_200" }), "evt_checkout");
    expect(res.status).toBe(200);
    expect(asked).toHaveBeenCalledTimes(1);
    expect(asked.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from("rzp_test_key:rzp_test_secret").toString("base64")}`);

    expect((await subOf(buyer.id)).extraDocuments).toBe(10);
    expect((await subOf(stranger.id))?.extraDocuments || 0).toBe(0);
    expect(await Payment.findOne({ providerPaymentId: "pay_checkout" })).toMatchObject({ kind: "topup", item: "docs_10", amount: 79 });
  });

  it("grants a payment that carries no notes at all, which is how Razorpay's checkout sends it", async () => {
    const buyer = await createUser();
    withRazorpay(() => json(order(buyer.id, { kind: "plan", item: "pro_monthly", plan: "pro_monthly" }, 29900)));
    await razorpay(paidThroughCheckout("pay_plain", 29900, []), "evt_plain");
    expect(await subOf(buyer.id)).toMatchObject({ plan: "pro_monthly", status: "active" });
  });

  it("grants nothing for a part payment of an order", async () => {
    const buyer = await createUser();
    withRazorpay(() => json(order(buyer.id, { kind: "topup", item: "docs_10" }, 7900)));
    await razorpay(paidThroughCheckout("pay_part", 100, {}), "evt_part");
    expect((await subOf(buyer.id))?.extraDocuments || 0).toBe(0);
  });

  it("leaves the notice to be sent again when Razorpay cannot be asked about the order", async () => {
    const buyer = await createUser();
    let up = false;
    withRazorpay(() => (up ? json(order(buyer.id, { kind: "topup", item: "docs_10" }, 7900)) : new Response("", { status: 503 })));

    const first = await razorpay(paidThroughCheckout("pay_retry", 7900, {}), "evt_retry");
    expect(first.status).toBeGreaterThanOrEqual(500);
    expect((await subOf(buyer.id))?.extraDocuments || 0).toBe(0);

    // Razorpay sends the same notice again, and this time the order can be read
    up = true;
    expect((await razorpay(paidThroughCheckout("pay_retry", 7900, {}), "evt_retry")).status).toBe(200);
    expect((await subOf(buyer.id)).extraDocuments).toBe(10);
  });
});

describe("P4-15 the credit wallet", () => {
  it("credits and debits, with a ledger line for each", async () => {
    const user = await createUser();
    await creditWallet(user.id, 50000, { reference: "test:credit:1", reason: "Credit added" });
    const debit = await debitWallet(user.id, 25, { reference: "test:sms:1", reason: "SMS message" });
    expect(debit).toMatchObject({ applied: true, balancePaise: 49975 });

    const wallet = await getWallet(user.id);
    expect(wallet.balancePaise).toBe(49975);
    expect(wallet.entries.map((e) => [e.type, e.amountPaise, e.balanceAfterPaise])).toEqual([
      ["debit", 25, 49975],
      ["credit", 50000, 50000],
    ]);
  });

  it("does not apply the same reference twice", async () => {
    const user = await createUser();
    await creditWallet(user.id, 1000, { reference: "test:credit:dup" });
    const again = await creditWallet(user.id, 1000, { reference: "test:credit:dup" });
    expect(again.applied).toBe(false);
    expect((await getWallet(user.id)).balancePaise).toBe(1000);

    await debitWallet(user.id, 300, { reference: "test:debit:dup" });
    await debitWallet(user.id, 300, { reference: "test:debit:dup" });
    expect((await getWallet(user.id)).balancePaise).toBe(700);
  });

  it("never goes below zero under parallel debits, and the ledger adds up to the balance", async () => {
    const user = await createUser();
    await creditWallet(user.id, 1000, { reference: "test:fund" });

    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => debitWallet(user.id, 100, { reference: `test:parallel:${i}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected").every((r) => r.reason.statusCode === 402)).toBe(true);

    const audit = await auditWallet(user.id);
    expect(audit).toMatchObject({ balancePaise: 0, ledgerSumPaise: 0, entries: 11, consistent: true });
    expect(await WalletEntry.countDocuments({ userId: user.id, balanceAfterPaise: { $lt: 0 } })).toBe(0);
  });

  it("applies the same reference once even when it arrives many times at once", async () => {
    const user = await createUser();
    await Promise.allSettled(Array.from({ length: 12 }, () => creditWallet(user.id, 500, { reference: "test:same" })));
    expect(await auditWallet(user.id)).toMatchObject({ balancePaise: 500, ledgerSumPaise: 500, entries: 1, consistent: true });
  });

  it("refuses a debit larger than the balance", async () => {
    const user = await createUser();
    await creditWallet(user.id, 20, { reference: "test:small" });
    await expect(debitWallet(user.id, 25, { reference: "test:too-much" })).rejects.toMatchObject({ statusCode: 402 });
    expect((await getWallet(user.id)).balancePaise).toBe(20);
  });

  it("finishes a change that was interrupted between the balance and the ledger", async () => {
    const user = await createUser();
    await creditWallet(user.id, 1000, { reference: "test:fund" });

    // The balance moved and the change was noted on the wallet, then the process stopped
    await Wallet.updateOne(
      { userId: user.id },
      { $inc: { balancePaise: -400 }, $push: { pending: { reference: "test:interrupted", type: "debit", amountPaise: 400, balanceAfterPaise: 600, reason: "SMS message", meta: {}, at: new Date() } } }
    );
    expect(await WalletEntry.countDocuments({ userId: user.id })).toBe(1);

    // The next time the wallet is touched, the ledger catches up
    expect(await auditWallet(user.id)).toMatchObject({ balancePaise: 600, ledgerSumPaise: 600, entries: 2, consistent: true });
    expect((await Wallet.findOne({ userId: user.id })).pending).toHaveLength(0);
    // And the interrupted change is not applied a second time
    expect((await debitWallet(user.id, 400, { reference: "test:interrupted" })).applied).toBe(false);
  });

  it("does not allow ledger lines to be changed or removed", async () => {
    const user = await createUser();
    await creditWallet(user.id, 100, { reference: "test:fixed" });
    await expect(WalletEntry.updateOne({ userId: user.id }, { amountPaise: 1 })).rejects.toThrow(/cannot be changed/);
    await expect(WalletEntry.deleteMany({ userId: user.id })).rejects.toThrow(/cannot be changed/);
  });

  it("adds credit bought through the gateway, once, and shows it to its owner only", async () => {
    const user = await createUser();
    const other = await createUser();
    const event = captured(user.id, "pay_wallet", 50000, { kind: "wallet", item: "wallet_500" });
    await razorpay(event, "evt_w1");
    await razorpay(event, "evt_w2");

    const mine = (await api().get("/api/billing/wallet").set(user.auth)).body.data;
    expect(mine.balancePaise).toBe(50000);
    expect(mine.entries).toHaveLength(1);
    expect((await api().get("/api/billing/wallet").set(other.auth)).body.data.balancePaise).toBe(0);
    expect((await api().get("/api/billing/wallet")).status).toBe(401);
  });

  it("pays for an SMS from the sender's wallet, and does not send when the wallet is empty", async () => {
    env.messagingEnabled = true;
    env.usageChargingEnabled = true;
    messageOutbox.length = 0;

    const funded = await createUser();
    await creditWallet(funded.id, 100, { reference: "test:fund" });
    const sent = await sendDocument(funded, [{ name: "Asha", phone: "+919876543210", channel: "sms" }], { fields: [] });
    expect(messageOutbox).toHaveLength(1);
    expect((await getWallet(funded.id)).balancePaise).toBe(75);
    expect((await Recipient.findById(sent.recipients[0]._id)).delivery.status).toBe("sent");

    const broke = await createUser();
    const unsent = await sendDocument(broke, [{ name: "Ravi", phone: "+919876500000", channel: "sms" }], { fields: [] });
    await flushEvents();
    expect(messageOutbox).toHaveLength(1); // nothing new went out
    expect((await getWallet(broke.id)).balancePaise).toBe(0);
    expect((await Recipient.findById(unsent.recipients[0]._id)).delivery.status).not.toBe("sent");
  });

  it("charges nothing for messages where charging is switched off", async () => {
    env.messagingEnabled = true;
    env.usageChargingEnabled = false;
    messageOutbox.length = 0;
    const user = await createUser();
    await sendDocument(user, [{ name: "Asha", phone: "+919876543210", channel: "sms" }], { fields: [] });
    expect(messageOutbox).toHaveLength(1);
    expect(await WalletEntry.countDocuments({ userId: user.id })).toBe(0);
  });
});

// ============================================================================================
describe("P4-16 invoices", () => {
  it("splits an amount that includes GST so that the parts add up exactly", () => {
    const same = splitTax(29900, { sellerStateCode: "27", buyerStateCode: "27" });
    expect(same.taxableValuePaise).toBe(25339);
    expect(same.taxes.map((t) => [t.name, t.ratePercent, t.amountPaise])).toEqual([["CGST", 9, 2280], ["SGST", 9, 2281]]);
    expect(same.taxableValuePaise + same.taxes.reduce((sum, t) => sum + t.amountPaise, 0)).toBe(29900);

    const other = splitTax(29900, { sellerStateCode: "27", buyerStateCode: "29" });
    expect(other.taxes).toEqual([{ name: "IGST", ratePercent: 18, amountPaise: 4561 }]);

    // A buyer with no state on file is treated as in the seller's state
    expect(splitTax(7900, { sellerStateCode: "27", buyerStateCode: "" }).taxes.map((t) => t.name)).toEqual(["CGST", "SGST"]);

    for (const total of [1, 99, 7900, 34900, 129900, 299000]) {
      const { taxableValuePaise, taxes } = splitTax(total, { sellerStateCode: "27", buyerStateCode: "27" });
      expect(taxableValuePaise + taxes.reduce((sum, t) => sum + t.amountPaise, 0), String(total)).toBe(total);
    }
  });

  it("puts a payment in the financial year it falls in, by India time", () => {
    expect(financialYearOf("2026-03-31T18:29:00Z")).toBe("2025-26"); // 23:59 on 31 March in India
    expect(financialYearOf("2026-03-31T18:31:00Z")).toBe("2026-27"); // 00:01 on 1 April in India
    expect(financialYearOf("2026-10-11T00:00:00Z")).toBe("2026-27");
  });

  it("knows what a GST number looks like", () => {
    expect(isGstin("27ABCDE1234F1Z5")).toBe(true);
    for (const bad of ["27ABCDE1234F1Z", "ABCDE1234F1Z5XX", "27abcde1234f1z5 extra", "", null]) expect(isGstin(bad), String(bad)).toBe(false);
  });

  it("issues a receipt with no tax while the seller has no GST number", async () => {
    env.sellerGstin = "";
    const user = await createUser();
    const invoice = await issueInvoiceForPayment((await paymentFor(user.id))._id);
    expect(invoice).toMatchObject({ kind: "receipt", taxableValuePaise: 29900, totalPaise: 29900 });
    expect(invoice.taxes).toHaveLength(0);
    expect(invoice.number).toMatch(/^PR\/\d{4}-\d{2}\/000001$/);
  });

  it("issues a tax invoice whose total equals the payment, with the right taxes for the buyer's state", async () => {
    env.sellerGstin = "27ABCDE1234F1Z5";
    env.sellerLegalName = "PactDoc Technologies";

    const local = await createUser();
    await api().put("/api/billing/profile").set(local.auth).send({ legalName: "Sharma Traders", address: "14 MG Road, Pune", stateCode: "27" });
    const first = await issueInvoiceForPayment((await paymentFor(local.id))._id);
    expect(first).toMatchObject({ kind: "tax_invoice", totalPaise: 29900, taxableValuePaise: 25339 });
    expect(first.number).toMatch(/^PD\/\d{4}-\d{2}\/000001$/);
    expect(first.taxes.map((t) => t.name)).toEqual(["CGST", "SGST"]);
    expect(first.seller).toMatchObject({ name: "PactDoc Technologies", gstin: "27ABCDE1234F1Z5", stateCode: "27" });
    expect(first.buyer).toMatchObject({ name: "Sharma Traders", stateCode: "27" });

    const away = await createUser();
    await api().put("/api/billing/profile").set(away.auth).send({ legalName: "Rao Exports", gstin: "29abcde1234f1z5" });
    const second = await issueInvoiceForPayment((await paymentFor(away.id, 2990, { plan: "pro_annual" }))._id);
    expect(second.buyer).toMatchObject({ gstin: "29ABCDE1234F1Z5", stateCode: "29" });
    expect(second.taxes.map((t) => t.name)).toEqual(["IGST"]);
    expect(second.totalPaise).toBe(299000);
    expect(second.taxableValuePaise + second.taxes[0].amountPaise).toBe(299000);
    expect(second.sequence).toBe(2);
  });

  it("numbers invoices without gaps when many payments arrive together", async () => {
    env.sellerGstin = "27ABCDE1234F1Z5";
    const user = await createUser();
    const payments = await Promise.all(Array.from({ length: 12 }, () => paymentFor(user.id)));

    const invoices = await Promise.all(payments.map((payment) => issueInvoiceForPayment(payment._id)));
    expect(invoices.map((i) => i.sequence).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(invoices.map((i) => i.number)).size).toBe(12);
    expect(new Set(invoices.map((i) => String(i.paymentId))).size).toBe(12);
  });

  it("issues one invoice per payment, however often it is asked for", async () => {
    const user = await createUser();
    const payment = await paymentFor(user.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => issueInvoiceForPayment(payment._id)));
    expect(new Set(results.map((i) => i.number)).size).toBe(1);
    expect(await Invoice.countDocuments({ paymentId: payment._id })).toBe(1);

    // A failed payment gets none
    const failed = await paymentFor(user.id, 0, { kind: "failed" });
    expect(await issueInvoiceForPayment(failed._id)).toBeNull();
  });

  it("issues an invoice for every purchase, and lets its owner download it", async () => {
    const user = await createUser();
    const other = await createUser();
    await devPay(user, "plan", "pro_monthly");
    await devPay(user, "topup", "docs_10");
    await devPay(user, "wallet", "wallet_200");

    const list = (await api().get("/api/billing/invoices").set(user.auth)).body.data;
    expect(list.map((i) => i.totalPaise).sort((a, b) => a - b)).toEqual([7900, 20000, 29900]);
    expect(list.map((i) => i.description)).toEqual(expect.arrayContaining(["10 extra documents", "PactDoc Pro plan, one month", "Wallet credit of Rs. 200"]));

    // Each total equals its payment
    for (const invoice of await Invoice.find({ userId: user.id })) {
      const payment = await Payment.findById(invoice.paymentId);
      expect(invoice.totalPaise).toBe(Math.round(payment.amount * 100));
    }

    const pdf = await api().get(`/api/billing/invoices/${list[0].id}/pdf`).set(user.auth).buffer(true).parse((res, done) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");

    expect((await api().get("/api/billing/invoices").set(other.auth)).body.data).toEqual([]);
    expect((await api().get(`/api/billing/invoices/${list[0].id}/pdf`).set(other.auth)).status).toBe(404);
    expect((await api().get(`/api/billing/invoices/${list[0].id}/pdf`)).status).toBe(401);
  });

  it("does not allow an invoice to be changed or removed", async () => {
    const user = await createUser();
    const invoice = await issueInvoiceForPayment((await paymentFor(user.id))._id);
    await expect(Invoice.updateOne({ _id: invoice._id }, { totalPaise: 1 })).rejects.toThrow(/cannot be changed/);
    await expect(Invoice.deleteOne({ _id: invoice._id })).rejects.toThrow(/cannot be changed/);
  });

  it("checks the GST number and state a customer enters", async () => {
    const user = await createUser();
    const save = (body) => api().put("/api/billing/profile").set(user.auth).send(body);

    expect((await save({ gstin: "NOT-A-GSTIN" })).status).toBe(400);
    expect((await save({ stateCode: "99" })).status).toBe(400);

    const saved = await save({ legalName: "  Sharma Traders  ", gstin: "27abcde1234f1z5", stateCode: "29", address: "Pune" });
    expect(saved.body.data).toEqual({ legalName: "Sharma Traders", address: "Pune", gstin: "27ABCDE1234F1Z5", stateCode: "27" });
    expect((await api().get("/api/billing/profile").set(user.auth)).body.data.gstin).toBe("27ABCDE1234F1Z5");
    expect((await User.findById(user.id)).billing.stateCode).toBe("27");
  });
});

// ============================================================================================
describe("P4-17 the Free plan's line on emails and the signing page", () => {
  it("adds the line to emails about documents from a Free account, and not from a paid one", async () => {
    const free = await createUser();
    await sendDocument(free, [{ name: "Asha", email: "asha.free@example.test" }]);
    const fromFree = emailsTo("asha.free@example.test")[0];
    expect(fromFree.html).toContain("Signed with PactDoc.");
    expect(fromFree.html).toContain("Send your own documents for signature, free.");

    const paid = await createUser();
    await setPlan(paid.id, "pro_monthly");
    await sendDocument(paid, [{ name: "Asha", email: "asha.paid@example.test" }]);
    const fromPaid = emailsTo("asha.paid@example.test")[0];
    expect(fromPaid.html).not.toContain("Signed with PactDoc");
    expect(fromPaid.html).not.toContain("Send your own documents");
  });

  it("writes the line in the signer's language", async () => {
    const free = await createUser();
    await sendDocument(free, [{ name: "आशा", email: "asha.hi@example.test", language: "hi" }]);
    expect(emailsTo("asha.hi@example.test")[0].html).toContain("के साथ हस्ताक्षरित");
  });

  it("tells the signing page whether to show the line", async () => {
    const free = await createUser();
    const fromFree = await sendDocument(free, [{ name: "Asha", email: "a1@example.test" }]);
    expect((await api().get(`/api/signing/${fromFree.recipients[0].token}`)).body.data.branding).toEqual({ badge: true });

    const paid = await createUser();
    await setPlan(paid.id, "lifetime");
    const fromPaid = await sendDocument(paid, [{ name: "Asha", email: "a2@example.test" }]);
    expect((await api().get(`/api/signing/${fromPaid.recipients[0].token}`)).body.data.branding).toEqual({ badge: false });
  });
});
