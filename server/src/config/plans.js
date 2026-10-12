/**
 * The plans, add-ons and prices (plan task P4-13).
 *
 * This is the one place that says what is sold and for how much. What each plan can *do*
 * is decided from the `tier` here by services/entitlements.service.js.
 *
 * A plan is one thing a customer chooses, said once: its name, who it is for, what it
 * allows. It is sold by the month, and can also have a yearly price. The yearly price is a
 * record of its own (`pro_annual`, which is what a subscription or a payment names), tied to
 * its plan by `yearlyOf`. It holds a price and how it is sold, and nothing else: everything
 * else is taken from the plan each time the list is put together, so the two cannot disagree.
 *
 * The plans written out below are the ones this release ships with. An admin can change them
 * and add more from the admin app; those changes are kept in the database and laid over this
 * list by services/planCatalogue.service.js. Everything else reads `PLANS`, which is always
 * the list as it stands now.
 *
 * Prices are in whole rupees and include GST; the tax invoice shows the tax inside the price.
 * The Free and Pro figures come from the India strategy. Every other figure below is a
 * proposal from the development team and needs the owner's decision before launch.
 */

// A plan with no practical limit on documents
export const UNLIMITED = 999999;

const SHIPPED_PLANS = {
  free: {
    name: "Free",
    tier: "free",
    documentsPerMonth: 5,
    priceInr: 0,
    interval: null,
    purchasable: false,
    tagline: "For trying PactDoc out",
  },
  pro_monthly: {
    name: "Pro",
    tier: "pro",
    documentsPerMonth: 50,
    priceInr: 299,
    interval: "month",
    purchasable: true,
    tagline: "For freelancers and one-person businesses",
    highlight: true,
  },
  // Proposal: a year for the price of ten months
  pro_annual: { yearlyOf: "pro_monthly", priceInr: 2990, interval: "year", purchasable: true },
  // For teams (plan task P5-05): priced per seat, with every seat's documents pooled into one allowance
  business_monthly: {
    name: "Business",
    tier: "business",
    documentsPerMonth: 100,
    priceInr: 499,
    interval: "month",
    perSeat: true,
    purchasable: true,
    tagline: "For teams that send documents together",
  },
  // Proposal: the same rule as Pro, a year for the price of ten months
  business_annual: { yearlyOf: "business_monthly", priceInr: 4990, interval: "year", purchasable: true },
  // Sold by conversation, not by a button: price and limits are agreed per customer
  enterprise: {
    name: "Enterprise",
    tier: "enterprise",
    documentsPerMonth: UNLIMITED,
    priceInr: 2499,
    priceIsFrom: true,
    interval: "month",
    purchasable: false,
    tagline: "For large organisations, on terms agreed with you",
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

// What a yearly price takes from its plan: everything but its own price and how it is sold
export const TAKEN_FROM_PLAN = ["name", "tier", "perSeat", "documentsPerMonth", "features", "bulkSendMax", "legacy", "tagline", "highlight"];

/**
 * Fills in every yearly price from the plan it belongs to. A record tied to something that
 * cannot have a yearly price (a plan that is gone, or is not sold by the month) is left as a
 * plan of its own.
 */
const tieYearlyPrices = (plans) => {
  for (const plan of Object.values(plans)) {
    if (!plan.yearlyOf) continue;
    const of = Object.prototype.hasOwnProperty.call(plans, plan.yearlyOf) ? plans[plan.yearlyOf] : null;
    if (!of || of.yearlyOf || of.interval !== "month") {
      delete plan.yearlyOf;
      continue;
    }
    for (const field of TAKEN_FROM_PLAN) {
      if (of[field] === undefined) delete plan[field];
      else plan[field] = structuredClone(of[field]);
    }
    plan.interval = "year";
    plan.priceIsFrom = false;
    // A retired plan is offered to nobody, at either price
    if (plan.legacy) plan.purchasable = false;
  }
  return plans;
};

// The plans as they stand now. It is the same object for the life of the process, so it can
// be imported once and read anywhere; applyPlanSettings changes what is in it.
export const PLANS = tieYearlyPrices(structuredClone(SHIPPED_PLANS));

export const isShippedPlan = (plan) => Object.prototype.hasOwnProperty.call(SHIPPED_PLANS, plan);

// Everything an admin can set on a plan. `features` and `bulkSendMax` are left unset on the
// shipped plans, which means "what the tier gives" (services/entitlements.service.js).
// `sellSubscription` and `sellPrepaid` say how a plan on sale may be bought; left unset, both ways.
// `tagline` says in a line who the plan is for; `highlight` marks it as the one most people choose.
const ADMIN_SET_FIELDS = ["name", "tier", "interval", "perSeat", "documentsPerMonth", "priceInr", "priceIsFrom", "purchasable", "legacy", "features", "bulkSendMax", "sellSubscription", "sellPrepaid", "tagline", "highlight", "yearlyOf"];

// A checkout opened before a price was changed is honoured at the price it showed for this long
export const PRICE_GRACE_MS = 60 * 60 * 1000;
// What a plan or a pack of extra documents was sold for until a short while ago:
// plan id, or "topup:<pack id>" -> [{ priceInr, until }]
const earlierPrices = new Map();

const pick = (from, fields) => Object.fromEntries(fields.filter((field) => from[field] !== undefined).map((field) => [field, from[field]]));

/**
 * Lays the admin's settings over the shipped plans: a setting changes the shipped plan of
 * the same id, or is a plan an admin added.
 */
export const applyPlanSettings = (settings = []) => {
  for (const id of Object.keys(PLANS)) delete PLANS[id];
  Object.assign(PLANS, structuredClone(SHIPPED_PLANS));
  for (const key of [...earlierPrices.keys()]) if (!key.startsWith("topup:")) earlierPrices.delete(key);

  for (const setting of settings) {
    const id = setting.planId;
    PLANS[id] = { ...PLANS[id], ...pick(setting, ADMIN_SET_FIELDS) };
    // Which plan a shipped yearly price belongs to is not a setting
    if (isShippedPlan(id)) {
      if (SHIPPED_PLANS[id].yearlyOf) PLANS[id].yearlyOf = SHIPPED_PLANS[id].yearlyOf;
      else delete PLANS[id].yearlyOf;
    } else if (!PLANS[id].yearlyOf) {
      delete PLANS[id].yearlyOf;
    }
    if (setting.earlierPrices?.length) earlierPrices.set(id, setting.earlierPrices);
  }
  tieYearlyPrices(PLANS);
};

// Extra documents, bought when a month's allowance runs out. They do not expire at month end.
// Proposal: cheaper per document as the pack grows, never cheaper than Pro itself (about Rs. 6).
const SHIPPED_TOPUP_PACKS = {
  docs_10: { documents: 10, priceInr: 79 },
  docs_50: { documents: 50, priceInr: 349 },
  docs_200: { documents: 200, priceInr: 1299 },
};

// The packs as they stand now. Like PLANS, the same object for the life of the process: an
// admin can change these and add more, and applyAddOnSettings lays that over the shipped ones.
// A pack taken off sale (`onSale: false`) stays in the list, since payments made for it name it.
export const TOPUP_PACKS = structuredClone(SHIPPED_TOPUP_PACKS);

// A pack can be bought several at a time, in one payment
export const MAX_TOPUP_PACKS = 20;
export const packsOf = (value) => Math.min(MAX_TOPUP_PACKS, Math.max(1, Math.floor(Number(value)) || 1));

export const isTopUpPack = (pack) => Object.prototype.hasOwnProperty.call(TOPUP_PACKS, pack);
export const isShippedTopUpPack = (pack) => Object.prototype.hasOwnProperty.call(SHIPPED_TOPUP_PACKS, pack);

export const applyAddOnSettings = (settings = []) => {
  for (const id of Object.keys(TOPUP_PACKS)) delete TOPUP_PACKS[id];
  Object.assign(TOPUP_PACKS, structuredClone(SHIPPED_TOPUP_PACKS));
  for (const key of [...earlierPrices.keys()]) if (key.startsWith("topup:")) earlierPrices.delete(key);

  for (const setting of settings) {
    const id = setting.addOnId;
    TOPUP_PACKS[id] = { ...TOPUP_PACKS[id], ...pick(setting, ["documents", "priceInr", "onSale"]) };
    if (setting.earlierPrices?.length) earlierPrices.set(`topup:${id}`, setting.earlierPrices);
  }
};

// Money added to the credit wallet, which pays for SMS, WhatsApp and (later) Aadhaar eSign
export const WALLET_PACKS = {
  wallet_200: { amountInr: 200 },
  wallet_500: { amountInr: 500 },
  wallet_2000: { amountInr: 2000 },
};

// Wallet credit can also be added in any whole number of rupees between these two. It is
// bought as the item "custom", with the amount beside it.
export const WALLET_CUSTOM = "custom";
export const WALLET_MIN_INR = 100;
export const WALLET_MAX_INR = 50000;
// The amount asked for, when it is one that can be added; otherwise null
export const walletAmountOf = (value) => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= WALLET_MIN_INR && amount <= WALLET_MAX_INR ? amount : null;
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

// ----- a plan and its yearly price -----

// The id a plan's yearly price is kept under: "pro_monthly" has "pro_annual", "starter" has "starter_annual"
export const yearlyIdFor = (plan) => `${String(plan).replace(/_monthly$/, "")}_annual`;
// The plan a yearly price belongs to, or null for a record that is a plan itself
export const monthlyPlanOf = (plan) => (isPlan(plan) && PLANS[plan].yearlyOf ? PLANS[plan].yearlyOf : null);
// The yearly price of a plan, or null where it has none
export const yearlyPlanOf = (plan) => Object.keys(PLANS).find((id) => PLANS[id].yearlyOf === plan) || null;
// Whether two ids are the same plan, at either price. Moving between them changes how often
// the customer pays and nothing about what they have.
export const sameOffer = (one, other) => isPlan(one) && isPlan(other) && (monthlyPlanOf(one) || one) === (monthlyPlanOf(other) || other);

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

// What one period of a plan costs at `priceInr`, with a line for the invoice
const planPeriodPrice = (plan, priceInr, seats) => {
  if (plan.perSeat) {
    const count = seatsOf(seats);
    return {
      amountInr: priceInr * count,
      seats: count,
      description: `PactDoc ${plan.name} plan, ${count} seat${count === 1 ? "" : "s"}, one ${plan.interval}`,
    };
  }
  return { amountInr: priceInr, description: `PactDoc ${plan.name} plan, one ${plan.interval}` };
};

/**
 * What can be bought, by kind and item, with its price in rupees and a line for the invoice.
 * Returns null for anything not on sale, which is how the lifetime plan is closed to new buyers.
 */
export const priceOf = (kind, item, { seats, amountInr } = {}) => {
  if (kind === "plan") {
    const plan = isPlan(item) ? PLANS[item] : null;
    if (!plan || !plan.purchasable) return null;
    return planPeriodPrice(plan, plan.priceInr, seats);
  }
  if (kind === "topup") {
    const pack = isTopUpPack(item) ? TOPUP_PACKS[item] : null;
    return pack && pack.onSale !== false ? { amountInr: pack.priceInr, description: `${pack.documents} extra documents` } : null;
  }
  if (kind === "wallet" && item === WALLET_CUSTOM) {
    const amount = walletAmountOf(amountInr);
    return amount ? { amountInr: amount, description: `Wallet credit of Rs. ${amount}` } : null;
  }
  if (kind === "wallet") {
    const pack = Object.prototype.hasOwnProperty.call(WALLET_PACKS, item) ? WALLET_PACKS[item] : null;
    return pack ? { amountInr: pack.amountInr, description: `Wallet credit of Rs. ${pack.amountInr}` } : null;
  }
  return null;
};

/**
 * Every price a payment for something may match: today's, and for a plan the prices it was
 * sold at until a short while ago. A checkout opened just before an admin changed a price, or
 * took the plan off sale, is paid at the price it showed and is still honoured.
 */
export const acceptedPricesOf = (kind, item, { seats, amountInr } = {}, now = new Date()) => {
  const current = priceOf(kind, item, { seats, amountInr });
  const honoured = (key) => (earlierPrices.get(key) || []).filter((price) => new Date(price.until) > now);
  let earlier = [];
  if (kind === "plan" && isPlan(item)) earlier = honoured(item).map((price) => planPeriodPrice(PLANS[item], price.priceInr, seats));
  if (kind === "topup" && isTopUpPack(item)) earlier = honoured(`topup:${item}`).map((price) => ({ amountInr: price.priceInr, description: `${TOPUP_PACKS[item].documents} extra documents` }));
  return [...(current ? [current] : []), ...earlier];
};

/**
 * How a plan may be bought:
 *   subscription  it renews by itself, charged each period until the customer turns that off
 *   prepaid       one period paid for up front, which ends unless more is bought
 * A plan on sale is sold both ways unless an admin has switched one off.
 */
export const sellsAs = (plan) => {
  const onSale = Boolean(plan?.purchasable && plan.priceInr >= 1 && (plan.interval === "month" || plan.interval === "year"));
  return { subscription: onSale && plan.sellSubscription !== false, prepaid: onSale && plan.sellPrepaid !== false };
};

// A plan as the apps are told about it: "no monthly limit" is null, every yes-or-no is a boolean
export const describePlan = (id) => {
  const plan = PLANS[id];
  return {
    id,
    name: plan.name,
    tier: plan.tier,
    documentsPerMonth: plan.documentsPerMonth >= UNLIMITED ? null : plan.documentsPerMonth,
    priceInr: plan.priceInr,
    priceIsFrom: Boolean(plan.priceIsFrom),
    interval: plan.interval,
    perSeat: Boolean(plan.perSeat),
    purchasable: Boolean(plan.purchasable),
    legacy: Boolean(plan.legacy),
    billing: sellsAs(plan),
    // The plan this is the yearly price of, or null for a plan itself
    yearlyOf: plan.yearlyOf || null,
    // The name with its period, for lists where both prices of a plan appear
    label: plan.yearlyOf ? `${plan.name}, yearly` : plan.name,
    tagline: plan.tagline || "",
    highlight: Boolean(plan.highlight),
  };
};

// A pack of extra documents as the apps are told about it
export const describeTopUpPack = (id) => ({ id, documents: TOPUP_PACKS[id].documents, priceInr: TOPUP_PACKS[id].priceInr, onSale: TOPUP_PACKS[id].onSale !== false });

/**
 * The catalogue as the pricing page shows it.
 */
export const publicCatalogue = () => ({
  currency: "INR",
  pricesIncludeGst: true,
  gstRatePercent: GST_RATE_PERCENT,
  plans: Object.keys(PLANS)
    .filter((id) => !PLANS[id].legacy)
    .map((id) => {
      // A plan no longer sold is not listed at all, so the public list does not say which are
      const { legacy: _legacy, ...plan } = describePlan(id);
      return plan;
    }),
  // Cheapest first, and only what is on sale
  topups: Object.entries(TOPUP_PACKS)
    .filter(([, pack]) => pack.onSale !== false)
    .map(([id, pack]) => ({ id, documents: pack.documents, priceInr: pack.priceInr }))
    .sort((a, b) => a.priceInr - b.priceInr),
  walletPacks: Object.entries(WALLET_PACKS).map(([id, pack]) => ({ id, ...pack })),
  // Any whole number of rupees between these can be added to the wallet too
  walletCustom: { minInr: WALLET_MIN_INR, maxInr: WALLET_MAX_INR },
  // The most seats a plan sold by the seat can be bought with
  maxSeats: MAX_SEATS,
  usagePricesPaise: { ...USAGE_PRICES_PAISE },
});
