/**
 * The plans, add-ons and prices (plan task P4-13).
 *
 * This is the one place that says what is sold and for how much. What each plan can *do*
 * is decided from the `tier` here by services/entitlements.service.js.
 *
 * Prices are in whole rupees and include GST; the tax invoice shows the tax inside the price.
 * The Free and Pro figures come from the India strategy. Every other figure below is a
 * proposal from the development team and needs the owner's decision before launch.
 */

// A plan with no practical limit on documents
export const UNLIMITED = 999999;

export const PLANS = {
  free: {
    name: "Free",
    tier: "free",
    documentsPerMonth: 5,
    priceInr: 0,
    interval: null,
    purchasable: false,
  },
  pro_monthly: {
    name: "Pro",
    tier: "pro",
    documentsPerMonth: 50,
    priceInr: 299,
    interval: "month",
    purchasable: true,
  },
  // Proposal: a year for the price of ten months
  pro_annual: {
    name: "Pro, paid yearly",
    tier: "pro",
    documentsPerMonth: 50,
    priceInr: 2990,
    interval: "year",
    purchasable: true,
  },
  // For teams (plan task P5-05): priced per seat, with every seat's documents pooled into one allowance
  business_monthly: {
    name: "Business",
    tier: "business",
    documentsPerMonth: 100,
    priceInr: 499,
    interval: "month",
    perSeat: true,
    purchasable: true,
  },
  // Sold by conversation, not by a button: price and limits are agreed per customer
  enterprise: {
    name: "Enterprise",
    tier: "enterprise",
    documentsPerMonth: UNLIMITED,
    priceInr: 2499,
    priceIsFrom: true,
    interval: "month",
    purchasable: false,
  },
  // No longer sold. Accounts that bought it keep Pro features and their unlimited documents.
  lifetime: {
    name: "Lifetime",
    tier: "pro",
    documentsPerMonth: UNLIMITED,
    priceInr: null,
    interval: null,
    purchasable: false,
    legacy: true,
  },
};

// Extra documents, bought when a month's allowance runs out. They do not expire at month end.
// Proposal: cheaper per document as the pack grows, never cheaper than Pro itself (about Rs. 6).
export const TOPUP_PACKS = {
  docs_10: { documents: 10, priceInr: 79 },
  docs_50: { documents: 50, priceInr: 349 },
  docs_200: { documents: 200, priceInr: 1299 },
};

// Money added to the credit wallet, which pays for SMS, WhatsApp and (later) Aadhaar eSign
export const WALLET_PACKS = {
  wallet_200: { amountInr: 200 },
  wallet_500: { amountInr: 500 },
  wallet_2000: { amountInr: 2000 },
};

// What one message costs, in paise, taken from the wallet. Placeholders until a provider quotes.
export const USAGE_PRICES_PAISE = {
  sms: 25,
  whatsapp: 80,
  // One Aadhaar eSign signature. A placeholder until a provider quotes (plan task P6-01).
  aadhaarEsign: 2500,
};

// GST on software services
export const GST_RATE_PERCENT = 18;
// Service accounting code printed on invoices: information technology software services
export const SAC_CODE = "998314";

export const isPlan = (plan) => Object.prototype.hasOwnProperty.call(PLANS, plan);

export const quotaOf = (plan) => (isPlan(plan) ? PLANS[plan].documentsPerMonth : PLANS.free.documentsPerMonth);

export const periodMsOf = (plan) => {
  const DAY = 24 * 60 * 60 * 1000;
  if (plan === "lifetime") return 100 * 365 * DAY;
  return PLANS[plan]?.interval === "year" ? 365 * DAY : 30 * DAY;
};

// The most seats one account can buy without talking to us
export const MAX_SEATS = 500;
export const seatsOf = (value) => Math.min(MAX_SEATS, Math.max(1, Math.floor(Number(value)) || 1));

/**
 * What adding seats to a per-seat plan costs for the rest of the period already paid for:
 * the seat price for the share of the period that is left, rounded up to a whole rupee.
 * Returns null when the plan is not sold by the seat or its period has ended.
 */
export const seatAdditionPrice = (plan, add, currentPeriodEnd, now = new Date()) => {
  const details = isPlan(plan) ? PLANS[plan] : null;
  const count = Math.floor(Number(add));
  if (!details?.perSeat || !(count >= 1) || count > MAX_SEATS || !currentPeriodEnd) return null;
  const left = new Date(currentPeriodEnd).getTime() - now.getTime();
  if (left <= 0) return null;
  const share = Math.min(1, left / periodMsOf(plan));
  return { amountInr: Math.max(1, Math.ceil(details.priceInr * count * share)), fullAmountInr: details.priceInr * count, seats: count };
};

/**
 * What can be bought, by kind and item, with its price in rupees and a line for the invoice.
 * Returns null for anything not on sale, which is how the lifetime plan is closed to new buyers.
 */
export const priceOf = (kind, item, { seats } = {}) => {
  if (kind === "plan") {
    const plan = isPlan(item) ? PLANS[item] : null;
    if (!plan || !plan.purchasable) return null;
    if (plan.perSeat) {
      const count = seatsOf(seats);
      return {
        amountInr: plan.priceInr * count,
        seats: count,
        description: `PactDoc ${plan.name} plan, ${count} seat${count === 1 ? "" : "s"}, one ${plan.interval}`,
      };
    }
    return { amountInr: plan.priceInr, description: `PactDoc ${plan.name} plan, one ${plan.interval}` };
  }
  if (kind === "topup") {
    const pack = Object.prototype.hasOwnProperty.call(TOPUP_PACKS, item) ? TOPUP_PACKS[item] : null;
    return pack ? { amountInr: pack.priceInr, description: `${pack.documents} extra documents` } : null;
  }
  if (kind === "wallet") {
    const pack = Object.prototype.hasOwnProperty.call(WALLET_PACKS, item) ? WALLET_PACKS[item] : null;
    return pack ? { amountInr: pack.amountInr, description: `Wallet credit of Rs. ${pack.amountInr}` } : null;
  }
  return null;
};

/**
 * The catalogue as the pricing page shows it.
 */
export const publicCatalogue = () => ({
  currency: "INR",
  pricesIncludeGst: true,
  gstRatePercent: GST_RATE_PERCENT,
  plans: Object.entries(PLANS)
    .filter(([, plan]) => !plan.legacy)
    .map(([id, plan]) => ({
      id,
      name: plan.name,
      tier: plan.tier,
      documentsPerMonth: plan.documentsPerMonth >= UNLIMITED ? null : plan.documentsPerMonth,
      priceInr: plan.priceInr,
      priceIsFrom: Boolean(plan.priceIsFrom),
      interval: plan.interval,
      perSeat: Boolean(plan.perSeat),
      purchasable: plan.purchasable,
    })),
  topups: Object.entries(TOPUP_PACKS).map(([id, pack]) => ({ id, ...pack })),
  walletPacks: Object.entries(WALLET_PACKS).map(([id, pack]) => ({ id, ...pack })),
  usagePricesPaise: { ...USAGE_PRICES_PAISE },
});
