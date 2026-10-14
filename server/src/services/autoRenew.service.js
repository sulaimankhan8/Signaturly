import crypto from "crypto";
import { Subscription } from "../models/Subscription.model.js";
import { ProviderPlan } from "../models/ProviderPlan.model.js";
import { User } from "../models/User.model.js";
import { PLANS, isPlan, periodMsOf, seatsOf, sellsAs, priceOf, sameOffer } from "../config/plans.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { assertSeatsCoverTeams } from "./workspace.service.js";
import { applyPurchase, applyRenewal, applyAutoRenewApproved, applyCancellation, applyPaymentFailure } from "./billingEvents.service.js";
import { moveTo } from "./planChange.service.js";
import { razorpayConfigured, createPlan, createSubscription, readSubscription, cancelSubscription, readSubscriptionInvoices } from "./razorpay.client.js";

/**
 * A plan bought as a subscription: it renews by itself.
 *
 * The customer approves once (a card or UPI mandate held by Razorpay), and Razorpay then
 * charges each period and reports it, which is what extends the plan
 * (services/billingEvents.service.js). This file starts and stops that arrangement, keeps
 * Razorpay's plans in step with ours, and asks Razorpay about any renewal that was due and
 * not heard of.
 *
 * A plan sold by the seat renews for the number of seats the customer approved. That number
 * cannot be changed on a running subscription (a UPI approval is for a fixed amount), so to
 * change it the customer turns auto-renew off and on again.
 */

// How many periods one approval covers. After the last, the customer subscribes again.
const PERIODS = { month: 60, year: 5 };
const HOUR_MS = 60 * 60 * 1000;

// A subscription made in development, with no payment provider behind it
const isSimulated = (subscriptionId) => String(subscriptionId || "").startsWith("sim_sub_");

// Sold as a subscription: on sale, with a price and a period, and not switched to prepaid only
export const canAutoRenew = (planId) => isPlan(planId) && sellsAs(PLANS[planId]).subscription;

// How many seats a subscription to a plan is for: what was asked for, or what the account
// already has on that plan (at either of its prices)
const seatsFor = (sub, planId, asked) => {
  if (!PLANS[planId].perSeat) return 1;
  if (asked) return seatsOf(asked);
  return sameOffer(sub.plan, planId) ? Math.max(1, sub.seats || 1) : 1;
};

const renewsNow = (sub) => Boolean(sub?.autoRenew && sub.plan !== "free" && ["active", "past_due"].includes(sub.status));

// The time the account has already paid for on `planId`, at either of the plan's prices, if any is left
const paidUntilOn = (sub, planId, now = new Date()) => (sameOffer(sub.plan, planId) && sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : null);

/**
 * How an account's plan carries on, for the billing page:
 *   "auto"  it renews by itself; `nextChargeOn` and `amountInr` say when and for how much
 *   "once"  it was paid for once and ends on `endsOn` unless more is bought
 *   "none"  there is nothing to renew (Free, or a plan with no period)
 * and what the customer may do about it.
 */
export const renewalOf = (sub, now = new Date()) => {
  const plan = isPlan(sub?.plan) ? PLANS[sub.plan] : null;
  const seats = plan?.perSeat ? Math.max(1, sub.seats || 1) : 1;
  const running = Boolean(plan?.interval && sub.plan !== "free" && ["active", "past_due"].includes(sub.status) && sub.currentPeriodEnd);
  if (!running) return { mode: "none", interval: null, endsOn: null, nextChargeOn: null, amountInr: null, overdue: false, canStart: false, canStop: false, canAddPeriod: false, scheduled: null };

  // The period has run out and the account is in its few days of grace
  const overdue = sub.status === "past_due" || sub.currentPeriodEnd <= now;
  if (renewsNow(sub)) {
    // A move to a cheaper plan waiting for the paid time to end: what it is, and when
    const next = isPlan(sub.scheduledPlan) ? PLANS[sub.scheduledPlan] : null;
    const scheduled = next ? { plan: sub.scheduledPlan, name: next.name, interval: next.interval, seats: next.perSeat ? sub.scheduledSeats || 1 : null, from: sub.scheduledPlanFrom || sub.currentPeriodEnd } : null;
    return { mode: "auto", interval: next?.interval || plan.interval, endsOn: null, nextChargeOn: sub.currentPeriodEnd, amountInr: sub.renewalAmountInr ?? plan.priceInr * seats, overdue, canStart: false, canStop: true, canAddPeriod: false, scheduled };
  }
  const ways = sellsAs(plan);
  return {
    mode: "once",
    interval: plan.interval,
    endsOn: sub.currentPeriodEnd,
    nextChargeOn: null,
    amountInr: plan.priceInr * seats,
    overdue,
    // With time still paid for, turning it on charges nothing now: the first automatic charge comes when that time ends
    canStart: ways.subscription,
    canStop: false,
    canAddPeriod: ways.prepaid && !plan.perSeat,
    scheduled: null,
  };
};

