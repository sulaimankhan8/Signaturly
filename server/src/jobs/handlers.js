import { registerJobHandler } from "./queue.js";
import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";
import {
  sendSigningRequestEmail,
  sendCompletionEmail,
  sendDeclineEmail,
  sendCancellationNotificationEmail,
  sendReminderEmail,
} from "../services/email.service.js";
import { withDocumentLock } from "../services/documentLock.service.js";
import { sealDocument } from "../services/pdfSeal.service.js";

const setDelivery = (recipientId, status, lastError = null) =>
  Recipient.updateOne(
    { _id: recipientId },
    { $set: { delivery: { status, lastError, updatedAt: new Date() } } }
  );

// Shows on the document that an invitation never arrived, so the sender can correct the address
const markUndelivered = async ({ recipientId }, message) => {
  if (recipientId) await setDelivery(recipientId, "failed", message);
};

// Jobs carry ids only. Records are loaded fresh, so a retry an hour later uses current data.
const loadRecipientContext = async (recipientId) => {
  const recipient = await Recipient.findById(recipientId);
  if (!recipient) return null;
  const pdf = await Pdf.findById(recipient.pdfId);
  if (!pdf) return null;
  const sender = await User.findById(pdf.userId);
  return { recipient, pdf, sender: sender || { name: "Sender", email: "" } };
};

export const registerJobHandlers = () => {
  registerJobHandler(
    "email.signing_request",
    async ({ recipientId, customMessage }) => {
      const ctx = await loadRecipientContext(recipientId);
      // Nothing to send if the signer is gone, has acted, or the document is no longer open
      if (!ctx || !["pending", "partially_signed"].includes(ctx.pdf.status)) return;
      if (["signed", "declined"].includes(ctx.recipient.status)) return;

      await sendSigningRequestEmail({ ...ctx, customMessage: customMessage || ctx.pdf.message });
      await setDelivery(recipientId, "sent");
    },
    { onFailed: markUndelivered }
  );

  registerJobHandler(
    "email.reminder",
    async ({ recipientId, customMessage }) => {
      const ctx = await loadRecipientContext(recipientId);
      if (!ctx || !["pending", "partially_signed"].includes(ctx.pdf.status)) return;
      if (["signed", "declined"].includes(ctx.recipient.status)) return;

      await sendReminderEmail({ ...ctx, customMessage });
      await setDelivery(recipientId, "sent");
    },
    { onFailed: markUndelivered }
  );

  registerJobHandler("email.completion", async ({ recipientId }) => {
    const ctx = await loadRecipientContext(recipientId);
    if (!ctx) return;

    // Each party downloads through their own signing link; no file link is ever emailed
    await sendCompletionEmail({
      recipientEmail: ctx.recipient.email,
      recipientName: ctx.recipient.name,
      pdf: ctx.pdf,
      senderName: env.appName,
      downloadUrl: `${env.appUrl}/sign/${ctx.recipient.token}`,
    });
  });

  registerJobHandler("email.completion_owner", async ({ pdfId }) => {
    const pdf = await Pdf.findById(pdfId);
    const owner = pdf && (await User.findById(pdf.userId));
    if (!owner) return;

    await sendCompletionEmail({
      recipientEmail: owner.email,
      recipientName: owner.name,
      pdf,
      senderName: env.appName,
      downloadUrl: `${env.appUrl}/dashboard`,
    });
  });

  registerJobHandler("email.decline", async ({ pdfId, recipientId, reason }) => {
    const pdf = await Pdf.findById(pdfId);
    const declinedRecipient = await Recipient.findById(recipientId);
    const owner = pdf && (await User.findById(pdf.userId));
    if (!owner || !declinedRecipient) return;

    await sendDeclineEmail({ senderEmail: owner.email, pdf, declinedRecipient, reason });
  });

  registerJobHandler("email.cancellation", async ({ recipientId, eventType, reason }) => {
    const ctx = await loadRecipientContext(recipientId);
    if (!ctx) return;

    await sendCancellationNotificationEmail({
      recipientEmail: ctx.recipient.email,
      recipientName: ctx.recipient.name,
      pdf: ctx.pdf,
      eventType,
      reason,
    });
  });

  // Retry for a completed document whose sealing failed at signing time
  registerJobHandler("document.seal", async ({ pdfId }) => {
    await withDocumentLock(pdfId, async () => {
      const pdf = await Pdf.findById(pdfId);
      if (!pdf || pdf.sealedKey || pdf.status !== "signed") return;
      await sealDocument(pdfId);
    });
  });
};
