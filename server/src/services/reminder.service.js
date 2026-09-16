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

  if (pdf.userId.toString() !== userId?.toString()) {
    throw new ApiError(403, "You do not have permission to send reminders for this document");
  }

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

// Automated background reminder job (runs periodically via cron)
export const processAutomatedReminders = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activePdfs = await Pdf.find({
      status: { $in: ["pending", "partially_signed"] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    for (const pdf of activePdfs) {
      const pendingRecipients = await Recipient.find({
        pdfId: pdf._id,
        status: { $in: ["sent", "viewed"] },
        createdAt: { $lt: twoDaysAgo },
        $or: [
          { lastRemindedAt: null },
          { lastRemindedAt: { $lt: oneDayAgo } },
        ],
      });

      const sender = await User.findById(pdf.userId);
      if (!sender) continue;

      for (const rec of pendingRecipients) {
        try {
          rec.lastRemindedAt = new Date();
          rec.reminderCount = (rec.reminderCount || 0) + 1;
          await rec.save();

          await eventBus.emitEvent(EventTypes.REMINDER_DISPATCHED, {
            aggregateId: pdf._id,
            actor: {
              id: sender._id,
              name: "Signaturly Automation",
              email: "system@signaturly.com",
            },
            payload: {
              recipient: rec,
              pdf,
              sender,
              customMessage: "Automated friendly reminder to review and sign this agreement.",
              recipientName: rec.name,
              recipientEmail: rec.email,
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
