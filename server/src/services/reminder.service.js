import { assertRecordAccess } from "./authorize.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { eventBus, EventTypes } from "../events/index.js";

// Manual 1-click reminder trigger by document owner
export const sendManualRecipientReminder = async ({
  recipientId,
  userId,
  customMessage = "",
  ipAddress = "",
  userAgent = "",
}) => {
  const recipient = await Recipient.findById(recipientId);
  if (!recipient) throw new ApiError(404, "Recipient not found");

  if (recipient.status === "signed") {
    throw new ApiError(400, "This recipient has already signed the document");
  }

  const pdf = await Pdf.findById(recipient.pdfId);
  if (!pdf) throw new ApiError(404, "Associated document not found");

await assertRecordAccess(pdf, userId, "document.remind");

  const sender = await User.findById(userId);

  // Update recipient last reminded timestamp
  recipient.lastRemindedAt = new Date();
  recipient.reminderCount = (recipient.reminderCount || 0) + 1;
  await recipient.save();

  // Emit event
  await eventBus.emitEvent(EventTypes.REMINDER_DISPATCHED, {
    aggregateId: pdf._id,
    actor: {
      id: sender?._id,
      name: sender?.name || "Sender",
      email: sender?.email || "",
      ipAddress,
      userAgent,
    },
    payload: {
      recipient,
      pdf,
      sender,
      customMessage,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
    },
  });

  return {
    success: true,
    recipientId: recipient._id,
    lastRemindedAt: recipient.lastRemindedAt,
    reminderCount: recipient.reminderCount,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Days between reminders for each choice the sender can make
const CADENCE_DAYS = { daily: 1, "3days": 3, "5days": 5 };

// Automated background reminder job (runs periodically via cron). Only documents whose sender
// chose reminders are reminded, at the interval they chose.
export const processAutomatedReminders = async () => {
  try {
    const activePdfs = await Pdf.find({
      status: { $in: ["pending", "partially_signed"] },
      reminderCadence: { $in: Object.keys(CADENCE_DAYS) },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    for (const pdf of activePdfs) {
      const due = new Date(Date.now() - CADENCE_DAYS[pdf.reminderCadence] * DAY_MS);
      const pendingRecipients = await Recipient.find({
        pdfId: pdf._id,
        status: { $in: ["sent", "viewed"] },
        createdAt: { $lt: due },
        $or: [
          { lastRemindedAt: null },
          { lastRemindedAt: { $lt: due } },
        ],
      });

      const sender = await User.findById(pdf.userId);
      if (!sender) continue;

      for (const rec of pendingRecipients) {
        try {
          // Atomic lock: claim the recipient first to prevent double-sends on restarts or multi-instance deployments
          const claimedRecipient = await Recipient.findOneAndUpdate(
            {
              _id: rec._id,
              status: { $in: ["sent", "viewed"] },
              $or: [
                { lastRemindedAt: null },
                { lastRemindedAt: { $lt: due } },
              ],
            },
            {
              $set: { lastRemindedAt: new Date() },
              $inc: { reminderCount: 1 },
            },
            { new: true }
          );

          if (!claimedRecipient) continue; // Already claimed by another process or prior execution

          await eventBus.emitEvent(EventTypes.REMINDER_DISPATCHED, {
            aggregateId: pdf._id,
            actor: {
              id: sender._id,
              name: "PactDoc Automation",
              email: "system@pactdoc.com",
            },
            payload: {
              recipient: claimedRecipient,
              pdf,
              sender,
              customMessage: "Automated friendly reminder to review and sign this agreement.",
              recipientName: claimedRecipient.name,
              recipientEmail: claimedRecipient.email,
            },
          });
        } catch (err) {
          console.error(`Failed to dispatch automated reminder to ${rec.email}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error("Error processing automated reminders:", error);
  }
};
