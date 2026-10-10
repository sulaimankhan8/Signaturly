import { PDFDocument, rgb } from "pdf-lib";
import { percentToPdfCoords } from "./coordinate.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { readFile, saveFile } from "./storage.service.js";
import { currentKeyOf, nextVersionKeyOf } from "./documentFiles.service.js";
import { createChainedAuditLog } from "./auditLedger.service.js";

export const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

const looksLikeImage = (buffer) =>
  buffer.subarray(0, 4).equals(PNG_MAGIC) || buffer.subarray(0, 3).equals(JPEG_MAGIC);

/**
 * Loads a signature image. Only two sources are accepted:
 *  - an inline PNG or JPEG data URL, and
 *  - a file already stored in the document owner's own folder.
 * The server never fetches a remote address and never reads an arbitrary path.
 */
const getImageBuffer = async (source, ownerId) => {
  if (typeof source !== "string" || !source) return null;

  let buffer = null;

  if (source.startsWith("data:")) {
    const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/.exec(source);
    if (!match) {
      throw new ApiError(422, "Signature images must be PNG or JPEG");
    }
    buffer = Buffer.from(match[2], "base64");
  } else if (source.startsWith("/uploads/")) {
    const key = decodeURIComponent(source.replace(/^\/uploads\//, "").split("?")[0]);
    if (!ownerId || key.split("/")[0] !== String(ownerId)) {
      throw new ApiError(422, "Signature image is not available");
    }
    buffer = await readFile(key);
  } else {
    throw new ApiError(422, "Signature images must be uploaded directly, not linked");
  }

  if (!buffer || buffer.length === 0) return null;
  if (buffer.length > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new ApiError(413, "Signature image is too large (2 MB maximum)");
  }
  if (!looksLikeImage(buffer)) {
    throw new ApiError(422, "Signature images must be PNG or JPEG");
  }
  return buffer;
};

const executeSignPdf = async ({
  pdfId,
  userId = null,
  recipientId = null,
  actorName = "User",
  actorEmail = "",
  fields = [],
  ipAddress = "",
  userAgent = "",
  consentVersion = "",
  isFinalCompletion = true,
}) => {
    const pdfMeta = await Pdf.findById(pdfId);
  if (!pdfMeta) throw new ApiError(404, "PDF not found");

  // Stamp on top of the latest working copy and write the result as a new version;
  // the original upload and every earlier version stay as they were
  const inputKey = await currentKeyOf(pdfMeta);
  const outputKey = nextVersionKeyOf(pdfMeta);

  const originalBuffer = await readFile(inputKey);
  const originalHash = sha256FromBuffer(originalBuffer);

  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  
  // Process each field
  for (const field of fields) {
    const parsedPage = parseInt(field.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      console.warn("Skipping field with invalid page number:", field.id, "page:", field.page);
      continue;
    }
    const pageIndex = parsedPage - 1;
    if (pageIndex >= pdfDoc.getPageCount()) {
      console.error("Invalid page number:", field.page, "— doc only has", pdfDoc.getPageCount(), "pages");
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

        const imageBuffer = await getImageBuffer(signatureAsset, pdfMeta.userId);
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

        const imageBuffer = await getImageBuffer(initialsAsset, pdfMeta.userId);
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

  await saveFile(outputKey, Buffer.from(signedBytes), "application/pdf");

  // Describe the identity check that was really passed, read from the signer's record
  let authMethod = "Account login";
  let otpVerified = false;

  if (recipientId) {
    const rec = await Recipient.findById(recipientId);
    const passed = rec?.authVerified === true && rec.authVerifiedAt;
    if (passed && rec.authMethod === "email_otp") {
      authMethod = "Email link + one-time code";
      otpVerified = true;
    } else if (passed && rec.authMethod === "passcode") {
      authMethod = "Email link + access passcode";
    } else {
      authMethod = "Email link";
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
    description: `${actorName} completed the required fields and signed electronically (${authMethod}).`,
    ipAddress,
    userAgent,
    otpVerified,
    authMethod,
    consentVersion,
    signedAt: new Date(),
  });

  // Recorded with one atomic update so the caller's own copy of the document cannot overwrite it
  await Pdf.updateOne(
    { _id: pdfMeta._id },
    {
      $push: { versions: { key: outputKey, hash: signedHash, recipientId, actorEmail } },
      $set: { status: isFinalCompletion ? "signed" : "partially_signed" },
    }
  );

  return outputKey;
};

/**
 * Stamps fields onto the document. Callers must hold the document lock
 * (see documentLock.service.js) and must have checked permissions already.
 */
export const signPdf = executeSignPdf;
