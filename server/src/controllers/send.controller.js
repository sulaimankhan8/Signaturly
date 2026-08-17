import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendDocumentToRecipients, voidDocument } from "../services/send.service.js";
import { sendManualRecipientReminder } from "../services/reminder.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";


export const sendDocumentController = asyncHandler(async (req, res) => {
  const { pdfId } = req.params;
  const { recipients, fields, message, expiresAt, signingOrder } = req.body;

  const result = await sendDocumentToRecipients({
    pdfId,
    userId: req.user.id,
    recipientsData: recipients,
    fieldsData: fields,
    message,
    expiresAt,
    signingOrder,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Document dispatched to recipients successfully"));
});

export const getDocumentDetailsController = asyncHandler(async (req, res) => {
  const { pdfId } = req.params;
  const pdf = await Pdf.findById(pdfId).populate("recipients");

  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  if (pdf.userId.toString() !== req.user.id) {
    throw new ApiError(403, "Unauthorized");
  }

  res.status(200).json(new ApiResponse(pdf, "Document retrieved"));
});

export const voidDocumentController = asyncHandler(async (req, res) => {
  const { pdfId } = req.params;
  await voidDocument({
    pdfId,
    userId: req.user.id,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse({ pdfId }, "Document voided successfully"));
});

export const remindRecipientController = asyncHandler(async (req, res) => {
  const { recipientId } = req.params;
  const { message } = req.body;

  const result = await sendManualRecipientReminder({
    recipientId,
    userId: req.user.id,
    customMessage: message,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Reminder dispatched successfully"));
});

