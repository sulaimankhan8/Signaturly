import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { upgradeUserPlan, addExtraDocuments } from "./subscription.service.js";
import { creditWallet } from "./wallet.service.js";
import { issueInvoiceForPayment } from "./invoice.service.js";
import { quotaOf, priceOf, seatAdditionPrice, PLANS, TOPUP_PACKS, WALLET_PACKS } from "../config/plans.js";
import { env } from "../config/env.js";

const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const FREE_QUOTA = quotaOf("free");

const toDate = (unixSeconds) =>
  Number.isFinite(Number(unixSeconds)) && Number(unixSeconds) > 0 ? new Date(Number(unixSeconds) * 1000) : null;

// Records a payment once. Returns the record when it is new, and null when this payment was
// already recorded (a provider retry), so whatever the payment buys is granted only once.
const recordPayment = async (entry) => {
  if (!entry.providerPaymentId) return null;
  let payment;
  try {
    payment = await Payment.create(entry);
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return null;
  }

  // Every successful rupee payment gets its invoice. A failure here must not undo the payment.
  if (payment.kind !== "failed") {
    try {
      await issueInvoiceForPayment(payment._id);
    } catch (err) {
      console.error("[Billing] Could not issue an invoice for payment", payment.providerPaymentId, err.message);
    }
  }
  return payment;
};

const findSubscription = ({ provider, providerSubscriptionId, userId }) => {
  if (providerSubscriptionId) {
    const field = provider === "stripe" ? "stripeSubscriptionId" : "razorpaySubscriptionId";
    return Subscription.findOne({ [field]: String(providerSubscriptionId) });
  }
  return userId ? Subscription.findOne({ userId: String(userId) }) : null;
};

/**
 * A plan was bought. Sets the plan and its first paid period.
 */
export const applyPurchase = async ({ provider, userId, plan, seats, providerSubscriptionId, customerId, periodEnd, payment }) => {
  const sub = await upgradeUserPlan(userId, plan, {
    seats: PLANS[plan]?.perSeat ? seats || 1 : undefined,
    stripeCustomerId: provider === "stripe" ? customerId : undefined,
    stripeSubscriptionId: provider === "stripe" ? providerSubscriptionId : undefined,
    razorpaySubscriptionId: provider === "razorpay" ? providerSubscriptionId : undefined,
    amount: payment?.amount,
    currency: payment?.currency,
  });

  // The provider's own period end is the truth; the locally computed one is only a fallback
  const end = toDate(periodEnd);
  if (end) {
    sub.currentPeriodEnd = end;
    await sub.save();
  }

  await recordPayment({ userId, provider, kind: "purchase", plan, seats: PLANS[plan]?.perSeat ? sub.seats : null, providerSubscriptionId, ...payment });
  return sub;
};

/**
 * A renewal was paid. Extends the paid period, so paying customers are never downgraded by the clock.
 */
export const applyRenewal = async ({ provider, providerSubscriptionId, userId, periodEnd, payment }) => {
  const sub = await findSubscription({ provider, providerSubscriptionId, userId });
  if (!sub) return null;

  const end = toDate(periodEnd);
  if (end && (!sub.currentPeriodEnd || end > sub.currentPeriodEnd)) {
    sub.currentPeriodEnd = end;
  }
  if (sub.plan === "free" && sub.previousPlan) {
    // Paid after lapsing: restore the plan they were on
    sub.plan = sub.previousPlan;
    sub.monthlyQuota = quotaOf(sub.plan) * (PLANS[sub.plan]?.perSeat ? sub.seats || 1 : 1);
  }
  // A new paid period starts on the current plans' allowances
  if (!sub.quotaGrandfatheredUntil || sub.quotaGrandfatheredUntil <= new Date()) {
    sub.quotaGrandfatheredUntil = null;
    sub.monthlyQuota = quotaOf(sub.plan) * (PLANS[sub.plan]?.perSeat ? sub.seats || 1 : 1);
  }
  sub.status = "active";
  sub.gracePeriodEnd = null;
  await sub.save();

  await recordPayment({
    userId: sub.userId,
    provider,
    kind: "renewal",
    plan: sub.plan,
    providerSubscriptionId,
    ...payment,
  });
  return sub;
};

/**
 * A charge failed. The customer keeps access for a short grace period while the provider retries.
 */
