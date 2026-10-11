import path from "path";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { saveFile } from "./storage.service.js";

const MAX_PAGES = 500;
const MAX_JOINED_BYTES = 25 * 1024 * 1024;

/**
 * Writes "TEST DOCUMENT" across every page. Documents made with a test API key carry it from
 * the start, so no copy of one can pass for a real signed document.
 */
export const watermarkTestDocument = async (pdfDoc) => {
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const words = "TEST DOCUMENT - NOT VALID";
  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(18, Math.min(width, height) / 12);
    const length = font.widthOfTextAtSize(words, size);
    // Centred, rising at 35 degrees
    const angle = (35 * Math.PI) / 180;
    page.drawText(words, {
      x: width / 2 - (length / 2) * Math.cos(angle),
      y: height / 2 - (length / 2) * Math.sin(angle),
      size,
      font,
      color: rgb(0.85, 0.1, 0.1),
      opacity: 0.22,
      rotate: degrees(35),
    });
  }
};

/**
 * Joins several PDFs into one, in the order given, so a set of papers (an offer letter, a
 * policy and a form) goes to its signers as a single document and is signed in one sitting.
 * Returns what an upload of the joined file would have been.
 */
export const joinPdfFiles = async (files) => {
  if (!Array.isArray(files) || files.length < 2) throw new ApiError(400, "Choose at least two PDF files to join");

  const joined = await PDFDocument.create();
  for (const file of files) {
    if (file.mimetype !== "application/pdf" || !file.buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
      throw new ApiError(422, `"${file.originalname}" is not a valid PDF`);
    }
    let source;
    try {
      source = await PDFDocument.load(file.buffer);
    } catch (err) {
      throw new ApiError(
        422,
        /encrypt/i.test(err?.message || "")
          ? `"${file.originalname}" is password-protected. Remove the password and try again.`
          : `"${file.originalname}" could not be read. It may be damaged.`
      );
    }
    for (const page of await joined.copyPages(source, source.getPageIndices())) joined.addPage(page);
    if (joined.getPageCount() > MAX_PAGES) throw new ApiError(422, `The joined document would have more than ${MAX_PAGES} pages`);
  }

  const buffer = Buffer.from(await joined.save());
  if (buffer.length > MAX_JOINED_BYTES) throw new ApiError(413, "The joined document is too large. Keep it under 25 MB.");

  const first = files[0].originalname.replace(/\.pdf$/i, "");
  const others = files.length - 1;
  return { buffer, mimetype: "application/pdf", originalname: `${first} and ${others} more.pdf` };
};

export const uplodedPdf = async ({ file, userId, workspaceId = null, testMode = false }) => {
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

  let stored = file.buffer;
  if (testMode) {
    await watermarkTestDocument(pdfDoc);
    stored = Buffer.from(await pdfDoc.save());
  }

  const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+/g, ".").slice(-120);
  const fileName = `${Date.now()}-${sanitizedFileName}`;
  const relativeKey = `${userId.toString()}/${fileName}`;

  // Save via abstracted storage adapter (GCS or Local Disk)
  const storagePath = await saveFile(relativeKey, stored, "application/pdf");

  const pdf = await Pdf.create({
    userId,
    workspaceId,
    testMode,
    originalFileName: file.originalname.slice(0, 255),
    storagePath,
    // The hash is of the file as stored, which for a test document includes its watermark
    originalHash: sha256FromBuffer(stored),
    pageCount,
  });

  return pdf;
};