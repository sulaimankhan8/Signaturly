import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { signPdf } from "./pdfSign.service.js";
import { eventBus, EventTypes } from "../events/index.js";
import { notifyUserDocumentUpdate } from "./sse.service.js";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { randomToken } from "../utils/tokens.js";
import { withDocumentLock } from "./documentLock.service.js";
import { sealDocument } from "./pdfSeal.service.js";
import { normalizePhone, isMessagingAvailable } from "./messaging/index.js";
import { normalizeLanguage } from "../i18n/messages.js";
import { enqueueJob } from "../jobs/queue.js";

const RECIPIENT_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#ef4444", // Red
];

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONSENT_VERSION = "esign-consent-1.0";

export const newTokenExpiry = () => new Date(Date.now() + env.signingLinkTtlDays * DAY_MS);

export const createRecipientsForDoc = async ({ pdfId, recipientsData }) => {
  if (!recipientsData || !Array.isArray(recipientsData) || recipientsData.length === 0) {
    throw new ApiError(400, "At least one recipient is required");
  }

  // Validate everything before touching stored recipients
  const prepared = [];
  for (let i = 0; i < recipientsData.length; i++) {
    const r = recipientsData[i] || {};
    if (typeof r.name !== "string" || !r.name.trim()) {
      throw new ApiError(400, "Every recipient needs a name");
    }

    const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    const phone = r.phone ? normalizePhone(String(r.phone)) : "";
    const channel = ["sms", "whatsapp"].includes(r.channel) ? r.channel : "email";

    if (email && !email.includes("@")) {
      throw new ApiError(400, `"${r.email}" is not a valid email address`);
    }
    if (r.phone && !phone) {
      throw new ApiError(400, `"${r.phone}" is not a valid mobile number`);
    }
    if (channel === "email" && !email) {
      throw new ApiError(400, "Recipient name and a valid email are required");
    }
    if (channel !== "email") {
      if (!phone) throw new ApiError(400, "A mobile number is required to send by SMS or WhatsApp");
      if (!isMessagingAvailable()) {
        throw new ApiError(503, "MESSAGING_UNAVAILABLE: SMS and WhatsApp delivery are not set up yet.");
      }
    }

    const authType = ["otp", "passcode"].includes(r.authType) ? r.authType : "none";
    let passcodeHash = null;
    if (authType === "passcode") {
      if (typeof r.passcode !== "string" || r.passcode.trim().length < 4) {
        throw new ApiError(400, "A passcode of at least 4 characters is required for passcode-protected signers");
      }
      passcodeHash = await bcrypt.hash(r.passcode.trim(), 10);
    }

    prepared.push({
      pdfId,
      name: r.name.trim(),
      email,
      phone: phone || "",
      channel,
      language: normalizeLanguage(r.language),
      role: ["signer", "viewer", "approver"].includes(r.role) ? r.role : "signer",
      signingOrder: Number.isInteger(r.signingOrder) && r.signingOrder > 0 ? r.signingOrder : i + 1,
      token: randomToken(),
      tokenExpiresAt: newTokenExpiry(),
      color: typeof r.color === "string" ? r.color : RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
      status: "pending",
      authType,
      passcodeHash,
      authVerified: authType === "none",
      authMethod: channel === "email" ? "email_link" : "message_link",
    });
  }

  await Recipient.deleteMany({ pdfId });
  return await Recipient.create(prepared);
};

export const getRecipientByToken = async (token) => {
  if (typeof token !== "string" || !token) {
    throw new ApiError(404, "Invalid or expired signing link");
  }

  const recipient = await Recipient.findOne({ token }).populate("pdfId");
  if (!recipient) {
    throw new ApiError(404, "Invalid or expired signing link");
  }

  const pdf = recipient.pdfId;
  if (!pdf) {
    throw new ApiError(404, "Associated document not found");
  }

  if (recipient.tokenExpiresAt && new Date() > recipient.tokenExpiresAt) {
    throw new ApiError(410, "This signing link has expired. Please ask the sender for a new one.");
  }

  if (pdf.deletedAt) {
    throw new ApiError(410, "This document is no longer available");
  }

  if (pdf.status === "voided") {
    throw new ApiError(410, "This document has been voided by the sender");
  }

  const stillOpen = ["pending", "partially_signed"].includes(pdf.status);
  if (stillOpen && pdf.expiresAt && new Date() > new Date(pdf.expiresAt)) {
    pdf.status = "expired";
    await pdf.save();
  }
  if (pdf.status === "expired") {
    throw new ApiError(410, "This document has expired and can no longer be signed");
  }

  return { recipient, pdf };
};

