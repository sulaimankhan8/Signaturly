import mongoose from "mongoose";

// Request counters for rate limiting, shared by every API instance
const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  hits: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RateLimit = mongoose.model("RateLimit", rateLimitSchema);
