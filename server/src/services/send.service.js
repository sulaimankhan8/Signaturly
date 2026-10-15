import { assertRecordAccess } from "./authorize.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { createRecipientsForDoc } from "./recipient.service.js";
import { eventBus, EventTypes } from "../events/index.js";
import { notifyUserDocumentUpdate } from "./sse.service.js";
import { normalizePhone } from "./messaging/index.js";
import { prepareAadhaarSigners } from "./esign/esign.service.js";
import { normalizeFieldList } from "./fieldRules.service.js";
import { billingUserIdOf } from "./branding.service.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { tierOf } from "./entitlements.service.js";

// How often signers can be reminded automatically
export const REMINDER_CADENCES = ["none", "daily", "3days", "5days"];

export const sendDocumentToRecipients = async ({
  pdfId,
  userId,
  recipientsData,
  fieldsData = [],
  message = "",
  expiresAt = null,
  signingOrder = false,
  emailSubject = "",
  reminderCadence = "none",
  ipAddress = "",
  userAgent = "",
}) => {
  const pdf = await Pdf.findOne({ _id: String(pdfId), deletedAt: null });
  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  await assertRecordAccess(pdf, userId, "document.send");

  // A document already out for signature must be voided, not silently re-sent with new signers
  const alreadySent = (pdf.recipients || []).length > 0 || !["draft", "uploaded", "signed"].includes(pdf.status);
  if (alreadySent) {
    throw new ApiError(409, "This document has already been sent. Void it or upload a new copy to send again.");
  }

  if (expiresAt && (isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt) <= new Date())) {
    throw new ApiError(400, "The signing deadline must be a future date");
  }

  // A subject line of the sender's own and automatic reminders come with the paid plans
  const subject = typeof emailSubject === "string" ? emailSubject.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const cadence = REMINDER_CADENCES.includes(reminderCadence) ? reminderCadence : "none";
  if (subject || cadence !== "none") {
    const subscription = await getOrCreateSubscription(await billingUserIdOf(pdf));
    if ((tierOf(subscription) || "free") === "free") {
      throw new ApiError(403, "UPGRADE_REQUIRED: Your own email subject and automatic reminders are on the Pro plan and above.");
    }
  }

  const sender = await User.findById(userId);

  // Where anyone signs with Aadhaar eSign, those signers go last and the document is signed
  // in order. This also checks that Aadhaar eSign is available and can be paid for.
  const aadhaar = await prepareAadhaarSigners({ pdf, recipientsData });
  recipientsData = aadhaar.recipientsData;
  if (aadhaar.count > 0) signingOrder = true;

  // 1. Check the fields and work out whose each one is before anything is stored
  const layout = normalizeFieldList(fieldsData, { pageCount: pdf.pageCount, values: "layout" });
  const ownerIndex = matchFieldsToRecipients(layout, recipientsData);

  // 2. Create recipient records, in the order they were given
  const recipients = await createRecipientsForDoc({
    pdfId,
    recipientsData,
  });

  const normalizedFields = layout.map((field, i) => {
    const owner = recipients[ownerIndex[i]];
    // Names the caller used to find the owner are replaced by the owner's own record
    const { roleColor, recipientPhone, ...rest } = field;
    return {
      ...rest,
      recipientId: owner._id.toString(),
      recipientEmail: owner.email,
      recipientName: owner.name,
      recipientColor: owner.color,
    };
  });

  // 3. Update PDF metadata
  pdf.recipients = recipients.map((r) => r._id);
  pdf.fields = normalizedFields;
  pdf.message = message;
  pdf.emailSubject = subject;
  pdf.reminderCadence = cadence;
  pdf.expiresAt = expiresAt ? new Date(expiresAt) : null;
  pdf.signingOrder = Boolean(signingOrder);
  pdf.status = "pending";
  // The editor's working copy has been sent; nothing is left to restore
  pdf.draft = null;
  await pdf.save();

  // 4. Mark active recipient statuses
  let activeRecipientsToNotify = [];
  if (signingOrder) {
    const firstSigner = recipients.sort((a, b) => a.signingOrder - b.signingOrder)[0];
    firstSigner.status = "sent";
    await firstSigner.save();
    activeRecipientsToNotify = [firstSigner];
  } else {
    for (const recipient of recipients) {
      recipient.status = "sent";
      await recipient.save();
    }
    activeRecipientsToNotify = recipients;
  }

  // 5. Emit Event-Driven Architecture signal (handled asynchronously by Email & Audit consumers)
  await eventBus.emitEvent(EventTypes.DOCUMENT_SENT, {
    aggregateId: pdf._id,
    actor: {
      id: sender?._id,
      name: sender?.name || "Sender",
      email: sender?.email || "",
      ipAddress,
      userAgent,
    },
    payload: {
      pdf,
      recipients: activeRecipientsToNotify,
      sender,
      customMessage: message,
      recipientsCount: recipients.length,
    },
  });

  // 6. Push real-time SSE / state update
  notifyUserDocumentUpdate(userId, {
    pdfId: pdf._id.toString(),
    event: "sent",
    status: pdf.status,
  });

  // A sender who is also a signer, and whose turn it is now, can sign straight away from the app
  const senderEmail = (sender?.email || "").toLowerCase();
  const senderSigner = senderEmail
    ? activeRecipientsToNotify.find((r) => r.role !== "viewer" && r.email && r.email === senderEmail)
    : null;

  return {
    pdfId: pdf._id,
    status: pdf.status,
    recipientsCount: recipients.length,
    signingOrder: pdf.signingOrder,
    signNowToken: senderSigner ? senderSigner.token : null,
  };
};

