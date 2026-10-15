import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendDocumentToRecipients, voidDocument } from "../services/send.service.js";
import { sendManualRecipientReminder } from "../services/reminder.service.js";
import { updateRecipientEmailService } from "../services/recipient.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { reserveQuota, releaseQuota } from "../services/subscription.service.js";
import { assertRecordAccess } from "../services/authorize.service.js";
import { billingUserIdOf } from "../services/branding.service.js";
import mongoose from "mongoose";

export const sendDocumentController = asyncHandler(async (req, res) => {
  const { pdfId } = req.params;
  const { recipients, fields, message, expiresAt, signingOrder, emailSubject, reminderCadence } = req.body;

  // Count the document against the plan that pays for the workspace the document is in, whichever
  // workspace the sender happens to be looking at; give it back if the send fails.
  // Documents made with a test key are never counted.
  const document = mongoose.isValidObjectId(String(pdfId)) ? await Pdf.findOne({ _id: String(pdfId), deletedAt: null }).select("userId workspaceId testMode") : null;
  const payer = document ? await billingUserIdOf(document) : req.user.id;
  const billed = !document?.testMode;
  if (billed) await reserveQuota(payer, 1);

  let result;
  try {
    result = await sendDocumentToRecipients({
      pdfId,
      userId: req.user.id,
      recipientsData: recipients,
      fieldsData: Array.isArray(fields) ? fields : [],
      message: typeof message === "string" ? message.slice(0, 2000) : "",
      expiresAt,
      signingOrder,
      emailSubject,
      reminderCadence,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    if (billed) await releaseQuota(payer, 1);
    throw err;
  }

  res.status(200).json(new ApiResponse(result, "Document dispatched to recipients successfully"));
});

export const getDocumentDetailsController = asyncHandler(async (req, res) => {
  const { pdfId } = req.params;
  const pdf = await Pdf.findOne({ _id: String(pdfId), deletedAt: null }).populate("recipients");

  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  await assertRecordAccess(pdf, req.user.id, "document.read");

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

export const updateRecipientEmailController = asyncHandler(async (req, res) => {
  const { recipientId } = req.params;
  const { email } = req.body;

  const result = await updateRecipientEmailService({
    recipientId,
    userId: req.user.id,
    newEmail: email,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Recipient email updated and signing link re-dispatched successfully"));
});

// People the sender has sent documents to before, newest first, to offer as they type a recipient
export const recentRecipientsController = asyncHandler(async (req, res) => {
  const documents = await Pdf.find({ userId: req.user.id, deletedAt: null, "recipients.0": { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(60)
    .select("_id");

  const people = await Recipient.find({ pdfId: { $in: documents.map((d) => d._id) } })
    .sort({ createdAt: -1 })
    .select("name email phone -_id")
    .lean();

  const seen = new Set();
  const recent = [];
  for (const person of people) {
    const key = (person.email || person.phone || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recent.push({ name: person.name, email: person.email || "", phone: person.phone || "" });
    if (recent.length >= 30) break;
  }

  res.status(200).json(new ApiResponse(recent, "Recent recipients"));
});
