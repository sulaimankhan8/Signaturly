import { asyncHandler } from "../utils/asyncHandler.js";
import { uplodedPdf } from "../services/pdfUpload.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import mongoose from "mongoose";
import { getFileUrl } from "../services/storage.service.js";
import { originalKeyOf, downloadKeyOf, hasSignedCopy } from "../services/documentFiles.service.js";
import { appendAuditEvent, verifyAuditChainIntegrity } from "../services/auditLedger.service.js";
import { eventBus, EventTypes } from "../events/index.js";

export const uploadPdfController = asyncHandler(async (req, res) => {
  const pdf = await uplodedPdf({
    file: req.file,
    userId: req.user.id,
  });

  const fileUrl = await getFileUrl(originalKeyOf(pdf));

  // Emit event-driven signal for document creation / initial vault storage
  await eventBus.emitEvent(EventTypes.DOCUMENT_CREATED, {
    aggregateId: pdf._id,
    actor: {
      id: req.user._id || req.user.id,
      name: req.user.name || "User",
      email: req.user.email || "",
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    },
    payload: {
      title: pdf.originalFileName,
      pageCount: pdf.pageCount,
    },
  });

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

const formatPdf = async (pdf) => {
  const base = {
    _id: pdf._id,
    id: pdf._id,
    originalFileName: pdf.originalFileName,
    pageCount: pdf.pageCount || 1,
    status: pdf.status || "draft",
    createdAt: pdf.createdAt,
    updatedAt: pdf.updatedAt,
    originalHash: pdf.originalHash || "",
    isSealed: Boolean(pdf.sealedKey),
  };

  try {
    return {
      ...base,
      originalUrl: await getFileUrl(originalKeyOf(pdf)),
      // The sealed copy once signing is complete, otherwise the latest signed version
      signedUrl: (await hasSignedCopy(pdf)) ? await getFileUrl(await downloadKeyOf(pdf)) : null,
    };
  } catch (err) {
    return { ...base, originalUrl: "", signedUrl: null };
  }
};

// Documents the owner has deleted stay in the database for their audit log but are never listed
const ownedDocuments = (userId) => Pdf.find({ userId, deletedAt: null }).sort({ createdAt: -1 });

export const getMyPdfsController = asyncHandler(async (req, res) => {
  const pdfs = await ownedDocuments(req.user.id);
  const formattedPdfs = await Promise.all(pdfs.map(formatPdf));

  res.status(200).json(new ApiResponse(formattedPdfs, "User documents fetched successfully"));
});

/**
 * Lightweight Zero-Cost Delta Sync Controller
 * Returns 304 Not Modified if no documents were modified since the provided timestamp.
 */
export const syncUpdatesController = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const since = typeof req.query.since === "string" ? new Date(req.query.since) : null;

  if (since && !isNaN(since.getTime())) {
    const hasModifications = await Pdf.exists({
      userId,
      updatedAt: { $gt: since },
    });

    if (!hasModifications) {
      // Zero-cost response: No payload, allows Cloud Run container to scale to 0
      return res.status(304).end();
    }
  }

  const pdfs = await ownedDocuments(userId);
  const formattedPdfs = await Promise.all(pdfs.map(formatPdf));

  res.status(200).json(
    new ApiResponse(
      {
        documents: formattedPdfs,
        serverTime: new Date().toISOString(),
      },
      "Delta sync completed"
    )
  );
});

const loadOwnedPdf = async (id, userId) => {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid document identifier");
  }

  const pdf = await Pdf.findOne({ _id: id, deletedAt: null });
  if (!pdf) {
    throw new ApiError(404, "Document not found");
  }
  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Not authorized for this document");
  }
  return pdf;
};

/**
 * Deleting hides the document from its owner and stops its signing links.
 * The record and its audit log are kept: an audit trail that disappears with the document proves nothing.
 */
export const deletePdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id);

  if (["pending", "partially_signed"].includes(pdf.status)) {
    throw new ApiError(409, "This document is out for signature. Void it before deleting.");
  }

  await Pdf.updateOne({ _id: pdf._id }, { $set: { deletedAt: new Date() } });

  await appendAuditEvent({
    pdfId: pdf._id,
    userId: req.user.id,
    event: "deleted",
    actorName: req.user.name,
    actorEmail: req.user.email,
    description: "Document deleted by its owner. The audit log is retained.",
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse({ id: pdf._id }, "Document deleted successfully"));
});

export const getPdfAuditController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id);

  const auditLogs = await PdfAudit.find({ pdfId: pdf._id }).sort({ seq: -1, createdAt: -1 });
  const integrity = await verifyAuditChainIntegrity(pdf._id);

  res.status(200).json(new ApiResponse({ pdf, auditLogs, integrity }, "Audit trail retrieved"));
});

export const getAuditCertificatePdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id);
  const { generateAuditCertificatePdf } = await import("../services/auditCertificate.service.js");

  const pdfBuffer = await generateAuditCertificatePdf(pdf._id, req.user.id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Signing-Record-${pdf._id}.pdf"`);
  res.send(pdfBuffer);
});
