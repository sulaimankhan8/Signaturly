import { asyncHandler } from "../utils/asyncHandler.js";
import { uplodedPdf } from "../services/pdfUpload.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import path from "path";

export const uploadPdfController = asyncHandler(async (req, res) => {
  console.log("uploadPdfController called", { userId: req.user?.id, fileOriginalName: req.file?.originalname });
  const pdf = await uplodedPdf({
    file: req.file,
    userId: req.user.id,
  });

  console.log("uplodedPdf result", { id: pdf._id, originalFileName: pdf.originalFileName, pageCount: pdf.pageCount, storagePath: pdf.storagePath });

  res.status(201).json(
    new ApiResponse({
      id: pdf._id,
      originalFileName: pdf.originalFileName,
      pageCount: pdf.pageCount,
      url: `/uploads/${pdf.userId}/${path.basename(pdf.storagePath)}`
    }, "PDF uploaded successfully")
  );
});
