import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
  acceptTerms,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate, schemas } from "../middlewares/validate.middleware.js";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
} from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/register", registerLimiter, validate({ body: schemas.register }), register);
router.post("/login", loginLimiter, validate({ body: schemas.login }), login);
router.post("/logout", logout);
router.post("/refresh-token", refreshLimiter, refreshAccessToken);
router.get("/me", protect, getMe);
router.post("/accept-terms", protect, acceptTerms);
router.post("/verify-email", passwordResetLimiter, verifyEmail);
router.post("/resend-verification", protect, passwordResetLimiter, resendVerification);
router.post("/forgot-password", passwordResetLimiter, validate({ body: schemas.forgotPassword }), forgotPassword);
router.post("/reset-password", passwordResetLimiter, validate({ body: schemas.resetPassword }), resetPassword);

export default router;
