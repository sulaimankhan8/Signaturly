import { ApiKey, hashApiKey } from "../models/ApiKey.model.js";
import { User } from "../models/User.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { RateLimit } from "../models/RateLimit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { roleOf } from "../services/authorize.service.js";
import { ensurePersonalWorkspace } from "../services/workspace.service.js";
import { getOrCreateSubscription } from "../services/subscription.service.js";
import { can } from "../services/entitlements.service.js";

/**
 * Authentication for the public API (plan task P6-09).
 *
 * A request carries its key as `Authorization: Bearer pd_live_...` or `pd_test_...`.
 * The key decides whose documents the request works on, in which workspace, with which scopes,
 * and whether it is in test mode. Every refusal looks the same from outside for a key that is
 * unknown or revoked, so keys cannot be probed.
 */

const KEY_SHAPE = /^pd_(live|test)_[a-f0-9]{6}_[a-f0-9]{48}$/;

// Keys made before scopes used colons were saved with dots
const normalizeScope = (scope) => String(scope).replace(".", ":");

/**
 * Counts this request against the key's allowance for the current minute.
 * The count is kept in the database, so it holds across every instance of the API.
 */
const withinRateLimit = async (apiKey) => {
  const minute = Math.floor(Date.now() / 60000);
  const key = `apikey:${apiKey._id}:${minute}`;
  let counter;
  try {
    counter = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Two first requests of a minute at once: count again against the row that now exists
    if (err?.code !== 11000) throw err;
    counter = await RateLimit.findOneAndUpdate({ key }, { $inc: { hits: 1 } }, { new: true });
  }
  return { allowed: counter.hits <= apiKey.rateLimitPerMinute, remaining: Math.max(0, apiKey.rateLimitPerMinute - counter.hits) };
};

export const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const refuse = () => new ApiError(401, "Invalid API key");

  if (!KEY_SHAPE.test(presented)) throw refuse();

  const apiKey = await ApiKey.findOne({ keyHash: hashApiKey(presented) });
  if (!apiKey || apiKey.status !== "active") throw refuse();

  const user = await User.findById(apiKey.userId);
  if (!user || user.deletedAt || user.suspendedAt) throw refuse();

  // The key works in its workspace only while the person who made it still belongs there
  let workspace = apiKey.workspaceId ? await Workspace.findById(apiKey.workspaceId) : null;
  if (workspace && (!roleOf(workspace, user._id) || workspace.status === "archived")) throw refuse();
  if (!workspace) workspace = await ensurePersonalWorkspace(user._id, user.name);
  // A team that requires two-step sign-in takes keys only from people who have it, so a key cannot
  // be a way round the rule. Single sign-on does not count here: a key is not a sign-in.
  if (workspace.policy?.requireTwoFactor && !user.twoFactor?.enabled) {
    throw new ApiError(403, "TWO_FACTOR_REQUIRED: This workspace requires two-step sign-in, and the person who made this key has not switched it on.");
  }

  // The plan that pays for the workspace must still include the API
  const subscription = await getOrCreateSubscription(workspace.ownerId);
  if (!can(subscription, "api")) {
    throw new ApiError(403, "UPGRADE_REQUIRED: The API is not included in this account's plan.");
  }

  const limit = await withinRateLimit(apiKey);
  res.setHeader("X-RateLimit-Limit", String(apiKey.rateLimitPerMinute));
  res.setHeader("X-RateLimit-Remaining", String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader("Retry-After", "60");
    throw new ApiError(429, "Too many requests for this API key. Try again in a minute.");
  }

  req.apiKey = { id: apiKey._id.toString(), mode: apiKey.mode, scopes: (apiKey.permissions || []).map(normalizeScope) };
  req.testMode = apiKey.mode === "test";
  req.user = {
    _id: user._id.toString(),
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified !== false,
    twoFactorEnabled: Boolean(user.twoFactor?.enabled),
    ssoWorkspaceId: null,
  };
  req.workspace = {
    id: workspace._id.toString(),
    name: workspace.name,
    role: roleOf(workspace, user._id),
    personal: Boolean(workspace.personal),
    ownerId: workspace.ownerId.toString(),
    status: workspace.status,
    requireTwoFactor: Boolean(workspace.policy?.requireTwoFactor),
  };
  req.billingUserId = req.workspace.ownerId;

  // Not awaited: a slow write here must not slow the request
  ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  next();
});

/**
 * Lets the request through only if its key was created with this scope.
 */
export const requireScope = (scope) => (req, res, next) => {
  if (!req.apiKey?.scopes.includes(scope)) {
    throw new ApiError(403, `This API key does not have the "${scope}" scope`);
  }
  next();
};
