import { Subscription } from "../models/Subscription.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

const PLAN_QUOTAS = {
  free: 15,
  pro_monthly: 999999,
  pro_annual: 999999,
  lifetime: 999999,
  enterprise: 999999,
};

export const getOrCreateSubscription = async (userId) => {
  let sub = await Subscription.findOne({ userId });

  if (!sub) {
    sub = await Subscription.create({
      userId,
      plan: "free",
      status: "free",
      monthlyQuota: PLAN_QUOTAS.free,
      usedThisMonth: 0,
    });
  }

  const now = new Date();

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
          { ownerId: userId },
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

export const checkQuota = async (userId, count = 1) => {
  const sub = await getOrCreateSubscription(userId);

  if (sub.plan === "free" && sub.usedThisMonth + count > sub.monthlyQuota) {
    throw new ApiError(
      403,
      `Monthly document quota exceeded (${sub.usedThisMonth}/${sub.monthlyQuota} used). Please upgrade to Pro for unlimited envelopes.`
    );
  }

  return sub;
};

export const incrementUsage = async (userId, count = 1) => {
  const sub = await getOrCreateSubscription(userId);
  sub.usedThisMonth += count;
  await sub.save();
  return sub;
};

/**
 * Checks the allowance and counts the documents in one database step,
 * so parallel sends can never go past the limit.
 */
export const reserveQuota = async (userId, count = 1) => {
  const sub = await getOrCreateSubscription(userId); // applies monthly reset and expiry first

  const filter = { _id: sub._id };
  if (sub.plan === "free") {
    filter.$expr = { $lte: [{ $add: ["$usedThisMonth", count] }, "$monthlyQuota"] };
  }

  const updated = await Subscription.findOneAndUpdate(filter, { $inc: { usedThisMonth: count } }, { new: true });
  if (!updated) {
    throw new ApiError(
      403,
      `Monthly document quota exceeded (${sub.usedThisMonth}/${sub.monthlyQuota} used). Please upgrade for more documents.`
    );
  }
  return updated;
};

// Gives back documents that were counted but not sent
export const releaseQuota = async (userId, count = 1) => {
  if (count <= 0) return;
  await Subscription.updateOne({ userId, usedThisMonth: { $gte: count } }, { $inc: { usedThisMonth: -count } });
};

export const upgradeUserPlan = async (userId, newPlan, metadata = {}) => {
  const sub = await getOrCreateSubscription(userId);
  const now = Date.now();

  // Calculate current period end based on plan
  let periodDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days default
  if (newPlan === "pro_annual") {
    periodDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year
  } else if (newPlan === "lifetime") {
    periodDurationMs = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
  }

  sub.plan = newPlan;
  sub.status = "active";
  sub.monthlyQuota = PLAN_QUOTAS[newPlan] || 999999;
  sub.currentPeriodEnd = new Date(now + periodDurationMs);
  sub.gracePeriodEnd = null;
  sub.cancelAtPeriodEnd = false;

  if (metadata.stripeCustomerId) sub.stripeCustomerId = metadata.stripeCustomerId;
  if (metadata.stripeSubscriptionId) sub.stripeSubscriptionId = metadata.stripeSubscriptionId;
  if (metadata.razorpaySubscriptionId) sub.razorpaySubscriptionId = metadata.razorpaySubscriptionId;
  if (metadata.amount) sub.lastPaymentAmount = metadata.amount;

  // Reactivate user's owned workspaces if upgrading to Enterprise
  if (newPlan === "enterprise") {
    try {
      await Workspace.updateMany(
        { ownerId: userId },
        { status: "active", "members.$[].status": "active" }
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
      amount: metadata.amount || (newPlan === "lifetime" ? 69 : 5.99),
      currency: metadata.currency || "USD",
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
          { ownerId: sub.userId },
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

  if (!["free", "pro_monthly", "pro_annual", "lifetime", "enterprise"].includes(plan)) {
    throw new ApiError(400, "Invalid subscription plan specified");
  }

  return await upgradeUserPlan(userId, plan, {
    amount: plan === "lifetime" ? 69 : plan === "pro_monthly" ? 5.99 : 49,
    currency: "USD",
  });
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
      { ownerId: userId },
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

