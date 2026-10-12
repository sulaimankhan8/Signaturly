import { PRICING_FALLBACK, includedIn, people } from "../config/pricingFallback";

/**
 * Plans as the customer is shown them, on every page that shows them.
 *
 * A plan is said once and has a monthly price and, where it is sold by the year too, a yearly
 * one. The price list names each price as a record of its own (`pro_monthly`, `pro_annual`,
 * which is what checkout is asked for); the yearly one says whose it is with `yearlyOf`.
 * Here the two are put back together, so a card is a plan and the switch chooses its price.
 */

const TIERS = ["free", "pro", "business", "enterprise"];

/**
 * The plans to show, each with its yearly price beside it: `[{ plan, yearly }]`, in the order
 * of their levels and, within a level, cheapest first. `yearly` is null where the plan is not
 * sold by the year.
 */
export const offersOf = (plans) => {
  const list = plans?.length ? plans : PRICING_FALLBACK.plans;
  const place = (plan) => (TIERS.includes(plan.tier) ? TIERS.indexOf(plan.tier) : TIERS.length);
  return list
    .filter((plan) => !plan.yearlyOf)
    .map((plan) => ({ plan, yearly: list.find((other) => other.yearlyOf === plan.id) || null }))
    .sort((a, b) => place(a.plan) - place(b.plan) || (a.plan.priceInr ?? Infinity) - (b.plan.priceInr ?? Infinity));
};

// The plan of a price list that an id names, at either of its prices
export const offerOf = (offers, id) => offers.find((offer) => offer.plan.id === id || offer.yearly?.id === id) || null;

// Whether a yearly price can be bought now
const sold = (record) => Boolean(record?.purchasable && record.priceInr >= 1);

/**
 * What a yearly price comes to beside the monthly one: what it is a month, and what it saves
 * over twelve single months, as a share and (when it comes to a whole number) in months.
 */
export const savingOf = (monthlyInr, yearlyInr) => {
  if (!(monthlyInr >= 1) || !(yearlyInr >= 1)) return null;
  const twelve = monthlyInr * 12;
  const monthsFree = (twelve - yearlyInr) / monthlyInr;
  return { perMonthInr: Math.round(yearlyInr / 12), percent: Math.round((1 - yearlyInr / twelve) * 100), monthsFree: Number.isInteger(monthsFree) && monthsFree > 0 ? monthsFree : null };
};

// "2 months free", or "Save 15%" where it does not come to whole months. Empty where nothing is saved.
export const savingSaid = (saving) => (!saving || saving.percent <= 0 ? "" : saving.monthsFree ? `${saving.monthsFree} month${saving.monthsFree === 1 ? "" : "s"} free` : `Save ${saving.percent}%`);

// What a plan's yearly price saves, or null where it is not sold by the year
export const savingOn = (offer) => (sold(offer.yearly) && !offer.plan.priceIsFrom ? savingOf(offer.plan.priceInr, offer.yearly.priceInr) : null);

// The most any plan on the list saves by the year, for the switch to say. Null: nothing is sold by the year.
export const bestSaving = (offers) => offers.map(savingOn).filter(Boolean).sort((a, b) => b.percent - a.percent)[0] || null;

// Whether the switch has anything to choose between
export const anyYearly = (offers) => offers.some((offer) => sold(offer.yearly));

// The record checkout is asked for: the yearly price in the yearly view where the plan has one, and the plan itself otherwise
export const recordFor = (offer, period) => (period === "year" && sold(offer.yearly) ? offer.yearly : offer.plan);

/**
 * What a card says a plan costs, in the monthly or the yearly view. Every plan is shown by
 * the month, so the cards can be compared; the amount really charged is beside it.
 *   kind "free"     nothing to pay
 *        "none"     no price: not sold
 *        "from"     a starting price, agreed with each customer
 *        "monthly"  `amountInr` a month; `only` when the yearly view was asked for and the plan has no yearly price
 *        "yearly"   `amountInr` a month, charged as `totalInr` once a year; `wasInr` is the monthly price it is set against
 *        "year"     a plan sold by the year alone: `amountInr` a year
 */
export const priceShown = (offer, period) => {
  const { plan } = offer;
  const seat = Boolean(plan.perSeat);
  if (plan.priceInr === 0) return { kind: "free" };
  if (plan.priceInr === null || plan.priceInr === undefined) return { kind: "none" };
  if (plan.priceIsFrom) return { kind: "from", amountInr: plan.priceInr, seat };
  if (plan.interval === "year") return { kind: "year", amountInr: plan.priceInr, seat };

  const saving = period === "year" ? savingOn(offer) : null;
  if (saving) return { kind: "yearly", amountInr: saving.perMonthInr, wasInr: saving.percent > 0 ? plan.priceInr : null, totalInr: offer.yearly.priceInr, saving, seat };
  return { kind: "monthly", amountInr: plan.priceInr, only: period === "year", seat };
};

// What a plan includes, in the words every page uses. The lines an admin can switch on or off
// for a plan come from the price list; the others follow the plan's level, and must stay true
// to services/entitlements.service.js on the server.
export const pointsOf = (plan) => {
  const { features, limits } = includedIn(plan);
  return [
    plan.documentsPerMonth === null ? "No monthly limit on documents" : `${plan.documentsPerMonth} documents a month${plan.perSeat ? " for each seat, shared by the team" : ""}`,
    plan.tier === "free" ? "Starter templates, filled in by answering questions" : plan.tier === "enterprise" ? "Every template pack" : "Every Pro template pack",
    plan.tier === "free" && "Sealed PDF with a signing record",
    plan.tier === "free" && "Signing in English and Hindi",
    features["templates.own"] && "Save your own templates",
    features.bulkSend && `Bulk send to ${people(limits.bulkSendMax)} people at a time`,
    features.workspaces && "Team workspaces, with your name and logo for signers",
    features.api && "API keys and webhooks",
    plan.tier === "enterprise" && "Single sign-on for your staff",
    plan.tier !== "free" && "No “Signed with PactDoc” line on your documents",
  ].filter(Boolean);
};

// "Monthly" or "Yearly", for a record of the price list. Empty for a plan with no period.
export const periodSaid = (record) => (record?.interval === "year" ? "Yearly" : record?.interval === "month" ? "Monthly" : "");
