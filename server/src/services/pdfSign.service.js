import fs from "fs";
import path from "path";
import axios from "axios";
import { PDFDocument, rgb } from "pdf-lib";
import { percentToPdfCoords } from "./coordinate.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { readFile, fileExists, saveFile } from "./storage.service.js";
import { createChainedAuditLog } from "./auditLedger.service.js";

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

    // 2. Relative upload URL (/uploads/...) or direct key
    if (url.startsWith("/uploads/")) {
      const relativeKey = url.replace(/^\/uploads\//, "");
      return await readFile(relativeKey);
    }

    // 3. Remote HTTP/HTTPS URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15000,
      });
      return Buffer.from(res.data);
    }

    // 4. Direct disk or storage path
    return await readFile(url);
  } catch (err) {
    console.error("Error loading signature image buffer:", err.message);
  }

  return null;
};

export const signPdf = async ({
  pdfId,
  userId = null,
  recipientId = null,
  actorName = "User",
  actorEmail = "",
  fields = [],
  ipAddress = "",
  userAgent = "",
  isFinalCompletion = true,
}) => {
  console.log("signPdf called", { pdfId, userId, recipientId, fieldsCount: fields?.length });

  const pdfMeta = await Pdf.findById(pdfId);
  if (!pdfMeta) throw new ApiError(404, "PDF not found");

  const fileName = path.basename(pdfMeta.storagePath);
  const relativeKey = `${pdfMeta.userId}/${fileName}`;
  const signedKey = relativeKey.replace(/\.pdf$/i, "-signed.pdf");

  // Check if a previously signed version exists — burn ON TOP of previously signed PDF!
  const hasSigned = await fileExists(signedKey);
  const inputKey = hasSigned ? signedKey : relativeKey;

  const originalBuffer = await readFile(inputKey);
  const originalHash = sha256FromBuffer(originalBuffer);

  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  console.log("PDF loaded with", pdfDoc.getPageCount(), "pages from storage key:", inputKey);

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

        if (textValue) {
          page.drawText(textValue, {
            x: x + padLeft,
            y: y + height / 2 - fontSize * 0.35,
            size: Math.max(8, fontSize),
            color: rgb(0, 0, 0),
          });
        }
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
        const signatureAsset = field.signatureUrl || field.value;
        if (!signatureAsset) {
          console.warn("Full signature field missing image asset:", field.id);
          break;
        }

        const imageBuffer = await getImageBuffer(signatureAsset);
        if (!imageBuffer || imageBuffer.length === 0) {
          console.error("Failed to retrieve image buffer for signature field:", field.id);
          break;
        }

        let image = null;
        try {
          image = await pdfDoc.embedPng(imageBuffer);
        } catch (pngErr) {
          try {
            image = await pdfDoc.embedJpg(imageBuffer);
          } catch (jpgErr) {
            console.error("Failed to embed signature as PNG or JPG:", jpgErr.message);
          }
        }

        if (!image) {
          console.error("Signature image could not be embedded for field:", field.id);
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
        break;
      }

      case "initials": {
        const initialsAsset = field.signatureUrl || field.value;
        if (!initialsAsset) {
          console.warn("Initials field missing image asset:", field.id);
          break;
        }

        const imageBuffer = await getImageBuffer(initialsAsset);
        if (!imageBuffer || imageBuffer.length === 0) {
          console.error("Failed to retrieve image buffer for initials field:", field.id);
          break;
        }

        let image = null;
        try {
          image = await pdfDoc.embedPng(imageBuffer);
        } catch (pngErr) {
          try {
            image = await pdfDoc.embedJpg(imageBuffer);
          } catch (jpgErr) {
            console.error("Failed to embed initials as PNG or JPG:", jpgErr.message);
          }
        }

        if (!image) {
          console.error("Initials image could not be embedded for field:", field.id);
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
        break;
      }

      case "checkbox": {
        const size = Math.min(width, height) * 0.7;
        const startX = x + (width - size) / 2;
        const startY = y + (height - size) / 2;

        page.drawRectangle({
          x: startX,
          y: startY,
          width: size,
          height: size,
          borderWidth: 1.5,
          color: rgb(1, 1, 1),
          borderColor: rgb(0, 0, 0),
        });

        if (field.checked || field.value === "true" || field.value === true) {
          // Draw checkmark lines or cross
          page.drawLine({
            start: { x: startX + size * 0.2, y: startY + size * 0.5 },
            end: { x: startX + size * 0.45, y: startY + size * 0.2 },
            thickness: 2,
            color: rgb(0, 0, 0),
          });
          page.drawLine({
            start: { x: startX + size * 0.45, y: startY + size * 0.2 },
            end: { x: startX + size * 0.85, y: startY + size * 0.8 },
            thickness: 2,
            color: rgb(0, 0, 0),
          });
        }
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

        if (field.checked || field.value === "true" || field.value === true) {
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

  // Save the modified PDF
  const signedBytes = await pdfDoc.save();
  const signedHash = sha256FromBuffer(signedBytes);

  const signedPath = await saveFile(signedKey, Buffer.from(signedBytes), "application/pdf");
  console.log("signed file saved to", signedPath);

  let authMethod = "Email Token (SES)";
  let otpVerified = false;

  if (recipientId) {
    const rec = await Recipient.findById(recipientId);
    if (rec) {
      if (rec.authType === "otp") {
        authMethod = "Email OTP (2FA Verified)";
        otpVerified = true;
      } else if (rec.authType === "passcode") {
        authMethod = "Access Passcode (Verified)";
        otpVerified = true;
      } else {
        authMethod = "Email Token (Direct SES)";
        otpVerified = false;
      }
    }
  }

  // Create cryptographically chained audit trail entry
  await createChainedAuditLog({
    pdfId,
    userId: userId || pdfMeta.userId,
    recipientId,
    event: "signed",
    actorName,
    actorEmail,
    originalHash,
    signedHash,
    fieldsMeta: fields,
    description: `${actorName} completed required fields and placed digital signature (${authMethod}).`,
    ipAddress,
    userAgent,
    otpVerified,
    authMethod,
    signedAt: new Date(),
  });

  if (isFinalCompletion) {
    pdfMeta.status = "signed";
  } else {
    pdfMeta.status = "partially_signed";
  }

  await pdfMeta.save();
  return signedPath;
};