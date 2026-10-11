import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { loginLimiter } from "../middlewares/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { beginTwoFactor, confirmTwoFactor, disableTwoFactor, twoFactorStatus } from "../services/twoFactor.service.js";

// Two-step sign-in with an authenticator app, managed by the signed-in user for their own account.
// These stay reachable in a workspace that requires two-step sign-in, so a member can switch it on.
const router = Router();

router.use(protect);

router.get(
  "/",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await twoFactorStatus(req.user.id), "Two-step sign-in")))
);

router.post(
  "/begin",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await beginTwoFactor(req.user.id), "Add this to your authenticator app, then confirm with a code")))
);

// Code guessing is slowed by the same limit as sign-in attempts
router.post(
  "/confirm",
  loginLimiter,
  asyncHandler(async (req, res) => res.json(new ApiResponse(await confirmTwoFactor(req.user.id, req.body?.code), "Two-step sign-in is on. Keep the recovery codes somewhere safe.")))
);

router.post(
  "/disable",
  loginLimiter,
  asyncHandler(async (req, res) => {
    await disableTwoFactor(req.user.id, req.body?.code);
    res.json(new ApiResponse({}, "Two-step sign-in is off"));
  })
);

export default router;
