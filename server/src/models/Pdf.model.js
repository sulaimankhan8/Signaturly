import mongoose from "mongoose";

const PdfSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The workspace the document belongs to. `userId` above is the member who made it.
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    // Set when a removed member's document passed to the workspace's owner
    transferredFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Made with a test API key: watermarked, never billed, kept apart from real documents
    testMode: {
      type: Boolean,
      default: false,
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

    // The editor's work before the document is signed or sent, saved as the sender goes so a
    // refresh or a closed tab loses nothing: { mode, fields, recipients, settings, updatedAt }.
    // Cleared when the document is sent or signed.
    draft: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    message: {
      type: String,
      default: "",
    },

    // The sender's own subject line for the invitation email (paid plans); empty uses ours
    emailSubject: {
      type: String,
      default: "",
    },

    // How often signers who have not signed are reminded by email (paid plans).
    // "none" sends no automatic reminders; the sender can still remind by hand.
    reminderCadence: {
      type: String,
      enum: ["none", "daily", "3days", "5days"],
      default: "none",
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

    // The guided template this document was made from, and the exact version of its wording
    template: {
      key: { type: String },
      version: { type: Number },
      language: { type: String },
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