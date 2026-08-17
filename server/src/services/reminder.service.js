import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { sendReminderEmail } from "./email.service.js";
import { ApiError } from "../utils/ApiError.js";

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

  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "You do not have permission to send reminders for this document");
  }

  const sender = await User.findById(userId);

  // Send reminder email
  await sendReminderEmail({
    recipient,
    pdf,
    sender,
    customMessage,
  });

  // Update recipient last reminded timestamp
  recipient.lastRemindedAt = new Date();
  recipient.reminderCount = (recipient.reminderCount || 0) + 1;
  await recipient.save();

  // Log in audit trail
  await PdfAudit.create({
    pdfId: pdf._id,
    userId,
    event: "reminder_sent",
    actorName: sender?.name || "Sender",
    actorEmail: sender?.email || "",
    description: `Manual reminder #${recipient.reminderCount} dispatched to ${recipient.name} (${recipient.email})`,
    ipAddress,
    userAgent,
    signedAt: new Date(),
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

    // Find pending documents that are not expired
    const pendingPdfs = await Pdf.find({
      status: "pending",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    for (const pdf of pendingPdfs) {
      const pendingRecipients = await Recipient.find({
        pdfId: pdf._id,
        status: { $in: ["sent", "viewed"] },
        // Sent more than 48 hours ago AND (never reminded OR last reminded > 24 hours ago)
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
          await sendReminderEmail({
            recipient: rec,
            pdf,
            sender,
            customMessage: "Automated friendly reminder to review and sign this agreement.",
          });

          rec.lastRemindedAt = new Date();
          rec.reminderCount = (rec.reminderCount || 0) + 1;
          await rec.save();

          await PdfAudit.create({
            pdfId: pdf._id,
            userId: pdf.userId,
            event: "automated_reminder",
            actorName: "Signaturly Automation",
            actorEmail: "system@signaturly.com",
            description: `Automated reminder dispatched to ${rec.name} (${rec.email})`,
            signedAt: new Date(),
          });
        } catch (err) {
          console.error(`Failed to send automated reminder to ${rec.email}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error("Error processing automated reminders:", error);
  }
};
