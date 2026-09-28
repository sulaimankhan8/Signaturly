import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { upgradeUserPlan } from "./subscription.service.js";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const RAZORPAY_KEY = process.env.RAZORPAY_KEY_ID;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

export const PLAN_CONFIG = {
  pro_monthly: {
    name: "Pro Creator (Monthly)",
    priceUsd: 5.99,
    priceInr: 499,
    interval: "month",
    type: "subscription",
  },
  pro_annual: {
    name: "Pro Creator (Annual - Save 32%)",
    priceUsd: 49.00,
    priceInr: 3999,
    interval: "year",
    type: "subscription",
  },
  lifetime: {
    name: "Lifetime Access Pass (LTD)",
    priceUsd: 69.00,
    priceInr: 5499,
    type: "one_time",
  },
  enterprise: {
    name: "Business & Enterprise",
    priceUsd: 14.99,
    priceInr: 1199,
    interval: "month",
    type: "subscription",
  },
};

/**
 * Creates a checkout session.
 * If live Stripe credentials exist in .env, connects with Stripe.
 * Otherwise, seamlessly generates a Dev Simulation Session.
 */
export const createCheckoutSession = async ({ userId, plan, gateway = "stripe" }) => {
  const planInfo = PLAN_CONFIG[plan];
  if (!planInfo) {
    throw new ApiError(400, "Invalid plan specified for checkout");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // 1. Live Stripe Gateway Mode (if configured)
  if (gateway === "stripe" && STRIPE_KEY && !STRIPE_KEY.includes("your_")) {
    try {
      // Dynamic import to avoid hard dependency if not yet installed
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(STRIPE_KEY);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Signaturly Pro — ${planInfo.name}`,
                description: "Unlimited electronic signatures, custom templates & priority processing.",
              },
              unit_amount: Math.round(planInfo.priceUsd * 100),
              ...(planInfo.type === "subscription"
                ? { recurring: { interval: planInfo.interval } }
                : {}),
            },
            quantity: 1,
          },
        ],
        mode: planInfo.type === "subscription" ? "subscription" : "payment",
        success_url: `${CLIENT_URL}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${CLIENT_URL}/settings?tab=billing&canceled=true`,
        customer_email: user.email,
        client_reference_id: user._id.toString(),
        metadata: {
          userId: user._id.toString(),
          plan,
        },
      });

      return {
        isMock: false,
        gateway: "stripe",
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (err) {
      console.warn("⚠️ [Billing] Stripe checkout failed, falling back to simulation:", err.message);
    }
  }

  // 2. Dev Simulation / Zero-Credential Fallback Mode
  return {
    isMock: true,
    gateway: "mock_simulation",
    plan,
    planName: planInfo.name,
    amount: planInfo.priceUsd,
    currency: "USD",
    checkoutUrl: `${CLIENT_URL}/settings?tab=billing&mock_plan=${plan}`,
    message: "Zero-Credential Dev Mode: Click Confirm Upgrade to simulate instant subscription activation.",
  };
};

/**
 * Generates Customer Billing Portal session for managing cards / cancellations
 */
export const createBillingPortalSession = async (userId) => {
  const sub = await Subscription.findOne({ userId });

  if (STRIPE_KEY && sub?.stripeCustomerId) {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(STRIPE_KEY);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${CLIENT_URL}/settings?tab=billing`,
      });
      return { url: portalSession.url };
    } catch (err) {
      console.warn("[Billing] Portal error:", err.message);
    }
  }

  return {
    url: `${CLIENT_URL}/settings?tab=billing`,
    message: "Dev Mode: Subscription managed directly in Signaturly Settings.",
  };
};
