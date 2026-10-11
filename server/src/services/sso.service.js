import crypto from "crypto";
import dns from "dns/promises";
import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { seal, open } from "../utils/secretBox.js";
import { safeEqual } from "../utils/tokens.js";
import { assertWorkspaceAccess, roleOf } from "./authorize.service.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { tierOf } from "./entitlements.service.js";
import { seatsUsed, seatsAllowed } from "./workspace.service.js";
import { assertSafeWebhookUrl } from "./webhookDelivery.service.js";

/**
 * Single sign-on for an Enterprise workspace, through the organisation's own identity provider
 * using OpenID Connect (plan task P6-15).
 *
 * An identity provider is believed only about addresses at domains the organisation has proved
 * it controls, by publishing a value in the domain's DNS. Without that, whoever set up a
 * workspace could sign in as anyone by naming their domain.
 */

const STATE_TTL_MS = 10 * 60 * 1000;
const isId = (value) => mongoose.isValidObjectId(String(value || ""));
const domainOf = (email) => String(email || "").toLowerCase().split("@")[1] || "";
const DOMAIN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const stateKey = () => crypto.createHmac("sha256", String(env.accessSecret)).update("sso-state").digest();
const signState = (body) => crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");

export const callbackUrl = () => `${env.apiUrl}/api/auth/sso/callback`;

// The provider's own description of itself. Its addresses are checked like any address this
// service is asked to call, so a workspace cannot point sign-in at this service's own network.
const discover = async (issuer) => {
  const base = (await assertSafeWebhookUrl(issuer)).toString().replace(/\/$/, "");
  const response = await fetch(`${base}/.well-known/openid-configuration`, { redirect: "manual", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!response || !response.ok) throw new ApiError(502, "The identity provider's configuration could not be read. Check the issuer address.");
  const config = await response.json().catch(() => null);
  for (const name of ["authorization_endpoint", "token_endpoint", "userinfo_endpoint"]) {
    if (typeof config?.[name] !== "string") throw new ApiError(502, `The identity provider's configuration has no ${name}`);
    await assertSafeWebhookUrl(config[name]);
  }
  return config;
};

const loadForOwner = async (workspaceId, userId) => {
  const workspace = isId(workspaceId) ? await Workspace.findById(String(workspaceId)).select("+sso.clientSecret") : null;
  if (!workspace || workspace.personal || workspace.status === "archived") throw new ApiError(404, "Workspace not found");
  // Only the owner sets how people sign in
  assertWorkspaceAccess(workspace, userId, "billing.manage");
  if (tierOf(await getOrCreateSubscription(workspace.ownerId)) !== "enterprise") {
    throw new ApiError(403, "UPGRADE_REQUIRED: Single sign-on is part of the Enterprise plan.");
  }
  return workspace;
};

const describe = (workspace) => ({
  enabled: Boolean(workspace.sso?.enabled),
  issuer: workspace.sso?.issuer || "",
  clientId: workspace.sso?.clientId || "",
  hasClientSecret: Boolean(workspace.sso?.clientSecret),
  emailDomains: workspace.sso?.emailDomains || [],
  verifiedDomains: workspace.sso?.verifiedDomains || [],
  // What to publish as a TXT record on each domain to prove it is the organisation's
  dnsRecord: workspace.sso?.domainToken ? `pactdoc-domain-verification=${workspace.sso.domainToken}` : null,
  callbackUrl: callbackUrl(),
});

export const getSsoSettings = async (workspaceId, userId) => describe(await loadForOwner(workspaceId, userId));

export const saveSsoSettings = async (workspaceId, userId, { issuer, clientId, clientSecret, emailDomains, enabled }) => {
  const workspace = await loadForOwner(workspaceId, userId);
  const set = {};

  if (issuer !== undefined) {
    await discover(issuer);
    set["sso.issuer"] = String(issuer).trim().replace(/\/$/, "");
  }
  if (clientId !== undefined) set["sso.clientId"] = String(clientId).trim().slice(0, 300);
  if (typeof clientSecret === "string" && clientSecret) set["sso.clientSecret"] = seal(clientSecret);

  if (emailDomains !== undefined) {
    const domains = [...new Set((Array.isArray(emailDomains) ? emailDomains : []).map((d) => String(d).trim().toLowerCase().replace(/^@/, "")))].slice(0, 20);
    const bad = domains.filter((d) => !DOMAIN.test(d));
    if (bad.length > 0) throw new ApiError(400, `Not a domain: ${bad.join(", ")}`);
    set["sso.emailDomains"] = domains;
    // A domain taken off the list is no longer trusted
    set["sso.verifiedDomains"] = (workspace.sso?.verifiedDomains || []).filter((d) => domains.includes(d));
  }
  if (!workspace.sso?.domainToken) set["sso.domainToken"] = crypto.randomBytes(20).toString("hex");

  if (enabled !== undefined) {
    const after = { ...workspace.sso?.toObject?.(), ...Object.fromEntries(Object.entries(set).map(([k, v]) => [k.replace("sso.", ""), v])) };
    if (enabled && (!after.issuer || !after.clientId || !after.clientSecret)) throw new ApiError(400, "Enter the issuer, client id and client secret before switching single sign-on on");
    if (enabled && (after.verifiedDomains || []).length === 0) throw new ApiError(400, "Verify at least one email domain before switching single sign-on on");
    set["sso.enabled"] = Boolean(enabled);
  }

  await Workspace.updateOne({ _id: workspace._id }, { $set: set });
  return describe(await Workspace.findById(workspace._id).select("+sso.clientSecret"));
};

/**
 * Looks for the workspace's value in each listed domain's DNS and records the ones that have it.
 */
export const verifySsoDomains = async (workspaceId, userId) => {
  const workspace = await loadForOwner(workspaceId, userId);
  const wanted = `pactdoc-domain-verification=${workspace.sso?.domainToken}`;
  const verified = [];
  for (const domain of workspace.sso?.emailDomains || []) {
    const records = await dns.resolveTxt(domain).catch(() => []);
    if (workspace.sso?.domainToken && records.some((parts) => parts.join("").trim() === wanted)) verified.push(domain);
  }
  const set = { "sso.verifiedDomains": verified };
  if (verified.length === 0) set["sso.enabled"] = false;
  await Workspace.updateOne({ _id: workspace._id }, { $set: set });
  return describe(await Workspace.findById(workspace._id).select("+sso.clientSecret"));
};

/**
 * Starts sign-in for an email address: finds the workspace whose verified domain it belongs to
 * and returns the identity provider's address to send the browser to, with the value to keep
 * in a cookie so the answer can be tied to this browser.
 */
export const startSso = async (email) => {
  const domain = domainOf(email);
  const workspace = domain ? await Workspace.findOne({ "sso.enabled": true, "sso.verifiedDomains": domain, status: { $ne: "archived" } }) : null;
  // The same answer whether or not the domain is known, so domains cannot be probed
  if (!workspace) throw new ApiError(404, "Single sign-on is not set up for that email address");

  const config = await discover(workspace.sso.issuer);
  const nonce = crypto.randomBytes(16).toString("hex");
  const body = Buffer.from(JSON.stringify({ w: workspace._id.toString(), n: nonce, e: Date.now() + STATE_TTL_MS })).toString("base64url");

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", workspace.sso.clientId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", `${body}.${signState(body)}`);
  url.searchParams.set("login_hint", String(email).trim().toLowerCase());
  return { redirectUrl: url.toString(), nonce };
};

