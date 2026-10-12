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
  sendBillingEmail,
  sendSalesEnquiryEmail,
} from "../services/email.service.js";
import { enquiryForEmail } from "../services/salesEnquiry.service.js";
import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { Invoice } from "../models/Invoice.model.js";
import { PLANS, isPlan } from "../config/plans.js";
import { formatDate } from "../utils/format.js";
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

const rupees = (amount) => `Rs. ${new Intl.NumberFormat("en-IN").format(amount)}`;

/**
 * What to tell a customer about their plan or a payment. Returns null when there is nothing
 * worth an email (the payment or the account is gone, or it was a payment that failed).
 */
const billingEmailFor = async ({ kind, userId, paymentId }) => {
  const sub = await Subscription.findOne({ userId }).lean();
  const plan = isPlan(sub?.plan) ? PLANS[sub.plan] : null;
  const planName = plan?.name || "your plan";
  const until = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "";
  const each = sub?.renewalAmountInr ? rupees(sub.renewalAmountInr) : "";
  const period = plan?.interval === "year" ? "year" : "month";

  if (kind === "payment") {
    const payment = paymentId ? await Payment.findById(paymentId).lean() : null;
    if (!payment || payment.kind === "failed" || !(payment.amount > 0)) return null;
    const invoice = await Invoice.findOne({ paymentId: payment._id }).select("number description").lean();
    const renewal = payment.kind === "renewal";
    return {
      subject: renewal ? `Your ${env.appName} plan was renewed` : `Payment received: ${rupees(payment.amount)}`,
      title: renewal ? "Your plan was renewed" : "Payment received",
      lines: [
        renewal ? `Your ${planName} plan was renewed automatically${until ? ` and now runs until ${until}` : ""}.` : "Thank you. We have received your payment and what you bought is on your account.",
        invoice ? "The invoice can be downloaded from your Billing page." : "",
      ].filter(Boolean),
      facts: [["For", invoice?.description], ["Amount", rupees(payment.amount)], ["Invoice", invoice?.number], ["Paid on", formatDate(payment.occurredAt || payment.createdAt)]],
    };
  }
  if (kind === "auto_renew_on") {
    return {
      subject: `Auto-renew is on for your ${env.appName} plan`,
      title: "Your plan now renews automatically",
      lines: [
        `Your ${planName} plan will renew by itself${until ? `, next on ${until}` : ""}${each ? `, for ${each} each ${period}` : ""}.`,
        "You can turn this off at any time from your Billing page, and keep the time you have paid for.",
      ],
      facts: [],
    };
  }
  if (kind === "renewal_failed") {
    const grace = sub?.gracePeriodEnd ? formatDate(sub.gracePeriodEnd) : "";
    return {
      subject: `We could not renew your ${env.appName} plan`,
      title: "Your renewal payment did not go through",
      lines: [
        `The automatic payment for your ${planName} plan could not be taken. It will be tried again.`,
        grace ? `Your plan stays as it is until ${grace}. If the payment has still not gone through by then, the account moves to the Free plan; your documents are kept.` : "Your plan stays on for a few days meanwhile.",
        "If your card or UPI approval has changed, turn auto-renew off and on again from your Billing page to approve a new one.",
      ],
      facts: [],
    };
  }
  if (kind === "auto_renew_off") {
    return {
      subject: `Auto-renew is off for your ${env.appName} plan`,
      title: "Your plan will not renew",
      lines: [
        "Auto-renew has been turned off and nothing more will be charged.",
        sub?.plan && sub.plan !== "free" && until ? `Your ${planName} plan stays as it is until ${until}, and then the account moves to the Free plan. Your documents are kept.` : "Your account is on the Free plan. Your documents are kept.",
        "You can turn auto-renew back on, or pay for a single period, from your Billing page.",
      ],
      facts: [],
    };
  }
  return null;
};

export const registerJobHandlers = () => {
  // Payments, renewals and changes to auto-renew, told to the account's owner
  // Sent on to whoever follows up sales, where an address for that is set
  registerJobHandler("email.sales_enquiry", async ({ enquiryId }) => {
    if (!env.salesEmail) return;
    const enquiry = await enquiryForEmail(enquiryId);
    if (enquiry) await sendSalesEnquiryEmail({ to: env.salesEmail, enquiry });
  });

  registerJobHandler("email.billing", async (payload) => {
    const user = await User.findById(payload.userId);
    if (!user || user.deletedAt || !user.email) return;
    const email = await billingEmailFor(payload);
    if (email) await sendBillingEmail({ email: user.email, name: user.name, ...email });
  });

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