export const isRecipientVerified = (recipient) =>
  !recipient.authType || recipient.authType === "none" || recipient.authVerified === true;

// The identity check the sender asked for must have been passed on the server, not just in the browser
export const assertRecipientVerified = (recipient) => {
  if (!isRecipientVerified(recipient)) {
    throw new ApiError(403, "VERIFICATION_REQUIRED: Please complete identity verification before continuing.");
  }
};

const assertCanAct = async (recipient, pdf, action) => {
  if (recipient.role === "viewer") {
    throw new ApiError(403, "Viewers cannot sign or decline this document");
  }
  if (recipient.status === "signed") {
    throw new ApiError(409, action === "decline" ? "Signed documents cannot be declined" : "You have already signed this document");
  }
  if (recipient.status === "declined") {
    throw new ApiError(409, "You have already declined this document");
  }
  if (!["pending", "partially_signed"].includes(pdf.status)) {
    throw new ApiError(409, `This document is ${pdf.status} and can no longer be changed`);
  }

  if (pdf.signingOrder) {
    const next = await Recipient.findOne({
      pdfId: pdf._id,
      role: { $ne: "viewer" },
      status: { $ne: "signed" },
    }).sort({ signingOrder: 1 });

    if (next && next.signingOrder < recipient.signingOrder) {
      throw new ApiError(409, "It is not your turn to sign yet. You will be notified when the earlier signers are done.");
    }
  }
};

export const recordRecipientView = async ({ token, ipAddress, userAgent }) => {
  const { recipient, pdf } = await getRecipientByToken(token);

  if (recipient.status === "pending" || recipient.status === "sent") {
    recipient.status = "viewed";
    recipient.viewedAt = new Date();
    recipient.ipAddress = ipAddress;
    recipient.userAgent = userAgent;
    await recipient.save();

    // Emit event
    await eventBus.emitEvent(EventTypes.RECIPIENT_VIEWED, {
      aggregateId: pdf._id,
      actor: {
        id: recipient._id,
        name: recipient.name,
        email: recipient.email,
        ipAddress,
        userAgent,
      },
      payload: {
        recipientId: recipient._id,
        pdfId: pdf._id,
      },
    });

    notifyUserDocumentUpdate(pdf.userId, {
      pdfId: pdf._id,
      event: "viewed",
      recipientName: recipient.name,
      recipientEmail: recipient.email,
    });
  }

  return { recipient, pdf };
};

const isFilled = (field) => {
  if (field.type === "signature" || field.type === "initials") {
    return Boolean(field.signatureUrl || field.value);
  }
  if (field.type === "text") {
    return typeof field.value === "string" && field.value.trim() !== "";
  }
  // Dates default to the signing date; checkboxes and radios may legitimately stay empty
  return true;
};