// ----- Razorpay's plans, kept in step with ours -----

// Razorpay's plan for one of ours at today's price and period, made the first time it is needed
const providerPlanFor = async (planId) => {
  const plan = PLANS[planId];
  const key = { provider: "razorpay", planId, priceInr: plan.priceInr, interval: plan.interval };
  const known = await ProviderPlan.findOne(key).lean();
  if (known) return known.providerPlanId;

  const made = await createPlan({
    period: plan.interval === "year" ? "yearly" : "monthly",
    interval: 1,
    item: { name: `PactDoc ${plan.name}`, amount: plan.priceInr * 100, currency: "INR" },
    notes: { plan: planId },
  });
  try {
    await ProviderPlan.create({ ...key, providerPlanId: made.id });
  } catch (err) {
    // Two requests at the same moment: both of Razorpay's plans work, and one is remembered
    if (err?.code !== 11000) throw err;
  }
  return made.id;
};

/**
 * Makes sure a plan sold as a subscription exists at Razorpay at its present price, so it is
 * there before the first customer subscribes. Called when an admin saves a plan, and from the
 * admin app's own button. Says what happened and never throws: a plan can be saved while
 * Razorpay is unreachable, and is created there at the first subscription instead.
 *   "synced"          it is at Razorpay; `providerPlanId` is Razorpay's id for it
 *   "not_needed"      the plan is not sold as a subscription
 *   "not_configured"  this server has no Razorpay keys
 *   "failed"          Razorpay refused; `reason` is what it said
 */
export const syncProviderPlan = async (planId) => {
  if (!canAutoRenew(planId)) return { state: "not_needed" };
  if (!razorpayConfigured()) return { state: "not_configured" };
  try {
    return { state: "synced", providerPlanId: await providerPlanFor(planId) };
  } catch (err) {
    return { state: "failed", reason: err.providerMessage || err.message };
  }
};

// ----- starting -----

const descriptionOf = (plan, seats) => `PactDoc ${plan.name} plan${plan.perSeat ? `, ${seats} seat${seats === 1 ? "" : "s"}` : ""}, renewing every ${plan.interval}`;

/**
 * What is being subscribed to, checked: the seats, the price of each renewal, any extra
 * documents bought with it, when it starts, and how it takes over from the plan the account is
 * on (services/planChange.service.js):
 *   the same plan, not yet renewing   the first charge waits for the time already paid for
 *   the plan's other price            the same, taking over from a subscription that is running
 *   an upgrade                        the new plan starts today; the unused time comes first as
 *                                     extra days, so nothing is charged until they run out
 *   a downgrade                       the first charge, and the cheaper plan, wait for the paid time to end
 * A subscription that is running is ended once the new one is approved, so nothing is ever
 * charged twice. Only the plan at the very price it already renews at cannot be bought again.
 */
const subscriptionFor = async ({ userId, planId, askedSeats, addOn }) => {
  if (!canAutoRenew(planId)) throw new ApiError(400, "That plan cannot be bought as a subscription");

  const sub = await getOrCreateSubscription(userId);
  if (renewsNow(sub) && sub.plan === planId) throw new ApiError(409, "Your plan already renews automatically at this price.");

  const plan = PLANS[planId];
  const seats = seatsFor(sub, planId, askedSeats);
  if (plan.perSeat) await assertSeatsCoverTeams(userId, seats);

  const move = moveTo(sub, planId, seats);
  // Time already paid for on the same plan is used first: the first charge waits for it to end
  const startsOn = move.change === "same" || move.change === "switch" ? paidUntilOn(sub, planId) : move.startsOn;
  const extra = addOn ? priceOf("topup", addOn) : null;
  if (addOn && !extra) throw new ApiError(400, "That pack of extra documents is not available to buy");
  if (extra && startsOn) throw new ApiError(400, "Nothing is charged today, so extra documents cannot be added here. Buy them separately.");

  return { plan, seats, startsOn, extra, renewalInr: plan.priceInr * seats, replaces: move.replaces, change: move.change, creditDays: move.creditDays };
};

/**
 * Starts checkout for a plan bought as a subscription.
 *
 * Time the account has already paid for on the same plan is used first: the subscription is
 * set to start when it ends, so turning auto-renew on never pays for the same days twice.
 * The plan's other price counts as the same plan, so moving from monthly to yearly works the
 * same way, and takes over from a subscription that is already running.
 * A pack of extra documents (`addOn`) can be bought with it: it is added to the first charge
 * only, and renewals are for the plan alone.
 *
 * The plan is granted, or marked as renewing, when Razorpay reports the payment.
 */
