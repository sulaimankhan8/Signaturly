import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { signPdf } from "../services/pdfSign.service.js";
import { sealDocument } from "../services/pdfSeal.service.js";
import { ApiError } from "../utils/ApiError.js";
import { Pdf } from "../models/Pdf.model.js";
import mongoose from "mongoose";
import { getFileUrl } from "../services/storage.service.js";
import { currentKeyOf, downloadKeyOf } from "../services/documentFiles.service.js";
import { withDocumentLock } from "../services/documentLock.service.js";
import { assertRecordAccess, assertTwoFactorRuleFor } from "../services/authorize.service.js";
import { normalizeField, normalizeFieldList, missingRequired, problemWithValue, MAX_FIELDS } from "../services/fieldRules.service.js";
import { formatDate } from "../utils/format.js";

// Without `action`, only the person who made the document passes. With one, the workspace's
// roles decide, as everywhere else.
const loadOwnedPdf = async (pdfId, userId, action = null) => {
  if (typeof pdfId !== "string" || !mongoose.isValidObjectId(pdfId)) {
    throw new ApiError(400, "Invalid document identifier");
  }

  const pdf = await Pdf.findOne({ _id: pdfId, deletedAt: null });
  if (!pdf) {
    throw new ApiError(404, "PDF not found");
  }
  if (action) {
    await assertRecordAccess(pdf, userId, action, { notFound: "PDF not found" });
    return pdf;
  }
  if (pdf.userId.toString() !== userId) {
    throw new ApiError(403, "Unauthorized");
  }
  // The creator of a team's document is still held to the team's two-step rule
  await assertTwoFactorRuleFor(pdf, userId);
  return pdf;
};

// Out for signature, or done with signers: its fields are no longer the sender's to change
const hasBeenSent = (pdf) => (pdf.recipients || []).length > 0 || !["draft", "uploaded", "signed"].includes(pdf.status);

// Signing your own document: only the owner, and only before it has been sent to anyone
export const signPdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.body.pdfId, req.user.id);

  if (hasBeenSent(pdf)) {
    throw new ApiError(409, "This document has been sent for signature and can no longer be edited");
  }

  if (!Array.isArray(req.body.fields)) {
    throw new ApiError(400, "Fields are required");
  }

  // The owner is the signer: their name and email fill those fields, and the same rules apply
  // as for anyone else signing
  const fields = normalizeFieldList(req.body.fields, { pageCount: pdf.pageCount, values: "all" }).map((field) => {
    if (field.type === "name") return { ...field, value: req.user.name || "" };
    if (field.type === "email") return { ...field, value: req.user.email || "" };
    if (field.type === "date" && !field.value) return { ...field, value: formatDate(new Date()) };
    return field;
  });

  for (const field of fields) {
    const problem = problemWithValue(field);
    if (problem) throw new ApiError(422, problem, [{ field: field.id, message: problem }]);
  }
  const missing = missingRequired(fields);
  if (missing.length > 0) {
    throw new ApiError(
      422,
      `Please complete all required fields (${missing.length} remaining)`,
      missing.map((f) => ({ field: f.id, message: "Required" }))
    );
  }

  await withDocumentLock(pdf._id, async () => {
    await signPdf({
      pdfId: pdf._id,
      userId: req.user.id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      fields,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    // The owner's signed copy is sealed like any completed document
    await sealDocument(pdf._id);
  });

  // The editor's work is now on the page
  await Pdf.updateOne({ _id: pdf._id }, { $set: { draft: null } });

  const signed = await Pdf.findById(pdf._id);

  res.status(200).json(
    new ApiResponse({
      signedPdfUrl: await getFileUrl(await downloadKeyOf(signed)),
    })
  );
});

export const getPdfController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id, "document.read");

  // The editor works on the latest signed version, so earlier signatures stay visible while adding more.
  // (The sealed copy is for download: it carries the signing record and must not be edited.)
  res.json(
    new ApiResponse({
      url: await getFileUrl(await currentKeyOf(pdf)),
      pageCount: pdf.pageCount,
      originalFileName: pdf.originalFileName,
      status: pdf.status,
      sent: hasBeenSent(pdf),
      // What the editor was doing when it last saved, to pick up where the sender left off
      draft: hasBeenSent(pdf) ? null : pdf.draft || null,
    })
  );
});

// ----- drafts -----

const MAX_DRAFT_RECIPIENTS = 50;
const REMINDER_CADENCES = ["none", "3days", "5days", "daily"];

const shortText = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

// The recipients as the sender has entered them so far. Passcodes are never kept in a draft.
const cleanDraftRecipients = (list) =>
  (Array.isArray(list) ? list : []).slice(0, MAX_DRAFT_RECIPIENTS).map((r, index) => ({
    id: shortText(r?.id, 64) || `recipient-${index + 1}`,
    name: shortText(r?.name, 120),
    email: shortText(r?.email, 200),
    phone: shortText(r?.phone, 30),
    channel: ["email", "sms", "whatsapp"].includes(r?.channel) ? r.channel : "email",
    language: shortText(r?.language, 10) || "en",
    role: ["signer", "viewer", "approver"].includes(r?.role) ? r.role : "signer",
    color: shortText(r?.color, 20),
    authType: ["none", "otp", "passcode"].includes(r?.authType) ? r.authType : "none",
    signatureType: r?.signatureType === "aadhaar" ? "aadhaar" : "electronic",
    isSender: Boolean(r?.isSender),
  }));

const cleanDraftSettings = (settings = {}) => ({
  signingOrder: Boolean(settings?.signingOrder),
  emailSubject: shortText(settings?.emailSubject, 200),
  message: shortText(settings?.message, 2000),
  reminderCadence: REMINDER_CADENCES.includes(settings?.reminderCadence) ? settings.reminderCadence : "none",
  expiresAt: shortText(settings?.expiresAt, 30),
});

/**
 * Saves the editor's work as the sender goes: who signs, where the fields are and the email
 * settings. Signature images are not kept; the editor applies the sender's signature again
 * when the document is reopened.
 */
export const saveDraftController = asyncHandler(async (req, res) => {
  const pdf = await loadOwnedPdf(req.params.id, req.user.id, "document.send");

  if (hasBeenSent(pdf)) {
    throw new ApiError(409, "This document has been sent for signature and can no longer be edited");
  }

  const { mode, fields, recipients, settings } = req.body || {};
  if (fields != null && !Array.isArray(fields)) throw new ApiError(400, "fields must be a list");
  if (Array.isArray(fields) && fields.length > MAX_FIELDS) throw new ApiError(400, `A document can have at most ${MAX_FIELDS} fields`);

  // A field the editor holds mid-change (a choice list being emptied, say) is left out rather
  // than failing the whole save
  const keptFields = [];
  for (const raw of fields || []) {
    try {
      keptFields.push(normalizeField(raw, { pageCount: pdf.pageCount, values: "draft" }));
    } catch {
      // skipped
    }
  }

  const draft = {
    mode: mode === "self" ? "self" : "send",
    fields: keptFields,
    recipients: cleanDraftRecipients(recipients),
    settings: cleanDraftSettings(settings),
    updatedAt: new Date(),
  };

  await Pdf.updateOne({ _id: pdf._id }, { $set: { draft } });

  res.status(200).json(new ApiResponse({ updatedAt: draft.updatedAt, fieldsSaved: keptFields.length }, "Draft saved"));
});
