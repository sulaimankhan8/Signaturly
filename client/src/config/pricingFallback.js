/**
 * The price list as the landing page shows it before, or without, asking the server.
 *
 * The server's list (server/src/config/plans.js) is the one checkout charges from, and the
 * pricing page reads it live. This copy exists so the landing page can show prices in its
 * ready-made HTML. A server test compares the two, so they cannot drift apart unnoticed.
 *
 * Plans, their prices and what they include can be changed from the admin app. The pricing
 * and billing pages show the server's list, so they follow such a change at once; this copy
 * is only what is shown until that list arrives.
 *
 * A plan's yearly price is a record of its own, naming its plan with `yearlyOf`; everything
 * but its price is the plan's (utils/plans.js puts the two together).
 */
const PRO = { name: "Pro", tier: "pro", documentsPerMonth: 50, perSeat: false, purchasable: true, tagline: "For freelancers and one-person businesses", highlight: true, features: { "templates.own": true, bulkSend: true, api: false, workspaces: false }, limits: { bulkSendMax: 25 } };
const BUSINESS = { name: "Business", tier: "business", documentsPerMonth: 100, perSeat: true, purchasable: true, tagline: "For teams that send documents together", highlight: false, features: { "templates.own": true, bulkSend: true, api: false, workspaces: true }, limits: { bulkSendMax: 500 } };

export const PRICING_FALLBACK = {
  currency: "INR",
  pricesIncludeGst: true,
  plans: [
    { id: "free", name: "Free", tier: "free", documentsPerMonth: 5, priceInr: 0, interval: null, perSeat: false, purchasable: false, yearlyOf: null, tagline: "For trying PactDoc out", highlight: false, features: { "templates.own": false, bulkSend: false, api: false, workspaces: false }, limits: { bulkSendMax: 0 } },
    { id: "pro_monthly", ...PRO, priceInr: 299, interval: "month", yearlyOf: null },
    { id: "pro_annual", ...PRO, priceInr: 2990, interval: "year", yearlyOf: "pro_monthly" },
    { id: "business_monthly", ...BUSINESS, priceInr: 499, interval: "month", yearlyOf: null },
    { id: "business_annual", ...BUSINESS, priceInr: 4990, interval: "year", yearlyOf: "business_monthly" },
    { id: "enterprise", name: "Enterprise", tier: "enterprise", documentsPerMonth: null, priceInr: 2499, priceIsFrom: true, interval: "month", perSeat: false, purchasable: false, yearlyOf: null, tagline: "For large organisations, on terms agreed with you", highlight: false, features: { "templates.own": true, bulkSend: true, api: true, workspaces: true }, limits: { bulkSendMax: 5000 } },
  ],
};

// What a plan includes: as the server's list says, and for a list that does not say, as this copy does
export const includedIn = (plan) => {
  const known = PRICING_FALLBACK.plans.find((p) => p.id === plan?.id) || PRICING_FALLBACK.plans.find((p) => p.tier === plan?.tier) || PRICING_FALLBACK.plans[0];
  return { features: plan?.features || known.features, limits: plan?.limits || known.limits };
};

// 5000 as "5,000"
export const people = (count) => Number(count).toLocaleString("en-IN");