export const startAutoRenew = async ({ userId, plan: planId, seats: askedSeats, addOn }) => {
  if (!env.billingEnabled) throw new ApiError(503, "BILLING_UNAVAILABLE: Paid plans are not available yet.");
  const { plan, seats, startsOn, extra, renewalInr, replaces, change, creditDays } = await subscriptionFor({ userId, planId, askedSeats, addOn });

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // What the first charge comes to. With a later start it is the first renewal, and nothing is taken today.
  const firstInr = renewalInr + (extra?.amountInr || 0);
  const common = {
    mode: "subscription",
    kind: "plan",
    item: planId,
    plan: planId,
    planName: plan.name,
    currency: "INR",
    description: `${descriptionOf(plan, seats)}${extra ? `, with ${extra.description}` : ""}`,
    interval: plan.interval,
    startsOn,
    renewsAtInr: renewalInr,
    // How this takes over from the plan the account is on, and the days its unused time is worth
    change,
    creditDays,
    ...(plan.perSeat ? { seats } : {}),
    ...(extra ? { addOn } : {}),
  };

  if (razorpayConfigured()) {
    const created = await createSubscription({
      plan_id: await providerPlanFor(planId),
      total_count: PERIODS[plan.interval],
      quantity: seats,
      customer_notify: 1,
      ...(startsOn ? { start_at: Math.floor(startsOn.getTime() / 1000) } : {}),
      // Charged once, with the first payment
      ...(extra ? { addons: [{ item: { name: extra.description, amount: extra.amountInr * 100, currency: "INR" } }] } : {}),
      // Read back when Razorpay reports, to decide who is subscribing and to what; the customer cannot change these
      // `replaces` is the subscription this one takes over from, which is ended once this one is approved
      // `change` says an upgrade is granted when approved, and a downgrade waits for its first charge
      notes: {
        userId: user._id.toString(),
        plan: planId,
        kind: "auto_renew",
        seats: String(seats),
        ...(extra ? { topup: addOn } : {}),
        ...(replaces && !isSimulated(replaces) ? { replaces } : {}),
        ...(change === "upgrade" || change === "downgrade" ? { change } : {}),
        ...(startsOn ? { startsAt: String(Math.floor(startsOn.getTime() / 1000)) } : {}),
      },
    });
    return { ...common, isMock: false, gateway: "razorpay", keyId: env.razorpayKeyId, subscriptionId: created.id, amountPaise: firstInr * 100, customer: { name: user.name, email: user.email } };
  }

  if (!env.devBillingSimulation) throw new ApiError(503, "BILLING_UNAVAILABLE: No payment provider is configured.");

  // Development-only simulation (never reachable in production)
  return { ...common, isMock: true, gateway: "mock_simulation", amount: firstInr, message: "Development mode: no payment provider is configured, so the subscription can be simulated." };
};

/**
 * Development only: completes a simulated subscription as if the customer had approved it and
 * Razorpay had reported so. It goes through the same code as a real one.
 */
export const completeSimulatedAutoRenew = async ({ userId, plan: planId, seats: askedSeats, addOn }) => {
  if (!env.devBillingSimulation) throw new ApiError(404, "Not found");
  const { seats, startsOn, extra, renewalInr, replaces, change } = await subscriptionFor({ userId, planId, askedSeats, addOn });

  const providerSubscriptionId = `sim_sub_${crypto.randomBytes(8).toString("hex")}`;
  // Nothing is paid when the subscription starts later, so there is no payment to name
  const paymentId = startsOn ? null : `sim_${crypto.randomBytes(10).toString("hex")}`;
  if (startsOn) {
    await applyAutoRenewApproved({ userId, plan: planId, seats, providerSubscriptionId, renewalAmountInr: renewalInr, replaces, change, startsOn });
  } else {
    await applyPurchase({
      provider: "razorpay",
      userId,
      plan: planId,
      seats,
      addOn: extra ? addOn : undefined,
      providerSubscriptionId,
      renewalAmountInr: renewalInr,
      replaces,
      payment: { providerPaymentId: paymentId, amount: renewalInr + (extra?.amountInr || 0), currency: "INR" },
    });
  }
  return { granted: true, paymentId, subscriptionId: providerSubscriptionId };
};

/**
 * Development only: the next automatic charge of a simulated subscription, as Razorpay would
 * report it.
 */
