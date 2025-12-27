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
      required: true,
    },

    originalHash: {
      type: String,
      required: true,
    },

    signedHash: {
      type: String,
      required: true,
    },

    fieldsMeta: {
      type: Array,
      required: true,
    },

    signedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const PdfAudit = mongoose.model(
  "PdfAudit",
  pdfAuditSchema
);
