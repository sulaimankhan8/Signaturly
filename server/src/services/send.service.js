import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { createRecipientsForDoc } from "./recipient.service.js";
import { sendSigningRequestEmail, sendCancellationNotificationEmail } from "./email.service.js";
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
    // If rawField is a Mongoose document or has _doc / toObject, extract plain object
    const f = (rawField && typeof rawField.toObject === "function")
      ? rawField.toObject()
      : (rawField && rawField._doc ? { ...rawField._doc } : { ...rawField });

    let matchedRecipient = null;

    // a) Try matching by email (most reliable — used in manual send flow)
    if (!matchedRecipient && f.recipientEmail) {
      matchedRecipient = recipients.find(
        (r) => r.email.toLowerCase() === f.recipientEmail.toLowerCase()
      );
    }

    // b) Try matching by name
    if (!matchedRecipient && f.recipientName) {
      matchedRecipient = recipients.find(
        (r) => r.name.toLowerCase() === f.recipientName.toLowerCase()
      );
    }

    // c) Try matching by roleId → signingOrder (template flow)
    if (!matchedRecipient && f.roleId) {
      const roleNum = parseInt(String(f.roleId).replace(/\D/g, ""), 10);
      if (!isNaN(roleNum)) {
        matchedRecipient = recipients.find(
          (r) => r.signingOrder === roleNum
        );
      }
      // Fallback: try matching roleName against recipient name
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

  // 4. Dispatch emails
  if (signingOrder) {
    // Sequential: send to first signer only
    const firstSigner = recipients.sort((a, b) => a.signingOrder - b.signingOrder)[0];
    firstSigner.status = "sent";
    await firstSigner.save();

    await sendSigningRequestEmail({
      recipient: firstSigner,
      pdf,
      sender,
      customMessage: message,
    });
  } else {
    // Parallel: send to all signers simultaneously
    for (const recipient of recipients) {
      recipient.status = "sent";
      await recipient.save();

      await sendSigningRequestEmail({
        recipient,
        pdf,
        sender,
        customMessage: message,
      });
    }
  }

  // 5. Log audit event
  await PdfAudit.create({
    pdfId,
    userId,
    event: "sent",
    actorName: sender.name,
    actorEmail: sender.email,
    description: `Document dispatched for legal e-signature to ${recipients.length} recipient(s).`,
    ipAddress,
    userAgent,
    signedAt: new Date(),
  });

  // 6. Push real-time SSE update to the sender's dashboard
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
  await PdfAudit.create({
    pdfId,
    userId,
    event: "voided",
    actorName: user?.name,
    actorEmail: user?.email,
    description: "Document was voided and cancelled by the sender.",
    ipAddress,
    userAgent,
    signedAt: new Date(),
  });

  // Notify all recipients (prior signers & invited recipients) that the agreement is voided
  const allRecipients = await Recipient.find({ pdfId: pdf._id });
  for (const recipient of allRecipients) {
    sendCancellationNotificationEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      pdf,
      eventType: "voided",
      reason: "Document was voided and cancelled by the sender.",
    }).catch(console.error);
  }

  // Push real-time SSE update
  notifyUserDocumentUpdate(userId, {
    pdfId: pdf._id.toString(),
    event: "voided",
    status: "voided",
  });

  return { success: true };
};
