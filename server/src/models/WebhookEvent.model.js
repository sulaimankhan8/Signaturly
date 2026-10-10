import mongoose from "mongoose";

// Payment-provider events already handled, so a replayed delivery changes nothing
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, enum: ["stripe", "razorpay"] },
    eventId: { type: String, required: true },
    type: { type: String },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
