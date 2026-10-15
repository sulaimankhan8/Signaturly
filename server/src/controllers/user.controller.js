import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import { revokeSessions } from "../services/auth.service.js";
import { exportAccountData, deleteAccount } from "../services/privacy.service.js";
import { getImageBuffer } from "../services/pdfSign.service.js";
import { readFile, saveFile, deleteFile } from "../services/storage.service.js";

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

// ----- the signature and initials saved with the account -----

const SIGNATURE_KINDS = { signature: "signatureKey", initials: "initialsKey" };

const kindOf = (value) => {
  if (!Object.prototype.hasOwnProperty.call(SIGNATURE_KINDS, value)) {
    throw new ApiError(400, 'kind must be "signature" or "initials"');
  }
  return value;
};

const asDataUrl = async (key) => {
  if (!key) return null;
  try {
    const buffer = await readFile(key);
    const type = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "image/jpeg" : "image/png";
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    // A file that has gone missing reads as no saved signature
    return null;
  }
};

export const getSavedSignatureController = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("savedSignature");
  if (!user) throw new ApiError(404, "User not found");

  res.status(200).json(
    new ApiResponse(
      {
        signature: await asDataUrl(user.savedSignature?.signatureKey),
        initials: await asDataUrl(user.savedSignature?.initialsKey),
        updatedAt: user.savedSignature?.updatedAt || null,
      },
      "Saved signature fetched"
    )
  );
});

export const saveSignatureController = asyncHandler(async (req, res) => {
  const kind = kindOf(req.body?.kind);
  // Same checks as an image placed on a document: PNG or JPEG, 2 MB at most
  const buffer = await getImageBuffer(req.body?.dataUrl, null);
  if (!buffer) throw new ApiError(400, "dataUrl must be a PNG or JPEG image");

  const isJpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const key = `${req.user.id}/signatures/${kind}.${isJpeg ? "jpg" : "png"}`;
  await saveFile(key, buffer, isJpeg ? "image/jpeg" : "image/png");

  await User.updateOne(
    { _id: req.user.id },
    { $set: { [`savedSignature.${SIGNATURE_KINDS[kind]}`]: key, "savedSignature.updatedAt": new Date() } }
  );

  res.status(200).json(new ApiResponse({ kind }, "Signature saved to your account"));
});

export const deleteSavedSignatureController = asyncHandler(async (req, res) => {
  const kind = kindOf(req.query?.kind);
  const user = await User.findById(req.user.id).select("savedSignature");
  const key = user?.savedSignature?.[SIGNATURE_KINDS[kind]];

  if (key) {
    try {
      await deleteFile(key);
    } catch {
      // Already gone
    }
  }
  await User.updateOne({ _id: req.user.id }, { $set: { [`savedSignature.${SIGNATURE_KINDS[kind]}`]: null } });

  res.status(200).json(new ApiResponse({ kind }, "Saved signature removed"));
});
