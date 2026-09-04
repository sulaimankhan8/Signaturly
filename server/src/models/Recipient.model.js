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
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
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
  },
  { timestamps: true }
);

export const Recipient = mongoose.model("Recipient", recipientSchema);
