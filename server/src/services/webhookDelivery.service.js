import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import mongoose from "mongoose";
import { Webhook } from "../models/Webhook.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { enqueueJob, registerJobHandler } from "../jobs/queue.js";
// Imported from their own files, not events/index.js, which itself imports this service
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";

/**
 * Sends events to customers' own servers (plan task P6-11).
 *
 * Each event is written to a delivery log first and then sent by a job, which retries with
 * back-off. The body is signed with the webhook's secret so the receiver can check it came
 * from here. Addresses inside private networks are refused, when the webhook is saved and
 * again when it is sent, so a webhook cannot be used to reach this service's own network.
 */

const deliverySchema = new mongoose.Schema(
  {
    webhookId: { type: mongoose.Schema.Types.ObjectId, ref: "Webhook", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: String, required: true },
    // Unique per webhook and event occurrence, so one event is delivered once
    eventId: { type: String, required: true },
    payload: { type: Object, required: true },
    status: { type: String, enum: ["pending", "delivered", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    responseStatus: { type: Number, default: null },
    lastError: { type: String, default: "" },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);
deliverySchema.index({ webhookId: 1, eventId: 1 }, { unique: true });
// The log is kept for 30 days
deliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WebhookDelivery = mongoose.models.WebhookDelivery || mongoose.model("WebhookDelivery", deliverySchema);

// Domain events, and the names customers subscribe to
const EVENT_NAMES = {
  [EventTypes.DOCUMENT_SENT]: "envelope.sent",
  [EventTypes.RECIPIENT_VIEWED]: "recipient.viewed",
  [EventTypes.DOCUMENT_SIGNED]: "recipient.signed",
  [EventTypes.DOCUMENT_COMPLETED]: "envelope.completed",
  [EventTypes.DOCUMENT_DECLINED]: "envelope.declined",
  [EventTypes.DOCUMENT_VOIDED]: "envelope.voided",
};

const privateV4 = (address) => {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

/**
 * Whether an address is one this service must not call: anything inside a private network,
 * on this machine, or not routed on the public internet.
 */
export const isPrivateAddress = (address) => {
  if (net.isIPv4(address)) return privateV4(address);
  if (!net.isIPv6(address)) return true;

  const lower = address.toLowerCase();
  // An IPv4 address written as IPv6, in either spelling: ::ffff:127.0.0.1 or ::ffff:7f00:1
  const mapped = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(lower);
  if (mapped) {
    if (mapped[1]) return privateV4(mapped[1]);
    const high = parseInt(mapped[2], 16);
    const low = parseInt(mapped[3], 16);
    return privateV4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }

  // Of IPv6, only global unicast addresses (2000::/3) are public. That leaves out loopback,
  // link-local, unique-local and multicast. 2002::/16 wraps an IPv4 address and is left out too.
  const first = parseInt(lower.split(":")[0] || "0", 16);
  return !(first >= 0x2000 && first <= 0x3fff) || first === 0x2002;
};

/**
 * Checks that a webhook address is one this service may call: https, a public host, no
 * credentials in it. Resolves the name, because a public-looking name can point inward.
 * Returns the parsed address.
 */
export const assertSafeWebhookUrl = async (value) => {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new ApiError(400, "Enter a full web address, such as https://example.com/webhooks/pactdoc");
  }
  if (url.protocol !== "https:") throw new ApiError(400, "Webhook addresses must use https");
  if (url.username || url.password) throw new ApiError(400, "Webhook addresses cannot contain a user name or password");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ApiError(400, "Webhook addresses must be reachable from the internet");
  }

  let addresses;
  try {
    addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((entry) => entry.address);
  } catch {
    throw new ApiError(400, "That address could not be found");
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new ApiError(400, "Webhook addresses must be reachable from the internet");
  }
  return url;
};

export const signPayload = (secret, timestamp, body) => crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const send = async (webhook, delivery) => {
  await assertSafeWebhookUrl(webhook.url);

  const body = JSON.stringify({ id: delivery.eventId, type: delivery.event, created: Math.floor(new Date(delivery.createdAt).getTime() / 1000), data: delivery.payload });
  const timestamp = Math.floor(Date.now() / 1000);

  const response = await fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `${env.appName}-Webhooks/1.0`,
      "X-PactDoc-Event": delivery.event,
      "X-PactDoc-Delivery": delivery._id.toString(),
      // t is when this attempt was signed; v1 is the HMAC-SHA256 of "<t>.<body>" with the webhook's secret
      "X-PactDoc-Signature": `t=${timestamp},v1=${signPayload(webhook.secret, timestamp, body)}`,
    },
    body,
    // A redirect could lead somewhere the address check never saw
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(`The receiver answered ${response.status}`);
    error.responseStatus = response.status;
    throw error;
  }
  return response.status;
};

/**
 * Queues an event for every webhook of the document's owner that asked for it.
 */
