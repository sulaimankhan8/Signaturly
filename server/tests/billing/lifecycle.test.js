import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { api, createUser } from "../helpers.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { WebhookEvent } from "../../src/models/WebhookEvent.model.js";
import { getOrCreateSubscription } from "../../src/services/subscription.service.js";
import * as billingEvents from "../../src/services/billingEvents.service.js";
import { env } from "../../src/config/env.js";

const DAY = 24 * 60 * 60;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const subOf = (userId) => Subscription.findOne({ userId });

let counter = 0;
const stripe = (type, object) => {
  counter += 1;
  const payload = JSON.stringify({ id: `evt_${type}_${counter}`, type, data: { object } });
  const t = nowSeconds();
  const sig = crypto.createHmac("sha256", env.stripeWebhookSecret).update(`${t}.${payload}`).digest("hex");
  return api()
    .post("/api/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("stripe-signature", `t=${t},v1=${sig}`)
    .send(payload);
};

const razorpay = (event, payload) => {
  counter += 1;
  const body = JSON.stringify({ event, payload, created_at: nowSeconds() + counter });
  const sig = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex");
  return api()
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("x-razorpay-signature", sig)
    .set("x-razorpay-event-id", `rzp_${counter}`)
    .send(body);
};

const buyWithStripe = async (user, subscriptionId = "sub_123") => {
  await stripe("checkout.session.completed", {
    id: `cs_${subscriptionId}`,
    metadata: { userId: user.id, plan: "pro_monthly" },
    payment_status: "paid",
    subscription: subscriptionId,
    customer: "cus_1",
    amount_total: 599,
    currency: "usd",
  });
  return subOf(user.id);
};

// Audit finding H1: renewals were never processed, so paying customers were downgraded after 30 days.
describe("H1 plan state follows the payment provider", () => {
  it("extends the paid period when a renewal is paid", async () => {
    const user = await createUser();
    const bought = await buyWithStripe(user);
    const firstEnd = bought.currentPeriodEnd.getTime();

    const nextEnd = nowSeconds() + 61 * DAY;
    await stripe("invoice.paid", {
      id: "in_renewal_1",
      subscription: "sub_123",
      billing_reason: "subscription_cycle",
      amount_paid: 599,
      currency: "usd",
      lines: { data: [{ period: { end: nextEnd } }] },
    });

    const sub = await subOf(user.id);
    expect(sub.plan).toBe("pro_monthly");
    expect(sub.status).toBe("active");
    expect(sub.currentPeriodEnd.getTime()).toBe(nextEnd * 1000);
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(firstEnd);

    const ledger = await Payment.find({ userId: user.id }).sort({ createdAt: 1 });
    expect(ledger.map((p) => p.kind)).toEqual(["purchase", "renewal"]);
    expect(ledger[1].amount).toBe(5.99);
  });

  it("does not count the first invoice twice", async () => {
    const user = await createUser();
    await buyWithStripe(user);
    await stripe("invoice.paid", { id: "in_first", subscription: "sub_123", billing_reason: "subscription_create", amount_paid: 599 });

    expect(await Payment.countDocuments({ userId: user.id })).toBe(1);
  });

  it("keeps access during the grace period after a failed charge, then restores on payment", async () => {
    const user = await createUser();
    await buyWithStripe(user);

    await stripe("invoice.payment_failed", { id: "in_failed_1", subscription: "sub_123" });
    let sub = await subOf(user.id);
    expect(sub.status).toBe("past_due");
    expect(sub.plan).toBe("pro_monthly");
    expect(sub.gracePeriodEnd.getTime()).toBeGreaterThan(Date.now());

    await stripe("invoice.paid", {
      id: "in_retry_ok",
      subscription: "sub_123",
      billing_reason: "subscription_cycle",
      amount_paid: 599,
      lines: { data: [{ period: { end: nowSeconds() + 30 * DAY } }] },
    });
    sub = await subOf(user.id);
    expect(sub.status).toBe("active");
    expect(sub.gracePeriodEnd).toBeNull();
  });

  it("downgrades once the grace period passes with no payment", async () => {
    const user = await createUser();
    await buyWithStripe(user);
    await stripe("invoice.payment_failed", { id: "in_failed_2", subscription: "sub_123" });
    await Subscription.updateOne({ userId: user.id }, { gracePeriodEnd: new Date(Date.now() - 1000) });

    const sub = await getOrCreateSubscription(user.id);
    expect(sub.plan).toBe("free");
    expect(sub.status).toBe("expired");
  });

  it("lets a cancelled customer keep the period they paid for, then moves them to free", async () => {
    const user = await createUser();
    await buyWithStripe(user);

    await stripe("customer.subscription.updated", { id: "sub_123", cancel_at_period_end: true });
    let sub = await subOf(user.id);
    expect(sub.plan).toBe("pro_monthly");
    expect(sub.cancelAtPeriodEnd).toBe(true);

    await Subscription.updateOne({ userId: user.id }, { currentPeriodEnd: new Date(Date.now() - 1000) });
    sub = await getOrCreateSubscription(user.id);
    expect(sub.plan).toBe("free");
    expect(sub.status).toBe("canceled");
  });

  it("moves to free immediately when the provider deletes the subscription", async () => {
    const user = await createUser();
    await buyWithStripe(user);
    await stripe("customer.subscription.deleted", { id: "sub_123" });

    const sub = await subOf(user.id);
    expect(sub.plan).toBe("free");
    expect(sub.status).toBe("canceled");
    expect(sub.monthlyQuota).toBe(5);
  });

  it("follows a Razorpay subscription from activation through renewal and failure", async () => {
    const user = await createUser();
    const subscription = (currentEnd) => ({
      entity: { id: "sub_rzp_1", current_end: currentEnd, notes: { userId: user.id, plan: "pro_monthly" } },
    });
    const payment = (id) => ({ entity: { id, amount: 29900, currency: "INR" } });

    const firstEnd = nowSeconds() + 30 * DAY;
    await razorpay("subscription.activated", { subscription: subscription(firstEnd), payment: payment("pay_a") });
    let sub = await subOf(user.id);
    expect(sub.plan).toBe("pro_monthly");
    expect(sub.razorpaySubscriptionId).toBe("sub_rzp_1");
    expect(sub.currentPeriodEnd.getTime()).toBe(firstEnd * 1000);

    const secondEnd = firstEnd + 30 * DAY;
    await razorpay("subscription.charged", { subscription: subscription(secondEnd), payment: payment("pay_b") });
    sub = await subOf(user.id);
    expect(sub.currentPeriodEnd.getTime()).toBe(secondEnd * 1000);

    await razorpay("subscription.halted", { subscription: subscription(secondEnd) });
    expect((await subOf(user.id)).status).toBe("past_due");

    const ledger = await Payment.find({ userId: user.id, kind: { $ne: "failed" } }).sort({ createdAt: 1 });
    expect(ledger.map((p) => [p.kind, p.amount, p.currency])).toEqual([
      ["purchase", 299, "INR"],
      ["renewal", 299, "INR"],
    ]);
  });

  it("ignores a renewal for a subscription it does not know", async () => {
    const res = await stripe("invoice.paid", {
      id: "in_unknown",
      subscription: "sub_nobody",
      billing_reason: "subscription_cycle",
      lines: { data: [{ period: { end: nowSeconds() + DAY } }] },
    });
    expect(res.status).toBe(200);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it("lets the provider retry an event whose handling failed", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await createUser();
    await buyWithStripe(user);

    // First delivery: the database write fails part-way
    const save = vi.spyOn(Subscription.prototype, "save").mockRejectedValueOnce(new Error("database unavailable"));
    const failedObject = {
      id: "in_retry_me",
      subscription: "sub_123",
      billing_reason: "subscription_cycle",
      amount_paid: 599,
      lines: { data: [{ period: { end: nowSeconds() + 90 * DAY } }] },
    };

    const payload = JSON.stringify({ id: "evt_retry_same", type: "invoice.paid", data: { object: failedObject } });
    const send = () => {
      const t = nowSeconds();
      const sig = crypto.createHmac("sha256", env.stripeWebhookSecret).update(`${t}.${payload}`).digest("hex");
      return api().post("/api/webhooks/stripe").set("Content-Type", "application/json").set("stripe-signature", `t=${t},v1=${sig}`).send(payload);
    };

    expect((await send()).status).toBe(500);
    expect(await WebhookEvent.countDocuments({ eventId: "evt_retry_same" })).toBe(0);
    save.mockRestore();

    // Second delivery of the same event is processed, not treated as a duplicate
    const retry = await send();
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBeUndefined();
    expect((await subOf(user.id)).currentPeriodEnd.getTime()).toBe(failedObject.lines.data[0].period.end * 1000);

    errors.mockRestore();
    void billingEvents;
  });
});
