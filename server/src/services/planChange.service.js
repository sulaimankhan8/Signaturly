import { PLANS, isPlan, periodMsOf, sameOffer, seatsOf, sellsAs } from "../config/plans.js";
import { ApiError } from "../utils/ApiError.js";
import { getOrCreateSubscription } from "./subscription.service.js";

/**
 * Moving an account from the plan it is on to another one.
 *
 *   upgrade    a plan that costs more a day. It starts today. The time already paid for on the
 *              present plan is not lost: its value, worked out to the moment, is turned into
 *              extra days of the new plan. Bought with auto-renew, those days come before the
 *              first charge (nothing is charged today); bought for one period, they are added
 *              after it.
 *   downgrade  a plan that costs less a day. It starts when the time already paid for ends, so
 *              nothing paid for is lost and the customer keeps the bigger plan until then. It is
 *              bought with auto-renew: a subscription that starts on that date.
 *
 * Unused time is turned into days, not money off, because a Razorpay subscription charges a
 * fixed amount (a UPI mandate cannot carry a credit), and because every payment then stays at a
 * price on the list, which is what services/billingEvents.service.js checks a payment against.
 * Nothing is ever refunded.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

// What one period of a plan costs for a number of seats
export const periodPriceOf = (planId, seats) => {
  const plan = isPlan(planId) ? PLANS[planId] : null;
  return (plan?.priceInr || 0) * (plan?.perSeat ? Math.max(1, Number(seats) || 1) : 1);
};

// What the account pays a period for the plan it is on: its renewal price while it renews (a
// price it subscribed at, which a later change to the list does not alter), and otherwise the list price
const paidPerPeriodOf = (sub) => (sub.autoRenew && sub.renewalAmountInr ? sub.renewalAmountInr : periodPriceOf(sub.plan, sub.seats));

// A paid plan with time left on it
const runningWithTimeLeft = (sub, now) =>
  Boolean(sub && sub.plan !== "free" && isPlan(sub.plan) && ["active", "past_due"].includes(sub.status) && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now);

/**
 * The value, in whole rupees, of the time an account has paid for and not used yet. Nothing
 * for Free, for a plan given by an administrator, for a plan with no period, or once the time
 * has run out. Time stacked by buying several periods ahead counts in full.
 */
export const unusedValueOf = (sub, now = new Date()) => {
  if (!runningWithTimeLeft(sub, now) || sub.complimentary || !PLANS[sub.plan].interval) return 0;
  const left = new Date(sub.currentPeriodEnd).getTime() - now.getTime();
  return Math.floor((paidPerPeriodOf(sub) * left) / periodMsOf(sub.plan));
};

// That value as whole days of `planId` for `seats`
export const creditDaysOn = (valueInr, planId, seats) => {
  const price = periodPriceOf(planId, seats);
  if (!(valueInr > 0) || !(price > 0)) return 0;
  return Math.floor((valueInr / price) * (periodMsOf(planId) / DAY_MS));
};

/**
 * What kind of move buying `planId` (for `seats`) is for the account `sub`:
 *   "new"        nothing paid for is running: Free, or a plan whose time has run out
 *   "same"       the plan, at the price, the account is on
 *   "switch"     the same plan at its other price (monthly to yearly, or back)
 *   "upgrade"    another plan that costs as much a day or more
 *   "downgrade"  another plan that costs less a day
 */
export const changeOf = (sub, planId, seats, now = new Date()) => {
  if (!runningWithTimeLeft(sub, now)) return "new";
  if (sub.plan === planId) return "same";
  if (sameOffer(sub.plan, planId)) return "switch";
  const perDay = (id, count) => periodPriceOf(id, count) / periodMsOf(id);
  return perDay(planId, seats) >= perDay(sub.plan, sub.seats) ? "upgrade" : "downgrade";
};

// The account's plan renews by itself right now
export const renewsNow = (sub) => Boolean(sub?.autoRenew && sub.plan !== "free" && ["active", "past_due"].includes(sub.status));

/**
 * How a move to `planId` is made, worked out the same way for the checkout page, for starting
 * a subscription and for an order:
 *   change      as changeOf says
 *   seats       the seats it is for
 *   creditInr   the value of the unused time (upgrades only)
 *   creditDays  that value as days of the new plan
 *   startsOn    with auto-renew, when the first charge is taken; null for today
 *   replaces    the subscription it takes over from, ended once this one is approved or paid
 *   ways        how it can be bought: "auto", "once"
 */
export const moveTo = (sub, planId, askedSeats, now = new Date()) => {
  const plan = PLANS[planId];
  const seats = plan.perSeat ? seatsOf(askedSeats || (sameOffer(sub?.plan, planId) ? sub.seats : 1)) : 1;
  const change = changeOf(sub, planId, seats, now);
  const creditInr = change === "upgrade" ? unusedValueOf(sub, now) : 0;
  const creditDays = change === "upgrade" ? creditDaysOn(creditInr, planId, seats) : 0;
  const paidUntil = runningWithTimeLeft(sub, now) && sub.status === "active" ? new Date(sub.currentPeriodEnd) : null;

  let startsOn = null;
  if (change === "upgrade" && creditDays >= 1) startsOn = new Date(now.getTime() + creditDays * DAY_MS);
  else if ((change === "same" || change === "switch" || change === "downgrade") && paidUntil) startsOn = paidUntil;

  const ways = sellsAs(plan);
  return {
    change,
    seats,
    creditInr,
    creditDays,
    startsOn,
    paidUntil,
    // A plan that renews is never left renewing beside the one that takes its place
    replaces: renewsNow(sub) && change !== "same" ? sub.razorpaySubscriptionId || null : null,
    // A cheaper plan waits for the paid time to end, which only a subscription can do
    ways: [ways.subscription && "auto", ways.prepaid && change !== "downgrade" && "once"].filter(Boolean),
  };
};

/**
 * What checkout shows for a plan before anything is bought, from the same working as the
 * purchase itself: what is charged today, when, what each renewal costs, and how the move
 * from the present plan is made.
 */
export const checkoutPreview = async (userId, { plan: planId, seats: askedSeats, renew }) => {
  const plan = isPlan(planId) ? PLANS[planId] : null;
  if (!plan || !plan.purchasable || !(plan.priceInr >= 1)) throw new ApiError(400, "That plan is not available to buy");
  const sub = await getOrCreateSubscription(userId);
  const now = new Date();
  const move = moveTo(sub, planId, askedSeats, now);
  const way = renew === "once" ? "once" : "auto";
  const price = periodPriceOf(planId, move.seats);
  const current = isPlan(sub.plan) ? PLANS[sub.plan] : null;

  // With auto-renew the first charge waits for `startsOn`; one period runs from today, or from
  // the end of time already paid for on the same plan, plus any days from unused time
  const startsOn = way === "auto" ? move.startsOn : null;
  const onceFrom = (move.change === "same" || move.change === "switch") && move.paidUntil ? move.paidUntil.getTime() : now.getTime();
  const periodEnd = way === "once" ? new Date(onceFrom + periodMsOf(planId) + move.creditDays * DAY_MS) : null;

  return {
    plan: planId,
    seats: move.seats,
    renew: way,
    change: move.change,
    ways: move.ways,
    chargeTodayInr: startsOn ? 0 : price,
    renewsAtInr: price,
    startsOn,
    periodEnd,
    creditInr: move.creditInr,
    creditDays: move.creditDays,
    replacesRenewal: Boolean(move.replaces),
    current: move.change === "new" ? null : { plan: sub.plan, name: current?.name || sub.plan, until: move.paidUntil, renews: renewsNow(sub) },
  };
};
