import { asyncHandler } from "../utils/asyncHandler.js";
import { uplodedPdf } from "../services/pdfUpload.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import path from "path";
import { fileExists, deleteFile, getFileUrl } from "../services/storage.service.js";

export const uploadPdfController = asyncHandler(async (req, res) => {
  const pdf = await uplodedPdf({
    file: req.file,
    userId: req.user.id,
  });

  const fileName = path.basename(pdf.storagePath);
  const relativeKey = `${pdf.userId}/${fileName}`;
  const fileUrl = await getFileUrl(relativeKey);

  res.status(201).json(
    new ApiResponse(
      {
        id: pdf._id,
        originalFileName: pdf.originalFileName,
        pageCount: pdf.pageCount,
        url: fileUrl,
      },
      "PDF uploaded successfully"
    )
  );
});

export const getMyPdfsController = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pdfs = await Pdf.find({ userId }).sort({ createdAt: -1 });

  const formattedPdfs = await Promise.all(
    pdfs.map(async (pdf) => {
      const fileName = path.basename(pdf.storagePath);
      const relativeKey = `${pdf.userId}/${fileName}`;
      const signedKey = relativeKey.replace(/\.pdf$/i, "-signed.pdf");

      const originalUrl = await getFileUrl(relativeKey);
      const isSignedPresent = await fileExists(signedKey);
      const signedUrl = isSignedPresent ? await getFileUrl(signedKey) : null;

      return {
        _id: pdf._id,
        id: pdf._id,
        originalFileName: pdf.originalFileName,
        pageCount: pdf.pageCount,
        status: pdf.status,
        createdAt: pdf.createdAt,
        updatedAt: pdf.updatedAt,
        originalUrl,
        signedUrl,
        originalHash: pdf.originalHash,
      };
    })
  );

  res.status(200).json(new ApiResponse(formattedPdfs, "User documents fetched successfully"));
});

export const deletePdfController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const pdf = await Pdf.findById(id);

  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Not authorized to delete this document");
  }

  const fileName = path.basename(pdf.storagePath);
  const relativeKey = `${pdf.userId}/${fileName}`;
  const signedKey = relativeKey.replace(/\.pdf$/i, "-signed.pdf");

  // Delete from storage adapter (GCS or Local)
  await deleteFile(relativeKey);
  await deleteFile(signedKey);

  // Delete DB records
  await Pdf.findByIdAndDelete(id);
  await PdfAudit.deleteMany({ pdfId: id });
  await Recipient.deleteMany({ pdfId: id });

  res.status(200).json(new ApiResponse({ id }, "Document deleted successfully"));
});

export const getPdfAuditController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const pdf = await Pdf.findById(id);
  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }

  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Unauthorized access to audit trail");
  }

  const auditLogs = await PdfAudit.find({ pdfId: id }).sort({ signedAt: -1 });

  res.status(200).json(new ApiResponse({ pdf, auditLogs }, "Audit trail retrieved"));
});

export const getAuditCertificatePdfController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { generateAuditCertificatePdf } = await import("../services/auditCertificate.service.js");

  const pdfBuffer = await generateAuditCertificatePdf(id, req.user.id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Audit-Certificate-${id}.pdf"`);
  res.send(pdfBuffer);
});
