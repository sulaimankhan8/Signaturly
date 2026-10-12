import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { ProviderPlan } from "../models/ProviderPlan.model.js";
import { upgradeUserPlan, addExtraDocuments } from "./subscription.service.js";
import { creditWallet } from "./wallet.service.js";
import { issueInvoiceForPayment } from "./invoice.service.js";
import { quotaOf, acceptedPricesOf, seatAdditionPrice, isTopUpPack, packsOf, sameOffer, PLANS, TOPUP_PACKS } from "../config/plans.js";
import { razorpayConfigured, readOrder, readSubscription, cancelSubscription } from "./razorpay.client.js";
import { enqueueJob } from "../jobs/queue.js";

/**
 * What happens to an account when money moves.
 *
 * Every function here is told about a payment by one of three callers: the payment provider's
 * webhook, the confirmation the browser brings back from checkout, and the hourly check that
 * asks the provider about renewals nobody reported. All three may speak of the same payment,
 * so each function applies a payment once, however many times it hears of it.
 */

const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// Tells the customer by email. The job is queued and sent apart from the payment: an email
// that cannot be sent must never undo, or hold up, what was paid for.
const tell = (kind, details, idempotencyKey) =>
  enqueueJob("email.billing", { kind, ...details }, { idempotencyKey }).catch((err) => console.error(`[Billing] Could not queue the ${kind} email:`, err.message));

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
    await tell("payment", { userId: String(payment.userId), paymentId: String(payment._id) }, `email.billing:payment:${payment._id}`);
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
 * Ends, at Razorpay, the subscription a new one has taken over from: the customer moved their
 * plan to its other price, and must not be charged at both. The account keeps the time it has
 * paid for, which is ours to keep count of, so the old one is ended at once.
 *
 * It is asked for each time the new subscription is heard of, and does nothing when the old
 * one has already ended. It throws when Razorpay cannot be reached, so a notice from Razorpay
 * is not marked as handled and is sent again.
 */
const endReplaced = async (subscriptionId, userId) => {
  if (!subscriptionId || String(subscriptionId).startsWith("sim_sub_") || !razorpayConfigured()) return;
  const replaced = await readSubscription(subscriptionId);
  // Only a subscription of the same account is ever ended this way
  if (String(replaced.notes?.userId || "") !== String(userId)) return;
  if (!["cancelled", "completed", "expired"].includes(replaced.status)) await cancelSubscription(subscriptionId, { atPeriodEnd: false });
};

/**
 * A plan was bought. Sets the plan and its first paid period.
 *
 * `once` is a single prepaid period, bought through checkout with no subscription at the
 * provider. It adds to the time the account already has on that plan, so it must be applied
 * once only: the payment is recorded first, and a payment already recorded grants nothing more.
 * Returns null in that case.
 *
 * With `providerSubscriptionId` the plan renews by itself; `renewalAmountInr` is what each
 * renewal charges.
 *
 * `addOn` is a pack of extra documents bought in the same payment. Its documents are added
 * when, and only when, the payment is recorded for the first time.
 *
 * `replaces` is a subscription this one takes over from (see endReplaced).
 */
export const applyPurchase = async ({ provider, userId, plan, seats, addOn, providerSubscriptionId, customerId, periodEnd, payment, once = false, renewalAmountInr, replaces }) => {
  const pack = addOn && isTopUpPack(addOn) ? TOPUP_PACKS[addOn] : null;
  const entry = { userId, provider, kind: "purchase", plan, item: pack ? addOn : null, providerSubscriptionId: providerSubscriptionId || null };

  if (once) {
    const recorded = await recordPayment({ ...entry, seats: PLANS[plan]?.perSeat ? seats || 1 : null, ...payment });
    if (!recorded) return null;
  }

  const sub = await upgradeUserPlan(userId, plan, {
    addToPeriod: once,
    seats: PLANS[plan]?.perSeat ? seats || 1 : undefined,
    stripeCustomerId: provider === "stripe" ? customerId : undefined,
    stripeSubscriptionId: provider === "stripe" ? providerSubscriptionId : undefined,
    razorpaySubscriptionId: provider === "razorpay" ? providerSubscriptionId : undefined,
    amount: payment?.amount,
    currency: payment?.currency,
  });

  // The provider's own period end is the truth; the locally computed one is only a fallback
  const end = toDate(periodEnd);
  if (end) sub.currentPeriodEnd = end;

  const startsRenewing = Boolean(providerSubscriptionId) && !sub.autoRenew;
  if (providerSubscriptionId) {
    sub.autoRenew = true;
    // Each renewal is for the plan alone; anything else in the first payment was bought once
    const paidForPlan = payment?.amount != null ? payment.amount - (pack?.priceInr || 0) : null;
    sub.renewalAmountInr = renewalAmountInr ?? paidForPlan ?? PLANS[plan]?.priceInr ?? null;
  } else if (!sub.autoRenew) {
    // Paid for once. A subscription the customer stopped earlier has nothing more to say about this account.
    sub.razorpaySubscriptionId = null;
    sub.renewalAmountInr = null;
  }
  await sub.save();

  if (providerSubscriptionId && replaces && replaces !== providerSubscriptionId) await endReplaced(replaces, userId);

  const recorded = once ? true : await recordPayment({ ...entry, seats: PLANS[plan]?.perSeat ? sub.seats : null, ...payment });
  if (recorded && pack) await addExtraDocuments(userId, pack.documents);
  if (startsRenewing) await tell("auto_renew_on", { userId: String(userId) });
  return sub;
};

