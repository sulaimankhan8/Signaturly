import crypto from "crypto";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * The one place that talks to Razorpay.
 *
 * Everything sold is created here with the secret key, which never leaves the server: orders
 * for single payments, plans and subscriptions for plans that renew by themselves. The same
 * file reads payments back and checks the signatures Razorpay gives the browser.
 */

const API = "https://api.razorpay.com/v1";

export const razorpayConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret);

/**
 * Razorpay refused a request or could not be reached. The customer is told only that the
 * payment provider could not be reached; `providerMessage` is Razorpay's own account of what
 * was wrong (for example that subscriptions are not switched on for the account), which is
 * for the operator and the log.
 */
export class RazorpayError extends ApiError {
  constructor(providerStatus, providerMessage) {
    super(502, "The payment provider could not be reached. Please try again.");
    this.providerStatus = providerStatus;
    this.providerMessage = providerMessage;
  }
}

const call = async (method, path, body) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  if (!response) throw new RazorpayError(null, "Razorpay did not answer");
  if (!response.ok) {
    const said = await response
      .json()
      .then((answer) => answer?.error?.description)
      .catch(() => "");
    console.error(`[Razorpay] ${method} ${path} failed (${response.status})${said ? `: ${said}` : ""}`);
    throw new RazorpayError(response.status, said || `Razorpay answered ${response.status}`);
  }
  return response.json();
};

const id = (value) => encodeURIComponent(String(value));

// A single payment
export const createOrder = (order) => call("POST", "/orders", order);
export const readOrder = (orderId) => call("GET", `/orders/${id(orderId)}`);
export const readPayment = (paymentId) => call("GET", `/payments/${id(paymentId)}`);

// A plan that renews by itself: Razorpay's plan fixes the amount and period, a subscription is one customer's approval of it
export const createPlan = (plan) => call("POST", "/plans", plan);
export const createSubscription = (subscription) => call("POST", "/subscriptions", subscription);
export const readSubscription = (subscriptionId) => call("GET", `/subscriptions/${id(subscriptionId)}`);
export const cancelSubscription = (subscriptionId, { atPeriodEnd }) => call("POST", `/subscriptions/${id(subscriptionId)}/cancel`, { cancel_at_cycle_end: atPeriodEnd ? 1 : 0 });
// What a subscription has charged, newest first
export const readSubscriptionInvoices = (subscriptionId) => call("GET", `/invoices?subscription_id=${id(subscriptionId)}&count=5`);

const safeEqualHex = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
};

/**
 * Whether Razorpay signed what the browser handed back after a payment. Razorpay signs with
 * the secret key, which the browser never has, so a payment cannot be claimed that was not made.
 *   a single payment:  order id | payment id
 *   a subscription:    payment id | subscription id
 */
export const signedByRazorpay = ({ paymentId, orderId, subscriptionId, signature }) => {
  if (!razorpayConfigured() || !paymentId || !signature || !(orderId || subscriptionId)) return false;
  const signed = orderId ? `${orderId}|${paymentId}` : `${paymentId}|${subscriptionId}`;
  return safeEqualHex(crypto.createHmac("sha256", env.razorpayKeySecret).update(signed).digest("hex"), String(signature));
};
