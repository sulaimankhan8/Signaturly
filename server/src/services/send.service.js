import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { createRecipientsForDoc } from "./recipient.service.js";
import { eventBus, EventTypes } from "../events/index.js";
import { notifyUserDocumentUpdate } from "./sse.service.js";

export const sendDocumentToRecipients = async ({
  pdfId,
  userId,
  recipientsData,
  fieldsData = [],
  message = "",
  expiresAt = null,
  signingOrder = false,
  ipAddress = "",
  userAgent = "",
}) => {
  const pdf = await Pdf.findById(pdfId);
  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to send this document");
  }

  const sender = await User.findById(userId);

  // 1. Create recipient records
  const recipients = await createRecipientsForDoc({
    pdfId,
    recipientsData,
  });

  // 2. Link each field to the exact recipient._id
  const normalizedFields = fieldsData.map((rawField) => {
    const f = (rawField && typeof rawField.toObject === "function")
      ? rawField.toObject()
      : (rawField && rawField._doc ? { ...rawField._doc } : { ...rawField });

    let matchedRecipient = null;

    if (!matchedRecipient && f.recipientEmail) {
      matchedRecipient = recipients.find(
        (r) => r.email.toLowerCase() === f.recipientEmail.toLowerCase()
      );
    }

    if (!matchedRecipient && f.recipientName) {
      matchedRecipient = recipients.find(
        (r) => r.name.toLowerCase() === f.recipientName.toLowerCase()
      );
    }

    if (!matchedRecipient && f.roleId) {
      const roleNum = parseInt(String(f.roleId).replace(/\D/g, ""), 10);
      if (!isNaN(roleNum)) {
        matchedRecipient = recipients.find(
          (r) => r.signingOrder === roleNum
        );
      }
      if (!matchedRecipient && f.roleName) {
        matchedRecipient = recipients.find(
          (r) => r.name.toLowerCase() === f.roleName.toLowerCase()
        );
      }
    }

    return {
      id: f.id || f._id?.toString() || `field-${Math.random().toString(36).substr(2, 9)}`,
      type: f.type || "signature",
      page: Number(f.page) || 1,
      xPercent: Number(f.xPercent) || 0,
      yPercent: Number(f.yPercent) || 0,
      widthPercent: Number(f.widthPercent) || 0.2,
      heightPercent: Number(f.heightPercent) || 0.05,
      fontSizePercent: f.fontSizePercent ? Number(f.fontSizePercent) : undefined,
      label: f.label || "",
      required: f.required !== false,
      value: f.value || "",
      signatureUrl: f.signatureUrl || "",
      roleId: f.roleId || undefined,
      roleName: f.roleName || undefined,
      recipientId: matchedRecipient ? matchedRecipient._id.toString() : (f.recipientId || recipients[0]?._id?.toString()),
      recipientEmail: matchedRecipient ? matchedRecipient.email : (f.recipientEmail || recipients[0]?.email),
      recipientName: matchedRecipient ? matchedRecipient.name : (f.recipientName || recipients[0]?.name),
      recipientColor: matchedRecipient ? matchedRecipient.color : (f.recipientColor || "#3b82f6"),
    };
  });

  // 3. Update PDF metadata
  pdf.recipients = recipients.map((r) => r._id);
  pdf.fields = normalizedFields;
  pdf.message = message;
  pdf.expiresAt = expiresAt ? new Date(expiresAt) : null;
  pdf.signingOrder = Boolean(signingOrder);
  pdf.status = "pending";
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

  return {
    pdfId: pdf._id,
    status: pdf.status,
    recipientsCount: recipients.length,
    signingOrder: pdf.signingOrder,
  };
};

export const voidDocument = async ({ pdfId, userId, ipAddress, userAgent }) => {
  const pdf = await Pdf.findById(pdfId);
  if (!pdf) throw new ApiError(404, "Document not found");
  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Unauthorized");
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
