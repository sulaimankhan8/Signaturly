import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  getOrCreateSubscription,
  devMockUpgrade,
} from "../services/subscription.service.js";
import {
  createCheckoutSession,
  createBillingPortalSession,
  PLAN_CONFIG,
} from "../services/billing.service.js";

export const getSubscriptionController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const subscription = await getOrCreateSubscription(userId);

  res.status(200).json(
    new ApiResponse(
      {
        subscription,
        availablePlans: PLAN_CONFIG,
      },
      "Subscription details retrieved successfully"
    )
  );
});

export const createCheckoutSessionController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { plan, gateway } = req.body;

  const result = await createCheckoutSession({ userId, plan, gateway });

  res.status(200).json(
    new ApiResponse(result, "Checkout session initialized")
  );
});

export const devMockUpgradeController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { plan } = req.body;

  const updatedSubscription = await devMockUpgrade(userId, plan);

  res.status(200).json(
    new ApiResponse(
      updatedSubscription,
      `Successfully upgraded to ${plan} (Dev Simulation Mode)`
    )
  );
});

export const createBillingPortalController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await createBillingPortalSession(userId);

  res.status(200).json(
    new ApiResponse(result, "Billing portal URL generated")
  );
});
