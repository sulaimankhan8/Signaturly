import path from "path";
import { ensureDir, writeFile } from "../utils/file.utils.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { PDFDocument } from "pdf-lib";

export const uplodedPdf = async ({file, userId}) => {
  console.log("uplodedPdf called", { userId, originalname: file?.originalname, mimetype: file?.mimetype });

  if(!file){
    console.log("uplodedPdf error: no file provided");
    throw new ApiError(400, "No file uploaded");
  }

    if (file.mimetype !== "application/pdf") {
    throw new ApiError(400, "Only PDF files are allowed");
  }

  const originalHash = sha256FromBuffer(file.buffer);
  console.log("uplodedPdf originalHash", { originalHash });

  const pdfDoc = await PDFDocument.load(file.buffer);
  const pageCount = pdfDoc.getPageCount();
  console.log("uplodedPdf pageCount", { pageCount });

  const uploadDir = path.join("uploads", userId.toString());
  ensureDir(uploadDir);

  const fileName = `${Date.now()}-${file.originalname}`;
  const storagePath = path.join(uploadDir, fileName);

  console.log("uplodedPdf saving file", { uploadDir, fileName, storagePath });
  writeFile(storagePath, file.buffer);

  const pdf = await Pdf.create({
    userId,
    originalFileName: file.originalname,
    storagePath,
    originalHash,
    pageCount,
  });

  console.log("✅ [uplodedPdf] PDF uploaded and metadata saved successfully:", pdf);
    return pdf;
};