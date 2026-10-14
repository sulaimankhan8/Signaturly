import { offerOf, savingOn, savingSaid } from "./plans";
import { familyOf } from "./planLook";
import { rupees } from "./checkout";

/**
 * How an account stands, and what the billing pages say and offer because of it. Kept apart
 * from the pages so the overview, the plans, the checkout and the alert under the navbar all
 * read an account the same way.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const shortDay = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
export const daysUntil = (value, now = new Date()) => (value ? Math.max(0, Math.ceil((new Date(value).getTime() - now.getTime()) / DAY_MS)) : null);
export const perMessage = (paise) => `₹${(paise / 100).toFixed(2)}`;

// What the page shows about renewal when the server does not say (an older server)
export const NO_RENEWAL = { mode: "none", interval: null, overdue: false, canStart: false, canStop: false, canAddPeriod: false };
export const NO_PROFILE = { legalName: "", address: "", gstin: "", stateCode: "" };

// GST on software services, used when the price list does not say
export const GST_RATE_FALLBACK = 18;
// The GST inside an amount that includes it
export const gstIn = (amountInr, ratePercent = GST_RATE_FALLBACK) => amountInr - amountInr / (1 + ratePercent / 100);

// State codes as GST uses them
export const STATES = [
  ["27", "Maharashtra"], ["29", "Karnataka"], ["07", "Delhi"], ["33", "Tamil Nadu"], ["36", "Telangana"], ["24", "Gujarat"],
  ["19", "West Bengal"], ["09", "Uttar Pradesh"], ["08", "Rajasthan"], ["32", "Kerala"], ["06", "Haryana"], ["03", "Punjab"],
  ["23", "Madhya Pradesh"], ["37", "Andhra Pradesh"], ["10", "Bihar"], ["21", "Odisha"], ["18", "Assam"], ["20", "Jharkhand"],
  ["22", "Chhattisgarh"], ["05", "Uttarakhand"], ["02", "Himachal Pradesh"], ["30", "Goa"], ["01", "Jammu and Kashmir"], ["04", "Chandigarh"],
  ["34", "Puducherry"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"],
  ["16", "Tripura"], ["17", "Meghalaya"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["31", "Lakshadweep"], ["35", "Andaman and Nicobar Islands"], ["38", "Ladakh"],
];
export const stateName = (code) => STATES.find(([known]) => known === code)?.[1] || "";

// The order plans rise in, to tell an upgrade from a move down
const TIER_RANK = { free: 0, pro: 1, business: 2, enterprise: 3 };
export const rankOf = (plan) => TIER_RANK[plan?.tier] ?? 0;

/**
 * How far through the month's allowance an account is, and whether it will run out before the
 * allowance comes round again (on the 1st of each month), at the pace it has sent so far.
 *   level  "ok", "warn" (80% used, or on course to run out first) or "out" (nothing left at all)
 */