export const applyPaymentFailure = async ({ provider, providerSubscriptionId, userId, payment }) => {
  const sub = await findSubscription({ provider, providerSubscriptionId, userId });
  if (!sub || sub.plan === "free") return null;

  sub.status = "past_due";
  if (!sub.gracePeriodEnd || sub.gracePeriodEnd < new Date()) {
    sub.gracePeriodEnd = new Date(Date.now() + GRACE_MS);
  }
  await sub.save();

  await recordPayment({ userId: sub.userId, provider, kind: "failed", plan: sub.plan, providerSubscriptionId, ...payment });
  return sub;
};

/**
 * The customer cancelled. With `atPeriodEnd` they keep what they paid for until the period ends.
 */
export const applyCancellation = async ({ provider, providerSubscriptionId, userId, atPeriodEnd = false }) => {
  const sub = await findSubscription({ provider, providerSubscriptionId, userId });
  if (!sub) return null;

  const stillPaidFor = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();
  if (atPeriodEnd && stillPaidFor) {
    sub.cancelAtPeriodEnd = true;
  } else {
    sub.previousPlan = sub.plan;
    sub.plan = "free";
    sub.status = "canceled";
    sub.monthlyQuota = FREE_QUOTA;
    sub.cancelAtPeriodEnd = false;
    sub.gracePeriodEnd = null;
  }
  await sub.save();
  return sub;
};

/**
 * A one-time payment for something on the price list was received: a plan period, a pack of
 * extra documents, or wallet credit. Grants it once, however often the provider reports it.
 * A payment that does not match the price of what it names is recorded and grants nothing.
 */
export const applyOrderPaid = async ({ provider, userId, kind, item, seats, payment }) => {
  if (kind === "seats") return applySeatsPaid({ provider, userId, add: item, payment });

  const price = priceOf(kind, item, { seats });
  if (!userId || !price) return { granted: false, reason: "not on the price list" };
  if (String(payment?.currency || "").toUpperCase() !== "INR" || Math.round(payment.amount * 100) !== price.amountInr * 100) {
    console.error(`[Billing] Payment ${payment?.providerPaymentId} for ${kind}:${item} does not match its price; nothing granted`);
    return { granted: false, reason: "amount does not match the price" };
  }

  if (kind === "plan") {
    await applyPurchase({ provider, userId, plan: item, seats: price.seats, payment });
    return { granted: true };
  }

  const recorded = await recordPayment({ userId, provider, kind, item, ...payment });
  if (!recorded) return { granted: false, reason: "already granted" };

  if (kind === "topup") {
    await addExtraDocuments(userId, TOPUP_PACKS[item].documents);
  } else {
    await creditWallet(userId, WALLET_PACKS[item].amountInr * 100, {
      reference: `payment:${provider}:${payment.providerPaymentId}`,
      reason: "Credit added",
      meta: { item },
    });
  }
  return { granted: true };
};

/**
 * Seats added to a per-seat plan part-way through its period were paid for.
 *
 * The price falls a little every moment as the period runs down, so the payment is accepted
 * when it covers the price as it stands now and is no more than the seats cost for a whole period.
 */
const applySeatsPaid = async ({ provider, userId, add, payment }) => {
  const sub = userId ? await Subscription.findOne({ userId: String(userId) }) : null;
  const price = sub && sub.status === "active" ? seatAdditionPrice(sub.plan, add, sub.currentPeriodEnd) : null;
  if (!price) return { granted: false, reason: "seats cannot be added to this account" };

  const paid = Number(payment?.amount);
  if (String(payment?.currency || "").toUpperCase() !== "INR" || !(paid >= price.amountInr) || paid > price.fullAmountInr) {
    console.error(`[Billing] Payment ${payment?.providerPaymentId} for ${price.seats} seats does not match the price; nothing granted`);
    return { granted: false, reason: "amount does not match the price" };
  }

  const recorded = await recordPayment({ userId, provider, kind: "seats", plan: sub.plan, seats: price.seats, item: String(price.seats), ...payment });
  if (!recorded) return { granted: false, reason: "already granted" };

  // One step in the database, so two purchases landing together both count
  await Subscription.updateOne({ _id: sub._id }, { $inc: { seats: price.seats, monthlyQuota: quotaOf(sub.plan) * price.seats } });
  return { granted: true };
};

/**
 * Maps a verified Stripe event to a billing change.
 */
