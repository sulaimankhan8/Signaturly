import mongoose from "mongoose";

// Background work that must survive a restart: emails, sealing retries, later webhooks
const jobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "running", "done", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    runAfter: { type: Date, default: Date.now, index: true },
    // A running job whose lock has lapsed was interrupted and may be picked up again
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    // The same key is never queued twice, so a repeated request cannot send two emails
    idempotencyKey: { type: String },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

// Finished jobs are removed after 30 days
jobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Job = mongoose.model("Job", jobSchema);