/**
 * The customer approved automatic renewal and nothing has been charged yet: the first charge
 * comes when the time already paid for runs out. Only notes that the plan now renews.
 *
 * `plan` is what was subscribed to. When it is the other price of the plan the account is on
 * (monthly to yearly, or back), the account is named for it now: what it has is the same, and
 * what it will be charged, and how often, is what the customer has just approved.
 * `replaces` is a subscription this one takes over from (see endReplaced).
 */
export const applyAutoRenewApproved = async ({ userId, plan, providerSubscriptionId, renewalAmountInr, replaces }) => {
  const sub = userId ? await Subscription.findOne({ userId: String(userId) }) : null;
  if (!sub) return null;

  const startsRenewing = !sub.autoRenew;
  sub.razorpaySubscriptionId = providerSubscriptionId;
  sub.autoRenew = true;
  sub.cancelAtPeriodEnd = false;
  if (renewalAmountInr) sub.renewalAmountInr = renewalAmountInr;
  if (plan && plan !== sub.plan && sameOffer(sub.plan, plan)) sub.plan = plan;
  await sub.save();

  if (replaces && replaces !== providerSubscriptionId) await endReplaced(replaces, userId);
  if (startsRenewing) await tell("auto_renew_on", { userId: String(userId) });
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

  const recorded = await recordPayment({ userId: sub.userId, provider, kind: "failed", plan: sub.plan, providerSubscriptionId, ...payment });
  // Told once for each charge that failed, not once for each time the provider says so
  if (recorded) await tell("renewal_failed", { userId: String(sub.userId) }, `email.billing:failed:${recorded._id}`);
  return sub;
};

/**
 * The customer cancelled. With `atPeriodEnd` they keep what they paid for until the period ends.
 */
export const applyCancellation = async ({ provider, providerSubscriptionId, userId, atPeriodEnd = false }) => {
  const sub = await findSubscription({ provider, providerSubscriptionId, userId });
  if (!sub) return null;

  // Whichever way it ends, nothing renews by itself any more
  const wasRenewing = Boolean(sub.autoRenew);
  sub.autoRenew = false;
  sub.renewalAmountInr = null;

  const stillPaidFor = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();
  if (atPeriodEnd && stillPaidFor) {
    sub.cancelAtPeriodEnd = true;
  } else {
    if (provider === "razorpay") sub.razorpaySubscriptionId = null;
    sub.previousPlan = sub.plan;
    sub.plan = "free";
    sub.status = "canceled";
    sub.monthlyQuota = quotaOf("free");
    sub.cancelAtPeriodEnd = false;
    sub.gracePeriodEnd = null;
  }
  await sub.save();
  if (wasRenewing) await tell("auto_renew_off", { userId: String(sub.userId) });
  return sub;
};

/**
 * A one-time payment for something on the price list was received: a plan period, a pack of
 * extra documents, or wallet credit. Grants it once, however often the provider reports it.
 * A payment that does not match the price of what it names is recorded and grants nothing.
 *
 * A plan period can be paid for together with a pack of extra documents (`addOn`); the
 * payment must then be for the two prices added together. A pack bought by itself can be
 * bought several at a time (`quantity`); the payment must be for that many. Wallet credit
 * of the customer's own choosing names its amount (`amountInr`), and the payment must be for it.
 */
