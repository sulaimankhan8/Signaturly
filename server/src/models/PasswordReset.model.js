import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup after expiry
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
