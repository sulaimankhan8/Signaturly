import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro_monthly", "pro_annual", "lifetime", "enterprise"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "past_due", "canceled", "expired", "free", "incomplete"],
      default: "active",
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    gracePeriodEnd: {
      type: Date,
      default: null,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    previousPlan: {
      type: String,
      default: null,
    },
    monthlyQuota: {
      type: Number,
      default: 15, // 15 documents/month for free starter tier
    },
    usedThisMonth: {
      type: Number,
      default: 0,
    },
    quotaResetDate: {
      type: Date,
      default: () => {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
      },
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    razorpaySubscriptionId: {
      type: String,
      default: null,
    },
    lastPaymentAmount: {
      type: Number,
      default: 0,
    },
    lastPaymentCurrency: {
      type: String,
      default: "USD",
    },
    billingCycleAnchor: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
