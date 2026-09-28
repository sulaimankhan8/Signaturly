import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import crypto from "crypto";

export const getMyApiKeysController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const keys = await ApiKey.find({ userId, status: "active" }).select("-keyHash");

  res.status(200).json(
    new ApiResponse(keys, "Developer API keys retrieved")
  );
});

export const createApiKeyController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, permissions } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "API key name is required (e.g. 'Production Zapier')");
  }

  const { fullKey, keyPrefix, keyHash } = ApiKey.generateKey();

  const apiKeyDoc = await ApiKey.create({
    userId,
    name: name.trim(),
    keyPrefix,
    keyHash,
    permissions: permissions || ["documents.read", "documents.write"],
  });

  res.status(201).json(
    new ApiResponse(
      {
        id: apiKeyDoc._id,
        name: apiKeyDoc.name,
        keyPrefix: apiKeyDoc.keyPrefix,
        secretKey: fullKey,
        apiKey: fullKey, // Only returned ONCE upon creation
        createdAt: apiKeyDoc.createdAt,
      },
      "API key generated. Please copy and store your secret key securely — it will not be displayed again."
    )
  );
});

export const revokeApiKeyController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const apiKey = await ApiKey.findOneAndUpdate(
    { _id: id, userId },
    { status: "revoked" },
    { new: true }
  );

  if (!apiKey) throw new ApiError(404, "API key not found");

  res.status(200).json(
    new ApiResponse({ id }, "API key revoked successfully")
  );
});

export const getMyWebhooksController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const webhooks = await Webhook.find({ userId });

  res.status(200).json(
    new ApiResponse(webhooks, "Registered developer webhooks")
  );
});

export const createWebhookController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { url, events } = req.body;

  if (!url?.startsWith("http")) {
    throw new ApiError(400, "A valid HTTPS webhook URL is required");
  }

  const secret = `whsec_${crypto.randomBytes(18).toString("hex")}`;

  const webhook = await Webhook.create({
    userId,
    url: url.trim(),
    secret,
    events: events || ["envelope.completed", "recipient.signed"],
  });

  res.status(201).json(
    new ApiResponse(webhook, "Webhook registered successfully")
  );
});

export const deleteWebhookController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const webhook = await Webhook.findOneAndDelete({ _id: id, userId });
  if (!webhook) throw new ApiError(404, "Webhook not found");

  res.status(200).json(
    new ApiResponse({ id }, "Webhook deleted successfully")
  );
});
