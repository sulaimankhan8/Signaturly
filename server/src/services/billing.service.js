import crypto from "crypto";
import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { PLANS, priceOf, seatAdditionPrice } from "../config/plans.js";
import { applyOrderPaid } from "./billingEvents.service.js";
import { Workspace } from "../models/Workspace.model.js";
import { seatsUsed } from "./workspace.service.js";

const CLIENT_URL = process.env.CLIENT_URL || env.appUrl;

// Kept for callers that list plans; the catalogue itself is config/plans.js
export const PLAN_CONFIG = PLANS;

const razorpayConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret);

/**
 * Starts the payment for something on the price list: a plan period, a pack of extra documents,
 * or wallet credit.
 *
 * With Razorpay configured, an order is created there and the app opens Razorpay's checkout;
 * what was bought is granted only when Razorpay reports the payment to the webhook.
 * Outside production, with no provider configured, a simulated order is returned instead.
 *
 * Plans bought this way are prepaid for one period and do not renew by themselves.
 */
/**
 * The price of adding seats now, for the rest of the period the account has already paid for.
 */
const priceOfMoreSeats = async (userId, add) => {
  const sub = await Subscription.findOne({ userId });
  const price = sub && sub.status === "active" ? seatAdditionPrice(sub.plan, add, sub.currentPeriodEnd) : null;
  if (!price) throw new ApiError(400, "Seats can be added only to an active plan that is sold by the seat");
  return {
    amountInr: price.amountInr,
    seats: price.seats,
    description: `${price.seats} more seat${price.seats === 1 ? "" : "s"} on the PactDoc ${PLANS[sub.plan].name} plan, until ${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
  };
};

export const createCheckoutSession = async ({ userId, plan, kind = "plan", item, seats }) => {
  const what = kind === "plan" ? plan || item : item;
  // Adding seats is priced from the account's own plan and the time left on it
  const price = kind === "seats" ? await priceOfMoreSeats(userId, what) : priceOf(kind, what, { seats });
  if (!price) {
    throw new ApiError(400, kind === "plan" ? "That plan is not available to buy" : "That item is not available to buy");
  }

  if (!env.billingEnabled) {
    throw new ApiError(503, "BILLING_UNAVAILABLE: Paid plans are not available yet.");
  }

  // A period can be bought with fewer seats than the last one, but not with fewer than the
  // people already in the account's teams. Seats are never taken away part-way through a period.
  if (kind === "plan" && price.seats) {
    for (const team of await Workspace.find({ ownerId: userId, personal: { $ne: true }, status: { $ne: "archived" } })) {
      const inUse = await seatsUsed(team);
      if (inUse > price.seats) {
        throw new ApiError(400, `"${team.name}" has ${inUse} people, counting invitations not yet answered. Remove some or buy at least ${inUse} seats.`);
      }
    }
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (razorpayConfigured()) {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: price.amountInr * 100,
        currency: "INR",
        receipt: `${kind}-${crypto.randomBytes(8).toString("hex")}`,
        // Read back by the webhook to decide what to grant; the customer cannot change these
        notes: {
          userId: user._id.toString(),
          kind,
          item: String(what),
          ...(kind === "plan" ? { plan: what } : {}),
          ...(price.seats ? { seats: String(price.seats) } : {}),
        },
      }),
    }).catch(() => null);

    if (!response || !response.ok) {
      console.error("[Billing] Razorpay order could not be created:", response ? response.status : "no response");
      // A gateway failure is an error. It never turns into a free upgrade.
      throw new ApiError(502, "The payment provider could not start checkout. Please try again.");
    }

    const order = await response.json();
    return {
      isMock: false,
      gateway: "razorpay",
      keyId: env.razorpayKeyId,
      orderId: order.id,
      amountPaise: order.amount,
      currency: "INR",
      description: price.description,
      customer: { name: user.name, email: user.email },
    };
  }

  if (!env.devBillingSimulation) {
    throw new ApiError(503, "BILLING_UNAVAILABLE: No payment provider is configured.");
  }

  // Development-only simulation (never reachable in production)
  return {
    isMock: true,
    gateway: "mock_simulation",
    kind,
    item: what,
    seats: price.seats,
    plan: kind === "plan" ? what : undefined,
    planName: kind === "plan" ? PLANS[what].name : undefined,
    amount: price.amountInr,
    currency: "INR",
    description: price.description,
    checkoutUrl: kind === "plan" ? `${CLIENT_URL}/settings?tab=billing&mock_plan=${what}` : undefined,
    message: "Development mode: no payment provider is configured, so the purchase can be simulated.",
  };
};

/**
 * Development only: completes a simulated order as if the provider had reported the payment.
 * It goes through the same code as a real payment, so invoices and ledgers behave the same.
 */
export const completeSimulatedOrder = async ({ userId, kind, item, seats }) => {
  if (!env.devBillingSimulation) throw new ApiError(404, "Not found");
  const price = kind === "seats" ? await priceOfMoreSeats(userId, item) : priceOf(kind, item, { seats });
  if (!price) throw new ApiError(400, "That item is not available to buy");

  const result = await applyOrderPaid({
    provider: "razorpay",
    userId,
    kind,
    item,
    seats: price.seats,
    payment: { providerPaymentId: `sim_${crypto.randomBytes(10).toString("hex")}`, amount: price.amountInr, currency: "INR" },
  });
  if (!result.granted) throw new ApiError(400, `The simulated payment was not applied: ${result.reason}`);
  return result;
};

/**
 * Where a customer manages their plan. Cards and mandates are held by the payment provider.
 */
export const createBillingPortalSession = async (userId) => {
  await Subscription.findOne({ userId });
  return { url: `${CLIENT_URL}/billing` };
};
