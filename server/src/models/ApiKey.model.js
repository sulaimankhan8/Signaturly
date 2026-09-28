import mongoose from "mongoose";
import crypto from "crypto";

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    keyPrefix: {
      type: String,
      required: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "documents.read",
          "documents.write",
          "templates.read",
          "templates.write",
          "documents:read",
          "documents:write",
          "templates:read",
          "templates:write",
        ],
        default: ["documents.read", "documents.write"],
      },
    ],
    lastUsedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
  },
  { timestamps: true }
);

/**
 * Static method to generate a secure API key pair
 */
apiKeySchema.statics.generateKey = function () {
  const secret = crypto.randomBytes(24).toString("hex");
  const prefix = `sig_live_${secret.substring(0, 6)}`;
  const fullKey = `${prefix}_${secret}`;
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

  return {
    fullKey,
    keyPrefix: prefix,
    keyHash,
  };
};

export const ApiKey = mongoose.model("ApiKey", apiKeySchema);
