import path from "path";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { PDFDocument } from "pdf-lib";
import { saveFile } from "./storage.service.js";

const MAX_PAGES = 500;

export const uplodedPdf = async ({ file, userId }) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  if (file.mimetype !== "application/pdf") {
    throw new ApiError(400, "Only PDF files are allowed");
  }

  // Check the file itself, not just the type the browser claimed
  if (!file.buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new ApiError(422, "This file is not a valid PDF");
  }

  const originalHash = sha256FromBuffer(file.buffer);

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(file.buffer);
  } catch (err) {
    const encrypted = /encrypt/i.test(err?.message || "");
    throw new ApiError(
      422,
      encrypted
        ? "Password-protected PDFs cannot be used. Please remove the password and upload again."
        : "This PDF could not be read. It may be damaged."
    );
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount < 1 || pageCount > MAX_PAGES) {
    throw new ApiError(422, `PDFs must have between 1 and ${MAX_PAGES} pages`);
  }

  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+/g, ".").slice(-120);
  const fileName = `${Date.now()}-${sanitizedFileName}`;
  const relativeKey = `${userId.toString()}/${fileName}`;

  // Save via abstracted storage adapter (GCS or Local Disk)
  const storagePath = await saveFile(relativeKey, file.buffer, "application/pdf");

  const pdf = await Pdf.create({
    userId,
    originalFileName: file.originalname.slice(0, 255),
    storagePath,
    originalHash,
    pageCount,
  });

  return pdf;
};