export const forecastOf = (usage, now = new Date()) => {
  if (!usage || usage.monthlyQuota === null || usage.monthlyQuota === undefined) {
    return { unlimited: true, share: 0, left: null, extra: usage?.extraDocuments || 0, level: "ok", runsOutOn: null, resets: null, daysToReset: null };
  }
  const quota = usage.monthlyQuota;
  const used = usage.usedThisMonth || 0;
  const extra = usage.extraDocuments || 0;
  const left = Math.max(0, quota - used);
  const share = quota ? Math.min(100, Math.round((used / quota) * 100)) : 100;
  const resets = usage.resetsOn ? new Date(usage.resetsOn) : null;
  const monthStart = resets ? new Date(resets.getFullYear(), resets.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const perDay = used / Math.max(1, (now.getTime() - monthStart.getTime()) / DAY_MS);
  const runsOut = left > 0 && perDay > 0 ? new Date(now.getTime() + (left / perDay) * DAY_MS) : null;
  const beforeReset = Boolean(runsOut && resets && runsOut < resets);
  const level = left === 0 && extra === 0 ? "out" : share >= 80 || (beforeReset && share >= 50) ? "warn" : "ok";
  return { unlimited: false, quota, used, left, extra, share, resets, daysToReset: daysUntil(resets, now), runsOutOn: beforeReset ? runsOut : null, level };
};

/**
 * How an account stands, worked out from what the server says about it: the plan it is on,
 * how that is paid for, and what the pages say and offer because of it.
 */
export const standingOf = (account, plans, offers, now = new Date()) => {
  const { subscription, usage, entitlements } = account;
  const renewal = account.renewal || NO_RENEWAL;
  // The plan the account is really on now: a paid plan that has lapsed counts as Free
  const planId = entitlements.plan || subscription.plan;
  const currentPlan = plans.find((plan) => plan.id === planId);
  // A plan no longer sold is not in the catalogue, but the account still holds it
  const held = currentPlan || account.availablePlans?.[planId] || null;
  const planName = held?.name || planId;
  const paid = entitlements.tier !== "free";
  const period = renewal.interval === "year" ? "year" : "month";
  const seats = held?.perSeat ? subscription.seats || 1 : null;
  const complimentary = Boolean(subscription.complimentary);

  // How the plan stands: a word for the label, and a sentence saying what happens next
  // A move to a cheaper plan, waiting for the paid time to end
  const scheduled = renewal.mode === "auto" ? renewal.scheduled || null : null;
  const [tone, label, sentence] =
    renewal.mode === "auto"
      ? renewal.overdue
        ? ["red", "Payment overdue", `The automatic payment due on ${day(renewal.nextChargeOn)} has not gone through yet. It will be tried again; your plan stays on for a few days meanwhile.`]
        : scheduled
          ? ["blue", `Moving to ${scheduled.name}`, `Moves to ${scheduled.name} on ${day(scheduled.from)}, and renews automatically then for ${rupees(renewal.amountInr)} a ${renewal.interval}.`]
          : ["green", "Auto-renew on", `Renews automatically on ${day(renewal.nextChargeOn)} for ${rupees(renewal.amountInr)}.`]
      : renewal.mode === "once"
        ? renewal.overdue
          ? ["red", "Ended", `Your paid time ended on ${day(renewal.endsOn)}. Buy more time to keep the plan.`]
          : ["yellow", "Paid once", `Paid until ${day(renewal.endsOn)}. It will not renew by itself.`]
        : paid
          ? ["blue", complimentary ? "Granted" : "Active", "This plan has no end date, and nothing is charged for it."]
          : ["gray", "Free", `${held?.documentsPerMonth ?? 5} documents a month, for as long as you like. Upgrade when you need more.`];

  const forecast = forecastOf(usage, now);

  // A plan is one thing with a monthly and, where it has one, a yearly price (utils/plans.js)
  const myOffer = paid ? offerOf(offers, planId) : null;
  const renewing = renewal.mode === "auto";
  // The account's plan at its other price, where that is on sale: the same plan, paid for differently
  const otherPrice = myOffer && currentPlan ? (myOffer.yearly?.id === planId ? myOffer.plan : myOffer.yearly) : null;
  const canSwitchPeriod = Boolean(otherPrice?.purchasable) && renewal.mode !== "none" && (renewing ? otherPrice.billing?.subscription !== false : true);
  const switchSaves = otherPrice && otherPrice === myOffer.yearly ? savingSaid(savingOn(myOffer)) : "";

  // Moving to another plan while one is running: it starts today and takes the place of the present one
  const replacing = paid ? { name: planName, until: renewal.endsOn || renewal.nextChargeOn || null } : null;
  // The time already paid for, which the plan's other price carries on from
  const paidUntil = renewal.mode !== "none" && !renewal.overdue ? renewal.endsOn || renewal.nextChargeOn || null : null;
  // A plan paid for once, ending within the week
  const endsSoon = renewal.mode === "once" && !renewal.overdue && daysUntil(renewal.endsOn, now) <= 7;

  // The plan one level up that can be bought with a button, for "Upgrade to ..."
  const nextUp = offers.find((offer) => rankOf(offer.plan) > rankOf(held || { tier: "free" }) && offer.plan.purchasable && offer.plan.priceInr > 0) || null;

  return {
    usage,
    renewal,
    planId,
    currentPlan,
    held,
    planName,
    paid,
    period,
    seats,
    complimentary,
    tone,
    label,
    sentence,
    forecast,
    share: forecast.share,
    myOffer,
    renewing,
    otherPrice,
    canSwitchPeriod,
    switchSaves,
    replacing,
    paidUntil,
    endsSoon,
    scheduled,
    nextUp,
    family: paid ? familyOf(planId) : "free",
  };
};

/**
 * The plan to point an account to: Pro for an account on Free, and the plan above for a paid
 * account that is running out of documents. Null when the account is fine where it is.
 */
export const recommendedFamily = (mine) => {
  if (!mine) return null;
  if (!mine.paid) return "pro";
  if (mine.forecast.level !== "ok" && mine.nextUp) return familyOf(mine.nextUp.plan.id);
  return null;
};

/**
 * The one billing button in the navbar, for an account as the server describes it: "Upgrade"
 * on Free, "Add documents" for a paid account running out, a red warning when a payment is
 * overdue, and nothing for a paid account with nothing to do.
 */
export const billingCtaOf = (data) => {
  if (!data) return { kind: "upgrade", label: "Upgrade", to: "/billing/plans" };
  const renewal = data.renewal || NO_RENEWAL;
  if (renewal.overdue) return { kind: "fix", label: renewal.mode === "auto" ? "Payment failed" : "Plan ended", to: "/billing" };
  if ((data.entitlements?.tier || "free") === "free") return { kind: "upgrade", label: "Upgrade", to: "/billing/plans" };
  if (forecastOf(data.usage).level !== "ok") return { kind: "documents", label: "Add documents", to: "/billing/add-ons" };
  return null;
};

// Where a plan is bought: the checkout page, with the plan and, where it matters, how it is paid
export const checkoutPath = (planId, { renew, seats } = {}) => {
  const query = new URLSearchParams({ plan: planId });
  if (renew) query.set("renew", renew);
  if (seats) query.set("seats", String(seats));
  return `/billing/checkout?${query}`;
};

/**
 * What the checkout is opened with for `record`, a plan at one of its prices, for an account
 * that stands as `mine`:
 *   plans      the prices to choose between (the same plan by the month and by the year)
 *   ways       "auto" (renews by itself) and "once" (one period), as far as either makes sense
 *   paidUntil  the date the account's paid time on this plan runs to: a subscription then
 *              starts after it, and a single period is added after it
 *   replacing  the plan the account is on, when this is a move to another one
 *   switching  the account's plan renews, and this moves it to the plan's other price
 *   same       this is the account's own plan, at either price
 *   nothing    there is nothing to buy: the plan already renews at this very price
 * How another plan takes over (an upgrade's extra days, a downgrade's later start) is the
 * server's to say, and the checkout asks it (hooks/useCheckoutQuote.js).
 */
export const checkoutSetupFor = (mine, offers, record) => {
  const offer = offerOf(offers, record.id);
  const prices = offer ? [offer.plan, offer.yearly].filter((price) => price?.purchasable) : [record];
  if (!mine) return { plans: prices, ways: ["auto", "once"], paidUntil: null, replacing: null, switching: false, same: false, nothing: false };

  const same = Boolean(mine.myOffer) && offer === mine.myOffer;
  if (same && record.id === mine.planId) {
    // More time, or auto-renew, on the plan and price the account already has
    if (mine.renewing) return { plans: [record], ways: [], paidUntil: mine.paidUntil, replacing: null, switching: false, same, nothing: true };
    const ways = [mine.renewal.canStart && "auto", mine.renewal.canAddPeriod && "once"].filter(Boolean);
    return { plans: [record], ways: ways.length ? ways : ["auto", "once"], paidUntil: mine.renewal.overdue ? null : mine.renewal.endsOn, replacing: null, switching: false, same, nothing: false };
  }
  if (same) {
    // The plan's other price: monthly to yearly, or back. A plan that renews moves in one step.
    const switching = mine.renewing;
    return { plans: switching ? [record] : prices, ways: switching ? ["auto"] : ["auto", "once"], paidUntil: mine.paidUntil, replacing: null, switching, same, nothing: false };
  }
  return { plans: prices, ways: ["auto", "once"], paidUntil: null, replacing: mine.replacing, switching: false, same, nothing: false };
};

// The address an old billing link meant: /billing#topups, /billing#plans and the others, and /billing?plan=
export const legacyBillingPath = (hash, search) => {
  const plan = new URLSearchParams(search || "").get("plan");
  if (plan) return checkoutPath(plan);
  return { "#plans": "/billing/plans", "#topups": "/billing/add-ons", "#wallet": "/billing/add-ons#wallet", "#invoices": "/billing/invoices" }[hash] || null;
};
