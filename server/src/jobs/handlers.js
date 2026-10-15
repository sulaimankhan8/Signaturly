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
import { endLapsedSubscription } from "../services/autoRenew.service.js";
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
// Where a customer pays for their plan again: checkout for it with auto-renew, which takes the
// place of an automatic payment that failed (services/autoRenew.service.js)
const payAgainPath = (planId) => `/billing/checkout?plan=${encodeURIComponent(planId)}&renew=auto`;

const billingEmailFor = async ({ kind, userId, paymentId, daysLeft, threshold, plan: endedPlanId, cancelled }) => {
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
  if (kind === "renewal_failed" || kind === "grace_ending") {
    // Said only while it is still true: the payment may have gone through since this was queued
    if (!plan || sub.status !== "past_due") return null;
    const grace = sub.gracePeriodEnd ? formatDate(sub.gracePeriodEnd) : "";
    const last = kind === "grace_ending";
    return {
      subject: last ? `Your ${env.appName} ${planName} plan moves to Free tomorrow` : `We could not renew your ${env.appName} plan`,
      title: last ? "Your plan moves to Free tomorrow" : "Your renewal payment did not go through",
      lines: [
        last
          ? `The automatic payment for your ${planName} plan has still not gone through.`
          : `The automatic payment for your ${planName} plan could not be taken. Razorpay will try it again over the next few days.`,
        grace ? `Your plan stays as it is until ${grace}. If it is not paid by then, the account moves to the Free plan; your documents are kept.` : "Your plan stays on for a few days meanwhile.",
        "You can pay now with UPI, a card or a bank mandate. It takes the place of the payment that failed, so you are never charged twice.",
      ],
      facts: [["Plan", planName], ["Amount", each], ["Plan stays until", grace]],
      action: { path: payAgainPath(sub.plan), label: each ? `Pay ${each} now` : "Pay now" },
    };
  }
  if (kind === "renews_soon") {
    // Said only while it is still true: auto-renew may have been turned off since this was queued
    if (!plan || sub.plan === "free" || !sub.autoRenew || sub.cancelAtPeriodEnd || !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) <= new Date()) return null;
    return {
      subject: `Your ${env.appName} ${planName} plan renews on ${until}`,
      title: `Your plan renews on ${until}`,
      lines: [
        `Your ${planName} plan renews automatically on ${until}${each ? ` for ${each}` : ""}, from the UPI or card you approved. There is nothing you need to do.`,
        "Make sure that UPI account or card can pay that amount on the day. To stop the renewal, turn off auto-renew from your Billing page before then; you keep the time you have paid for, and nothing is refunded.",
      ],
      facts: [["Plan", planName], ["Renews on", until], ["Amount", each]],
    };
  }
  if (kind === "plan_lapsed") {
    const ended = isPlan(endedPlanId) ? PLANS[endedPlanId] : null;
    const endedName = ended?.name || "paid";
    // Back on a paid plan since this was queued: nothing to say
    if (sub?.plan && sub.plan !== "free") return null;
    return {
      subject: `Your ${env.appName} ${endedName} plan has ended`,
      title: `Your ${endedName} plan has ended`,
      lines: [
        cancelled
          ? `Your ${endedName} plan has reached the end of the time you paid for, and the account is now on the Free plan.`
          : `The payment for your ${endedName} plan did not go through, and the account is now on the Free plan. Nothing more will be charged.`,
        "Your documents and templates are kept. Team workspaces are read-only until a plan that includes them is back on.",
        "You can come back to a paid plan at any time from your Billing page.",
      ],
      facts: [],
      action: ended?.purchasable ? { path: payAgainPath(endedPlanId), label: `Get ${endedName} again` } : { path: "/billing/plans", label: "See plans" },
    };
  }
  if (kind === "mandate_ended") {
    return {
      subject: `Approve auto-renew again for your ${env.appName} plan`,
      title: "Your auto-pay approval has been used up",
      lines: [
        "The UPI or card approval you gave for auto-renew covered a set number of payments, and the last of them has been taken. Nothing more will be charged.",
        sub?.plan && sub.plan !== "free" && until ? `Your ${planName} plan stays as it is until ${until}. Approve auto-renew again to keep it without a break; nothing is charged before that date.` : "Approve auto-renew again from your Billing page to keep your plan renewing.",
      ],
      facts: [],
      action: sub?.plan && sub.plan !== "free" ? { path: payAgainPath(sub.plan), label: "Approve auto-renew" } : null,
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
  if (kind === "ending_soon") {
    // Said only while it is still true: auto-renew may have been turned on since this was queued
    if (!plan || sub.plan === "free" || sub.autoRenew || !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) <= new Date()) return null;
    const when = Number(daysLeft) <= 1 ? "tomorrow" : `in ${daysLeft} days`;
    const price = plan.priceInr ? rupees(plan.priceInr * (plan.perSeat ? sub.seats || 1 : 1)) : "";
    return {
      subject: `Your ${env.appName} ${planName} plan ends ${when}`,
      title: `Your ${planName} plan ends ${when}`,
      lines: [
        `Your ${planName} plan runs until ${until} and will not renew by itself.`,
        "Turn on auto-renew to keep it without a break. Nothing is charged until that date, and you can turn it off at any time.",
        "If you do nothing, the account moves to the Free plan on that date. Your documents are kept.",
      ],
      facts: [["Plan", planName], ["Runs until", until], ["Renews at", price ? `${price} a ${period}` : ""]],
      action: { path: `/billing/checkout?plan=${encodeURIComponent(sub.plan)}&renew=auto`, label: "Turn on auto-renew" },
    };
  }
  if (kind === "usage") {
    if (!sub || !(sub.monthlyQuota > 0)) return null;
    const all = Number(threshold) >= 100;
    const resets = sub.quotaResetDate ? formatDate(sub.quotaResetDate) : "";
    return {
      subject: all ? `You have used this month's ${env.appName} documents` : `You have used ${threshold}% of this month's documents`,
      title: all ? "This month's documents are used up" : `${threshold}% of this month's documents used`,
      lines: [
        `You have sent ${sub.usedThisMonth} of the ${sub.monthlyQuota} documents your ${planName === "your plan" ? "plan" : `${planName} plan`} includes this month.`,
        resets ? `Your allowance comes round again on ${resets}.` : "",
        sub.extraDocuments > 0
          ? `You have ${sub.extraDocuments} extra documents, which are used after the allowance.`
          : "To send more before then, buy extra documents with one payment (they never expire), or move to a bigger plan.",
      ].filter(Boolean),
      facts: [],
      action: { path: "/billing/add-ons", label: "Add documents" },
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

  // A plan that moved to Free after its payment never came: its subscription is ended at Razorpay
  registerJobHandler("billing.end_subscription", async ({ userId, subscriptionId }) => {
    await endLapsedSubscription({ userId, subscriptionId });
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