export const applyOrderPaid = async ({ provider, userId, kind, item, seats, addOn, quantity, amountInr, payment }) => {
  if (kind === "seats") return applySeatsPaid({ provider, userId, add: item, payment });

  const prices = acceptedPricesOf(kind, item, { seats, amountInr });
  const packPrices = kind === "plan" && addOn ? acceptedPricesOf("topup", addOn) : null;
  if (!userId || prices.length === 0 || (packPrices && packPrices.length === 0)) return { granted: false, reason: "not on the price list" };

  const paid = String(payment?.currency || "").toUpperCase() === "INR" ? Math.round(payment.amount * 100) : null;
  const extras = packPrices ? packPrices.map((pack) => pack.amountInr) : [0];
  const packs = kind === "topup" ? packsOf(quantity) : 1;
  const price = paid === null ? null : prices.find((known) => extras.some((extra) => paid === (known.amountInr * packs + extra) * 100));
  if (!price) {
    console.error(`[Billing] Payment ${payment?.providerPaymentId} for ${kind}:${item}${addOn ? ` with ${addOn}` : ""} does not match its price; nothing granted`);
    return { granted: false, reason: "amount does not match the price" };
  }

  if (kind === "plan") {
    const sub = await applyPurchase({ provider, userId, plan: item, seats: price.seats, addOn, payment, once: true });
    return sub ? { granted: true } : { granted: false, reason: "already granted" };
  }

  const recorded = await recordPayment({ userId, provider, kind, item, quantity: packs, ...payment });
  if (!recorded) return { granted: false, reason: "already granted" };

  if (kind === "topup") {
    await addExtraDocuments(userId, TOPUP_PACKS[item].documents * packs);
  } else {
    // What was paid is what is added: a set amount, or the one the customer chose
    await creditWallet(userId, price.amountInr * 100, {
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
const razorpayOrder = async (orderId) => (!orderId || !razorpayConfigured() ? null : readOrder(orderId));

/**
 * Which of our plans a Razorpay subscription renews, for how many seats, what each renewal
 * charges, and which pack of extra documents was bought with its first payment.
 *
 * Subscriptions are made by this server on Razorpay plans it made itself (ProviderPlan), so
 * that record decides. A subscription on a Razorpay plan this server did not make renews
 * nothing here. Where no Razorpay keys are set (development and tests), the notes this server
 * would have written are taken as they are.
 */
export const planRenewedBy = async (subscription, knownPlan) => {
  // A plan sold by the seat is subscribed to with the seats as its quantity
  const seats = Math.floor(Number(subscription?.quantity)) || Math.floor(Number(subscription?.notes?.seats)) || undefined;
  const addOn = isTopUpPack(subscription?.notes?.topup) ? subscription.notes.topup : undefined;
  const made = subscription?.plan_id ? await ProviderPlan.findOne({ provider: "razorpay", providerPlanId: String(subscription.plan_id) }).lean() : null;
  // Written by this server when the customer moved a running subscription to the plan's other price
  const replaces = subscription?.notes?.replaces ? String(subscription.notes.replaces) : undefined;
  if (made) return { plan: knownPlan(made.planId), seats, addOn, replaces, renewalAmountInr: made.priceInr * (seats || 1) };
  if (subscription?.plan_id && razorpayConfigured()) {
    console.error(`[Billing] Subscription ${subscription.id} is on a Razorpay plan this server did not make; nothing granted`);
    return { plan: null };
  }
  return { plan: knownPlan(subscription?.notes?.plan), seats, addOn, replaces };
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
      // An automatic renewal is charged against an invoice Razorpay raises itself. It arrives
      // as subscription.charged, and must not also be taken for a one-time purchase.
      if (subscription || payment?.invoice_id) return;
      // A payment made through checkout belongs to an order, and the order's notes were written
      // by this server when it created the order. They decide who is buying and what.
      const order = body.payload?.order?.entity || (await razorpayOrder(payment?.order_id));
      // An order that can be read and was not made by this server's checkout is not ours to grant from
      if (order && !order.notes?.userId) return;
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
      await applyOrderPaid({
        provider: "razorpay",
        userId,
        kind,
        item,
        seats: Number(notes.seats) || undefined,
        addOn: kind === "plan" ? notes.topup || undefined : undefined,
        quantity: kind === "topup" ? Number(notes.quantity) || 1 : undefined,
        amountInr: kind === "wallet" ? Number(notes.amount) || undefined : undefined,
        payment: paymentInfo,
      });
      return;
    }

    // The customer approved automatic renewal. With time already paid for, the first charge
    // waits for it to end, and until then this is all that is heard.
    case "subscription.authenticated": {
      const userId = subscription?.notes?.userId;
      const { plan, renewalAmountInr, replaces } = await planRenewedBy(subscription, knownPlan);
      if (!userId || !plan) return;
      await applyAutoRenewApproved({ userId, plan, providerSubscriptionId: subscription.id, renewalAmountInr, replaces });
      return;
    }

    case "subscription.activated": {
      const userId = subscription?.notes?.userId;
      const { plan, seats, addOn, renewalAmountInr, replaces } = await planRenewedBy(subscription, knownPlan);
      if (!userId || !plan) return;
      await applyPurchase({
        provider: "razorpay",
        userId,
        plan,
        seats,
        addOn,
        providerSubscriptionId: subscription.id,
        periodEnd: subscription.current_end,
        payment: paymentInfo,
        renewalAmountInr,
        replaces,
      });
      return;
    }

    case "subscription.charged": {
      if (!subscription) return;
      // The first charge of a subscription is the purchase, whichever of the two notices comes first
      if (subscription.paid_count === 1) {
        const userId = subscription.notes?.userId;
        const { plan, seats, addOn, renewalAmountInr, replaces } = await planRenewedBy(subscription, knownPlan);
        if (!userId || !plan) return;
        await applyPurchase({
          provider: "razorpay",
          userId,
          plan,
          seats,
          addOn,
          providerSubscriptionId: subscription.id,
          periodEnd: subscription.current_end,
          payment: paymentInfo,
          renewalAmountInr,
          replaces,
        });
        return;
      }
      await applyRenewal({
        provider: "razorpay",
        providerSubscriptionId: subscription.id,
        userId: subscription.notes?.userId,
        periodEnd: subscription.current_end,
        payment: paymentInfo,
      });
      return;
    }

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
