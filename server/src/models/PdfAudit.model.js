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
  },
  { timestamps: true }
);

export const PdfAudit = mongoose.model("PdfAudit", pdfAuditSchema);
