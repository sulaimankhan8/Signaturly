import mongoose from "mongoose";
import crypto from "crypto";

// What a key may be allowed to do. A key gets only the scopes it was created with.
export const API_SCOPES = ["documents:read", "documents:write", "templates:read", "webhooks:manage"];

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The workspace whose documents the key works on. Null means the creator's personal workspace.
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
    // live keys act on real documents; test keys make watermarked documents that are never billed
    mode: {
      type: String,
      enum: ["live", "test"],
      default: "live",
    },
    keyPrefix: {
      type: String,
      required: true,
    },
    // Only a hash of the key is stored. The key itself is shown once, when it is created.
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Older keys were saved with dots (documents.read); both spellings are understood when checked
    permissions: {
      type: [String],
      default: ["documents:read", "documents:write"],
    },
    rateLimitPerMinute: {
      type: Number,
      default: 120,
      min: 1,
    },
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

export const hashApiKey = (fullKey) => crypto.createHash("sha256").update(String(fullKey)).digest("hex");

/**
 * Makes a new key. The prefix says which kind it is, so a test key is never mistaken for a live one.
 */
apiKeySchema.statics.generateKey = function (mode = "live") {
  const secret = crypto.randomBytes(24).toString("hex");
  const prefix = `pd_${mode === "test" ? "test" : "live"}_${secret.substring(0, 6)}`;
  const fullKey = `${prefix}_${secret}`;

  return {
    fullKey,
    keyPrefix: prefix,
    keyHash: hashApiKey(fullKey),
  };
};

export const ApiKey = mongoose.model("ApiKey", apiKeySchema);
