import { checkQuota } from "../services/subscription.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const enforceEnvelopeQuota = (requiredCount = 1) => {
  return asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) {
      return next();
    }

    // Determine count if it's a bulk send request
    const count = req.body?.rows?.length || requiredCount;

    const subscription = await checkQuota(userId, count);
    req.subscription = subscription;
    next();
  });
};
