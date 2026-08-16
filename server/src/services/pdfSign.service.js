import fs from "fs";
import path from "path";
import axios from "axios";
import { PDFDocument, rgb } from "pdf-lib";
import { percentToPdfCoords } from "./coordinate.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { ApiError } from "../utils/ApiError.js";

const getImageBuffer = async (url) => {
  if (!url) return null;

  try {
    // 1. Base64 Data URL (data:image/png;base64,iVBOR...)
    if (url.startsWith("data:")) {
      const commaIdx = url.indexOf(",");
      if (commaIdx === -1) return null;
      const base64Data = url.substring(commaIdx + 1);
      if (!base64Data) return null;
      return Buffer.from(base64Data, "base64");
    }

    // 2. Relative upload URL (/uploads/...)
    if (url.startsWith("/uploads/")) {
      const relativePath = path.join(".", url);
      if (fs.existsSync(relativePath)) {
        return fs.readFileSync(relativePath);
      }
    }

    // 3. Remote HTTP/HTTPS URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15000,
      });
      return Buffer.from(res.data);
    }

    // 4. Direct disk file path
    if (fs.existsSync(url)) {
      return fs.readFileSync(url);
    }
  } catch (err) {
    console.error("Error loading signature image buffer:", err.message);
  }

  return null;
};

export const signPdf = async ({ pdfId, userId, fields }) => {
  console.log("signPdf called", { pdfId, userId, fieldsCount: fields?.length });

  const pdfMeta = await Pdf.findById(pdfId);
  if (!pdfMeta) throw new ApiError(404, "PDF not found");
  if (pdfMeta.userId.toString() !== userId) {
    throw new ApiError(403, "Not your document");
  }

  // Check if a previously signed version exists — if so, burn ON TOP of previously signed PDF!
  const signedPath = pdfMeta.storagePath.replace(/\.pdf$/i, "-signed.pdf");
  const inputPath = fs.existsSync(signedPath) ? signedPath : pdfMeta.storagePath;

  if (!fs.existsSync(inputPath)) {
    throw new ApiError(404, "PDF source file not found on disk");
  }

  const originalBuffer = fs.readFileSync(inputPath);
  const originalHash = sha256FromBuffer(originalBuffer);

  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  console.log("PDF loaded with", pdfDoc.getPageCount(), "pages from", inputPath);

  // Process each field
  for (const field of fields) {
    const pageIndex = field.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
      console.error("Invalid page number:", field.page);
      continue;
    }

    const page = pdfDoc.getPage(pageIndex);
    const { width: pw, height: ph } = page.getSize();

    const safeField = {
      ...field,
      xPercent: Math.max(0, Math.min(1, field.xPercent)),
      yPercent: Math.max(0, Math.min(1, field.yPercent)),
      widthPercent: Math.max(0.01, Math.min(1, field.widthPercent)),
      heightPercent: Math.max(0.01, Math.min(1, field.heightPercent)),
    };

    const { x, y, width, height } = percentToPdfCoords({
      ...safeField,
      pdfWidth: pw,
      pdfHeight: ph,
    });

    switch (field.type) {
      case "text": {
        const fontSize = field.fontSizePercent
          ? field.fontSizePercent * ph
          : height * 0.55;

        const padLeft = 8 * (pw / 612);
        const textValue = (field.value || "").replace(/[^\x00-\x7F]/g, "");

        page.drawText(textValue, {
          x: x + padLeft,
          y: y + height / 2 - fontSize * 0.35,
          size: Math.max(8, fontSize),
          color: rgb(0, 0, 0),
        });
        break;
      }

      case "date": {
        const fontSize = field.fontSizePercent
          ? field.fontSizePercent * ph
          : height * 0.55;

        const padLeft = 8 * (pw / 612);
        const dateValue = (field.value || new Date().toLocaleDateString()).replace(/[^\x00-\x7F]/g, "");

        page.drawText(dateValue, {
          x: x + padLeft,
          y: y + height / 2 - fontSize * 0.35,
          size: Math.max(8, fontSize),
          color: rgb(0, 0, 0),
        });
        break;
      }

      case "signature": {
        if (!field.signatureUrl) {
          console.warn("Signature field missing signatureUrl:", field.id);
          break;
        }

        const imageBuffer = await getImageBuffer(field.signatureUrl);
        if (!imageBuffer || imageBuffer.length === 0) {
          console.error("Failed to retrieve image buffer for signatureUrl:", field.signatureUrl?.slice(0, 60));
          break;
        }

        let image = null;
        try {
          image = await pdfDoc.embedPng(imageBuffer);
        } catch (pngErr) {
          try {
            image = await pdfDoc.embedJpg(imageBuffer);
          } catch (jpgErr) {
            console.error("Failed to embed signature image as PNG or JPG:", jpgErr.message);
          }
        }

        if (!image) {
          console.error("Signature image could not be embedded into PDF for field:", field.id);
          break;
        }

        const imgDims = image.scale(1);
        const scale = Math.min(width / imgDims.width, height / imgDims.height);
        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;

        page.drawImage(image, {
          x: x + (width - drawW) / 2,
          y: y + (height - drawH) / 2,
          width: drawW,
          height: drawH,
        });

        console.log("Signature successfully burned into PDF:", { drawW, drawH });
        break;
      }

      case "radio": {
        const size = field.fontSizePercent
          ? field.fontSizePercent * ph
          : Math.min(width, height) * 0.6;

        const radius = size / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        page.drawCircle({
          x: centerX,
          y: centerY,
          size: radius,
          borderWidth: 1,
          color: rgb(1, 1, 1),
          borderColor: rgb(0, 0, 0),
        });

        if (field.checked) {
          page.drawCircle({
            x: centerX,
            y: centerY,
            size: radius * 0.6,
            color: rgb(0, 0, 0),
          });
        }
        break;
      }

      default:
        console.warn("Unknown field type:", field.type);
    }
  }

  // Save the signed PDF
  const signedBytes = await pdfDoc.save();
  const signedHash = sha256FromBuffer(signedBytes);

  fs.writeFileSync(signedPath, signedBytes);
  console.log("signed file written to", signedPath);

  // Create audit trail record
  await PdfAudit.create({
    pdfId,
    userId,
    originalHash,
    signedHash,
    fieldsMeta: fields,
  });

  // Update PDF status
  pdfMeta.status = "signed";
  await pdfMeta.save();

  return signedPath;
};