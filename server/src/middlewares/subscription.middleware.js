import { getOrCreateSubscription } from "../services/subscription.service.js";
import { can, upgradeMessage } from "../services/entitlements.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Lets the request through only if the plan includes the feature.
 * Which plans include what is decided in services/entitlements.service.js, never here or in a route.
 *
 * The plan looked at is the one that pays for the workspace the request is working in: a member
 * of a team works under the team owner's plan. `own: true` looks at the person's own plan
 * instead, for things they would own themselves, such as a new team workspace.
 */
export const requireFeature = (feature, { own = false } = {}) =>
  asyncHandler(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) {
      throw new ApiError(401, "Authentication required");
    }

    const sub = await getOrCreateSubscription(own ? userId : req.billingUserId || userId);
    req.subscription = sub;

    if (!can(sub, feature)) {
      throw new ApiError(403, upgradeMessage(feature));
    }

    next();
  });
