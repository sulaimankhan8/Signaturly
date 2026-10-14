import { useEffect, useState } from "react";
import { savingOf } from "../utils/plans";
import { rupees } from "../utils/checkout";
import { day, shortDay, gstIn, GST_RATE_FALLBACK } from "../utils/billing";
import { fetchCheckoutPreviewApi } from "../api/billing.api";

// How a plan may be bought. A price list that does not say sells it both ways.
const soldAs = (plan) => plan?.billing || { subscription: true, prepaid: true };

// "month" as "every month", "one month", "Monthly"
export const every = (interval) => (interval === "year" ? "every year" : "every month");
export const one = (interval) => (interval === "year" ? "one year" : "one month");
export const named = (interval) => (interval === "year" ? "Yearly" : "Monthly");

// What the button that pays says
export const payLabelOf = (quote, { busy, switching }) =>
  busy
    ? "Opening payment…"
    : quote.nothingToday
      ? switching
        ? `Switch to ${named(quote.plan.interval).toLowerCase()} billing`
        : quote.change === "upgrade"
          ? `Upgrade to ${quote.plan.name}`
          : quote.change === "downgrade"
            ? `Switch to ${quote.plan.name} on ${shortDay(quote.firstChargeOn)}`
            : "Turn on auto-renew"
      : quote.renew === "auto"
        ? `Pay ${rupees(quote.today)} and subscribe`
        : `Pay ${rupees(quote.today)}`;

const DAY_MS = 24 * 60 * 60 * 1000;
// The server counts a month as 30 days and a year as 365 (config/plans.js periodMsOf)
const periodEndFrom = (from, interval) => new Date(new Date(from).getTime() + (interval === "year" ? 365 : 30) * DAY_MS);

/**
 * What a plan comes to at checkout, as the customer changes their choices: how many seats,
 * monthly or yearly, auto-renew or one period, and a pack of extra documents. The full checkout
 * page and the pop-up used in the middle of sending both work from this, so the two can never
 * show different figures.
 *
 * The plan's prices are read from the price list. How the purchase takes over from the plan the
 * account is on is asked of the server (GET /billing/checkout/preview), which works it out the
 * same way as the purchase itself: an upgrade starts today and turns the unused time of the
 * present plan into extra days; a downgrade waits for the paid time to end. Until the server
 * has answered for the choices on screen, `ready` is false and nothing can be paid.
 *
 *   plans      the plan's prices to choose between (by the month and by the year)
 *   planId     the one chosen to begin with
 *   ways       what may be offered: "auto" (renews by itself) and "once" (one period)
 *   prefer     the way chosen to begin with
 *   paidUntil  the date the account's paid time on this same plan runs to: a subscription then
 *              charges nothing today, and a single period is added after it
 *   seats      how many seats a plan sold by the seat is bought with; `chooseSeats` lets the
 *              customer change it, up to `maxSeats`
 *   addOns     the packs of extra documents that can be added to the same payment
 *   preview    false where there is no account to ask about (nothing is then asked)
 */
