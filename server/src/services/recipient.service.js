import { v4 as uuidv4 } from "uuid";
import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sendSigningRequestEmail, sendCompletionEmail, sendDeclineEmail } from "./email.service.js";
import { signPdf } from "./pdfSign.service.js";
import path from "path";

const RECIPIENT_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#ef4444", // Red
];

export const createRecipientsForDoc = async ({ pdfId, recipientsData }) => {
  if (!recipientsData || !Array.isArray(recipientsData) || recipientsData.length === 0) {
    throw new ApiError(400, "At least one recipient is required");
  }

  // Remove existing recipients for fresh submission
  await Recipient.deleteMany({ pdfId });

  const recipients = [];
  for (let i = 0; i < recipientsData.length; i++) {
    const r = recipientsData[i];
    if (!r.name || !r.email) {
      throw new ApiError(400, "Recipient name and email are required");
    }

    const token = uuidv4();
    const color = r.color || RECIPIENT_COLORS[i % RECIPIENT_COLORS.length];

    const recipient = await Recipient.create({
      pdfId,
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      role: r.role || "signer",
      signingOrder: r.signingOrder || i + 1,
      token,
      color,
      status: "pending",
    });

    recipients.push(recipient);
  }

  return recipients;
};

export const getRecipientByToken = async (token) => {
  const recipient = await Recipient.findOne({ token }).populate("pdfId");
  if (!recipient) {
    throw new ApiError(404, "Invalid or expired signing link");
  }

  const pdf = recipient.pdfId;
  if (!pdf) {
    throw new ApiError(404, "Associated document not found");
  }

  if (pdf.expiresAt && new Date() > new Date(pdf.expiresAt)) {
    pdf.status = "expired";
    await pdf.save();
    throw new ApiError(410, "This document has expired and can no longer be signed");
  }

  if (pdf.status === "voided") {
    throw new ApiError(410, "This document has been voided by the sender");
  }

  return { recipient, pdf };
};

export const recordRecipientView = async ({ token, ipAddress, userAgent }) => {
  const { recipient, pdf } = await getRecipientByToken(token);

  if (recipient.status === "pending" || recipient.status === "sent") {
    recipient.status = "viewed";
    recipient.viewedAt = new Date();
    recipient.ipAddress = ipAddress;
    recipient.userAgent = userAgent;
    await recipient.save();

    await PdfAudit.create({
      pdfId: pdf._id,
      recipientId: recipient._id,
      event: "viewed",
      actorName: recipient.name,
      actorEmail: recipient.email,
      description: `${recipient.name} opened and viewed the document.`,
      ipAddress,
      userAgent,
      signedAt: new Date(),
    });
  }

  return { recipient, pdf };
};

export const submitRecipientSignature = async ({
  token,
  filledFields,
  ipAddress,
  userAgent,
}) => {
  const { recipient, pdf } = await getRecipientByToken(token);

  if (recipient.status === "signed") {
    throw new ApiError(400, "You have already signed this document");
  }

  // 1. Mark recipient as signed
  recipient.status = "signed";
  recipient.signedAt = new Date();
  recipient.ipAddress = ipAddress;
  recipient.userAgent = userAgent;
  await recipient.save();

  // 2. Burn this recipient's filled fields into the PDF
  const remainingRecipients = await Recipient.find({
    pdfId: pdf._id,
    status: { $ne: "signed" },
  });

  const isFinal = remainingRecipients.length === 0;

  await signPdf({
    pdfId: pdf._id,
    recipientId: recipient._id,
    actorName: recipient.name,
    actorEmail: recipient.email,
    fields: filledFields || [],
    ipAddress,
    userAgent,
    isFinalCompletion: isFinal,
  });

  // 3. Sequential workflow trigger or complete notification
  if (isFinal) {
    pdf.status = "signed";
    await pdf.save();

    // Notify sender & all signers that document is completed
    const allRecipients = await Recipient.find({ pdfId: pdf._id });
    const signedFileName = path.basename(pdf.storagePath).replace(/\.pdf$/i, "-signed.pdf");
    const downloadUrl = `/uploads/${pdf.userId}/${signedFileName}`;

    for (const r of allRecipients) {
      sendCompletionEmail({
        recipientEmail: r.email,
        recipientName: r.name,
        pdf,
        senderName: "Signaturly Pro Vault",
        downloadUrl,
      }).catch(console.error);
    }
  } else if (pdf.signingOrder) {
    // If sequential, dispatch email to the NEXT signer in order
    const nextRecipient = await Recipient.findOne({
      pdfId: pdf._id,
      status: "pending",
    }).sort({ signingOrder: 1 });

    if (nextRecipient) {
      nextRecipient.status = "sent";
      await nextRecipient.save();

      const populatedPdf = await Pdf.findById(pdf._id).populate("userId");
      sendSigningRequestEmail({
        recipient: nextRecipient,
        pdf,
        sender: populatedPdf.userId,
        customMessage: pdf.message,
      }).catch(console.error);
    }
  }

  return { success: true, isFinal };
};

export const declineRecipientSignature = async ({
  token,
  reason,
  ipAddress,
  userAgent,
}) => {
  const { recipient, pdf } = await getRecipientByToken(token);

  if (recipient.status === "signed") {
    throw new ApiError(400, "Signed documents cannot be declined");
  }

  recipient.status = "declined";
  recipient.declineReason = reason || "Declined by signer";
  recipient.ipAddress = ipAddress;
  recipient.userAgent = userAgent;
  await recipient.save();

  pdf.status = "declined";
  pdf.declinedBy = recipient._id;
  pdf.declineReason = reason;
  await pdf.save();

  await PdfAudit.create({
    pdfId: pdf._id,
    recipientId: recipient._id,
    event: "declined",
    actorName: recipient.name,
    actorEmail: recipient.email,
    description: `${recipient.name} declined to sign the document: "${reason || 'No reason specified'}".`,
    ipAddress,
    userAgent,
    signedAt: new Date(),
  });

  const populatedPdf = await Pdf.findById(pdf._id).populate("userId");
  if (populatedPdf.userId?.email) {
    sendDeclineEmail({
      senderEmail: populatedPdf.userId.email,
      pdf,
      declinedRecipient: recipient,
      reason,
    }).catch(console.error);
  }

  return { success: true };
};
