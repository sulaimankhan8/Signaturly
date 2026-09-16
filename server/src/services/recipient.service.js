import { v4 as uuidv4 } from "uuid";
import { Recipient } from "../models/Recipient.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import { signPdf } from "./pdfSign.service.js";
import { eventBus, EventTypes } from "../events/index.js";
import { notifyUserDocumentUpdate } from "./sse.service.js";
import path from "path";
import bcrypt from "bcrypt";

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
    const authType = r.authType && ["otp", "passcode"].includes(r.authType) ? r.authType : "none";

    let passcodeHash = null;
    if (authType === "passcode" && r.passcode) {
      const salt = await bcrypt.genSalt(10);
      passcodeHash = await bcrypt.hash(r.passcode.trim(), salt);
    }

    const recipient = await Recipient.create({
      pdfId,
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      role: r.role || "signer",
      signingOrder: r.signingOrder || i + 1,
      token,
      color,
      status: "pending",
      authType,
      passcodeHash,
      authVerified: authType === "none",
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

  const remainingRecipients = await Recipient.find({
    pdfId: pdf._id,
    status: { $ne: "signed" },
  });
  const isFinal = remainingRecipients.length === 0;

  // 2. Persist updated fields to MongoDB
  const rId = recipient._id.toString();
  const rEmail = recipient.email.toLowerCase();
  const rName = recipient.name.toLowerCase();

  const updatedPdfFields = (pdf.fields || []).map((dbField) => {
    const isMine =
      (dbField.recipientId && dbField.recipientId.toString() === rId) ||
      (dbField.recipientEmail && dbField.recipientEmail.toLowerCase() === rEmail) ||
      (dbField.recipientName && dbField.recipientName.toLowerCase() === rName);

    if (isMine) {
      const matchingFilled = (filledFields || []).find((f) => f.id === dbField.id);
      if (matchingFilled) {
        return {
          ...dbField,
          value: matchingFilled.value !== undefined ? matchingFilled.value : dbField.value,
          signatureUrl: matchingFilled.signatureUrl || matchingFilled.value || dbField.signatureUrl,
          signedAt: new Date(),
          signedBy: recipient._id.toString(),
        };
      }
    }
    return dbField;
  });

  pdf.fields = updatedPdfFields;
  pdf.markModified("fields");
  if (!isFinal && pdf.status === "pending") {
    pdf.status = "partially_signed";
  }
  await pdf.save();

  // 3. Burn ONLY this recipient's filled fields into the PDF layer
  const recipientFieldsToBurn = (updatedPdfFields || []).filter((f) => {
    const isMine =
      (f.recipientId && f.recipientId.toString() === rId) ||
      (f.recipientEmail && f.recipientEmail.toLowerCase() === rEmail) ||
      (f.recipientName && f.recipientName.toLowerCase() === rName);
    return isMine;
  });

  await signPdf({
    pdfId: pdf._id,
    userId: pdf.userId,
    recipientId: recipient._id,
    actorName: recipient.name,
    actorEmail: recipient.email,
    fields: recipientFieldsToBurn,
    ipAddress,
    userAgent,
    isFinalCompletion: isFinal,
  });

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
    pdf.status = "signed";
    await pdf.save();

    const allRecipients = await Recipient.find({ pdfId: pdf._id });
    const signedFileName = path.basename(pdf.storagePath).replace(/\.pdf$/i, "-signed.pdf");
    const downloadUrl = `/uploads/${pdf.userId}/${signedFileName}`;

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
        downloadUrl,
      },
    });
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
  if (!newEmail || !newEmail.includes("@")) {
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
  recipient.token = uuidv4();
  recipient.status = "sent";
  await recipient.save();

  if (Array.isArray(pdf.fields)) {
    pdf.fields = pdf.fields.map((f) => {
      if (f.recipientId?.toString() === recipient._id.toString() || f.recipientEmail?.toLowerCase() === oldEmail) {
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
