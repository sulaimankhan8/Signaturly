import mongoose from "mongoose";

export const ENQUIRY_STATUSES = ["new", "contacted", "closed"];
export const TEAM_SIZES = ["1-10", "11-50", "51-200", "201+"];

/**
 * Someone asked to talk to us about a plan that is agreed and not bought with a button
 * (Enterprise). Written by the "Contact sales" form on the pricing and billing pages, and
 * read and followed up from the admin app.
 */
const salesEnquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, maxlength: 254 },
    company: { type: String, default: "", maxlength: 120 },
    // How many people would use it, as one of the bands the form offers
    teamSize: { type: String, enum: [...TEAM_SIZES, ""], default: "" },
    message: { type: String, default: "", maxlength: 2000 },
    // The plan the form was opened from, as the price list names it
    plan: { type: String, default: "" },
    status: { type: String, enum: ENQUIRY_STATUSES, default: "new", index: true },
    // What an admin wrote down about following it up
    note: { type: String, default: "", maxlength: 1000 },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

salesEnquirySchema.index({ createdAt: -1 });

export const SalesEnquiry = mongoose.model("SalesEnquiry", salesEnquirySchema);
