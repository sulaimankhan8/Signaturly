import { PlanSetting } from "../models/PlanSetting.model.js";
import { AddOnSetting } from "../models/AddOnSetting.model.js";
import { ProviderPlan } from "../models/ProviderPlan.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/User.model.js";
import {
  PLANS,
  TOPUP_PACKS,
  UNLIMITED,
  PRICE_GRACE_MS,
  applyPlanSettings,
  applyAddOnSettings,
  describePlan,
  describeTopUpPack,
  isPlan,
  isShippedPlan,
  isTopUpPack,
  isShippedTopUpPack,
  sellsAs,
  yearlyIdFor,
  yearlyPlanOf,
  monthlyPlanOf,
} from "../config/plans.js";
import { FEATURE_NAMES, FEATURE_LABELS, TIER_LABELS, includesOf, describeTiers } from "./entitlements.service.js";
import { syncProviderPlan } from "./autoRenew.service.js";
import { razorpayConfigured } from "./razorpay.client.js";
import { ADMIN_ROLES } from "../middleware/admin.middleware.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * The price list as admins set it from the admin app: plans, and packs of extra documents.
 *
 * What a release ships with is in config/plans.js. What an admin changes or adds is kept in
 * the database, one PlanSetting for each plan and one AddOnSetting for each pack, and laid
 * over that list. This server's list is the one that counts: a plan sold as a subscription is
 * created at Razorpay from here, never the other way round. The rest of the
 * server reads the list from memory, so it is read from the database when the server starts,
 * when an admin changes it, and again every half a minute, which is how a change made on one
 * running copy of the server reaches the others.
 */

const REFRESH_MS = 30 * 1000;
let loadedAt = 0;
let loading = null;

export const loadPlans = async () => {
  const [plans, addOns] = await Promise.all([PlanSetting.find().sort({ createdAt: 1, _id: 1 }).lean(), AddOnSetting.find().sort({ createdAt: 1, _id: 1 }).lean()]);
  applyPlanSettings(plans);
  applyAddOnSettings(addOns);
  loadedAt = Date.now();
};

// Runs before every API request. A database that cannot be read leaves the last known list in use.
export const keepPlansCurrent = async (req, res, next) => {
  if (Date.now() - loadedAt > REFRESH_MS) {
    loading ||= loadPlans()
      .catch((err) => {
        loadedAt = Date.now();
        console.error("[Plans] settings could not be read; keeping the list as it was:", err.message);
      })
      .finally(() => {
        loading = null;
      });
    await loading;
  }
  next();
};

// What a request may name. `features` and `limits` are what the plan includes.
const SETTABLE = ["name", "tagline", "highlight", "tier", "interval", "perSeat", "documentsPerMonth", "priceInr", "priceIsFrom", "purchasable", "legacy", "features", "limits", "sellSubscription", "sellPrepaid"];
// A plan's yearly price is only that: a price, and how it is sold. The rest is the plan's.
const YEARLY_FIELDS = ["priceInr", "purchasable", "sellSubscription", "sellPrepaid"];
// Free is what every account falls back to: it has no price, no period and a tier of its own.
// Lifetime was sold once, for good and with no monthly limit; only what it includes can be set.
const fieldsAdminMaySet = (id) =>
  id === "free" ? ["name", "tagline", "highlight", "documentsPerMonth", "features", "limits"] : id === "lifetime" ? ["name", "tier", "features", "limits"] : monthlyPlanOf(id) ? YEARLY_FIELDS : SETTABLE;

const pick = (from, fields) => Object.fromEntries(fields.filter((field) => from[field] !== undefined).map((field) => [field, from[field]]));