export const handleStripeEvent = async (event, knownPlan) => {
  const object = event.data?.object || {};

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = object.metadata?.userId || object.client_reference_id;
      const plan = knownPlan(object.metadata?.plan);
      if (!userId || !plan || object.payment_status === "unpaid") return;

      await applyPurchase({
        provider: "stripe",
        userId,
        plan,
        providerSubscriptionId: object.subscription,
        customerId: object.customer,
        payment: {
          providerPaymentId: object.payment_intent || object.id,
          amount: object.amount_total ? object.amount_total / 100 : 0,
          currency: object.currency || "usd",
        },
      });
      return;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      // The first invoice is already covered by checkout.session.completed
      if (!object.subscription || object.billing_reason === "subscription_create") return;
      await applyRenewal({
        provider: "stripe",
        providerSubscriptionId: object.subscription,
        periodEnd: object.lines?.data?.[0]?.period?.end,
        payment: {
          providerPaymentId: object.id,
          amount: object.amount_paid ? object.amount_paid / 100 : 0,
          currency: object.currency || "usd",
        },
      });
      return;
    }

    case "invoice.payment_failed":
      if (!object.subscription) return;
      await applyPaymentFailure({
        provider: "stripe",
        providerSubscriptionId: object.subscription,
        payment: { providerPaymentId: `failed:${object.id}`, currency: object.currency || "usd" },
      });
      return;

    case "customer.subscription.updated":
      if (object.cancel_at_period_end) {
        await applyCancellation({ provider: "stripe", providerSubscriptionId: object.id, atPeriodEnd: true });
      }
      return;

    case "customer.subscription.deleted":
      await applyCancellation({ provider: "stripe", providerSubscriptionId: object.id });
      return;

    default:
      return;
  }
};

/**
 * Reads back an order this server created at Razorpay, for the notes written on it then: who
 * is buying, and what. A payment's own notes are set by the browser that paid, so they are not
 * what decides what is granted.
 *
 * Returns null where no Razorpay keys are configured. Throws when Razorpay cannot be reached,
 * so the notice is not marked as handled and Razorpay sends it again.
 */
const razorpayOrder = async (orderId) => {
  if (!orderId || !env.razorpayKeyId || !env.razorpayKeySecret) return null;
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!response || !response.ok) throw new Error(`Razorpay order ${orderId} could not be read (${response ? response.status : "no response"})`);
  return response.json();
};

/**
 * Maps a verified Razorpay event to a billing change.
 */
export const handleRazorpayEvent = async (body, knownPlan) => {
  const subscription = body.payload?.subscription?.entity;
  const payment = body.payload?.payment?.entity;
  const paymentInfo = payment && {
    providerPaymentId: payment.id,
    amount: payment.amount ? payment.amount / 100 : 0,
    currency: payment.currency || "INR",
  };

  switch (body.event) {
    // One-time purchase (for example a lifetime plan) or the first charge of a plan bought by order
    case "payment.captured": {
      if (subscription) return; // subscription charges arrive as subscription.charged
      // A payment made through checkout belongs to an order, and the order's notes were written
      // by this server when it created the order. They decide who is buying and what.
      const order = body.payload?.order?.entity || (await razorpayOrder(payment?.order_id));
      const notes = order?.notes?.userId ? order.notes : payment?.notes || {};
      // The payment must be for the whole of the order it names
      if (order?.amount && payment?.amount !== order.amount) {
        console.error(`[Billing] Payment ${payment?.id} does not match the amount of order ${order.id}; nothing granted`);
        return;
      }
      const userId = notes.userId;
      const kind = notes.kind || "plan";
      const item = kind === "plan" ? knownPlan(notes.plan || notes.item) : notes.item;
      if (!userId || !item) return;
      await applyOrderPaid({ provider: "razorpay", userId, kind, item, seats: Number(notes.seats) || undefined, payment: paymentInfo });
      return;
    }

    case "subscription.activated": {
      const userId = subscription?.notes?.userId;
      const plan = knownPlan(subscription?.notes?.plan);
      if (!userId || !plan) return;
      await applyPurchase({
        provider: "razorpay",
        userId,
        plan,
        providerSubscriptionId: subscription.id,
        periodEnd: subscription.current_end,
        payment: paymentInfo,
      });
      return;
    }

    case "subscription.charged":
      if (!subscription) return;
      await applyRenewal({
        provider: "razorpay",
        providerSubscriptionId: subscription.id,
        userId: subscription.notes?.userId,
        periodEnd: subscription.current_end,
        payment: paymentInfo,
      });
      return;

    case "subscription.pending":
    case "subscription.halted":
      if (!subscription) return;
      await applyPaymentFailure({
        provider: "razorpay",
        providerSubscriptionId: subscription.id,
        payment: { providerPaymentId: `failed:${subscription.id}:${subscription.current_end || Date.now()}` },
      });
      return;

    case "subscription.cancelled":
    case "subscription.completed":
      if (!subscription) return;
      await applyCancellation({ provider: "razorpay", providerSubscriptionId: subscription.id, atPeriodEnd: true });
      return;

    default:
      return;
  }
};
