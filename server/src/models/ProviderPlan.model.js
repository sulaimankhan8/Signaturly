import mongoose from "mongoose";

/**
 * A plan as the payment provider knows it, for auto-renew.
 *
 * Razorpay renews a subscription from a "plan" of its own, with a fixed amount that cannot be
 * changed afterwards. So one is made for each of our plans at each price and period it has
 * been subscribed to at, and remembered here. When an admin changes a price, the next
 * subscriber gets a new one, and the customers already renewing stay on the old.
 */
const providerPlanSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["razorpay"], required: true },
    // Our plan's id, and the price and period the provider's plan charges
    planId: { type: String, required: true },
    priceInr: { type: Number, required: true },
    interval: { type: String, enum: ["month", "year"], required: true },
    // The provider's own id for it
    providerPlanId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

providerPlanSchema.index({ provider: 1, planId: 1, priceInr: 1, interval: 1 }, { unique: true });

export const ProviderPlan = mongoose.model("ProviderPlan", providerPlanSchema);
