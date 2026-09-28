import { getOrCreateSubscription } from "../services/subscription.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireTier = (allowedTiers = []) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Authentication required");
    }

    const sub = await getOrCreateSubscription(userId);
    req.subscription = sub;

    // Normalize check - if subscription is expired or canceled, treat as free
    const isExpired = sub.status === "expired" || sub.status === "canceled" || (sub.currentPeriodEnd && new Date() > new Date(sub.currentPeriodEnd) && sub.status !== "past_due" && sub.status !== "active");
    const currentPlan = isExpired ? "free" : (sub.plan || "free");
    
    if (!allowedTiers.includes(currentPlan)) {
      throw new ApiError(
        403,
        `UPGRADE_REQUIRED: This feature is restricted to ${allowedTiers.map(t => t.toUpperCase()).join(" / ")} subscribers. Your current plan is ${currentPlan.toUpperCase()}${isExpired ? " (EXPIRED)" : ""}.`
      );
    }

    next();
  });
};
