import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { createRecipientsForDoc } from "./recipient.service.js";
import { sendSigningRequestEmail } from "./email.service.js";

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
  const normalizedFields = fieldsData.map((f) => {
    const matchedRecipient = recipients.find(
      (r) =>
        (f.recipientEmail && r.email.toLowerCase() === f.recipientEmail.toLowerCase()) ||
        (f.roleId && (r.role === f.roleId || r.role === f.roleName)) ||
        (f.recipientName && r.name.toLowerCase() === f.recipientName.toLowerCase())
    );

    return {
      ...f,
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

  return { success: true };
};
