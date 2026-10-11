import { Subscription } from "../models/Subscription.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { PLANS, isPlan, quotaOf, periodMsOf } from "../config/plans.js";

// Document allowances come from the plan catalogue
const PLAN_QUOTAS = Object.fromEntries(Object.keys(PLANS).map((plan) => [plan, quotaOf(plan)]));

export const getOrCreateSubscription = async (userId) => {
  let sub = await Subscription.findOne({ userId });

  if (!sub) {
    // A new account's first pages ask for the subscription several times at once.
    // Only one of those requests may create it; the others read what that one made.
    try {
      sub = await Subscription.create({
        userId,
        plan: "free",
        status: "free",
        monthlyQuota: PLAN_QUOTAS.free,
        usedThisMonth: 0,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      sub = await Subscription.findOne({ userId });
    }
  }

  const now = new Date();

  // An account that paid for an unlimited period under the old plans has reached the end of it
  if (sub.quotaGrandfatheredUntil && now >= sub.quotaGrandfatheredUntil) {
    sub.quotaGrandfatheredUntil = null;
    sub.monthlyQuota = quotaOf(sub.plan) * (PLANS[sub.plan]?.perSeat ? sub.seats || 1 : 1);
  }

  // 1. Lazy reset monthly quota if current time is past quotaResetDate
  if (sub.quotaResetDate && now >= sub.quotaResetDate) {
    sub.usedThisMonth = 0;
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);
    sub.quotaResetDate = nextReset;
  }

  // 2. Automated Lifecycle & Expiry Evaluation
  if (sub.plan !== "free" && sub.currentPeriodEnd) {
    const periodEndDate = new Date(sub.currentPeriodEnd);

    // Cancelled earlier, and the time they paid for has now run out
    if (now > periodEndDate && sub.cancelAtPeriodEnd) {
      sub.previousPlan = sub.plan;
      sub.plan = "free";
      sub.status = "canceled";
      sub.monthlyQuota = PLAN_QUOTAS.free;
      sub.cancelAtPeriodEnd = false;
      await sub.save();
    }

    // Period ended with no renewal reported -> enter the 3-day grace period
    if (sub.plan !== "free" && now > periodEndDate && sub.status === "active") {
      sub.status = "past_due";
      sub.gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days grace
      await sub.save();
    }

    // Grace period ended -> Complete Downgrade to Free
    if (sub.status === "past_due" && sub.gracePeriodEnd && now > new Date(sub.gracePeriodEnd)) {
      sub.previousPlan = sub.plan;
      sub.plan = "free";
      sub.status = "expired";
      sub.monthlyQuota = PLAN_QUOTAS.free;

      // Soft-lock owned workspaces to read-only mode
      try {
        await Workspace.updateMany(
          { ownerId: userId, personal: { $ne: true } },
          { status: "read_only" }
        );
      } catch (wsErr) {
        console.warn("Could not set workspace to read-only upon downgrade:", wsErr.message);
      }

      await sub.save();
    }
  }

  if (sub.isModified()) {
    await sub.save();
  }

  return sub;
};

// Whether an account could send `count` more documents, without counting them.
// Sending itself uses reserveQuota, which checks and counts in one step.
export const checkQuota = async (userId, count = 1) => {
  const sub = await getOrCreateSubscription(userId);
  if (sub.usedThisMonth + count > sub.monthlyQuota + (sub.extraDocuments || 0)) {
    throw new ApiError(403, `Monthly document quota exceeded (${sub.usedThisMonth} of ${sub.monthlyQuota} used).`);
  }
  return sub;
};

// Documents sent this month beyond the plan's allowance. These are the ones paid for by top-ups.
const overAllowance = (used) => ({ $max: [0, { $subtract: [used, "$monthlyQuota"] }] });

/**
 * Counts documents against the account before they are sent (plan task P4-14).
 *
 * The month's allowance is used first, then documents bought as top-ups. The check and the
 * count are one step in the database, so sends arriving together cannot pass the limit.
 */
export const reserveQuota = async (userId, count = 1) => {
  const sub = await getOrCreateSubscription(userId); // applies monthly reset and expiry first

  const usedAfter = { $add: ["$usedThisMonth", count] };
  // What this send takes from the top-ups: the growth in documents beyond the allowance
  const fromTopUps = { $subtract: [overAllowance(usedAfter), overAllowance("$usedThisMonth")] };

  const updated = await Subscription.findOneAndUpdate(
    { _id: sub._id, $expr: { $lte: [fromTopUps, "$extraDocuments"] } },
    [{ $set: { extraDocuments: { $subtract: ["$extraDocuments", fromTopUps] }, usedThisMonth: usedAfter } }],
    { new: true, updatePipeline: true }
  );

  if (!updated) {
    const extra = sub.extraDocuments ? ` and ${sub.extraDocuments} extra` : "";
    throw new ApiError(
      403,
      `Monthly document quota exceeded (${sub.usedThisMonth} of ${sub.monthlyQuota}${extra} used). Upgrade your plan or buy extra documents to send more.`
    );
  }
  return updated;
};

// Gives back documents that were counted but not sent, to wherever they were taken from
export const releaseQuota = async (userId, count = 1) => {
  if (count <= 0) return;
  const usedBefore = { $subtract: ["$usedThisMonth", count] };
  const toTopUps = { $subtract: [overAllowance("$usedThisMonth"), overAllowance(usedBefore)] };

  await Subscription.updateOne(
    { userId, usedThisMonth: { $gte: count } },
    [{ $set: { extraDocuments: { $add: ["$extraDocuments", toTopUps] }, usedThisMonth: usedBefore } }],
    { updatePipeline: true }
  );
};

// Adds documents bought as a top-up
export const addExtraDocuments = async (userId, documents) => {
  await getOrCreateSubscription(userId);
  return Subscription.findOneAndUpdate({ userId }, { $inc: { extraDocuments: documents } }, { new: true });
};

/**
 * How much of its allowance an account has used, for the billing page.
 */
export const usageOf = (sub) => {
  const unlimited = sub.monthlyQuota >= PLAN_QUOTAS.lifetime;
  return {
    usedThisMonth: sub.usedThisMonth,
    monthlyQuota: unlimited ? null : sub.monthlyQuota,
    extraDocuments: sub.extraDocuments || 0,
    remaining: unlimited ? null : Math.max(0, sub.monthlyQuota - sub.usedThisMonth) + (sub.extraDocuments || 0),
    resetsOn: sub.quotaResetDate,
  };
};

export const upgradeUserPlan = async (userId, newPlan, metadata = {}) => {
  const sub = await getOrCreateSubscription(userId);
  const now = Date.now();

  if (!isPlan(newPlan)) throw new ApiError(400, "Invalid subscription plan specified");

  sub.plan = newPlan;
  if (metadata.seats) sub.seats = Math.max(1, Number(metadata.seats) || 1);
  if (!PLANS[newPlan].perSeat) sub.seats = 1;
  sub.status = newPlan === "free" ? "free" : "active";
  // On a plan sold by the seat, the allowance is pooled: every seat adds to the one total
  sub.monthlyQuota = quotaOf(newPlan) * (PLANS[newPlan].perSeat ? sub.seats : 1);
  sub.quotaGrandfatheredUntil = null;
  sub.currentPeriodEnd = newPlan === "free" ? null : new Date(now + periodMsOf(newPlan));
  sub.gracePeriodEnd = null;
  sub.cancelAtPeriodEnd = false;

  if (metadata.stripeCustomerId) sub.stripeCustomerId = metadata.stripeCustomerId;
  if (metadata.stripeSubscriptionId) sub.stripeSubscriptionId = metadata.stripeSubscriptionId;
  if (metadata.razorpaySubscriptionId) sub.razorpaySubscriptionId = metadata.razorpaySubscriptionId;
  if (metadata.amount) sub.lastPaymentAmount = metadata.amount;
  if (metadata.currency) sub.lastPaymentCurrency = String(metadata.currency).toUpperCase();

  // Reactivate user's owned workspaces if upgrading to Enterprise
  if (["business", "enterprise"].includes(PLANS[newPlan].tier)) {
    try {
      await Workspace.updateMany(
        { ownerId: userId, personal: { $ne: true }, status: "read_only" },
        { status: "active" }
      );
    } catch (wsErr) {
      console.warn("Could not reactivate workspaces upon upgrade:", wsErr.message);
    }
  }

  await sub.save();

  // Dispatch instant webhook alert (Telegram/Discord/Slack)
  try {
    const { User } = await import("../models/User.model.js");
    const { sendNewSubscriptionAlert } = await import("./alert.service.js");
    const user = await User.findById(userId);
    await sendNewSubscriptionAlert({
      userEmail: user?.email || "unknown@user.com",
      plan: newPlan,
      amount: metadata.amount || PLANS[newPlan].priceInr || 0,
      currency: metadata.currency || "INR",
    });
  } catch (alertErr) {
    console.warn("Could not dispatch subscription alert:", alertErr.message);
  }

  return sub;
};

// Batch background runner for scheduled lifecycle checks
export const processSubscriptionLifecycle = async () => {
  try {
    const now = new Date();

    // 1. Move active expired to past_due (grace period)
    const toGracePeriod = await Subscription.find({
      plan: { $ne: "free" },
      status: "active",
      currentPeriodEnd: { $ne: null, $lt: now },
    });

    for (const sub of toGracePeriod) {
      sub.status = "past_due";
      sub.gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await sub.save();
    }

    // 2. Move past_due past gracePeriodEnd to expired & free
    const toExpire = await Subscription.find({
      status: "past_due",
      gracePeriodEnd: { $ne: null, $lt: now },
    });

    for (const sub of toExpire) {
      sub.previousPlan = sub.plan;
      sub.plan = "free";
      sub.status = "expired";
      sub.monthlyQuota = PLAN_QUOTAS.free;

      try {
        await Workspace.updateMany(
          { ownerId: sub.userId, personal: { $ne: true } },
          { status: "read_only" }
        );
      } catch (e) {}

      await sub.save();
    }
  } catch (err) {
    console.error("Subscription lifecycle check error:", err);
  }
};

// Developer simulation mode: instant upgrade for local dev testing
export const devMockUpgrade = async (userId, plan) => {
  if (!env.devBillingSimulation) {
    throw new ApiError(404, "Not found");
  }

  if (!isPlan(plan)) {
    throw new ApiError(400, "Invalid subscription plan specified");
  }

  return await upgradeUserPlan(userId, plan, { amount: PLANS[plan].priceInr || 0, currency: "INR" });
};

// Simulation / Webhook Handler: Payment Failure (Enter 3-day Grace Period)
export const handlePaymentFailed = async (userId) => {
  const sub = await getOrCreateSubscription(userId);
  sub.status = "past_due";
  sub.gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days grace
  await sub.save();
  return sub;
};

// Simulation / Webhook Handler: Expiration Downgrade to Free
export const downgradeExpiredSubscription = async (userId) => {
  const sub = await getOrCreateSubscription(userId);
  sub.previousPlan = sub.plan;
  sub.plan = "free";
  sub.status = "expired";
  sub.monthlyQuota = PLAN_QUOTAS.free;
  sub.gracePeriodEnd = null;

  try {
    await Workspace.updateMany(
      { ownerId: userId, personal: { $ne: true } },
      { status: "read_only" }
    );
  } catch (wsErr) {
    console.warn("Could not set workspace to read-only upon downgrade:", wsErr.message);
  }

  await sub.save();
  return sub;
};

// Simulation / Webhook Handler: Reactivation
export const reactivateSubscription = async (userId, plan = "enterprise", metadata = {}) => {
  return await upgradeUserPlan(userId, plan, metadata);
};

