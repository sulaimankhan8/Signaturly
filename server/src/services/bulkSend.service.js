import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Template } from "../models/Template.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { calculateFileHash } from "./hash.service.js";
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

  const sourcePdfPath = template.pdfPath;
  if (!fs.existsSync(sourcePdfPath)) {
    throw new ApiError(404, "Template source PDF file is missing on server");
  }

  const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const successfulDispatches = [];
  const errors = [];

  const uploadsDir = path.resolve(process.cwd(), "uploads", "pdfs");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  for (let i = 0; i < recipientsList.length; i++) {
    const row = recipientsList[i];
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      errors.push({ row: i + 1, email, error: "Invalid email address" });
      continue;
    }

    try {
      // 1. Copy source PDF to unique document file
      const newPdfFileName = `bulk_${batchId}_${Date.now()}_${i + 1}.pdf`;
      const newPdfPath = path.join(uploadsDir, newPdfFileName);
      await fs.promises.copyFile(sourcePdfPath, newPdfPath);

      const fileHash = await calculateFileHash(newPdfPath);
      const originalDocName = `${template.name} - ${name || email}`;

      // 2. Create PDF record
      const pdf = await Pdf.create({
        userId,
        originalFileName: originalDocName,
        filePath: newPdfPath,
        originalHash: fileHash,
        pageCount: template.pageCount || 1,
        status: "pending",
        message: customMessage,
        fields: [],
      });

      // 3. Create Recipient record
      const token = crypto.randomBytes(32).toString("hex");
      const recipient = await Recipient.create({
        pdfId: pdf._id,
        name: name || email.split("@")[0],
        email,
        role: template.roles[0]?.name || "Signer",
        color: template.roles[0]?.color || "#ef4444",
        signingOrder: 1,
        status: "sent",
        token,
      });

      // 4. Map template fields to this recipient
      const mappedFields = (template.fields || []).map((tf) => ({
        id: tf.id || `f_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        pageNumber: tf.pageNumber || 1,
        type: tf.type || "signature",
        x: tf.x,
        y: tf.y,
        width: tf.width || 120,
        height: tf.height || 40,
        required: tf.required !== false,
        recipientId: recipient._id,
        recipientEmail: recipient.email,
        recipientColor: recipient.color,
      }));

      pdf.fields = mappedFields;
      pdf.recipients = [recipient._id];
      await pdf.save();

      // 5. Send signing invitation email
      try {
        await sendSigningRequestEmail({
          recipient,
          pdf,
          sender,
          customMessage,
        });
      } catch (mailErr) {
        console.error(`Email dispatch failed for ${email}:`, mailErr.message);
      }

      // 6. Audit Trail
      await PdfAudit.create({
        pdfId: pdf._id,
        userId,
        event: "bulk_dispatched",
        actorName: sender.name || "Sender",
        actorEmail: sender.email,
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
