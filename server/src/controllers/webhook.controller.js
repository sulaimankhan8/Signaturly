import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { handleStripeEvent, handleRazorpayEvent } from "../services/billingEvents.service.js";
import { WebhookEvent } from "../models/WebhookEvent.model.js";
import { PLAN_CONFIG } from "../services/billing.service.js";
import { env } from "../config/env.js";

const STRIPE_TOLERANCE_SECONDS = 5 * 60;

const hmacHex = (secret, payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

const hexEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
};

// Stripe signs "<timestamp>.<raw body>" and sends "t=<timestamp>,v1=<signature>"
export const verifyStripeSignature = (rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) => {
  if (!Buffer.isBuffer(rawBody) || typeof header !== "string" || !secret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const idx = part.indexOf("=");
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
    })
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs(nowSeconds - timestamp) > STRIPE_TOLERANCE_SECONDS) return false;

  return hexEqual(hmacHex(secret, `${timestamp}.${rawBody.toString("utf8")}`), parts.v1);
};

// Razorpay signs the raw body with the webhook secret
export const verifyRazorpaySignature = (rawBody, header, secret) => {
  if (!Buffer.isBuffer(rawBody) || typeof header !== "string" || !secret) return false;
  return hexEqual(hmacHex(secret, rawBody), header);
};

// Returns false when this event was already handled
const claimEvent = async (provider, eventId, type) => {
  if (!eventId) return false;
  try {
    await WebhookEvent.create({ provider, eventId: String(eventId), type });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
};

const releaseEvent = (provider, eventId) =>
  WebhookEvent.deleteOne({ provider, eventId: String(eventId) });

const knownPlan = (plan) => (Object.prototype.hasOwnProperty.call(PLAN_CONFIG, plan) ? plan : null);

export const handleStripeWebhookController = asyncHandler(async (req, res) => {
  // No secret configured means no way to trust the caller: refuse rather than accept
  if (!env.stripeWebhookSecret) {
    return res.status(503).json({ error: "Stripe webhooks are not configured" });
  }

  if (!verifyStripeSignature(req.body, req.headers["stripe-signature"], env.stripeWebhookSecret)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  if (!(await claimEvent("stripe", event.id, event.type))) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    await handleStripeEvent(event, knownPlan);
  } catch (err) {
    // Not handled after all: forget the claim so the provider's retry is processed
    await releaseEvent("stripe", event.id);
    throw err;
  }

  res.status(200).json({ received: true });
});

export const handleRazorpayWebhookController = asyncHandler(async (req, res) => {
  if (!env.razorpayWebhookSecret) {
    return res.status(503).json({ error: "Razorpay webhooks are not configured" });
  }

  if (!verifyRazorpaySignature(req.body, req.headers["x-razorpay-signature"], env.razorpayWebhookSecret)) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let body;
  try {
    body = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const { event, payload } = body;
  const entityId = payload?.payment?.entity?.id || payload?.subscription?.entity?.id;
  const eventId = req.headers["x-razorpay-event-id"] || (entityId ? `${event}:${entityId}:${body.created_at || ""}` : null);

  if (!(await claimEvent("razorpay", eventId, event))) {
    return res.status(200).json({ status: "ok", duplicate: true });
  }

  try {
    await handleRazorpayEvent(body, knownPlan);
  } catch (err) {
    await releaseEvent("razorpay", eventId);
    throw err;
  }

  res.status(200).json({ status: "ok" });
});
