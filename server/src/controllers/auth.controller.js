import { asyncHandler } from "../utils/asyncHandler.js";
import {
  registerUser,
  loginUser,
  issueSession,
  revokeSessions,
  verifyEmailToken,
  issueEmailVerification,
} from "../services/auth.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { PasswordReset } from "../models/PasswordReset.model.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import { randomToken, sha256Hex, safeEqual } from "../utils/tokens.js";

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_REUSE_GRACE_MS = 30 * 1000;

// Secure in production; SameSite=Lax works because the app and API share a parent domain
const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProd,
  path: "/",
});

const setRefreshCookie = (res, refreshToken) =>
  res.cookie("refreshToken", refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE_MS });

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  emailVerified: user.emailVerified !== false,
  termsAccepted: user.termsAccepted || false,
  termsAcceptedAt: user.termsAcceptedAt || null,
  twoFactorEnabled: Boolean(user.twoFactor?.enabled),
});

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json(
    new ApiResponse({ id: user._id, emailVerified: false }, "Registered. Please confirm your email address.")
  );
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);

  setRefreshCookie(res, refreshToken)
    .status(200)
    .json(new ApiResponse({ accessToken, user: publicUser(user) }));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.refreshSecret);
  } catch (err) {
    res.clearCookie("refreshToken", refreshCookieOptions());
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decoded.id).select(
    "+refreshTokenHash +previousRefreshTokenHash +refreshRotatedAt"
  );
  const presentedHash = sha256Hex(refreshToken);

  // Two tabs refreshing at the same moment: the loser still holds the token rotated a moment ago
  const justRotated =
    user?.previousRefreshTokenHash &&
    user.refreshRotatedAt &&
    Date.now() - new Date(user.refreshRotatedAt).getTime() < REFRESH_REUSE_GRACE_MS &&
    safeEqual(user.previousRefreshTokenHash, presentedHash);

  if (justRotated) {
    return res.status(200).json(new ApiResponse({ accessToken: user.generateAccessToken() }));
  }

  if (!user || !user.refreshTokenHash || !safeEqual(user.refreshTokenHash, presentedHash)) {
    // A token that no longer matches may be a stolen copy being replayed: end every session
    if (user) await revokeSessions(user._id);
    res.clearCookie("refreshToken", refreshCookieOptions());
    throw new ApiError(401, "Refresh token mismatch");
  }

  // Rotation: each refresh token works once
  const session = await issueSession(user);

  setRefreshCookie(res, session.refreshToken)
    .status(200)
    .json(new ApiResponse({ accessToken: session.accessToken }));
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse({
      user: req.user,
      id: req.user._id || req.user.id,
      workspace: req.workspace,
    })
  );
});

export const acceptTerms = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsVersion: "1.0.0",
      termsIpAddress: req.ip || req.socket?.remoteAddress,
    },
    { new: true }
  );

  res.status(200).json(
    new ApiResponse({
      termsAccepted: updatedUser.termsAccepted,
      termsAcceptedAt: updatedUser.termsAcceptedAt,
      termsVersion: updatedUser.termsVersion,
    }, "Terms and Conditions accepted successfully.")
  );
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.refreshSecret);
      if (decoded?.id) {
        await revokeSessions(decoded.id);
      }
    } catch (err) {
      // ignore invalid token decoding on logout
    }
  }

  res
    .clearCookie("refreshToken", refreshCookieOptions())
    .status(200)
    .json(new ApiResponse(null, "Logged out successfully"));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) {
    throw new ApiError(400, "Confirmation token is required");
  }

  await verifyEmailToken(token);
  res.status(200).json(new ApiResponse({ emailVerified: true }, "Email address confirmed."));
});

export const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (user.emailVerified !== false) {
    return res.status(200).json(new ApiResponse({ emailVerified: true }, "Email address already confirmed."));
  }

  await issueEmailVerification(user);
  res.status(200).json(new ApiResponse({ emailVerified: false }, "Confirmation email sent."));
});

const GENERIC_RESET_MESSAGE = "If an account exists with that email, a password reset link has been dispatched.";

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Same answer whether or not the account exists
    return res.status(200).json(new ApiResponse(null, GENERIC_RESET_MESSAGE));
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordReset.deleteMany({ userId: user._id }); // invalidate previous
  await PasswordReset.create({
    userId: user._id,
    token: sha256Hex(token), // only the hash is stored
    expiresAt,
  });

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetToken: token,
    });
  } catch (err) {
    // Keep the response identical so a mail failure does not reveal that the account exists
    console.error("Could not send password reset email:", err.message);
  }

  res.status(200).json(new ApiResponse(null, GENERIC_RESET_MESSAGE));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // Claim the token atomically so it cannot be used twice
  const resetRecord = await PasswordReset.findOneAndUpdate(
    { token: sha256Hex(token), used: false, expiresAt: { $gt: new Date() } },
    { $set: { used: true } }
  );
  if (!resetRecord) {
    throw new ApiError(400, "Password reset token is invalid or has expired");
  }

  const user = await User.findById(resetRecord.userId).select("+password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  await user.save();

  // Whoever knew the old password is signed out everywhere
  await revokeSessions(user._id);
  res.clearCookie("refreshToken", refreshCookieOptions());

  res.status(200).json(new ApiResponse(null, "Password reset successfully. You can now log in."));
});