export const queueWebhooksFor = async ({ event, eventId, pdfId, data }) => {
  const pdf = await Pdf.findById(pdfId).select("userId workspaceId originalFileName status testMode").lean();
  if (!pdf) return 0;

  const webhooks = await Webhook.find({
    status: "active",
    events: event,
    $or: [{ userId: pdf.userId, workspaceId: null }, ...(pdf.workspaceId ? [{ workspaceId: pdf.workspaceId }] : [])],
  }).lean();

  let queued = 0;
  for (const webhook of webhooks) {
    let delivery;
    try {
      delivery = await WebhookDelivery.create({
        webhookId: webhook._id,
        userId: webhook.userId,
        event,
        eventId,
        payload: { document: { id: String(pdf._id), title: pdf.originalFileName, status: pdf.status, test: Boolean(pdf.testMode) }, ...data },
      });
    } catch (err) {
      if (err?.code === 11000) continue; // this event is already queued for this webhook
      throw err;
    }
    await enqueueJob("webhook.deliver", { deliveryId: delivery._id.toString() }, { idempotencyKey: `webhook:${delivery._id}:0`, maxAttempts: 5 });
    queued += 1;
  }
  return queued;
};

const idOf = (doc) => (doc?._id || doc)?.toString();

export const registerWebhookDelivery = () => {
  for (const [type, name] of Object.entries(EVENT_NAMES)) {
    eventBus.subscribe(type, `WebhookConsumer:${name}`, async (event) => {
      const { pdf, recipient, recipients } = event.payload || {};
      const pdfId = idOf(pdf) || idOf(event.aggregateId);
      if (!pdfId) return;

      const who = recipient || (name === "recipient.signed" ? event.actor : null);
      await queueWebhooksFor({
        event: name,
        eventId: `${event.eventId || `${type}:${pdfId}:${Date.now()}`}`,
        pdfId,
        data: {
          ...(who ? { recipient: { name: who.name || "", email: who.email || "" } } : {}),
          ...(Array.isArray(recipients) ? { recipients: recipients.map((r) => ({ name: r.name, email: r.email || "", status: r.status })) } : {}),
        },
      });
    });
  }

  registerJobHandler(
    "webhook.deliver",
    async ({ deliveryId }) => {
      const delivery = await WebhookDelivery.findById(deliveryId);
      if (!delivery || delivery.status === "delivered") return;
      const webhook = await Webhook.findById(delivery.webhookId);
      if (!webhook || webhook.status !== "active") {
        await WebhookDelivery.updateOne({ _id: delivery._id }, { $set: { status: "failed", lastError: "The webhook was removed or switched off" } });
        return;
      }

      try {
        const status = await send(webhook, delivery);
        await WebhookDelivery.updateOne({ _id: delivery._id }, { $set: { status: "delivered", responseStatus: status, deliveredAt: new Date(), lastError: "" }, $inc: { attempts: 1 } });
      } catch (err) {
        await WebhookDelivery.updateOne(
          { _id: delivery._id },
          { $set: { responseStatus: err.responseStatus || null, lastError: String(err.message || err).slice(0, 300) }, $inc: { attempts: 1 } }
        );
        throw err; // the queue retries with back-off
      }
    },
    {
      onFailed: async ({ deliveryId }, message) => {
        await WebhookDelivery.updateOne({ _id: deliveryId, status: "pending" }, { $set: { status: "failed", lastError: String(message || "").slice(0, 300) } });
      },
    }
  );
};

/**
 * The recent deliveries of a webhook, newest first. `scope` is the filter that limits the
 * caller to the webhooks of their own workspace.
 */
export const listDeliveries = async (webhookId, scope) => {
  const webhook = mongoose.isValidObjectId(String(webhookId)) ? await Webhook.findOne({ _id: String(webhookId), ...scope }).lean() : null;
  if (!webhook) throw new ApiError(404, "Webhook not found");
  const deliveries = await WebhookDelivery.find({ webhookId: webhook._id }).sort({ createdAt: -1 }).limit(50).lean();
  return deliveries.map((d) => ({ id: d._id, event: d.event, status: d.status, attempts: d.attempts, responseStatus: d.responseStatus, lastError: d.lastError, createdAt: d.createdAt, deliveredAt: d.deliveredAt }));
};

/**
 * Sends a logged delivery again, with the same event id, so the receiver can recognise a repeat.
 */
export const replayDelivery = async (deliveryId, scope) => {
  const delivery = mongoose.isValidObjectId(String(deliveryId)) ? await WebhookDelivery.findById(String(deliveryId)) : null;
  // The delivery must belong to a webhook of the caller's own workspace
  if (!delivery || !(await Webhook.exists({ _id: delivery.webhookId, ...scope }))) throw new ApiError(404, "Delivery not found");
  await WebhookDelivery.updateOne({ _id: delivery._id }, { $set: { status: "pending", lastError: "" } });
  await enqueueJob("webhook.deliver", { deliveryId: delivery._id.toString() }, { idempotencyKey: `webhook:${delivery._id}:replay:${Date.now()}`, maxAttempts: 5 });
  return { id: delivery._id, status: "pending" };
};
