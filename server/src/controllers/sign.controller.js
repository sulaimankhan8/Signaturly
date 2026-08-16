import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { signPdf } from "../services/pdfSign.service.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import path from "path";
import fs from "fs";

export const signPdfController = asyncHandler(async (req, res) => {
  const signedPath = await signPdf({
    pdfId: req.body.pdfId,
    userId: req.user.id,
    fields: req.body.fields,
  });

  const publicUrl = signedPath
    .replace(/\\/g, "/")
    .replace(/^uploads/, "/uploads");

  res.status(200).json(
    new ApiResponse({
      signedPdfUrl: publicUrl,
    })
  );
});

export const getPdfController = asyncHandler(async (req, res) => {
  const pdf = await Pdf.findById(req.params.id);

  if (!pdf) {
    throw new ApiError(404, "PDF not found");
  }

  if (pdf.userId.toString() !== req.user.id) {
    throw new ApiError(403, "Unauthorized");
  }

  const fileName = path.basename(pdf.storagePath);
  const signedFileName = fileName.replace(/\.pdf$/i, "-signed.pdf");
  const signedPath = pdf.storagePath.replace(/\.pdf$/i, "-signed.pdf");

  // If document was signed previously, return signed version URL so re-editing displays existing signatures!
  const targetFileName = fs.existsSync(signedPath) ? signedFileName : fileName;

  res.json(
    new ApiResponse({
      url: `/uploads/${pdf.userId}/${targetFileName}`,
      pageCount: pdf.pageCount,
      originalFileName: pdf.originalFileName,
      status: pdf.status,
    })
  );
});
