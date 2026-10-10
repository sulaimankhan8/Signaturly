import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pdf",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // A signer is reached by email, by phone, or both. At least one is always present.
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    // International format, for example +919876543210
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    // Where the signing link, reminders and codes are sent
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp"],
      default: "email",
    },
    // Language of everything this signer receives and sees
    language: {
      type: String,
      default: "en",
    },
    role: {
      type: String,
      enum: ["signer", "viewer", "approver"],
      default: "signer",
    },
    signingOrder: {
      type: Number,
      default: 1,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Signing links stop working after this moment, whatever the document's own deadline
    tokenExpiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "viewed", "signed", "declined"],
      default: "pending",
    },
    color: {
      type: String,
      default: "#ef4444", // hex accent for assigned fields
    },
    signedAt: {
      type: Date,
    },
    viewedAt: {
      type: Date,
    },
    declineReason: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    authType: {
      type: String,
      enum: ["none", "otp", "passcode"],
      default: "none",
    },
    passcodeHash: {
      type: String,
      default: null,
    },
    authVerified: {
      type: Boolean,
      default: false,
    },
    // How and when the signer actually proved who they are (never inferred from authType)
    authMethod: {
      type: String,
      enum: ["email_link", "message_link", "email_otp", "sms_otp", "passcode"],
      default: "email_link",
    },
    authVerifiedAt: {
      type: Date,
    },
    passcodeAttempts: {
      type: Number,
      default: 0,
    },
    passcodeLockedUntil: {
      type: Date,
    },
    otpLastSentAt: {
      type: Date,
    },
    otpWindowStart: {
      type: Date,
    },
    otpSendCount: {
      type: Number,
      default: 0,
    },
    // Electronic-records consent captured at the moment of signing
    consent: {
      accepted: { type: Boolean, default: false },
      version: { type: String },
      acceptedAt: { type: Date },
      ipAddress: { type: String },
      userAgent: { type: String },
    },
    // Outcome of the last invitation or reminder email
    delivery: {
      status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
      lastError: { type: String, default: null },
      updatedAt: { type: Date },
    },
    lastRemindedAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Recipient = mongoose.model("Recipient", recipientSchema);