export const submitRecipientSignature = async ({
  token,
  filledFields,
  consent,
  consentVersion,
  ipAddress,
  userAgent,
}) => {
  if (consent !== true) {
    throw new ApiError(422, "You must agree to sign electronically before completing");
  }

  const first = await getRecipientByToken(token);

  const outcome = await withDocumentLock(first.pdf._id, async () => {
    // Re-read inside the lock: an earlier signer may have just changed the document
    const { recipient, pdf } = await getRecipientByToken(token);

    assertRecipientVerified(recipient);
    await assertCanAct(recipient, pdf, "sign");

    const rId = recipient._id.toString();
    const submitted = new Map(
      (Array.isArray(filledFields) ? filledFields : [])
        .filter((f) => f && typeof f.id === "string")
        .map((f) => [f.id, f])
    );

    // 1. Merge submitted values into this signer's own fields. Ownership is by recipient id only.
    const signedAt = new Date();
    const updatedPdfFields = (pdf.fields || []).map((dbField) => {
      const isMine = dbField.recipientId && dbField.recipientId.toString() === rId;
      if (!isMine) return dbField;

      const incoming = submitted.get(dbField.id);
      if (!incoming) return dbField;

      const isImageField = dbField.type === "signature" || dbField.type === "initials";
      const value =
        typeof incoming.value === "string" || typeof incoming.value === "boolean" ? incoming.value : dbField.value;
      const signatureUrl = isImageField
        ? (typeof incoming.signatureUrl === "string" && incoming.signatureUrl) ||
          (typeof incoming.value === "string" && incoming.value) ||
          dbField.signatureUrl
        : dbField.signatureUrl;

      return {
        ...dbField,
        value,
        signatureUrl,
        checked: typeof incoming.checked === "boolean" ? incoming.checked : dbField.checked,
        signedAt,
        signedBy: rId,
      };
    });

    const myFields = updatedPdfFields.filter((f) => f.recipientId && f.recipientId.toString() === rId);

    const missing = myFields.filter((f) => f.required !== false && !isFilled(f));
    if (missing.length > 0) {
      throw new ApiError(
        422,
        `Please complete all required fields (${missing.length} remaining)`,
        missing.map((f) => ({ field: f.id, message: "Required" }))
      );
    }

    const remaining = await Recipient.countDocuments({
      pdfId: pdf._id,
      _id: { $ne: recipient._id },
      role: { $ne: "viewer" },
      status: { $ne: "signed" },
    });
    const isFinal = remaining === 0;

    // 2. Stamp the PDF first. If this throws, nothing below runs and the signer stays unsigned.
    await signPdf({
      pdfId: pdf._id,
      userId: pdf.userId,
      recipientId: recipient._id,
      actorName: recipient.name,
      actorEmail: recipient.email,
      fields: myFields,
      ipAddress,
      userAgent,
      consentVersion: consentVersion || CONSENT_VERSION,
      isFinalCompletion: isFinal,
    });

    // 3. Only now record the signature and the consent that came with it
    recipient.status = "signed";
    recipient.signedAt = signedAt;
    recipient.ipAddress = ipAddress;
    recipient.userAgent = userAgent;
    recipient.consent = {
      accepted: true,
      version: consentVersion || CONSENT_VERSION,
      acceptedAt: signedAt,
      ipAddress,
      userAgent,
    };
    await recipient.save();

    pdf.fields = updatedPdfFields;
    pdf.markModified("fields");
    pdf.status = isFinal ? "signed" : "partially_signed";
    await pdf.save();

    if (isFinal) {
      // Completed copies stay downloadable from every signer's link for a further period
      await Recipient.updateMany({ pdfId: pdf._id }, { $set: { tokenExpiresAt: newTokenExpiry() } });

      // Attach the signing record and seal the file. The signature above already stands, so a
      // sealing failure is logged and retried in the background rather than failing the signer.
      try {
        await sealDocument(pdf._id);
      } catch (err) {
        console.error("Sealing failed, will retry:", err.message);
        await enqueueJob("document.seal", { pdfId: pdf._id.toString() }, { idempotencyKey: `seal:${pdf._id}` });
      }
    }

    return { recipient, pdf, isFinal };
  });

  const { recipient, pdf, isFinal } = outcome;

  // Emit DOCUMENT_SIGNED event for this recipient
  await eventBus.emitEvent(EventTypes.DOCUMENT_SIGNED, {
    aggregateId: pdf._id,
    actor: {
      id: recipient._id,
      name: recipient.name,
      email: recipient.email,
      ipAddress,
      userAgent,
    },
    payload: {
      recipientId: recipient._id,
      pdfId: pdf._id,
      isFinal,
    },
  });

  // 4. Sequential workflow trigger or complete notification
  if (isFinal) {
    const allRecipients = await Recipient.find({ pdfId: pdf._id });

    // Emit completed event
    await eventBus.emitEvent(EventTypes.DOCUMENT_COMPLETED, {
      aggregateId: pdf._id,
      actor: {
        id: recipient._id,
        name: recipient.name,
        email: recipient.email,
        ipAddress,
        userAgent,
      },
      payload: {
        pdf,
        recipients: allRecipients,
      },
    });
  } else if (pdf.signingOrder) {
    // If sequential, dispatch email to the NEXT signer in order
    const nextRecipient = await Recipient.findOne({
      pdfId: pdf._id,
      role: { $ne: "viewer" },
      status: "pending",
    }).sort({ signingOrder: 1 });

    if (nextRecipient) {
      nextRecipient.status = "sent";
      await nextRecipient.save();

      const populatedPdf = await Pdf.findById(pdf._id).populate("userId");
      await eventBus.emitEvent(EventTypes.DOCUMENT_SENT, {
        aggregateId: pdf._id,
        actor: {
          id: populatedPdf.userId?._id,
          name: populatedPdf.userId?.name || "Sender",
          email: populatedPdf.userId?.email || "",
          ipAddress,
          userAgent,
        },
        payload: {
          pdf,
          recipients: [nextRecipient],
          sender: populatedPdf.userId,
          customMessage: pdf.message,
        },
      });
    }
  }

  notifyUserDocumentUpdate(pdf.userId, {
    pdfId: pdf._id,
    event: isFinal ? "completed" : "signed",
    recipientName: recipient.name,
    recipientEmail: recipient.email,
    status: isFinal ? "signed" : "partially_signed",
  });

  return { success: true, isFinal };
};

