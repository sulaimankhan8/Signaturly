import crypto from "crypto";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiKey, API_SCOPES } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { roleCan } from "../services/authorize.service.js";
import { assertSafeWebhookUrl, listDeliveries, replayDelivery } from "../services/webhookDelivery.service.js";

/**
 * The developer settings inside the app: API keys and webhooks for the workspace the person
 * is working in (plan tasks P6-09 and P6-11). In a team workspace these need an admin.
 */

const MAX_KEYS = 20;
const MAX_WEBHOOKS = 10;
export const WEBHOOK_EVENTS = ["envelope.sent", "recipient.viewed", "recipient.signed", "envelope.completed", "envelope.declined", "envelope.voided"];

const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);

const assertMayManage = (req) => {
  if (!roleCan(req.workspace.role, "developer.manage")) {
    throw new ApiError(403, "Only an admin of this workspace can manage API keys and webhooks");
  }
};

// Keys and webhooks made before workspaces existed have no workspace; they belong to their
// creator's personal workspace
export const inWorkspace = (req) => {
  const workspaceId = new mongoose.Types.ObjectId(req.workspace.id);
  return req.workspace.personal ? { userId: req.user.id, $or: [{ workspaceId }, { workspaceId: null }] } : { workspaceId };
};

const publicKey = (key) => ({
  id: key._id,
  _id: key._id,
  name: key.name,
  mode: key.mode || "live",
  keyPrefix: key.keyPrefix,
  permissions: key.permissions,
  rateLimitPerMinute: key.rateLimitPerMinute,
  lastUsedAt: key.lastUsedAt,
  createdAt: key.createdAt,
});

const publicWebhook = (webhook) => ({
  id: webhook._id,
  _id: webhook._id,
  url: webhook.url,
  events: webhook.events,
  status: webhook.status,
  createdAt: webhook.createdAt,
});

export const getMyApiKeysController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  const keys = await ApiKey.find({ ...inWorkspace(req), status: "active" }).sort({ createdAt: -1 }).lean();
  res.status(200).json(new ApiResponse(keys.map(publicKey), "Developer API keys retrieved"));
});

export const createApiKeyController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  // A key works in such a team only for someone with two-step sign-in of their own
  // (middlewares/apiKey.middleware.js); signing in through single sign-on is not enough for a key
  if (req.workspace.requireTwoFactor && !req.user.twoFactorEnabled) {
    throw new ApiError(400, "This workspace requires two-step sign-in. Switch it on for your own account before making a key.");
  }
  const { name, permissions, mode } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    throw new ApiError(400, "API key name is required (e.g. 'Production Zapier')");
  }

  // Older screens send scopes with dots
  const asked = Array.isArray(permissions) ? permissions.map((scope) => String(scope).replace(".", ":")) : ["documents:read", "documents:write"];
  const unknown = asked.filter((scope) => !API_SCOPES.includes(scope));
  if (unknown.length > 0) throw new ApiError(400, `Unknown scope: ${unknown.join(", ")}. Choose from ${API_SCOPES.join(", ")}.`);
  if (asked.length === 0) throw new ApiError(400, "Choose at least one scope");

  if ((await ApiKey.countDocuments({ ...inWorkspace(req), status: "active" })) >= MAX_KEYS) {
    throw new ApiError(400, `A workspace can have at most ${MAX_KEYS} active keys. Revoke one you no longer use.`);
  }

  const keyMode = mode === "test" ? "test" : "live";
  const { fullKey, keyPrefix, keyHash } = ApiKey.generateKey(keyMode);

  const apiKeyDoc = await ApiKey.create({
    userId: req.user.id,
    workspaceId: req.workspace.id,
    name: name.trim().slice(0, 80),
    mode: keyMode,
    keyPrefix,
    keyHash,
    permissions: [...new Set(asked)],
  });

  res.status(201).json(
    new ApiResponse(
      {
        ...publicKey(apiKeyDoc),
        // The key itself is returned once, here, and never again
        secretKey: fullKey,
        apiKey: fullKey,
      },
      "API key generated. Please copy and store your secret key securely — it will not be displayed again."
    )
  );
});

export const revokeApiKeyController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  const { id } = req.params;
  const apiKey = isId(id) ? await ApiKey.findOneAndUpdate({ _id: id, ...inWorkspace(req) }, { status: "revoked" }, { new: true }) : null;
  if (!apiKey) throw new ApiError(404, "API key not found");

  res.status(200).json(new ApiResponse({ id }, "API key revoked successfully"));
});

export const getMyWebhooksController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  const webhooks = await Webhook.find(inWorkspace(req)).sort({ createdAt: -1 }).lean();
  res.status(200).json(new ApiResponse(webhooks.map(publicWebhook), "Registered developer webhooks"));
});

/**
 * Saves a webhook for a workspace. Shared with the public API, which is why it takes plain values.
 * The signing secret is part of what it returns and is shown only then.
 */
export const createWebhook = async ({ userId, workspaceId, scope, url, events }) => {
  const address = (await assertSafeWebhookUrl(url)).toString();

  const chosen = Array.isArray(events) && events.length > 0 ? [...new Set(events.map(String))] : ["envelope.completed", "recipient.signed"];
  const unknown = chosen.filter((event) => !WEBHOOK_EVENTS.includes(event));
  if (unknown.length > 0) throw new ApiError(400, `Unknown event: ${unknown.join(", ")}. Choose from ${WEBHOOK_EVENTS.join(", ")}.`);

  if ((await Webhook.countDocuments(scope)) >= MAX_WEBHOOKS) {
    throw new ApiError(400, `A workspace can have at most ${MAX_WEBHOOKS} webhooks`);
  }

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  const webhook = await Webhook.create({ userId, workspaceId, url: address, secret, events: chosen });
  return { ...publicWebhook(webhook), secret };
};

export const createWebhookController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  const webhook = await createWebhook({
    userId: req.user.id,
    workspaceId: req.workspace.id,
    scope: inWorkspace(req),
    url: req.body?.url,
    events: req.body?.events,
  });
  res.status(201).json(new ApiResponse(webhook, "Webhook registered. Copy its signing secret now — it will not be shown again."));
});

export const deleteWebhookController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  const { id } = req.params;
  const webhook = isId(id) ? await Webhook.findOneAndDelete({ _id: id, ...inWorkspace(req) }) : null;
  if (!webhook) throw new ApiError(404, "Webhook not found");

  res.status(200).json(new ApiResponse({ id }, "Webhook deleted successfully"));
});

export const listWebhookDeliveriesController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  res.status(200).json(new ApiResponse(await listDeliveries(req.params.id, inWorkspace(req)), "Recent deliveries"));
});

export const replayWebhookDeliveryController = asyncHandler(async (req, res) => {
  assertMayManage(req);
  res.status(200).json(new ApiResponse(await replayDelivery(req.params.deliveryId, inWorkspace(req)), "Queued to be sent again"));
});
