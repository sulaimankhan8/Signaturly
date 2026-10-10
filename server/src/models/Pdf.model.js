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

    // Every stamped copy, oldest first. The original upload is never overwritten.
    versions: [
      {
        _id: false,
        key: { type: String, required: true },
        hash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipient", default: null },
        actorEmail: { type: String, default: "" },
      },
    ],

    // The certificate-sealed copy that people download once signing is complete
    sealedKey: {
      type: String,
      default: null,
    },
    sealedHash: {
      type: String,
      default: null,
    },
    sealedAt: {
      type: Date,
      default: null,
    },

    // Set when the owner deletes the document. The record and its audit log are kept.
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    // Held while a signature is being stamped, so two signers never write the file at once
    signLockUntil: {
      type: Date,
      default: null,
    },
    signLockHolder: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const Pdf = mongoose.model("Pdf", PdfSchema);