// A plan with every field present, as it is kept in the database
const whole = (plan) => ({
  name: plan.name,
  tier: plan.tier,
  documentsPerMonth: plan.documentsPerMonth,
  priceInr: plan.priceInr ?? null,
  priceIsFrom: Boolean(plan.priceIsFrom),
  interval: plan.interval ?? null,
  perSeat: Boolean(plan.perSeat),
  purchasable: Boolean(plan.purchasable),
  legacy: Boolean(plan.legacy),
  // How it may be bought while on sale; both, unless one was switched off
  sellSubscription: plan.sellSubscription !== false,
  sellPrepaid: plan.sellPrepaid !== false,
  // Null for either means "what the tier gives"
  features: Array.isArray(plan.features) ? [...plan.features] : null,
  bulkSendMax: Number.isInteger(plan.bulkSendMax) ? plan.bulkSendMax : null,
  yearlyOf: plan.yearlyOf || null,
  tagline: plan.tagline || "",
  highlight: Boolean(plan.highlight),
});

/**
 * The plan as it would be after `changes`. What a plan includes is kept only where it differs
 * from what its tier gives, so a plan nobody has singled out keeps following its tier.
 */
const withChanges = (before, { features, limits, documentsPerMonth, ...simple }) => {
  const after = { ...before, ...simple };
  if (documentsPerMonth !== undefined) after.documentsPerMonth = documentsPerMonth ?? UNLIMITED;
  // Retiring a plan takes it off sale
  if (simple.legacy === true && simple.purchasable === undefined) after.purchasable = false;
  // A new tier brings what that tier gives, unless the same change says otherwise
  if (after.tier !== before.tier) Object.assign(after, { features: null, bulkSendMax: null });

  const tierGives = includesOf({ tier: after.tier });
  if (features) {
    const wanted = { ...includesOf(after).features, ...features };
    after.features = FEATURE_NAMES.every((name) => wanted[name] === tierGives.features[name]) ? null : FEATURE_NAMES.filter((name) => wanted[name]);
  }
  if (limits?.bulkSendMax !== undefined) after.bulkSendMax = limits.bulkSendMax === tierGives.limits.bulkSendMax ? null : limits.bulkSendMax;
  return after;
};

// Refuses a plan that could not be sold or held as it is written. For a yearly price,
// `monthly` is the plan it belongs to, as that plan is about to be.
const check = (id, plan, monthly = plan.yearlyOf ? PLANS[plan.yearlyOf] : null) => {
  const includes = includesOf(plan);
  if (includes.features.bulkSend && !(includes.limits.bulkSendMax >= 1)) throw new ApiError(400, "Say how many people one bulk send may go to");

  if (id === "free") {
    if (plan.documentsPerMonth >= UNLIMITED) throw new ApiError(400, "The Free plan needs a monthly limit");
    return;
  }
  if (!plan.purchasable) return;
  if (!plan.sellSubscription && !plan.sellPrepaid) throw new ApiError(400, "A plan on sale has to be sold at least one way: as a subscription, or for one period");
  if (plan.legacy) throw new ApiError(400, "A retired plan cannot be on sale");
  if (plan.priceIsFrom) throw new ApiError(400, 'A plan priced "from" an amount is agreed with each customer, so it cannot be put on sale');
  if (!(plan.priceInr >= 1)) throw new ApiError(400, "A plan on sale needs a price");
  // A year that costs more than twelve months is not an offer anyone should be shown
  if (plan.yearlyOf && monthly?.priceInr >= 1 && plan.priceInr > monthly.priceInr * 12) {
    throw new ApiError(400, `A year at Rs. ${plan.priceInr} would cost more than twelve months at Rs. ${monthly.priceInr}. Lower the yearly price, or do not sell the plan by the year.`);
  }
};

const documentsSaid = (documents) => (documents >= UNLIMITED ? "no monthly limit" : `${documents} documents a month`);
const priceSaid = (plan) => (plan.priceInr === null ? "no price" : `${plan.priceIsFrom ? "from " : ""}Rs. ${plan.priceInr}`);

