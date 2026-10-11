import { PACKS } from "../templates/catalogue.js";
import { PLANS } from "../config/plans.js";

/**
 * What each plan can do (plan task P4-06).
 *
 * This is the one place that knows. Routes ask "may this account use bulk send?"; they never
 * list plan names themselves, so adding or renaming a plan is a change to the two tables below
 * and nothing else.
 */

export const TIERS = ["free", "pro", "business", "enterprise"];

// Every plan an account can be on, and the tier of features it buys. The plans themselves,
// with their prices and document allowances, are listed in config/plans.js.
export const PLAN_TIER = Object.fromEntries(Object.entries(PLANS).map(([plan, { tier }]) => [plan, tier]));

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
const FEATURE_LABELS = {
  "templates.own": "Saving your own templates",
  bulkSend: "Bulk send",
  api: "API keys and webhooks",
  workspaces: "Team workspaces",
};

const TIER_LABELS = { free: "Free", pro: "Pro", business: "Business", enterprise: "Enterprise" };

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
  return PLAN_TIER[plan] ? plan : "free";
};

export const tierOf = (subscription, now) => PLAN_TIER[effectivePlan(subscription, now)];

const rank = (tier) => TIERS.indexOf(tier);

export const can = (subscription, feature, now) => {
  if (!(feature in FEATURES.free)) throw new Error(`Unknown feature: ${feature}`);
  return FEATURES[tierOf(subscription, now)][feature];
};

export const limitOf = (subscription, limit, now) => {
  if (!(limit in LIMITS.free)) throw new Error(`Unknown limit: ${limit}`);
  return LIMITS[tierOf(subscription, now)][limit];
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
    features: { ...FEATURES[tier] },
    limits: { ...LIMITS[tier] },
    packs: Object.keys(PACKS).filter((pack) => canUsePack(subscription, pack, now)),
  };
};
