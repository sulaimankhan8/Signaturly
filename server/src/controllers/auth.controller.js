import { asyncHandler } from "../utils/asyncHandler.js";
import { registerUser, loginUser } from "../services/auth.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { PasswordReset } from "../models/PasswordReset.model.js";
import { sendPasswordResetEmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import { v4 as uuidv4 } from "uuid";

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json(new ApiResponse({ id: user._id }, "Registered"));
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);
  console.log("login controller", { userId: user._id, email: user.email });
  res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    })
    .status(200)
    .json(
      new ApiResponse({
        accessToken,
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
      })
    );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const decoded = jwt.verify(refreshToken, env.refreshSecret);
  const user = await User.findById(decoded.id).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    throw new ApiError(401, "Refresh token mismatch");
  }

  const newAccessToken = user.generateAccessToken();

  res.status(200).json(
    new ApiResponse({
      accessToken: newAccessToken,
    })
  );
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse({
      user: req.user,
      id: req.user._id,
    })
  );
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.refreshSecret);
      if (decoded?.id) {
        await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
      }
    } catch (err) {
      // ignore invalid token decoding on logout
    }
  }

  res
    .clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    })
    .status(200)
    .json(new ApiResponse(null, "Logged out successfully"));
});


export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, "Please provide your account email address");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    // For security, still return generic success so user enumeration is discouraged
    return res.status(200).json(
      new ApiResponse(null, "If an account exists with that email, a password reset link has been dispatched.")
    );
  }

  // Generate 1-hour expiration reset token
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordReset.deleteMany({ userId: user._id }); // invalidate previous
  await PasswordReset.create({
    userId: user._id,
    token,
    expiresAt,
  });

  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetToken: token,
  });

  res.status(200).json(
    new ApiResponse(null, "If an account exists with that email, a password reset link has been dispatched.")
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    throw new ApiError(400, "Token and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  const resetRecord = await PasswordReset.findOne({ token, used: false });
  if (!resetRecord || new Date() > new Date(resetRecord.expiresAt)) {
    throw new ApiError(400, "Password reset token is invalid or has expired");
  }

  const user = await User.findById(resetRecord.userId).select("+password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  await user.save();

  resetRecord.used = true;
  await resetRecord.save();

  res.status(200).json(new ApiResponse(null, "Password reset successfully. You can now log in."));
});
