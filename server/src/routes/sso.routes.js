import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { loginLimiter } from "../middlewares/rateLimit.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { env } from "../config/env.js";
import { issueSession } from "../services/auth.service.js";
import { startSso, finishSso, getSsoSettings, saveSsoSettings, verifySsoDomains } from "../services/sso.service.js";

// Single sign-on for Enterprise workspaces (plan task P6-15)
const router = Router();

const cookie = (maxAge) => ({ httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge });
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// The sign-in screen asks where to send someone who typed a work email address
router.post(
  "/start",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { redirectUrl, nonce } = await startSso(req.body?.email);
    res.cookie("ssoState", nonce, cookie(10 * 60 * 1000));
    res.json(new ApiResponse({ redirectUrl }, "Continue with your organisation's sign-in"));
  })
);

// The identity provider sends the browser back here. On success the browser goes on to the
// app with a session; on failure it goes to the sign-in screen with a reason to show.
router.get("/callback", loginLimiter, async (req, res) => {
  try {
    const { user, workspaceId } = await finishSso({ code: req.query.code, state: req.query.state, cookieNonce: req.cookies?.ssoState });
    const { refreshToken } = await issueSession(user);
    res.clearCookie("ssoState", { path: "/" });
    res.cookie("refreshToken", refreshToken, cookie(REFRESH_COOKIE_MAX_AGE_MS));
    res.redirect(`${env.appUrl}/sso/done?workspace=${workspaceId}`);
  } catch (err) {
    res.clearCookie("ssoState", { path: "/" });
    res.redirect(`${env.appUrl}/login?sso_error=${encodeURIComponent(err?.statusCode && err.statusCode < 500 ? err.message : "Single sign-on could not be completed")}`);
  }
});

// The workspace owner's settings
router.get(
  "/settings/:workspaceId",
  protect,
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getSsoSettings(req.params.workspaceId, req.user.id), "Single sign-on settings")))
);

router.put(
  "/settings/:workspaceId",
  protect,
  asyncHandler(async (req, res) => res.json(new ApiResponse(await saveSsoSettings(req.params.workspaceId, req.user.id, req.body || {}), "Single sign-on settings saved")))
);

router.post(
  "/settings/:workspaceId/verify-domains",
  protect,
  asyncHandler(async (req, res) => res.json(new ApiResponse(await verifySsoDomains(req.params.workspaceId, req.user.id), "Domains checked")))
);

export default router;
