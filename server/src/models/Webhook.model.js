import mongoose from "mongoose";

const webhookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
    },
    events: [
      {
        type: String,
        enum: [
          "envelope.sent",
          "recipient.viewed",
          "recipient.signed",
          "envelope.completed",
          "envelope.declined",
          "envelope.voided",
        ],
        default: ["envelope.completed", "recipient.signed"],
      },
    ],
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
  },
  { timestamps: true }
);

export const Webhook = mongoose.model("Webhook", webhookSchema);
