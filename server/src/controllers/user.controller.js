import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { revokeSessions } from "../services/auth.service.js";
import { exportAccountData, deleteAccount } from "../services/privacy.service.js";

export const getUserProfileController = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(
    new ApiResponse(
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified !== false,
        createdAt: user.createdAt,
      },
      "Profile fetched"
    )
  );
});

export const updateUserProfileController = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, "Name cannot be empty");
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  user.name = name.trim();
  await user.save();

  res.status(200).json(
    new ApiResponse(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      "Profile updated successfully"
    )
  );
});

export const changePasswordController = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current and new passwords are required");
  }

  if (typeof newPassword !== "string" || newPassword.length < 10) {
    throw new ApiError(400, "New password must be at least 10 characters long");
  }

  const user = await User.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const match = await user.comparePassword(currentPassword);
  if (!match) {
    throw new ApiError(401, "Current password does not match");
  }

  user.password = newPassword;
  await user.save();

  // Other devices are signed out; this one signs in again with the new password
  await revokeSessions(user._id);

  res.status(200).json(new ApiResponse(null, "Password changed successfully"));
});

// A copy of everything held about the account, as a downloadable JSON file
export const exportAccountController = asyncHandler(async (req, res) => {
  const data = await exportAccountData(req.user.id);

  res.setHeader("Content-Disposition", 'attachment; filename="account-export.json"');
  res.status(200).json(new ApiResponse(data, "Account data exported"));
});

export const deleteAccountController = asyncHandler(async (req, res) => {
  const result = await deleteAccount(req.user.id, {
    password: req.body?.password,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.clearCookie("refreshToken", { path: "/" });
  res.status(200).json(new ApiResponse(result, "Account deleted"));
});
