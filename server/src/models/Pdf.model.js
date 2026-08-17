import mongoose from "mongoose";

const PdfSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalFileName: {
      type: String,
      required: true,
    },

    storagePath: {
      type: String,
      required: true,
    },

    originalHash: {
      type: String,
      required: true,
    },

    pageCount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "uploaded",
        "pending",
        "partially_signed",
        "signed",
        "declined",
        "expired",
        "voided",
        "failed",
      ],
      default: "draft",
    },

    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipient",
      },
    ],

    fields: {
      type: Array,
      default: [],
    },

    signingOrder: {
      type: Boolean,
      default: false,
    },

    message: {
      type: String,
      default: "",
    },

    expiresAt: {
      type: Date,
    },

    declinedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipient",
    },

    declineReason: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Pdf = mongoose.model("Pdf", PdfSchema);