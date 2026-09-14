import path from "path";
import crypto from "crypto";
import { Template } from "../models/Template.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { sha256FromBuffer } from "./hash.service.js";
import { readFile, saveFile } from "./storage.service.js";
import { sendSigningRequestEmail } from "./email.service.js";
import { ApiError } from "../utils/ApiError.js";

export const processBulkSendFromTemplate = async ({
  templateId,
  userId,
  recipientsList = [],
  customMessage = "",
  ipAddress = "",
  userAgent = "",
}) => {
  if (!templateId) throw new ApiError(400, "Template ID is required");
  if (!recipientsList || recipientsList.length === 0) {
    throw new ApiError(400, "Recipients list cannot be empty");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const template = await Template.findOne({ _id: templateId, userId });
  if (!template) throw new ApiError(404, "Template not found or unauthorized");

  const templatePdfPath = template.sourcePdfPath;
  let sourceBuffer;
  try {
    sourceBuffer = await readFile(templatePdfPath);
  } catch (err) {
    throw new ApiError(404, "Template source PDF file is missing on storage: " + err.message);
  }

  const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dispatchedDocuments = [];
  const errors = [];

  for (let i = 0; i < recipientsList.length; i++) {
    const row = recipientsList[i];
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      errors.push({ row: i + 1, email, error: "Invalid email address" });
      continue;
    }

    try {
      const sanitizedName = (template.name || "Template").replace(/[^a-zA-Z0-9_-]/g, "_");
      const newPdfFileName = `${Date.now()}_bulk_${batchId}_${i + 1}_${sanitizedName}.pdf`;
      const relativeStorageKey = `${userId}/${newPdfFileName}`;

      const savedStoragePath = await saveFile(relativeStorageKey, sourceBuffer, "application/pdf");
      const fileHash = sha256FromBuffer(sourceBuffer);
      const originalDocName = `${template.name} - ${name || email}`;

      // 1. Create Recipient record
      const token = crypto.randomBytes(32).toString("hex");
      const recipientRole = template.roles?.[0]?.name || "Signer";
      const recipientColor = template.roles?.[0]?.color || "#3b82f6";

      // 2. Create PDF record first (placeholder fields)
      const pdf = await Pdf.create({
        userId,
        originalFileName: originalDocName,
        storagePath: savedStoragePath,
        originalHash: fileHash,
        pageCount: template.pageCount || 1,
        status: "pending",
        message: customMessage,
        fields: [],
        recipients: [],
      });

      const recipient = await Recipient.create({
        pdfId: pdf._id,
        name: name || email.split("@")[0],
        email,
        role: recipientRole,
        color: recipientColor,
        signingOrder: 1,
        status: "sent",
        token,
      });

      // 3. Map template fields to standard percentage field schema
      const mappedFields = (template.fields || []).map((tf) => ({
        id: tf.id || `f_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: tf.type || "signature",
        page: Number(tf.page) || 1,
        xPercent: tf.xPercent !== undefined ? Number(tf.xPercent) : (Number(tf.x) / 100 || 0),
        yPercent: tf.yPercent !== undefined ? Number(tf.yPercent) : (Number(tf.y) / 100 || 0),
        widthPercent: tf.widthPercent !== undefined ? Number(tf.widthPercent) : (Number(tf.width) / 100 || 0.2),
        heightPercent: tf.heightPercent !== undefined ? Number(tf.heightPercent) : (Number(tf.height) / 100 || 0.05),
        fontSizePercent: tf.fontSizePercent ? Number(tf.fontSizePercent) : undefined,
        label: tf.label || "",
        required: tf.required !== false,
        recipientId: recipient._id.toString(),
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientColor: recipient.color,
      }));

      pdf.fields = mappedFields;
      pdf.recipients = [recipient._id];
      await pdf.save();

      // 4. Send signing invitation email
      try {
        await sendSigningRequestEmail({
          recipient,
          pdf,
          sender: user,
          customMessage,
        });
      } catch (mailErr) {
        console.error(`Email dispatch failed for ${email}:`, mailErr.message);
      }

      // 5. Audit Trail
      await PdfAudit.create({
        pdfId: pdf._id,
        userId,
        event: "sent",
        actorName: user.name || "Sender",
        actorEmail: user.email,
        description: `Dispatched in bulk batch ${batchId} to ${name} (${email})`,
        ipAddress,
        userAgent,
        signedAt: new Date(),
      });

      dispatchedDocuments.push({
        pdfId: pdf._id,
        documentName: originalDocName,
        recipientName: name,
        recipientEmail: email,
        signingUrl: `/sign/${token}`,
      });
    } catch (err) {
      console.error(`Bulk send failure on row ${i + 1}:`, err);
      errors.push({ row: i + 1, email, error: err.message });
    }
  }

  // Increment template usage count
  template.usageCount = (template.usageCount || 0) + dispatchedDocuments.length;
  await template.save();

  return {
    batchId,
    totalRequested: recipientsList.length,
    totalDispatched: dispatchedDocuments.length,
    dispatchedDocuments,
    errors,
  };
};
