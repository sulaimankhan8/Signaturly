import { Subscription } from "../models/Subscription.model.js";
import { PLANS, UNLIMITED, isPlan, quotaOf } from "../config/plans.js";

/**
 * Moves every account onto the plan catalogue of October 2026 (plan task P4-13).
 *
 *   free                 5 documents a month (was 15)
 *   pro_monthly/annual   50 a month, but an account inside a period it already paid for keeps
 *                        unlimited documents until that period ends
 *   lifetime             unchanged: Pro features and unlimited documents, though no longer sold
 *   enterprise           unchanged: unlimited
 *   anything else        a plan value that no longer exists becomes free
 *
 * Top-up balances start at zero. Nothing an account paid for is taken away.
 */
export const name = "001-plans-2026-10";

export const up = async () => {
  const counts = { free: 0, grandfathered: 0, moved: 0, unchanged: 0, unknown: 0 };
  const now = new Date();

  // Read through the driver, so rows whose plan is no longer in the schema's list are still seen
  const rows = await Subscription.collection.find({}).toArray();

  for (const row of rows) {
    const set = {};
    if (typeof row.extraDocuments !== "number") set.extraDocuments = 0;

    if (!isPlan(row.plan)) {
      Object.assign(set, { previousPlan: row.plan || null, plan: "free", status: "free", monthlyQuota: quotaOf("free"), quotaGrandfatheredUntil: null });
      counts.unknown += 1;
    } else if (row.plan === "free") {
      if (row.monthlyQuota !== quotaOf("free")) set.monthlyQuota = quotaOf("free");
      counts.free += 1;
    } else if (PLANS[row.plan].documentsPerMonth >= UNLIMITED) {
      if (row.monthlyQuota !== UNLIMITED) set.monthlyQuota = UNLIMITED;
      counts.unchanged += 1;
    } else if (row.quotaGrandfatheredUntil) {
      // Already handled by an earlier run
      counts.grandfathered += 1;
    } else if (row.monthlyQuota >= UNLIMITED && row.currentPeriodEnd && new Date(row.currentPeriodEnd) > now && row.status === "active") {
      // Paid for an unlimited period: it runs to its end
      set.quotaGrandfatheredUntil = new Date(row.currentPeriodEnd);
      counts.grandfathered += 1;
    } else {
      if (row.monthlyQuota !== quotaOf(row.plan)) set.monthlyQuota = quotaOf(row.plan);
      counts.moved += 1;
    }

    if (Object.keys(set).length > 0) await Subscription.collection.updateOne({ _id: row._id }, { $set: set });
  }

  return counts;
};
