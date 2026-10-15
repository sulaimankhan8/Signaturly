import crypto from "crypto";
import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { Invoice } from "../models/Invoice.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { PLANS, WALLET_CUSTOM, WALLET_MIN_INR, WALLET_MAX_INR, isPlan, priceOf, seatAdditionPrice, sellsAs, packsOf, sameOffer } from "../config/plans.js";
import { moveTo, renewsNow } from "./planChange.service.js";
import { applyOrderPaid, applyPurchase, applyAutoRenewApproved, handleRazorpayEvent, planRenewedBy } from "./billingEvents.service.js";
import { startAutoRenew, completeSimulatedAutoRenew, renewalOf } from "./autoRenew.service.js";
import { getOrCreateSubscription, usageOf } from "./subscription.service.js";
import { assertSeatsCoverTeams } from "./workspace.service.js";
import { razorpayConfigured, createOrder, readOrder, readPayment, readSubscription, signedByRazorpay } from "./razorpay.client.js";

const CLIENT_URL = process.env.CLIENT_URL || env.appUrl;

// Kept for callers that list plans; the catalogue itself is config/plans.js
export const PLAN_CONFIG = PLANS;

/**
 * The price of adding seats now, for the rest of the period the account has already paid for.
 */
const priceOfMoreSeats = async (userId, add) => {
  const sub = await Subscription.findOne({ userId });
  const price = sub && sub.status === "active" ? seatAdditionPrice(sub.plan, add, sub.currentPeriodEnd) : null;
  if (!price) throw new ApiError(400, "Seats can be added only to an active plan that is sold by the seat");
  // The customer approved automatic renewal for a set number of seats, and that approval cannot be widened from here
  if (sub.autoRenew) {
    throw new ApiError(409, `Your plan renews automatically for ${sub.seats} seat${sub.seats === 1 ? "" : "s"}. To change that number, turn off auto-renew, add the seats, then turn auto-renew on again.`);
  }
  return {
    amountInr: price.amountInr,
    seats: price.seats,
    description: `${price.seats} more seat${price.seats === 1 ? "" : "s"} on the PactDoc ${PLANS[sub.plan].name} plan, until ${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
  };
};

/**
 * Starts the payment for something on the price list. There are three things to buy:
 *
 *   a plan as a subscription  `kind: "plan", renew: "auto"`. It renews by itself
 *                             (services/autoRenew.service.js).
 *   a plan, prepaid           `kind: "plan", renew: "once"`. One period through an order here:
 *                             it does not renew, and bought again early it adds to the time left.
 *   a top-up                  `kind: "topup"`, a pack of extra documents; or `kind: "wallet"`,
 *                             credit for messages. One payment, at any time, on any plan.
 *
 * A plan bought either way can take a pack of extra documents with it (`addOn`), paid for in
 * the same payment. A pack bought by itself can be bought several at a time (`quantity`).
 * Wallet credit is bought in a set amount, or as the item "custom" with any whole number of
 * rupees the price list allows (`amountInr`).
 *
 * With Razorpay configured, the order or subscription is created there and the app opens
 * Razorpay's checkout; what was bought is granted when Razorpay's payment is confirmed, never
 * on the browser's word. Outside production, with no provider configured, a simulated order
 * is returned instead.
 */
export const createCheckoutSession = async ({ userId, plan, kind = "plan", item, seats, renew = "once", addOn, quantity, amountInr: customInr }) => {
  const what = kind === "plan" ? plan || item : item;
  if (kind === "plan" && renew === "auto") return startAutoRenew({ userId, plan: what, seats, addOn });

  // Adding seats is priced from the account's own plan and the time left on it
  const price = kind === "seats" ? await priceOfMoreSeats(userId, what) : priceOf(kind, what, { seats, amountInr: customInr });
  if (!price) {
    if (kind === "wallet" && what === WALLET_CUSTOM) throw new ApiError(400, `Wallet credit can be added in whole rupees, from Rs. ${WALLET_MIN_INR} to Rs. ${WALLET_MAX_INR}`);
    throw new ApiError(400, kind === "plan" ? "That plan is not available to buy" : "That item is not available to buy");
  }
  if (kind === "plan" && !sellsAs(PLANS[what]).prepaid) {
    throw new ApiError(400, "That plan is sold as a subscription only");
  }

  // Extra documents bought with the plan, in the same payment
  const extra = kind === "plan" && addOn ? priceOf("topup", addOn) : null;
  if (kind === "plan" && addOn && !extra) throw new ApiError(400, "That pack of extra documents is not available to buy");

  if (!env.billingEnabled) {
    throw new ApiError(503, "BILLING_UNAVAILABLE: Paid plans are not available yet.");
  }

  // How this period takes over from the plan the account is on (services/planChange.service.js).
  // A plan that renews by itself is already being paid for, so a single period of the same plan
  // on top would be paid twice; a single period of a bigger plan takes over from it, and the
  // subscription is ended once this is paid. A cheaper plan waits for the paid time to end,
  // which only auto-renew can arrange.
  let move = null;
  if (kind === "plan") {
    const current = await getOrCreateSubscription(userId);
    move = moveTo(current, what, price.seats);
    // Except when its automatic payment failed: then one period paid now takes over from it
    if (renewsNow(current) && current.status === "active" && sameOffer(current.plan, what)) {
      throw new ApiError(409, "Your plan already renews automatically. Turn off auto-renew first if you want to change how you pay.");
    }
    if (!move.ways.includes("once")) {
      throw new ApiError(409, move.change === "downgrade" ? "A cheaper plan starts when your present plan ends. Choose auto-renew to move to it then." : "That plan is sold as a subscription only");
    }
  }

  if (kind === "plan" && price.seats) await assertSeatsCoverTeams(userId, price.seats);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // How many of a pack: one, unless more were asked for
  const packs = kind === "topup" ? packsOf(quantity) : 1;
  const amountInr = price.amountInr * packs + (extra?.amountInr || 0);
  const description = extra ? `${price.description}, with ${extra.description}` : packs > 1 ? `${packs} packs of ${price.description}` : price.description;

  if (razorpayConfigured()) {
    const order = await createOrder({
      amount: amountInr * 100,
      currency: "INR",
      receipt: `${kind}-${crypto.randomBytes(8).toString("hex")}`,
      // Read back when the payment is confirmed, to decide what to grant; the customer cannot change these
      notes: {
        userId: user._id.toString(),
        kind,
        item: String(what),
        ...(kind === "plan" ? { plan: what } : {}),
        ...(price.seats ? { seats: String(price.seats) } : {}),
        ...(extra ? { topup: addOn } : {}),
        ...(packs > 1 ? { quantity: String(packs) } : {}),
        ...(kind === "wallet" && what === WALLET_CUSTOM ? { amount: String(price.amountInr) } : {}),
        ...(move?.replaces && !String(move.replaces).startsWith("sim_sub_") ? { replaces: move.replaces } : {}),
      },
    }).catch((err) => {
      console.error("[Billing] Razorpay order could not be created:", err.providerMessage || err.message);
      // A gateway failure is an error. It never turns into a free upgrade.
      throw new ApiError(502, "The payment provider could not start checkout. Please try again.");
    });

    return {
      isMock: false,
      gateway: "razorpay",
      keyId: env.razorpayKeyId,
      orderId: order.id,
      amountPaise: order.amount,
      currency: "INR",
      description,
      change: move?.change,
      creditDays: move?.creditDays || 0,
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
    addOn: extra ? addOn : undefined,
    quantity: packs,
    amount: amountInr,
    currency: "INR",
    description,
    change: move?.change,
    creditDays: move?.creditDays || 0,
    checkoutUrl: kind === "plan" ? `${CLIENT_URL}/settings?tab=billing&mock_plan=${what}` : undefined,
    message: "Development mode: no payment provider is configured, so the purchase can be simulated.",
  };
};

/**
 * Development only: completes a simulated order as if the provider had reported the payment.
 * It goes through the same code as a real payment, so invoices and ledgers behave the same.
 */
export const completeSimulatedOrder = async ({ userId, kind, item, seats, renew = "once", addOn, quantity, amountInr: customInr }) => {
  if (!env.devBillingSimulation) throw new ApiError(404, "Not found");
  if (kind === "plan" && renew === "auto") return completeSimulatedAutoRenew({ userId, plan: item, seats, addOn });

  const price = kind === "seats" ? await priceOfMoreSeats(userId, item) : priceOf(kind, item, { seats, amountInr: customInr });
  if (!price) throw new ApiError(400, "That item is not available to buy");
  const extra = kind === "plan" && addOn ? priceOf("topup", addOn) : null;
  if (kind === "plan" && addOn && !extra) throw new ApiError(400, "That pack of extra documents is not available to buy");

  const paymentId = `sim_${crypto.randomBytes(10).toString("hex")}`;
  const packs = kind === "topup" ? packsOf(quantity) : 1;
  // As for a real order: a plan bought for one period in place of one that renews ends that subscription
  const move = kind === "plan" ? moveTo(await getOrCreateSubscription(userId), item, price.seats) : null;
  const result = await applyOrderPaid({
    provider: "razorpay",
    userId,
    kind,
    item,
    seats: price.seats,
    addOn: extra ? addOn : undefined,
    quantity: packs,
    replaces: move?.replaces || undefined,
    amountInr: kind === "wallet" ? price.amountInr : undefined,
    payment: { providerPaymentId: paymentId, amount: price.amountInr * packs + (extra?.amountInr || 0), currency: "INR" },
  });
  if (!result.granted) throw new ApiError(400, `The simulated payment was not applied: ${result.reason}`);
  return { ...result, paymentId };
};

const knownPlan = (plan) => (isPlan(plan) ? plan : null);

/**
 * Confirms a payment the moment the customer comes back from Razorpay's checkout, so they
 * do not wait for Razorpay's own notice to arrive.
 *
 * The browser brings back the ids and a signature Razorpay made with the secret key. The
 * signature is checked here, then the payment itself is read from Razorpay, and only that
 * decides what is granted: to whom, what, and for how much are read from the order or
 * subscription this server created. It is applied by the same code as Razorpay's notice, and
 * whichever of the two comes second finds it already done.
 *
 * Returns `{ confirmed: true }`, or `{ confirmed: false }` for a payment Razorpay has not
 * finished taking yet, which its notice will complete.
 */
export const confirmCheckout = async (userId, { paymentId, orderId, subscriptionId, signature }) => {
  if (!razorpayConfigured()) throw new ApiError(400, "No payment provider is configured");
  if (!signedByRazorpay({ paymentId, orderId, subscriptionId, signature })) throw new ApiError(400, "That payment could not be confirmed");

  const payment = await readPayment(paymentId);
  const mine = (notes) => String(notes?.userId || "") === String(userId);

  if (orderId) {
    if (payment.order_id !== orderId) throw new ApiError(400, "That payment could not be confirmed");
    const order = await readOrder(orderId);
    if (!mine(order.notes)) throw new ApiError(403, "That payment belongs to another account");
    if (payment.status !== "captured") return { confirmed: false };
    await handleRazorpayEvent({ event: "payment.captured", payload: { payment: { entity: payment }, order: { entity: order } } }, knownPlan);
    return { confirmed: true };
  }

  const subscription = await readSubscription(subscriptionId);
  if (!mine(subscription.notes)) throw new ApiError(403, "That payment belongs to another account");
  const { plan, seats, addOn, renewalAmountInr, replaces, change, startsOn } = await planRenewedBy(subscription, knownPlan);
  if (!plan) throw new ApiError(400, "That payment could not be confirmed");

  // Approved, with the first charge still to come: when the time already paid for ends, or
  // when the days an upgrade was given for unused time run out
  if (subscription.status === "authenticated") {
    await applyAutoRenewApproved({ userId, plan, seats, providerSubscriptionId: subscription.id, renewalAmountInr, replaces, change, startsOn });
    return { confirmed: true };
  }
  if (subscription.status !== "active" || payment.status !== "captured") return { confirmed: false };

  await applyPurchase({
    provider: "razorpay",
    userId,
    plan,
    seats,
    addOn,
    providerSubscriptionId: subscription.id,
    periodEnd: subscription.current_end,
    renewalAmountInr,
    replaces,
    payment: { providerPaymentId: payment.id, amount: payment.amount ? payment.amount / 100 : 0, currency: payment.currency || "INR" },
  });
  return { confirmed: true };
};

/**
 * Whether a payment has reached the account, for the page a customer lands on after paying.
 *
 * It answers from the record, not from the browser: `recorded` is true once the payment is
 * in the ledger (which is when what it bought was granted), and `approved` once a
 * subscription that charges nothing today is marked as renewing. Until one of them is true
 * the page keeps asking; Razorpay's own notice may still be on its way.
 */
export const checkoutStatus = async (userId, { paymentId, subscriptionId }) => {
  const payment = paymentId ? await Payment.findOne({ userId, providerPaymentId: paymentId, kind: { $ne: "failed" } }).lean() : null;
  const invoice = payment ? await Invoice.findOne({ paymentId: payment._id }).select("number description totalPaise kind").lean() : null;
  const sub = await getOrCreateSubscription(userId);
  const plan = isPlan(sub.plan) ? PLANS[sub.plan] : null;

  return {
    recorded: Boolean(payment),
    approved: Boolean(subscriptionId && sub.autoRenew && sub.razorpaySubscriptionId === subscriptionId),
    payment: payment ? { kind: payment.kind, amount: payment.amount, currency: payment.currency, plan: payment.plan, item: payment.item, occurredAt: payment.occurredAt } : null,
    invoice: invoice ? { id: invoice._id, number: invoice.number, description: invoice.description, totalPaise: invoice.totalPaise, kind: invoice.kind } : null,
    plan: { id: sub.plan, name: plan?.name || sub.plan, perSeat: Boolean(plan?.perSeat), seats: plan?.perSeat ? sub.seats || 1 : null, interval: plan?.interval || null },
    renewal: renewalOf(sub),
    usage: usageOf(sub),
  };
};

/**
 * Where a customer manages their plan. Cards and mandates are held by the payment provider.
 */
export const createBillingPortalSession = async (userId) => {
  await Subscription.findOne({ userId });
  return { url: `${CLIENT_URL}/billing` };
};