export const simulateRenewal = async (userId) => {
  if (!env.devBillingSimulation) throw new ApiError(404, "Not found");
  const sub = await Subscription.findOne({ userId });
  if (!renewsNow(sub) || !isSimulated(sub.razorpaySubscriptionId)) throw new ApiError(400, "This account has no simulated subscription to renew");

  const from = Math.max(Date.now(), sub.currentPeriodEnd?.getTime() || 0);
  return applyRenewal({
    provider: "razorpay",
    providerSubscriptionId: sub.razorpaySubscriptionId,
    periodEnd: Math.floor((from + periodMsOf(sub.plan)) / 1000),
    payment: { providerPaymentId: `sim_${crypto.randomBytes(10).toString("hex")}`, amount: sub.renewalAmountInr ?? PLANS[sub.plan].priceInr * (PLANS[sub.plan].perSeat ? sub.seats || 1 : 1), currency: "INR" },
  });
};

// ----- stopping -----

/**
 * Stops a plan renewing. The customer keeps the time already paid for; nothing is refunded
 * and nothing more is charged.
 */
export const stopAutoRenew = async (userId) => {
  const sub = await Subscription.findOne({ userId });
  if (!renewsNow(sub)) throw new ApiError(409, "This plan does not renew automatically");

  const subscriptionId = sub.razorpaySubscriptionId;
  if (subscriptionId && !isSimulated(subscriptionId)) {
    if (!razorpayConfigured()) throw new ApiError(503, "BILLING_UNAVAILABLE: No payment provider is configured.");
    // A subscription that has charged ends with its period; one still waiting to start is simply called off
    const current = await readSubscription(subscriptionId);
    if (!["cancelled", "completed", "expired"].includes(current.status)) {
      await cancelSubscription(subscriptionId, { atPeriodEnd: current.status === "active" });
    }
  }

  // Said here at once; Razorpay's own notice, when it comes, finds nothing left to do
  return applyCancellation({ provider: "razorpay", providerSubscriptionId: subscriptionId, userId, atPeriodEnd: true });
};

// ----- catching what was missed -----

// Brings one account in line with what Razorpay says about its subscription
const reconcileOne = async (sub) => {
  const subscriptionId = sub.razorpaySubscriptionId;
  const remote = await readSubscription(subscriptionId);
  const remoteEnd = remote.current_end ? remote.current_end * 1000 : 0;

  if (remote.status === "active" && remoteEnd > sub.currentPeriodEnd.getTime()) {
    // It was charged and we were not told. The newest paid invoice is that charge.
    const invoices = await readSubscriptionInvoices(subscriptionId);
    const paid = (invoices.items || []).find((invoice) => invoice.status === "paid" && invoice.payment_id);
    if (!paid) return "waiting";
    await applyRenewal({
      provider: "razorpay",
      providerSubscriptionId: subscriptionId,
      periodEnd: remote.current_end,
      payment: { providerPaymentId: paid.payment_id, amount: (paid.amount_paid ?? paid.amount ?? 0) / 100, currency: paid.currency || "INR" },
    });
    return "renewed";
  }
  if (["pending", "halted"].includes(remote.status)) {
    if (sub.status !== "past_due") {
      await applyPaymentFailure({ provider: "razorpay", providerSubscriptionId: subscriptionId, payment: { providerPaymentId: `failed:${subscriptionId}:${remote.current_end || ""}` } });
    }
    return "overdue";
  }
  if (["cancelled", "completed", "expired"].includes(remote.status)) {
    await applyCancellation({ provider: "razorpay", providerSubscriptionId: subscriptionId, atPeriodEnd: true });
    return "ended";
  }
  return "waiting";
};

/**
 * Asks Razorpay about every account whose automatic renewal was due more than an hour ago
 * and has not been heard of. A notice from Razorpay can be lost; a customer who has paid must
 * not be moved to Free because of it. Run with the hourly subscription check.
 */
export const reconcileAutoRenewals = async ({ now = new Date(), limit = 50 } = {}) => {
  const summary = { checked: 0, renewed: 0, overdue: 0, ended: 0, failed: 0 };
  if (!razorpayConfigured()) return summary;

  const due = await Subscription.find({
    autoRenew: true,
    plan: { $ne: "free" },
    status: { $in: ["active", "past_due"] },
    razorpaySubscriptionId: { $ne: null, $not: /^sim_sub_/ },
    currentPeriodEnd: { $ne: null, $lt: new Date(now.getTime() - HOUR_MS) },
  }).limit(limit);

  for (const sub of due) {
    summary.checked += 1;
    try {
      const outcome = await reconcileOne(sub);
      if (outcome in summary) summary[outcome] += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(`[Billing] Subscription ${sub.razorpaySubscriptionId} could not be checked at Razorpay:`, err.providerMessage || err.message);
    }
  }
  return summary;
};
