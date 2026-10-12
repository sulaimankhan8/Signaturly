import mongoose from "mongoose";

/**
 * A plan as an admin set it from the admin app: a change to a plan this release ships with,
 * or a plan an admin added. config/plans.js lays these over the shipped list.
 *
 * A plan's yearly price is a record of its own, with `yearlyOf` naming the plan. Only its
 * price and how it is sold are read from it; the rest is taken from the plan.
 */
const planSettingSchema = new mongoose.Schema(
  {
    // The plan's id, as subscriptions and payments name it: "pro_monthly"
    planId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tier: { type: String, enum: ["free", "pro", "business", "enterprise"], required: true },
    // 999999 (UNLIMITED in config/plans.js) means no monthly limit
    documentsPerMonth: { type: Number, required: true, min: 1 },
    // Whole rupees, GST included. Null for a plan that has no price.
    priceInr: { type: Number, default: null },
    priceIsFrom: { type: Boolean, default: false },
    interval: { type: String, enum: ["month", "year", null], default: null },
    perSeat: { type: Boolean, default: false },
    purchasable: { type: Boolean, default: false },
    // Retired: kept for the accounts that hold it, and offered to nobody else
    legacy: { type: Boolean, default: false },
    // What the plan includes, where it differs from what its tier gives: the names of the
    // features it has, and its own limit on a bulk send. Null means "what the tier gives".
    features: { type: mongoose.Schema.Types.Mixed, default: null },
    bulkSendMax: { type: Number, default: null, min: 0 },
    // How a plan on sale may be bought: as a subscription that renews by itself, for one
    // prepaid period, or both
    sellSubscription: { type: Boolean, default: true },
    sellPrepaid: { type: Boolean, default: true },
    // For a yearly price: the id of the plan it is the yearly price of
    yearlyOf: { type: String, default: null },
    // Who the plan is for, in a line, as the pricing page says it
    tagline: { type: String, default: "", maxlength: 90 },
    // Marked as the plan most people choose
    highlight: { type: Boolean, default: false },
    // Prices the plan was sold at until a short while ago. A checkout opened before the price
    // changed is still honoured until `until`.
    earlierPrices: [{ _id: false, priceInr: { type: Number, required: true }, until: { type: Date, required: true } }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const PlanSetting = mongoose.model("PlanSetting", planSettingSchema);
