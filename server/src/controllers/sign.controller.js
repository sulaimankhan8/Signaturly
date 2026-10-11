import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { signPdf } from "../services/pdfSign.service.js";
import { sealDocument } from "../services/pdfSeal.service.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import mongoose from "mongoose";
import { getFileUrl } from "../services/storage.service.js";
import { currentKeyOf, downloadKeyOf } from "../services/documentFiles.service.js";
import { withDocumentLock } from "../services/documentLock.service.js";
import { assertRecordAccess } from "../services/authorize.service.js";

// Without `action`, only the person who made the document passes. With one, the workspace's
// roles decide, as everywhere else.
const loadOwnedPdf = async (pdfId, userId, action = null) => {
  if (typeof pdfId !== "string" || !mongoose.isValidObjectId(pdfId)) {
    throw new ApiError(400, "Invalid document identifier");
  }

  const pdf = await Pdf.findOne({ _id: pdfId, deletedAt: null });
  if (!pdf) {
    throw new ApiError(404, "PDF not found");
  }
  if (action) {
    await assertRecordAccess(pdf, userId, action, { notFound: "PDF not found" });
    return pdf;
  }
  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Unauthorized");
  }
  return pdf;
};

// Signing your own document: only the owner, and only before it has been sent to anyone
export const signPdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.body.pdfId, req.user.id);

  const hasBeenSent = (pdf.recipients || []).length > 0 || !["draft", "uploaded", "signed"].includes(pdf.status);
  if (hasBeenSent) {
    throw new ApiError(409, "This document has been sent for signature and can no longer be edited");
  }

  if (!Array.isArray(req.body.fields)) {
    throw new ApiError(400, "Fields are required");
  }

  await withDocumentLock(pdf._id, async () => {
    await signPdf({
      pdfId: pdf._id,
      userId: req.user.id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      fields: req.body.fields,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // The owner's signed copy is sealed like any completed document
    await sealDocument(pdf._id);
  });

  const signed = await Pdf.findById(pdf._id);

  res.status(200).json(
    new ApiResponse({
      signedPdfUrl: await getFileUrl(await downloadKeyOf(signed)),
    })
  );
});

export const getPdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id, "document.read");

  // The editor works on the latest signed version, so earlier signatures stay visible while adding more.
  // (The sealed copy is for download: it carries the signing record and must not be edited.)
  res.json(
    new ApiResponse({
      url: await getFileUrl(await currentKeyOf(pdf)),
      pageCount: pdf.pageCount,
      originalFileName: pdf.originalFileName,
      status: pdf.status,
    })
  );
});
