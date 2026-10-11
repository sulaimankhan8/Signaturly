import mongoose from "mongoose";

export const AUDIT_EVENTS = [
  "created",
  "sent",
  "viewed",
  "identity_verified",
  "signed",
  "completed",
  "sealed",
  "declined",
  "voided",
  "downloaded",
  "expired",
  "reminder_sent",
  "automated_reminder",
  "recipient_updated",
  "deleted",
  // Aadhaar eSign: the signer was sent to the provider, the provider confirmed, or it did not go through
  "esign_started",
  "esign_verified",
  "esign_failed",
  // Removed at the end of the period its workspace keeps documents for
  "retention_deleted",
];

const pdfAuditSchema = new mongoose.Schema(
  {
    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pdf",
      required: true,
      index: true,
    },

    // Position of this entry in the document's chain, starting at 1
    seq: {
      type: Number,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipient",
    },

    event: {
      type: String,
      enum: AUDIT_EVENTS,
      default: "signed",
    },

    actorName: {
      type: String,
    },

    actorEmail: {
      type: String,
    },

    originalHash: {
      type: String,
    },

    signedHash: {
      type: String,
    },

    fieldsMeta: {
      type: Array,
      default: [],
    },

    description: {
      type: String,
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    signedAt: {
      type: Date,
      default: Date.now,
    },

    previousEventHash: {
      type: String,
    },

    eventHash: {
      type: String,
    },

    otpVerified: {
      type: Boolean,
      default: false,
    },

    authMethod: {
      type: String,
      default: "",
    },

    // Version of the electronic-signature consent text the signer accepted (sign events only)
    consentVersion: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// One entry per position: two writers racing for the same slot cannot both succeed
pdfAuditSchema.index(
  { pdfId: 1, seq: 1 },
  { unique: true, partialFilterExpression: { seq: { $type: "number" } } }
);

const refuse = (what) =>
  function () {
    throw new Error(`AUDIT_APPEND_ONLY: Audit records cannot be ${what}.`);
  };

// Append-only safeguard: entries can be added, never changed or removed
pdfAuditSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne"], refuse("modified"));
pdfAuditSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], refuse("deleted"));
pdfAuditSchema.pre("deleteOne", { document: true, query: false }, refuse("deleted"));
pdfAuditSchema.pre("save", function () {
  if (!this.isNew) refuse("modified")();
});

export const PdfAudit = mongoose.model("PdfAudit", pdfAuditSchema);
