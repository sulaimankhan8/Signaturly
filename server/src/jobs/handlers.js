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
import { sendMessage } from "../services/messaging/index.js";
import { chargeForMessage } from "../services/wallet.service.js";
import { brandingFor, billingUserIdOf } from "../services/branding.service.js";
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

const usesMessaging = (recipient) => recipient.channel !== "email" && Boolean(recipient.phone);
const signingLink = (recipient) => `${env.appUrl}/sign/${recipient.token}`;

// Sends by SMS or WhatsApp in the signer's language. The sender's wallet pays for the message
// first; the job's id is the reference, so a retry of the same job is not charged again.
const message = async (ctx, template, params, job) => {
  const { recipient, pdf } = ctx;
  // The plan that pays for the document's workspace pays for its messages too
  await chargeForMessage({ userId: await billingUserIdOf(pdf), channel: recipient.channel, reference: `message:${job?._id || `${template}:${recipient._id}`}` });
  return sendMessage({
    channel: recipient.channel,
    to: recipient.phone,
    template,
    language: recipient.language,
    params,
  });
};

// Documents sent from a Free account carry a "Signed with PactDoc" line; a team's documents
// carry the team's own name and colour. Returns the options the email functions take.
const lookOf = async (pdf) => {
  const { badge, brand } = await brandingFor(pdf);
  return { showBadge: badge, brand };
};

// Documents made with a test API key are for trying an integration out. Nothing is sent to
// anyone for them: their signing links are read through the API instead.
const isTest = (pdf) => Boolean(pdf?.testMode);

export const registerJobHandlers = () => {
  registerJobHandler(
    "email.signing_request",
    async ({ recipientId, customMessage }, job) => {
      const ctx = await loadRecipientContext(recipientId);
      // Nothing to send if the signer is gone, has acted, or the document is no longer open
      if (!ctx || !["pending", "partially_signed"].includes(ctx.pdf.status)) return;
      if (["signed", "declined"].includes(ctx.recipient.status)) return;
      if (isTest(ctx.pdf)) return;

      if (usesMessaging(ctx.recipient)) {
        await message(ctx, "signing_request", {
          sender: ctx.sender.name || ctx.sender.email,
          document: ctx.pdf.originalFileName,
          link: signingLink(ctx.recipient),
        }, job);
      } else {
        await sendSigningRequestEmail({ ...ctx, customMessage: customMessage || ctx.pdf.message, ...(await lookOf(ctx.pdf)) });
      }
      await setDelivery(recipientId, "sent");
    },
    { onFailed: markUndelivered }
  );

  registerJobHandler(
    "email.reminder",
    async ({ recipientId, customMessage }, job) => {
      const ctx = await loadRecipientContext(recipientId);
      if (!ctx || !["pending", "partially_signed"].includes(ctx.pdf.status)) return;
      if (["signed", "declined"].includes(ctx.recipient.status)) return;
      if (isTest(ctx.pdf)) return;

      if (usesMessaging(ctx.recipient)) {
        await message(ctx, "reminder", {
          sender: ctx.sender.name || ctx.sender.email,
          document: ctx.pdf.originalFileName,
          link: signingLink(ctx.recipient),
        }, job);
      } else {
        await sendReminderEmail({ ...ctx, customMessage, ...(await lookOf(ctx.pdf)) });
      }
      await setDelivery(recipientId, "sent");
    },
    { onFailed: markUndelivered }
  );

  registerJobHandler("email.completion", async ({ recipientId }, job) => {
    const ctx = await loadRecipientContext(recipientId);
    if (!ctx || isTest(ctx.pdf)) return;

    // Each party downloads through their own signing link; no file link is ever sent
    if (usesMessaging(ctx.recipient)) {
      await message(ctx, "completed", {
        document: ctx.pdf.originalFileName,
        link: signingLink(ctx.recipient),
      }, job);
      return;
    }

    await sendCompletionEmail({
      recipientEmail: ctx.recipient.email,
      pdf: ctx.pdf,
      downloadUrl: signingLink(ctx.recipient),
      language: ctx.recipient.language,
      ...(await lookOf(ctx.pdf)),
    });
  });

  registerJobHandler("email.completion_owner", async ({ pdfId }) => {
    const pdf = await Pdf.findById(pdfId);
    const owner = pdf && (await User.findById(pdf.userId));
    if (!owner) return;

    await sendCompletionEmail({
      recipientEmail: owner.email,
      pdf,
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

  registerJobHandler("email.cancellation", async ({ recipientId, eventType, reason }, job) => {
    const ctx = await loadRecipientContext(recipientId);
    if (!ctx || isTest(ctx.pdf)) return;

    if (usesMessaging(ctx.recipient)) {
      await message(ctx, "cancelled", { document: ctx.pdf.originalFileName }, job);
      return;
    }

    await sendCancellationNotificationEmail({
      recipientEmail: ctx.recipient.email,
      recipientName: ctx.recipient.name,
      pdf: ctx.pdf,
      eventType,
      reason,
      language: ctx.recipient.language,
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
