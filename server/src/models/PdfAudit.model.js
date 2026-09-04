import mongoose from "mongoose";

const pdfAuditSchema = new mongoose.Schema(
  {
    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pdf",
      required: true,
      index: true,
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
      enum: [
        "created",
        "sent",
        "viewed",
        "signed",
        "declined",
        "voided",
        "downloaded",
        "expired",
      ],
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
      default: "0000000000000000000000000000000000000000000000000000000000000000",
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
      default: "Email OTP",
    },
  },
  { timestamps: true }
);

// Immutability Safeguard: Prevent updating existing audit logs
pdfAuditSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findByIdAndUpdate"], function () {
  throw new Error("LEGAL_AUDIT_IMMUTABLE: Modification of completed audit records is strictly prohibited by law.");
});

export const PdfAudit = mongoose.model("PdfAudit", pdfAuditSchema);