// What changed, as short phrases for the record of admin actions
const changesBetween = (before, after) => {
  const [had, has] = [includesOf(before), includesOf(after)];
  return [
    before.name !== after.name && `name "${before.name}" to "${after.name}"`,
    before.tagline !== after.tagline && `who it is for "${before.tagline}" to "${after.tagline}"`,
    before.highlight !== after.highlight && (after.highlight ? "marked as most popular" : "no longer marked as most popular"),
    (before.priceInr !== after.priceInr || before.priceIsFrom !== after.priceIsFrom) && `price ${priceSaid(before)} to ${priceSaid(after)}`,
    before.interval !== after.interval && `period one ${before.interval} to one ${after.interval}`,
    before.perSeat !== after.perSeat && (after.perSeat ? "now sold by the seat" : "no longer sold by the seat"),
    before.documentsPerMonth !== after.documentsPerMonth && `allowance ${documentsSaid(before.documentsPerMonth)} to ${documentsSaid(after.documentsPerMonth)}`,
    before.tier !== after.tier && `level ${TIER_LABELS[before.tier]} to ${TIER_LABELS[after.tier]}`,
    ...FEATURE_NAMES.filter((name) => had.features[name] !== has.features[name]).map((name) => `${FEATURE_LABELS[name]} ${has.features[name] ? "added" : "removed"}`),
    had.limits.bulkSendMax !== has.limits.bulkSendMax && `bulk send limit ${had.limits.bulkSendMax} to ${has.limits.bulkSendMax}`,
    before.purchasable !== after.purchasable && (after.purchasable ? "put on sale" : "taken off sale"),
    before.sellSubscription !== after.sellSubscription && (after.sellSubscription ? "now sold as a subscription" : "no longer sold as a subscription"),
    before.sellPrepaid !== after.sellPrepaid && (after.sellPrepaid ? "now sold for one period" : "no longer sold for one period"),
    before.legacy !== after.legacy && (after.legacy ? "retired" : "brought back from retirement"),
  ].filter(Boolean);
};

// A plan as the admin app is told about it: what it costs and what it includes
const viewOf = (id) => ({ ...describePlan(id), ...includesOf(PLANS[id]), sellSubscription: PLANS[id].sellSubscription !== false, sellPrepaid: PLANS[id].sellPrepaid !== false });

// A pack of extra documents as the admin app is told about it
const addOnViewOf = (id, changedAt) => ({ ...describeTopUpPack(id), shipped: isShippedTopUpPack(id), changedAt: changedAt || null });

/**
 * Every plan, with how many accounts hold it and what an admin may change on it; where each
 * plan sold as a subscription stands at Razorpay; the packs of extra documents; and what each
 * tier gives by itself.
 *
 * A plan's yearly price is in the list too, as a record of its own with `yearlyOf` naming the
 * plan: it has its own accounts, its own price history and its own plan at Razorpay.
 */