/**
 * The identity provider sent the browser back. Exchanges the code, reads who signed in, and
 * returns the account to start a session for. A new person is given an account and a seat.
 */
export const finishSso = async ({ code, state, cookieNonce }) => {
  const refuse = () => new ApiError(400, "Single sign-on could not be completed. Please start again.");
  if (typeof code !== "string" || typeof state !== "string" || !state.includes(".")) throw refuse();

  const [body, signature] = state.split(".");
  if (!safeEqual(signature || "", signState(body))) throw refuse();
  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw refuse();
  }
  // The answer must come back to the browser that asked
  if (!(claims.e > Date.now()) || !cookieNonce || !safeEqual(String(cookieNonce), String(claims.n))) throw refuse();

  const workspace = isId(claims.w) ? await Workspace.findById(claims.w).select("+sso.clientSecret") : null;
  if (!workspace?.sso?.enabled || workspace.status === "archived") throw refuse();
  const clientSecret = open(workspace.sso.clientSecret);
  if (!clientSecret) throw new ApiError(500, "Single sign-on is misconfigured for this workspace. Its owner needs to enter the client secret again.");

  const config = await discover(workspace.sso.issuer);

  // The code is exchanged directly with the provider, over TLS, with the workspace's own secret
  const tokenResponse = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUrl(), client_id: workspace.sso.clientId, client_secret: clientSecret }),
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const tokens = tokenResponse?.ok ? await tokenResponse.json().catch(() => null) : null;
  if (!tokens?.access_token) throw refuse();

  const infoResponse = await fetch(config.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const info = infoResponse?.ok ? await infoResponse.json().catch(() => null) : null;

  const email = String(info?.email || "").trim().toLowerCase();
  if (!email || info.email_verified === false) throw new ApiError(403, "Your identity provider did not confirm your email address");
  if (!(workspace.sso.verifiedDomains || []).includes(domainOf(email))) {
    throw new ApiError(403, "That email address is not at a domain this workspace has verified");
  }

  let user = await User.findOne({ email });
  if (user?.deletedAt) throw refuse();
  if (!user) {
    user = await User.create({
      name: String(info.name || email.split("@")[0]).slice(0, 80),
      email,
      // Nobody knows this password; the account signs in through the identity provider
      password: crypto.randomBytes(32).toString("base64url"),
      emailVerified: true,
    });
  }

  if (!roleOf(workspace, user._id)) {
    if ((await seatsUsed(workspace)) >= (await seatsAllowed(workspace.ownerId))) {
      throw new ApiError(403, "This workspace has no free seat. Ask its owner to add one.");
    }
    await Workspace.updateOne(
      { _id: workspace._id, "members.userId": { $ne: user._id } },
      { $push: { members: { userId: user._id, role: "member", status: "active", joinedAt: new Date() } } }
    );
  }

  return { user, workspaceId: workspace._id.toString() };
};
