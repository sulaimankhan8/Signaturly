import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { signPdf } from "../services/pdfSign.service.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import path from "path";

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
      signedPdfUrl: publicUrl, // ✅ DIRECT URL
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

  res.json(
    new ApiResponse({
      url: `/uploads/${pdf.userId}/${path.basename(pdf.storagePath)}`,
      pageCount: pdf.pageCount,
    })
  );
});