export const declineRecipientSignature = async ({
  token,
  reason,
  ipAddress,
  userAgent,
}) => {
  const { recipient, pdf } = await getRecipientByToken(token);

  assertRecipientVerified(recipient);
  await assertCanAct(recipient, pdf, "decline");

  recipient.status = "declined";
  recipient.declineReason = reason || "Declined by signer";
  recipient.ipAddress = ipAddress;
  recipient.userAgent = userAgent;
  await recipient.save();

  pdf.status = "declined";
  pdf.declinedBy = recipient._id;
  pdf.declineReason = reason;
  await pdf.save();

  const populatedPdf = await Pdf.findById(pdf._id).populate("userId");
  const priorSigners = await Recipient.find({
    pdfId: pdf._id,
    _id: { $ne: recipient._id },
    status: "signed",
  });

  // Emit decline event
  await eventBus.emitEvent(EventTypes.DOCUMENT_DECLINED, {
    aggregateId: pdf._id,
    actor: {
      id: recipient._id,
      name: recipient.name,
      email: recipient.email,
      ipAddress,
      userAgent,
    },
    payload: {
      pdf,
      declinedRecipient: recipient,
      senderEmail: populatedPdf.userId?.email,
      reason,
      priorSigners,
    },
  });

  notifyUserDocumentUpdate(pdf.userId, {
    pdfId: pdf._id,
    event: "declined",
    recipientName: recipient.name,
    recipientEmail: recipient.email,
    status: "declined",
  });

  return { success: true };
};

export const updateRecipientEmailService = async ({
  recipientId,
  userId,
  newEmail,
  ipAddress = "",
  userAgent = "",
}) => {
  if (typeof newEmail !== "string" || !newEmail.includes("@")) {
    throw new ApiError(400, "Valid email address is required");
  }

  const cleanEmail = newEmail.trim().toLowerCase();
  const recipient = await Recipient.findById(recipientId);
  if (!recipient) throw new ApiError(404, "Recipient not found");

  if (recipient.status === "signed") {
    throw new ApiError(400, "Cannot change email for a recipient who has already signed");
  }

  const pdf = await Pdf.findById(recipient.pdfId);
  if (!pdf) throw new ApiError(404, "Document not found");

  if (pdf.userId.toString() !== userId?.toString()) {
    throw new ApiError(403, "Unauthorized to modify this document's recipients");
  }

  if (["signed", "declined", "voided", "expired"].includes(pdf.status)) {
    throw new ApiError(400, `Cannot update recipient for a document with status: ${pdf.status}`);
  }

  const oldEmail = recipient.email;
  recipient.email = cleanEmail;
  // A new address gets a new link and must pass the identity check again
  recipient.token = randomToken();
  recipient.tokenExpiresAt = newTokenExpiry();
  recipient.authVerified = recipient.authType === "none";
  recipient.authVerifiedAt = undefined;
  recipient.channel = "email";
  recipient.authMethod = "email_link";
  recipient.status = "sent";
  await recipient.save();

  if (Array.isArray(pdf.fields)) {
    pdf.fields = pdf.fields.map((f) => {
      if (f.recipientId?.toString() === recipient._id.toString()) {
        return { ...f, recipientEmail: cleanEmail };
      }
      return f;
    });
    pdf.markModified("fields");
    await pdf.save();
  }

  const sender = await User.findById(userId);

  // Emit event
  await eventBus.emitEvent(EventTypes.RECIPIENT_EMAIL_UPDATED, {
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
      recipient,
      sender,
      oldEmail,
      newEmail: cleanEmail,
    },
  });

  return {
    success: true,
    recipientId: recipient._id,
    newEmail: recipient.email,
  };
};
