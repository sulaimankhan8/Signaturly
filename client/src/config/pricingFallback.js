/**
 * The price list as the landing page shows it before, or without, asking the server.
 *
 * The server's list (server/src/config/plans.js) is the one checkout charges from, and the
 * pricing page reads it live. This copy exists so the landing page can show prices in its
 * ready-made HTML. A server test compares the two, so they cannot drift apart unnoticed.
 */
export const PRICING_FALLBACK = {
  currency: "INR",
  pricesIncludeGst: true,
  plans: [
    { id: "free", name: "Free", tier: "free", documentsPerMonth: 5, priceInr: 0, interval: null, perSeat: false, purchasable: false },
    { id: "pro_monthly", name: "Pro", tier: "pro", documentsPerMonth: 50, priceInr: 299, interval: "month", perSeat: false, purchasable: true },
    { id: "pro_annual", name: "Pro, paid yearly", tier: "pro", documentsPerMonth: 50, priceInr: 2990, interval: "year", perSeat: false, purchasable: true },
    { id: "business_monthly", name: "Business", tier: "business", documentsPerMonth: 100, priceInr: 499, interval: "month", perSeat: true, purchasable: true },
    { id: "enterprise", name: "Enterprise", tier: "enterprise", documentsPerMonth: null, priceInr: 2499, priceIsFrom: true, interval: "month", perSeat: false, purchasable: false },
  ],
};
