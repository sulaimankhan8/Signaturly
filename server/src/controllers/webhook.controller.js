import { asyncHandler } from "../utils/asyncHandler.js";
import { upgradeUserPlan } from "../services/subscription.service.js";
import { Subscription } from "../models/Subscription.model.js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const handleStripeWebhookController = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event = req.body;

  // Verify signature if webhook secret is configured
  if (STRIPE_WEBHOOK_SECRET && !STRIPE_WEBHOOK_SECRET.includes("your_")) {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("⚠️ Stripe webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // Handle relevant events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const plan = session.metadata?.plan || "pro_monthly";

      if (userId) {
        await upgradeUserPlan(userId, plan, {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          amount: session.amount_total ? session.amount_total / 100 : 0,
          currency: session.currency || "usd",
        });
        console.log(`🎉 [Stripe] User ${userId} upgraded to ${plan}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const subRecord = await Subscription.findOne({
        stripeSubscriptionId: subscription.id,
      });

      if (subRecord) {
        subRecord.plan = "free";
        subRecord.status = "canceled";
        subRecord.monthlyQuota = 15;
        await subRecord.save();
        console.log(`[Stripe] Subscription canceled for user ${subRecord.userId}`);
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

export const handleRazorpayWebhookController = asyncHandler(async (req, res) => {
  const { event, payload } = req.body;

  if (event === "payment.captured") {
    const payment = payload?.payment?.entity;
    const userId = payment?.notes?.userId;
    const plan = payment?.notes?.plan || "pro_monthly";

    if (userId) {
      await upgradeUserPlan(userId, plan, {
        amount: payment.amount ? payment.amount / 100 : 0,
        currency: payment.currency || "INR",
      });
      console.log(`🎉 [Razorpay] User ${userId} upgraded to ${plan}`);
    }
  }

  res.status(200).json({ status: "ok" });
});