export default function useCheckoutQuote({ plans, planId, ways = ["auto", "once"], prefer = "auto", paidUntil = null, seats = null, chooseSeats = false, maxSeats = 500, addOns = [], gstRatePercent = GST_RATE_FALLBACK, preview: withPreview = true }) {
  const [chosenId, setChosenId] = useState(planId);
  // The number of seats as typed; it may be empty or out of range while it is being changed
  const [typedSeats, setTypedSeats] = useState(String(Math.max(1, Number(seats) || 1)));
  const [wanted, setWanted] = useState(prefer);
  const [addOn, setAddOn] = useState("");
  // When checkout was opened: a period bought now runs from about then
  const [openedAt] = useState(() => Date.now());
  // The server's last answer, and the choices it was for
  const [answer, setAnswer] = useState({ key: "", data: null });

  const plan = plans.find((option) => option.id === chosenId) || plans.find((option) => option.id === planId) || plans[0] || null;
  const most = Math.max(1, Number(maxSeats) || 1);
  const count = plan?.perSeat ? Math.min(most, Math.max(1, Math.floor(Number(chooseSeats ? typedSeats : seats)) || 1)) : 1;

  // The ways the server allows for this plan and number of seats (a downgrade only with auto-renew)
  const known = answer.data && plan && answer.data.plan === plan.id && answer.data.seats === count ? answer.data : null;
  const available = plan ? ways.filter((way) => (way === "auto" ? soldAs(plan).subscription : soldAs(plan).prepaid)).filter((way) => !known || known.ways.includes(way)) : [];
  // Changing the period can leave the way that was chosen unavailable; the first one that is takes its place
  const renew = available.includes(wanted) ? wanted : available[0];

  const key = withPreview && plan && renew ? `${plan.id}|${count}|${renew}` : "";
  useEffect(() => {
    if (!key) return undefined;
    let stopped = false;
    const [asked, askedSeats, askedWay] = key.split("|");
    // A moment's pause, so typing a number of seats asks once
    const timer = setTimeout(() => {
      fetchCheckoutPreviewApi({ plan: asked, seats: Number(askedSeats), renew: askedWay })
        .then((data) => !stopped && setAnswer({ key, data }))
        // Without an answer the page still works, on the price list alone
        .catch(() => !stopped && setAnswer({ key, data: null }));
    }, 200);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [key]);

  const fresh = key && answer.key === key ? answer.data : null;
  const ready = !key || answer.key === key;

  const stepSeats = (by) => setTypedSeats(String(Math.min(most, Math.max(1, count + by))));
  const amountOf = (option) => option.priceInr * (option.perSeat ? count : 1);
  const planAmount = plan ? amountOf(plan) : 0;
  const price = rupees(planAmount);

  // How this takes over from the account's present plan, as the server says
  const change = fresh?.change || null;
  const current = fresh?.current || null;
  const credit = fresh?.creditDays > 0 ? { days: fresh.creditDays, inr: fresh.creditInr, from: current?.name || "present plan" } : null;
  // With auto-renew, when the first charge is taken: after time already paid for, after an
  // upgrade's extra days, or when a downgrade starts. Null for today.
  const firstChargeOn = renew === "auto" ? (fresh ? fresh.startsOn : paidUntil) : null;
  // One period: when it ends, extra days included
  const periodEnd = renew === "once" ? fresh?.periodEnd || null : null;

  // A subscription that starts later takes nothing today, so nothing can be added to it
  const nothingToday = renew === "auto" && Boolean(firstChargeOn);
  const canAddPack = addOns.length > 0 && available.length > 0 && !nothingToday;
  const pack = canAddPack ? addOns.find((option) => option.id === addOn) || null : null;
  const today = nothingToday ? 0 : planAmount + (pack?.priceInr || 0);
  const gst = Math.round(gstIn(today, gstRatePercent));

  // Each price of the plan, with what a year saves over twelve of its months
  const monthly = plans.find((option) => option.interval === "month") || null;
  const periods = plans.map((option) => {
    const saving = option.interval === "year" && monthly ? savingOf(monthly.priceInr, option.priceInr) : null;
    return {
      option,
      amount: amountOf(option),
      saving,
      perMonth: saving ? saving.perMonthInr * (option.perSeat ? count : 1) : null,
      saved: saving ? (monthly.priceInr * 12 - option.priceInr) * (option.perSeat ? count : 1) : 0,
    };
  });

  const documents = !plan
    ? ""
    : plan.documentsPerMonth === null
      ? "No monthly limit on documents"
      : plan.perSeat
        ? `${(plan.documentsPerMonth * count).toLocaleString("en-IN")} documents a month, shared by your team of ${count}`
        : `${plan.documentsPerMonth} documents a month`;

  // What happens after today's payment
  const addedAfter = paidUntil && (!change || change === "same" || change === "switch");
  const then = !plan
    ? ""
    : renew === "auto"
      ? nothingToday
        ? `Then ${price} on ${day(firstChargeOn)} and ${every(plan.interval)} after that, until you turn auto-renew off.`
        : `Then ${price} ${every(plan.interval)}, until you turn auto-renew off.`
      : addedAfter
        ? `${one(plan.interval)[0].toUpperCase()}${one(plan.interval).slice(1)} is added after ${day(paidUntil)}. Nothing after that.`
        : `${plan.name} runs until ${day(periodEnd || periodEndFrom(openedAt, plan.interval))}${credit ? `, with ${credit.days} extra days for your unused ${credit.from} time` : ""}. Nothing after that.`;

  return {
    plan,
    chosenId: plan?.id,
    choosePlan: setChosenId,
    available,
    renew,
    chooseWay: setWanted,
    count,
    typedSeats,
    setTypedSeats,
    stepSeats,
    most,
    amountOf,
    planAmount,
    price,
    periods,
    nothingToday,
    firstChargeOn,
    periodEnd,
    canAddPack,
    pack,
    addOns,
    chooseAddOn: setAddOn,
    today,
    gst,
    gstRatePercent,
    documents,
    then,
    paidUntil: addedAfter ? paidUntil : null,
    change,
    current,
    credit,
    ready,
    payArgs: { renew, seats: plan?.perSeat ? count : undefined, addOn: pack?.id },
  };
}
