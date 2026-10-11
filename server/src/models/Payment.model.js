import mongoose from "mongoose";

// Ledger of money events reported by the payment providers. One row per provider payment.
const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["stripe", "razorpay"], required: true },
    providerPaymentId: { type: String, required: true },
    providerSubscriptionId: { type: String, default: null },
    // purchase and renewal are for a plan; topup is extra documents; wallet is credit added to the wallet
    // seats is seats added to a per-seat plan part-way through its period
    kind: { type: String, enum: ["purchase", "renewal", "failed", "topup", "wallet", "seats"], required: true },
    plan: { type: String, default: null },
    // How many seats a per-seat plan was bought with, or how many were added
    seats: { type: Number, default: null },
    // The top-up or wallet pack bought, for those kinds
    item: { type: String, default: null },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true });

export const Payment = mongoose.model("Payment", paymentSchema);
