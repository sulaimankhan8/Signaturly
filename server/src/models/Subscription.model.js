import mongoose from "mongoose";
import { isPlan } from "../config/plans.js";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // Any plan in the catalogue (config/plans.js), which admins can add to
    plan: {
      type: String,
      validate: { validator: (plan) => isPlan(plan), message: "`{VALUE}` is not a plan" },
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
    // The plan renews by itself: the provider holds the customer's approval and charges each period
    autoRenew: {
      type: Boolean,
      default: false,
    },
    // What each automatic renewal charges, in rupees. It is the price when the customer
    // subscribed, which a later change to the plan's price does not alter.
    renewalAmountInr: {
      type: Number,
      default: null,
    },
    // A move to a cheaper plan that waits for the paid time to end: the subscription approved
    // for it starts then, and its first charge switches the account to `scheduledPlan`
    // (services/planChange.service.js). Null when nothing is waiting.
    scheduledPlan: {
      type: String,
      default: null,
      validate: { validator: (plan) => plan === null || isPlan(plan), message: "`{VALUE}` is not a plan" },
    },
    scheduledSeats: {
      type: Number,
      default: null,
    },
    scheduledPlanFrom: {
      type: Date,
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
        reason: { type: String, default: "" },
        // When the granted plan ends, and the allowance it was given with
        periodEnd: { type: Date, default: null },
        quota: { type: Number, default: null },
      },
    ],
    // The current plan was given by an administrator, not paid for. Cleared by the next payment.
    complimentary: {
      type: Boolean,
      default: false,
    },
    billingCycleAnchor: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
