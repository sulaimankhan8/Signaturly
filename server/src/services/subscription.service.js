import { Subscription } from "../models/Subscription.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { PLANS, UNLIMITED, isPlan, quotaOf, periodMsOf, sameOffer } from "../config/plans.js";
import { includesOf } from "./entitlements.service.js";
import { enqueueJob } from "../jobs/queue.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Tells the account's owner by email, once for each key. Queued apart from what caused it: an
// email that cannot be sent must never hold up, or undo, a send or a check.
const tell = (kind, details, idempotencyKey) =>
  enqueueJob("email.billing", { kind, ...details }, { idempotencyKey }).catch((err) => console.error(`[Billing] Could not queue the ${kind} email:`, err.message));

/**
 * Says so by email when a send takes an account past 80% or 100% of its month's allowance:
 * once each a month, and only the higher of the two when one send passes both.
 */
const tellUsage = (sub, count) => {
  const quota = sub.monthlyQuota;
  if (!(quota > 0) || quota >= UNLIMITED) return;
  const after = sub.usedThisMonth;
  const before = after - count;
  const crossed = [100, 80].find((threshold) => before * 100 < threshold * quota && after * 100 >= threshold * quota);
  if (!crossed) return;
  // The month the allowance belongs to: the one before the next reset
  const month = sub.quotaResetDate ? new Date(new Date(sub.quotaResetDate).getTime() - DAY_MS).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
  tell("usage", { userId: String(sub.userId), threshold: crossed }, `email.billing:usage:${sub.userId}:${month}:${crossed}`);
};

/**
 * Reminds the owner of a plan paid for once that it is about to end: a week before, and the
 * day before. A plan that renews by itself needs no reminder. Run with the hourly check.
 */
export const remindPlansEndingSoon = async (now = new Date()) => {
  const ending = await Subscription.find({
    plan: { $ne: "free" },
    status: "active",
    autoRenew: { $ne: true },
    cancelAtPeriodEnd: { $ne: true },
    currentPeriodEnd: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY_MS) },
  })
    .select("userId currentPeriodEnd")
    .limit(500)
    .lean();

  for (const sub of ending) {
    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY_MS);
    const offset = daysLeft <= 1 ? 1 : 7;
    await tell("ending_soon", { userId: String(sub.userId), daysLeft }, `email.billing:ending:${sub._id}:${sub.currentPeriodEnd.toISOString()}:${offset}`);
  }
  return ending.length;
};

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
        monthlyQuota: quotaOf("free"),
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
      sub.monthlyQuota = quotaOf("free");
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
      sub.monthlyQuota = quotaOf("free");

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
  tellUsage(updated, count);
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
  const unlimited = sub.monthlyQuota >= UNLIMITED;
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

  // More time bought on the plan the account is already on is added to the end of what it
  // has, so paying early never loses the days left. That holds whichever of the plan's two
  // prices is paid: a year bought with days of a month left starts when those days end.
  // On a plan sold by the seat it holds while the number of seats stays as it is; a purchase
  // for a different number starts afresh.
  const sameSeats = !PLANS[newPlan].perSeat || !metadata.seats || Math.max(1, Number(metadata.seats) || 1) === Math.max(1, sub.seats || 1);
  const addsTime = metadata.addToPeriod && sameSeats && sameOffer(sub.plan, newPlan) && sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now;
  const periodStart = addsTime ? sub.currentPeriodEnd.getTime() : now;
  // An upgrade carries the value of the old plan's unused time as extra time on the new one
  // (services/planChange.service.js): added to a period bought now (`creditMs`), or, bought with
  // auto-renew, as the time until the first charge (`periodEnd`)
  const creditMs = !addsTime && Number(metadata.creditMs) > 0 ? Number(metadata.creditMs) : 0;

  sub.plan = newPlan;
  if (metadata.seats) sub.seats = Math.max(1, Number(metadata.seats) || 1);
  if (!PLANS[newPlan].perSeat) sub.seats = 1;
  sub.status = newPlan === "free" ? "free" : "active";
  // On a plan sold by the seat, the allowance is pooled: every seat adds to the one total
  sub.monthlyQuota = quotaOf(newPlan) * (PLANS[newPlan].perSeat ? sub.seats : 1);
  sub.quotaGrandfatheredUntil = null;
  sub.currentPeriodEnd = newPlan === "free" ? null : metadata.periodEnd ? new Date(metadata.periodEnd) : new Date(periodStart + periodMsOf(newPlan) + creditMs);
  sub.gracePeriodEnd = null;
  sub.cancelAtPeriodEnd = false;
  // The account is now on the plan it was moving to, or on another: nothing is waiting any more
  sub.scheduledPlan = null;
  sub.scheduledSeats = null;
  sub.scheduledPlanFrom = null;
  // A plan given by an administrator brings in no money; the next payment clears this
  sub.complimentary = Boolean(metadata.grantedByAdmin) && newPlan !== "free";

  if (metadata.stripeCustomerId) sub.stripeCustomerId = metadata.stripeCustomerId;
  if (metadata.stripeSubscriptionId) sub.stripeSubscriptionId = metadata.stripeSubscriptionId;
  if (metadata.razorpaySubscriptionId) sub.razorpaySubscriptionId = metadata.razorpaySubscriptionId;
  if (metadata.amount) sub.lastPaymentAmount = metadata.amount;
  if (metadata.currency) sub.lastPaymentCurrency = String(metadata.currency).toUpperCase();

  // Reactivate the account's team workspaces when the new plan has them
  if (includesOf(PLANS[newPlan]).features.workspaces) {
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

  // Dispatch instant webhook alert (Telegram/Discord/Slack). A plan given by an administrator
  // is not a sale; it is written to the record of admin actions instead.
  if (metadata.grantedByAdmin) return sub;

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
  // A renewal that was due and unheard is looked up at the payment provider first, so that
  // nobody who has paid is moved into grace, or back to Free, over a lost notice
  try {
    const { reconcileAutoRenewals } = await import("./autoRenew.service.js");
    await reconcileAutoRenewals();
  } catch (err) {
    console.error("Subscription reconciliation error:", err.message);
  }

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
      sub.monthlyQuota = quotaOf("free");

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

  // Plans paid for once that end within the week: their owners are reminded
  try {
    await remindPlansEndingSoon();
  } catch (err) {
    console.error("Ending-soon reminders could not be queued:", err.message);
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
  sub.monthlyQuota = quotaOf("free");
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