/**
 * Finds, for each field, the index of the recipient it belongs to. A field names its owner by:
 *   recipientId  the id the editor gave the recipient before sending
 *   roleId       the template role the recipient fills
 *   recipientEmail / recipientPhone, or a recipientName that only one recipient has (the API)
 * A field that matches nobody, or belongs to someone who only views, is refused rather than
 * handed to another signer.
 */
export const matchFieldsToRecipients = (fields, recipientsData) => {
  const list = Array.isArray(recipientsData) ? recipientsData : [];
  const lower = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

  const indexWhere = (test) => list.findIndex((r) => r && test(r));
  const onlyIndexWhere = (test) => {
    const matches = list.map((r, i) => (r && test(r) ? i : -1)).filter((i) => i >= 0);
    return matches.length === 1 ? matches[0] : -1;
  };

  return fields.map((field) => {
    let index = -1;

    if (field.recipientId) index = indexWhere((r) => r.id != null && String(r.id) === field.recipientId);
    if (index < 0 && field.roleId) index = indexWhere((r) => r.roleId != null && String(r.roleId) === field.roleId);
    if (index < 0 && field.recipientEmail) index = indexWhere((r) => lower(r.email) === lower(field.recipientEmail));
    if (index < 0 && field.recipientPhone) {
      const phone = normalizePhone(field.recipientPhone);
      index = indexWhere((r) => r.phone && normalizePhone(String(r.phone)) === phone);
    }
    if (index < 0 && field.recipientName) index = onlyIndexWhere((r) => lower(r.name) === lower(field.recipientName));

    if (index < 0) {
      throw new ApiError(400, `The ${field.type} field on page ${field.page} is not assigned to any recipient`);
    }
    if (list[index].role === "viewer") {
      throw new ApiError(400, `${list[index].name || "A viewer"} only views the document and cannot be given fields`);
    }
    return index;
  });
};

export const voidDocument = async ({ pdfId, userId, ipAddress, userAgent }) => {
  const pdf = await Pdf.findOne({ _id: String(pdfId), deletedAt: null });
  if (!pdf) throw new ApiError(404, "Document not found");
  await assertRecordAccess(pdf, userId, "document.void");

  if (!["pending", "partially_signed"].includes(pdf.status)) {
    throw new ApiError(409, `A document that is ${pdf.status} cannot be voided`);
  }

  pdf.status = "voided";
  await pdf.save();

  const user = await User.findById(userId);
  const allRecipients = await Recipient.find({ pdfId: pdf._id });

  // Emit Event-Driven Architecture signal
  await eventBus.emitEvent(EventTypes.DOCUMENT_VOIDED, {
    aggregateId: pdf._id,
    actor: {
      id: user?._id,
      name: user?.name || "Sender",
      email: user?.email || "",
      ipAddress,
      userAgent,
    },
    payload: {
      pdf,
      recipients: allRecipients,
      reason: "Document was voided and cancelled by the sender.",
    },
  });

  // Push real-time SSE / state update
  notifyUserDocumentUpdate(userId, {
    pdfId: pdf._id.toString(),
    event: "voided",
    status: "voided",
  });

  return { success: true };
};
