import mongoose from "mongoose";

/**
 * A pack of extra documents (a top-up) as an admin set it from the admin app: a change to a
 * pack this release ships with, or a pack an admin added. config/plans.js lays these over the
 * shipped list.
 */
const addOnSettingSchema = new mongoose.Schema(
  {
    // The pack's id, as payments name it: "docs_10"
    addOnId: { type: String, required: true, unique: true },
    // How many extra documents the pack adds
    documents: { type: Number, required: true, min: 1 },
    // Whole rupees, GST included
    priceInr: { type: Number, required: true, min: 1 },
    // Off sale, a pack stays on record for the payments already made for it
    onSale: { type: Boolean, default: true },
    // Prices the pack was sold at until a short while ago. A checkout opened before the price
    // changed is still honoured until `until`.
    earlierPrices: [{ _id: false, priceInr: { type: Number, required: true }, until: { type: Date, required: true } }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const AddOnSetting = mongoose.model("AddOnSetting", addOnSettingSchema);
