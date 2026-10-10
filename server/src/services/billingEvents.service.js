import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { upgradeUserPlan } from "./subscription.service.js";

const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const FREE_QUOTA = 15;

const toDate = (unixSeconds) =>
  Number.isFinite(Number(unixSeconds)) && Number(unixSeconds) > 0 ? new Date(Number(unixSeconds) * 1000) : null;

const recordPayment = async (entry) => {
  if (!entry.providerPaymentId) return;
  try {
    await Payment.create(entry);
  } catch (err) {
    if (err?.code !== 11000) throw err; // already recorded
  }
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
export const applyPurchase = async ({ provider, userId, plan, providerSubscriptionId, customerId, periodEnd, payment }) => {
  const sub = await upgradeUserPlan(userId, plan, {
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

  await recordPayment({ userId, provider, kind: "purchase", plan, providerSubscriptionId, ...payment });
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
    sub.monthlyQuota = 999999;
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
      const userId = payment?.notes?.userId;
      const plan = knownPlan(payment?.notes?.plan);
      if (!userId || !plan) return;
      await applyPurchase({ provider: "razorpay", userId, plan, payment: paymentInfo });
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
