import path from "path";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { PDFDocument } from "pdf-lib";
import { saveFile } from "./storage.service.js";

export const uplodedPdf = async ({ file, userId }) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  if (file.mimetype !== "application/pdf") {
    throw new ApiError(400, "Only PDF files are allowed");
  }

  const originalHash = sha256FromBuffer(file.buffer);
  const pdfDoc = await PDFDocument.load(file.buffer);
  const pageCount = pdfDoc.getPageCount();

  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${sanitizedFileName}`;
  const relativeKey = `${userId.toString()}/${fileName}`;

  // Save via abstracted storage adapter (GCS or Local Disk)
  const storagePath = await saveFile(relativeKey, file.buffer, "application/pdf");

  const pdf = await Pdf.create({
    userId,
    originalFileName: file.originalname,
    storagePath,
    originalHash,
    pageCount,
  });

  return pdf;
};