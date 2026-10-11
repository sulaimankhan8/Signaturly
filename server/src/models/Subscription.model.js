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
      enum: ["free", "pro_monthly", "pro_annual", "business_monthly", "lifetime", "enterprise"],
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
    // Documents the plan allows each month
    monthlyQuota: {
      type: Number,
      default: 5,
    },
    // Documents bought as top-ups. Used only after the month's allowance, and kept across months.
    extraDocuments: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Seats paid for, on plans sold by the seat. The owner takes one.
    seats: {
      type: Number,
      default: 1,
      min: 1,
    },
    // An account that paid under the old unlimited plans keeps that until this date
    quotaGrandfatheredUntil: {
      type: Date,
      default: null,
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
      default: "INR",
    },
    // Plans granted by an administrator, with who granted them
    adminGrants: [
      {
        _id: false,
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        plan: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    billingCycleAnchor: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
