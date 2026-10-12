import { PACKS } from "../templates/catalogue.js";
import { PLANS, publicCatalogue } from "../config/plans.js";

/**
 * What each plan can do (plan task P4-06).
 *
 * This is the one place that knows. Routes ask "may this account use bulk send?"; they never
 * list plan names themselves, so adding or renaming a plan is a change to the two tables below
 * and nothing else.
 *
 * A plan has a tier, and the tables say what each tier gives. An admin can also set, for one
 * plan, which of the features it has and how large a bulk send may be; where that is set it
 * is used in place of what the tier gives. Template packs, the "Signed with PactDoc" line and
 * single sign-on always follow the tier.
 */

export const TIERS = ["free", "pro", "business", "enterprise"];

// The tier of features a plan buys. The plans themselves, with their prices and document
// allowances, are in config/plans.js; admins can change that list, so it is read each time.
export const tierOfPlan = (plan) => (Object.prototype.hasOwnProperty.call(PLANS, plan) ? PLANS[plan].tier : undefined);

const FEATURES = {
  free: {
    "templates.own": false, // save their own PDFs as reusable templates
    bulkSend: false,
    api: false,
    workspaces: false,
  },
  pro: {
    "templates.own": true,
    bulkSend: true,
    api: false,
    workspaces: false,
  },
  business: {
    "templates.own": true,
    bulkSend: true,
    api: false,
    workspaces: true,
  },
  enterprise: {
    "templates.own": true,
    bulkSend: true,
    api: true,
    workspaces: true,
  },
};

const LIMITS = {
  free: { bulkSendMax: 0 },
  pro: { bulkSendMax: 25 },
  business: { bulkSendMax: 500 },
  enterprise: { bulkSendMax: 5000 },
};

export const FEATURE_NAMES = Object.keys(FEATURES.free);

// What to call a feature when telling someone they need a higher plan
export const FEATURE_LABELS = {
  "templates.own": "Saving your own templates",
  bulkSend: "Bulk send",
  api: "API keys and webhooks",
  workspaces: "Team workspaces",
};

export const TIER_LABELS = { free: "Free", pro: "Pro", business: "Business", enterprise: "Enterprise" };

/**
 * What a plan includes: what its tier gives, with what an admin set for this plan in its place.
 * `plan` is a plan as config/plans.js holds it. `features`, when set, is the list of features
 * the plan has; `bulkSendMax`, when set, is its own limit.
 */
export const includesOf = (plan) => {
  const tier = TIERS.includes(plan?.tier) ? plan.tier : "free";
  const features = Array.isArray(plan?.features) ? Object.fromEntries(FEATURE_NAMES.map((name) => [name, plan.features.includes(name)])) : { ...FEATURES[tier] };
  const limits = { ...LIMITS[tier], ...(Number.isInteger(plan?.bulkSendMax) ? { bulkSendMax: plan.bulkSendMax } : {}) };
  return { features, limits };
};

// What a tier gives by itself, for the admin app to offer as a starting point
export const describeTiers = () => TIERS.map((tier) => ({ id: tier, name: TIER_LABELS[tier], features: { ...FEATURES[tier] }, limits: { ...LIMITS[tier] } }));

// The price list with what each plan includes, as the pricing and billing pages show it
export const describeCatalogue = () => {
  const catalogue = publicCatalogue();
  return { ...catalogue, plans: catalogue.plans.map((plan) => ({ ...plan, ...includesOf(PLANS[plan.id]) })) };
};

/**
 * The plan an account is really on right now. A paid plan whose period has ended, with no
 * renewal and no grace period running, counts as free.
 */
export const effectivePlan = (subscription, now = new Date()) => {
  if (!subscription) return "free";
  const lapsed =
    subscription.status === "expired" ||
    subscription.status === "canceled" ||
    (subscription.currentPeriodEnd &&
      now > new Date(subscription.currentPeriodEnd) &&
      subscription.status !== "past_due" &&
      subscription.status !== "active");
  const plan = lapsed ? "free" : subscription.plan || "free";
  return tierOfPlan(plan) ? plan : "free";
};

export const tierOf = (subscription, now) => tierOfPlan(effectivePlan(subscription, now));

const includedIn = (subscription, now) => includesOf(PLANS[effectivePlan(subscription, now)]);

const rank = (tier) => TIERS.indexOf(tier);

export const can = (subscription, feature, now) => {
  if (!(feature in FEATURES.free)) throw new Error(`Unknown feature: ${feature}`);
  return includedIn(subscription, now).features[feature];
};

export const limitOf = (subscription, limit, now) => {
  if (!(limit in LIMITS.free)) throw new Error(`Unknown limit: ${limit}`);
  return includedIn(subscription, now).limits[limit];
};

/**
 * A pack is open to its own tier and every tier above it.
 */
export const canUsePack = (subscription, pack, now) => {
  const definition = PACKS[pack];
  if (!definition) return false;
  return rank(tierOf(subscription, now)) >= rank(definition.tier);
};

// The lowest tier that has a feature, for "upgrade to ..." messages
export const lowestTierWith = (feature) => TIERS.find((tier) => FEATURES[tier][feature]);

export const upgradeMessage = (feature) =>
  `UPGRADE_REQUIRED: ${FEATURE_LABELS[feature]} is available on the ${TIER_LABELS[lowestTierWith(feature)]} plan and above.`;

export const packUpgradeMessage = (pack) =>
  `UPGRADE_REQUIRED: The ${PACKS[pack]?.name || pack} templates are available on the ${TIER_LABELS[PACKS[pack]?.tier] || "Pro"} plan and above.`;

/**
 * Everything the app needs to show or hide for an account, in one object.
 */
export const describeEntitlements = (subscription, now) => {
  const tier = tierOf(subscription, now);
  return {
    plan: effectivePlan(subscription, now),
    tier,
    ...includedIn(subscription, now),
    packs: Object.keys(PACKS).filter((pack) => canUsePack(subscription, pack, now)),
  };
};
