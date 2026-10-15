import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from "pdf-lib";
import { percentToPdfCoords, visualFrameOf } from "./coordinate.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { readFile, saveFile } from "./storage.service.js";
import { currentKeyOf, nextVersionKeyOf } from "./documentFiles.service.js";
import { createChainedAuditLog } from "./auditLedger.service.js";
import { drawShapedText } from "./textShaping.service.js";
import { formatDate } from "../utils/format.js";
import { describeIdentityCheck } from "../utils/identityCheck.js";
import { IMAGE_FIELD_TYPES, MAX_FIELD_TEXT_LENGTH, isRequired } from "./fieldRules.service.js";

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
export const getImageBuffer = async (source, ownerId) => {
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

const IMAGE_WORDS = { signature: "signature", initials: "initials", stamp: "stamp" };

/** Text written into a field, or "" when it stays blank */
const textOf = (field) => {
  if (field.type === "checkbox" || field.type === "radio") return "";
  const value = typeof field.value === "string" ? field.value.replace(/\s+/g, " ").trim() : "";
  // An owner's date field left blank takes today's date
  if (field.type === "date" && !value) return formatDate(new Date());
  return value.slice(0, MAX_FIELD_TEXT_LENGTH);
};

/**
 * Draws one field. Coordinates are in the page as a reader sees it (see coordinate.service.js):
 * the caller has already turned the drawing to match the page's rotation and crop.
 */
const drawField = async ({ pdfDoc, page, field, box, frame, ownerId }) => {
  const { x, y, width, height } = box;

  if (IMAGE_FIELD_TYPES.has(field.type)) {
    const source = field.signatureUrl || field.value;
    if (!source) {
      if (isRequired(field)) {
        throw new ApiError(422, `The ${IMAGE_WORDS[field.type]} on page ${field.page} is missing`);
      }
      return;
    }

    const imageBuffer = await getImageBuffer(source, ownerId);
    if (!imageBuffer) throw new ApiError(422, `The ${IMAGE_WORDS[field.type]} on page ${field.page} could not be read`);

    let image = null;
    try {
      image = imageBuffer.subarray(0, 4).equals(PNG_MAGIC) ? await pdfDoc.embedPng(imageBuffer) : await pdfDoc.embedJpg(imageBuffer);
    } catch (err) {
      // A signature that cannot be drawn must stop the signing, never leave the document "signed" without it
      throw new ApiError(422, `The ${IMAGE_WORDS[field.type]} on page ${field.page} could not be read. Please create it again.`);
    }

    const natural = image.scale(1);
    const scale = Math.min(width / natural.width, height / natural.height);
    const drawWidth = natural.width * scale;
    const drawHeight = natural.height * scale;

    page.drawImage(image, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
    return;
  }

  if (field.type === "checkbox") {
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
    return;
  }

  if (field.type === "radio") {
    const radius = (Math.min(width, height) * 0.6) / 2;
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
      page.drawCircle({ x: centerX, y: centerY, size: radius * 0.6, color: rgb(0, 0, 0) });
    }
    return;
  }

  // text, name, email, date and dropdown are written as one line of text
  const value = textOf(field);
  if (!value) return;

  const fontSize = field.fontSizePercent ? field.fontSizePercent * frame.height : height * 0.55;
  const padLeft = 8 * (frame.width / 612);

  // Shaped drawing keeps every script intact; long values shrink to stay inside the field
  drawShapedText(page, value, {
    x: x + padLeft,
    y: y + height / 2 - fontSize * 0.35,
    size: Math.max(8, fontSize),
    maxWidth: Math.max(10, width - padLeft * 2),
  });
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

  for (const field of fields) {
    const pageNumber = parseInt(field.page, 10);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdfDoc.getPageCount()) {
      throw new ApiError(422, `A field is on page ${field.page}, which this document does not have`);
    }

    const page = pdfDoc.getPage(pageNumber - 1);
    const frame = visualFrameOf(page);

    const widthPercent = Math.max(0.01, Math.min(1, Number(field.widthPercent) || 0));
    const heightPercent = Math.max(0.005, Math.min(1, Number(field.heightPercent) || 0));
    const box = percentToPdfCoords({
      xPercent: Math.max(0, Math.min(1 - widthPercent, Number(field.xPercent) || 0)),
      yPercent: Math.max(0, Math.min(1 - heightPercent, Number(field.yPercent) || 0)),
      widthPercent,
      heightPercent,
      pdfWidth: frame.width,
      pdfHeight: frame.height,
    });

    // Draw in the page as it is shown, whatever its rotation or crop
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...frame.matrix));
    try {
      await drawField({ pdfDoc, page, field, box, frame, ownerId: pdfMeta.userId });
    } finally {
      page.pushOperators(popGraphicsState());
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
    authMethod = describeIdentityCheck(rec);
    otpVerified = Boolean(rec?.authVerified && rec.authVerifiedAt && ["email_otp", "sms_otp"].includes(rec.authMethod));
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