export const listPlans = async () => {
  await loadPlans();
  const admins = (await User.find({ role: { $in: ADMIN_ROLES } }).select("_id").lean()).map((u) => u._id);
  const [held, customers, settings, addOnSettings, providerPlans, renewing] = await Promise.all([
    Subscription.aggregate([
      { $match: { userId: { $nin: admins }, plan: { $ne: "free" }, status: { $in: ["active", "past_due"] } } },
      { $group: { _id: "$plan", accounts: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: { $nin: ADMIN_ROLES }, deletedAt: null }),
    PlanSetting.find().select("planId updatedAt").lean(),
    AddOnSetting.find().select("addOnId updatedAt").lean(),
    ProviderPlan.find({ provider: "razorpay" }).sort({ createdAt: -1 }).lean(),
    // Accounts renewing by themselves, by plan and by what one seat of it is charged
    Subscription.aggregate([
      { $match: { userId: { $nin: admins }, autoRenew: true, plan: { $ne: "free" }, status: { $in: ["active", "past_due"] } } },
      { $group: { _id: { plan: "$plan", each: { $divide: ["$renewalAmountInr", { $max: [{ $ifNull: ["$seats", 1] }, 1] }] } }, accounts: { $sum: 1 } } },
    ]),
  ]);
  const addOnChangedAt = new Map(addOnSettings.map((setting) => [setting.addOnId, setting.updatedAt]));

  // Each price a plan has been subscribed to at is its own plan at Razorpay, which cannot be
  // edited there. The one at today's price is what a new subscriber gets; the others still
  // renew for the customers who subscribed at them.
  const razorpayOf = (id) => {
    const plan = PLANS[id];
    const needed = sellsAs(plan).subscription;
    const versions = providerPlans
      .filter((made) => made.planId === id)
      .map((made) => ({
        providerPlanId: made.providerPlanId,
        priceInr: made.priceInr,
        interval: made.interval,
        createdAt: made.createdAt,
        current: needed && made.priceInr === plan.priceInr && made.interval === plan.interval,
        subscribers: renewing.find((row) => row._id.plan === id && row._id.each === made.priceInr)?.accounts || 0,
      }));
    return { needed, configured: razorpayConfigured(), current: versions.find((version) => version.current) || null, versions };
  };

  const accountsOn = new Map(held.map((row) => [row._id, row.accounts]));
  const onPaidPlan = held.reduce((sum, row) => sum + row.accounts, 0);
  const changedAt = new Map(settings.map((setting) => [setting.planId, setting.updatedAt]));

  return {
    plans: Object.keys(PLANS).map((id) => ({
      ...viewOf(id),
      // An account with no paid plan is on Free, whether or not it has a subscription row
      accounts: id === "free" ? Math.max(0, customers - onPaidPlan) : accountsOn.get(id) || 0,
      // Ships with the release, as against added by an admin
      shipped: isShippedPlan(id),
      changedAt: changedAt.get(id) || null,
      canChange: fieldsAdminMaySet(id),
      razorpay: razorpayOf(id),
    })),
    addOns: Object.keys(TOPUP_PACKS).map((id) => addOnViewOf(id, addOnChangedAt.get(id))),
    tiers: describeTiers(),
    features: FEATURE_NAMES.map((id) => ({ id, label: FEATURE_LABELS[id] })),
  };
};

// One record of the price list as it would be after `changes`, checked, with what changed in words
const planAfter = (id, changes) => {
  const before = whole(PLANS[id]);
  const after = withChanges(before, changes);
  check(id, after);
  return { id, before, after, changed: changesBetween(before, after) };
};

/**
 * A plan's yearly price as it would be once the plan is as in `planNow` and `asked` is applied
 * to it. `asked` is `{ priceInr, purchasable, sellSubscription, sellPrepaid }`, each optional;
 * null means the plan is not to be sold by the year; undefined leaves the yearly price alone.
 * Returns null where there is no yearly price and none was asked for.
 */
const yearlyAfter = (planId, planNow, asked) => {
  const existing = yearlyPlanOf(planId);
  const id = existing || yearlyIdFor(planId);
  if (!existing && asked === undefined) return null;
  if (!existing && isPlan(id)) throw new ApiError(409, `The yearly price would be kept as ${id}, and there is already a plan with that id`);
  if (asked !== undefined && planNow.interval !== "month") throw new ApiError(400, "Only a plan sold by the month can have a yearly price as well");

  const before = existing ? whole(PLANS[existing]) : null;
  // Not sold by the year: a yearly price that exists is taken off sale, and kept for whoever is on it
  const wanted = asked === null ? { purchasable: false } : pick(asked || {}, YEARLY_FIELDS);
  if (!before && !(wanted.priceInr >= 1)) return null;

  const own = before || { priceInr: null, purchasable: false, sellSubscription: true, sellPrepaid: true };
  const after = { ...planNow, yearlyOf: planId, interval: "year", priceIsFrom: false, ...pick(own, YEARLY_FIELDS), ...wanted };
  // With no price there is nothing to sell; a retired plan is offered to nobody
  if (!(after.priceInr >= 1) || after.legacy) after.purchasable = false;
  check(id, after, planNow);

  // Only its own price and sale are its own to change; the rest was said about the plan
  const asWas = before ? { ...after, ...pick(before, YEARLY_FIELDS) } : { ...after, priceInr: null, purchasable: false };
  return { id, before: before || asWas, after, changed: changesBetween(asWas, after), isNew: !before };
};

// Writes one record. Checkouts already open were shown the price as it was, and are honoured for a while.
const write = async ({ id, before, after, isNew }, admin) => {
  const now = new Date();
  const existing = await PlanSetting.findOne({ planId: id }).select("earlierPrices").lean();
  const earlierPrices = (existing?.earlierPrices || []).filter((price) => new Date(price.until) > now);
  if (!isNew && before.purchasable && (after.priceInr !== before.priceInr || !after.purchasable)) {
    earlierPrices.push({ priceInr: before.priceInr, until: new Date(now.getTime() + PRICE_GRACE_MS) });
  }
  await PlanSetting.updateOne({ planId: id }, { $set: { ...after, earlierPrices, updatedBy: admin.id } }, { upsert: true, runValidators: true });
};

/**
 * Changes a plan. Only what is in `changes` is changed. `changes.yearly` is the plan's yearly
 * price and how it is sold (see yearlyAfter); it is saved with the plan, or not at all.
 *
 * - A new price or period is what the next checkout sells; an account that has paid keeps
 *   the period it paid for.
 * - A new allowance reaches a paying account when its next period starts, which is when its
 *   allowance is next set. Free accounts have no periods, so those still on Free's old
 *   allowance are moved at once; an account an admin gave its own allowance keeps it.
 * - What the plan includes is read each time it is asked about, so a change to its level or
 *   its features reaches every account on the plan at once, whichever price it pays.
 */
export const updatePlan = async (id, { yearly, ...changes }, admin) => {
  await loadPlans();
  if (!isPlan(id)) throw new ApiError(404, "Plan not found");

  const allowed = fieldsAdminMaySet(id);
  const refused = Object.keys(changes).filter((field) => !allowed.includes(field));
  if (refused.length > 0) {
    throw new ApiError(400, monthlyPlanOf(id) ? `That is set on the ${PLANS[id].name} plan itself; its yearly price has only a price and how it is sold` : `On the ${PLANS[id].name} plan that cannot be changed`);
  }
  if (yearly !== undefined && (monthlyPlanOf(id) || !allowed.includes("interval"))) throw new ApiError(400, "Only a plan sold by the month can have a yearly price as well");

  const own = planAfter(id, changes);
  if (yearlyPlanOf(id) && own.after.interval !== "month") throw new ApiError(400, "This plan has a yearly price, so it is itself sold by the month");
  const ofYear = monthlyPlanOf(id) ? null : yearlyAfter(id, own.after, yearly);

  const changed = [...own.changed, ...(ofYear?.changed || []).map((what) => `yearly: ${what}`)];
  if (changed.length === 0) throw new ApiError(400, "Nothing to change");

  // Seats already bought are counted against teams; a plan people are on cannot stop or start having them
  if (own.after.perSeat !== own.before.perSeat) {
    const ids = [id, yearlyPlanOf(id)].filter(Boolean);
    const holders = await Subscription.countDocuments({ $or: [{ plan: { $in: ids } }, { previousPlan: { $in: ids } }] });
    if (holders > 0) throw new ApiError(409, "Whether a plan is sold by the seat can be changed only while no account is on it");
  }

  if (own.changed.length > 0) await write(own, admin);
  if (ofYear && (ofYear.changed.length > 0 || ofYear.isNew)) await write(ofYear, admin);

  let accountsMoved = 0;
  if (id === "free" && own.after.documentsPerMonth !== own.before.documentsPerMonth) {
    const moved = await Subscription.updateMany({ plan: "free", monthlyQuota: own.before.documentsPerMonth }, { $set: { monthlyQuota: own.after.documentsPerMonth } });
    accountsMoved = moved.modifiedCount;
  }

  await loadPlans();
  // A plan sold as a subscription is made at Razorpay now, at its present price, not at the first sale
  const yearlyId = yearlyPlanOf(id);
  return { plan: viewOf(id), changed, accountsMoved, razorpay: await syncProviderPlan(id), razorpayYearly: yearlyId ? await syncProviderPlan(yearlyId) : null };
};

/**
 * Adds a plan. What it includes starts from one of the tiers the service knows, and any of
 * the features can be set apart from it. `yearly` gives it a yearly price as well.
 */
export const createPlan = async ({ id, features, limits, yearly, ...fields }, admin) => {
  await loadPlans();
  if (id in Object.prototype) throw new ApiError(400, "That id cannot be used");
  if (isPlan(id)) throw new ApiError(409, "There is already a plan with that id");

  const plan = withChanges(whole({ ...fields, documentsPerMonth: fields.documentsPerMonth ?? UNLIMITED }), { features, limits });
  check(id, plan);
  const ofYear = yearly ? yearlyAfter(id, plan, yearly) : null;

  try {
    await PlanSetting.create({ planId: id, ...plan, updatedBy: admin.id });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    throw new ApiError(409, "There is already a plan with that id");
  }
  if (ofYear) await write(ofYear, admin);

  await loadPlans();
  const yearlyId = yearlyPlanOf(id);
  return { ...viewOf(id), razorpay: await syncProviderPlan(id), razorpayYearly: yearlyId ? await syncProviderPlan(yearlyId) : null };
};

/**
 * Makes a plan at Razorpay at its present price, when it is sold as a subscription and is
 * not there yet. For the admin app's own button.
 */
export const pushPlanToRazorpay = async (id) => {
  await loadPlans();
  if (!isPlan(id)) throw new ApiError(404, "Plan not found");
  return { plan: describePlan(id), razorpay: await syncProviderPlan(id) };
};

// ----- packs of extra documents -----

/**
 * Adds a pack of extra documents.
 */
export const createAddOn = async ({ id, documents, priceInr, onSale = true }, admin) => {
  await loadPlans();
  if (id in Object.prototype) throw new ApiError(400, "That id cannot be used");
  if (isTopUpPack(id)) throw new ApiError(409, "There is already a pack with that id");

  try {
    await AddOnSetting.create({ addOnId: id, documents, priceInr, onSale, updatedBy: admin.id });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    throw new ApiError(409, "There is already a pack with that id");
  }
  await loadPlans();
  return addOnViewOf(id, new Date());
};

/**
 * Changes a pack of extra documents: how many it adds, its price, and whether it is on sale.
 * Only what is in `changes` is changed. Documents already bought are not touched; a new
 * price or size is what the next buyer gets.
 */
export const updateAddOn = async (id, changes, admin) => {
  await loadPlans();
  if (!isTopUpPack(id)) throw new ApiError(404, "Pack not found");

  const before = { documents: TOPUP_PACKS[id].documents, priceInr: TOPUP_PACKS[id].priceInr, onSale: TOPUP_PACKS[id].onSale !== false };
  const after = { ...before, ...changes };
  const changed = [
    before.documents !== after.documents && `size ${before.documents} to ${after.documents} documents`,
    before.priceInr !== after.priceInr && `price Rs. ${before.priceInr} to Rs. ${after.priceInr}`,
    before.onSale !== after.onSale && (after.onSale ? "put on sale" : "taken off sale"),
  ].filter(Boolean);
  if (changed.length === 0) throw new ApiError(400, "Nothing to change");

  // Checkouts already open were shown the price as it was
  const now = new Date();
  const existing = await AddOnSetting.findOne({ addOnId: id }).select("earlierPrices").lean();
  const earlierPrices = (existing?.earlierPrices || []).filter((price) => new Date(price.until) > now);
  if (before.onSale && (after.priceInr !== before.priceInr || !after.onSale)) {
    earlierPrices.push({ priceInr: before.priceInr, until: new Date(now.getTime() + PRICE_GRACE_MS) });
  }

  await AddOnSetting.updateOne({ addOnId: id }, { $set: { ...after, earlierPrices, updatedBy: admin.id } }, { upsert: true, runValidators: true });
  await loadPlans();
  return { addOn: addOnViewOf(id, now), changed };
};
