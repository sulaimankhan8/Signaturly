import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import { formatDate } from "../utils/format.js";

/**
 * What a field on a document is, what a signer must do with it, and what the server writes
 * into it. Every path that stores or fills fields (sending, templates, drafts, signing your own
 * document, a signer's submission) goes through here, so they all follow the same rules.
 *
 * The browser has its own copy of the completion rules in client/src/components/editor/fieldTypes.js
 * so the signer is guided the same way the server checks; change both together.
 */

export const FIELD_TYPES = ["signature", "initials", "stamp", "text", "name", "email", "date", "checkbox", "radio", "dropdown"];

// Filled with an image: a signature, initials, or a company stamp
export const IMAGE_FIELD_TYPES = new Set(["signature", "initials", "stamp"]);

// Written by the server when the signer signs; the signer sees them but cannot change them.
// A date field is the date of signing by the server's clock, so a document cannot be back-dated.
export const AUTO_FIELD_TYPES = new Set(["date", "name", "email"]);

// What a text field accepts
export const TEXT_FORMATS = ["", "number", "email", "date"];

export const MAX_FIELDS = 500;
export const MAX_FIELD_TEXT_LENGTH = 500;
const MAX_LABEL_LENGTH = 80;
const MAX_OPTIONS = 50;
const MAX_OPTION_LENGTH = 100;

// 05 Oct 2026; the server's own dates write September as "Sept"
const DATE_PATTERN = /^\d{1,2} [A-Z][a-z]{2,3} \d{4}$/;
const NUMBER_PATTERN = /^-?(\d{1,3}(,\d{2,3})*|\d+)(\.\d+)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const newId = () => `field-${crypto.randomBytes(6).toString("hex")}`;

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const shortText = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

/** Whether the signer must complete the field. Checkboxes are optional unless the sender says otherwise. */
export const isRequired = (field) => {
  if (AUTO_FIELD_TYPES.has(field.type)) return false;
  if (typeof field.required === "boolean") return field.required;
  return field.type !== "checkbox";
};

const isTicked = (field) => field.checked === true || field.value === true || field.value === "true";

/** Whether the field holds what it needs. Radio buttons are judged as a group by `missingRequired`. */
export const isFieldFilled = (field) => {
  if (IMAGE_FIELD_TYPES.has(field.type)) return Boolean(field.signatureUrl || field.value);
  if (field.type === "checkbox" || field.type === "radio") return isTicked(field);
  if (AUTO_FIELD_TYPES.has(field.type)) return true;
  return typeof field.value === "string" && field.value.trim() !== "";
};

/** The required fields still empty. A radio group counts once, by its first option. */
export const missingRequired = (fields) => {
  const missing = [];
  const groups = new Map();

  for (const field of fields) {
    if (!isRequired(field)) continue;
    if (field.type === "radio") {
      const key = field.groupId || field.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(field);
    } else if (!isFieldFilled(field)) {
      missing.push(field);
    }
  }

  for (const group of groups.values()) {
    if (!group.some(isTicked)) missing.push(group[0]);
  }
  return missing;
};

const nameOf = (field) => (field.label ? `"${field.label}"` : `The ${field.type} field on page ${field.page}`);

/** A problem with what the signer wrote, in words, or null. Empty values are judged by `missingRequired`. */
export const problemWithValue = (field) => {
  const value = typeof field.value === "string" ? field.value.trim() : "";
  if (!value) return null;

  if (field.type === "text") {
    if (field.format === "number" && !NUMBER_PATTERN.test(value)) return `${nameOf(field)} must be a number`;
    if (field.format === "email" && !EMAIL_PATTERN.test(value)) return `${nameOf(field)} must be an email address`;
    if (field.format === "date" && !DATE_PATTERN.test(value)) return `${nameOf(field)} must be a date`;
  }
  if (field.type === "dropdown" && !(field.options || []).includes(value)) {
    return `${nameOf(field)} must be one of its listed choices`;
  }
  return null;
};

/**
 * Cleans one field as a sender or the API described it: a known type, a position on the page,
 * and only the settings that type uses.
 *
 * values:
 *   "layout"  what a sender may set for a signer: a pre-filled text or a default choice
 *   "all"     also ticks and images, for the owner signing their own document
 *   "draft"   like "all" but without images, which the editor applies again when it reopens
 */
export const normalizeField = (raw, { pageCount = null, values = "layout" } = {}) => {
  const source = raw && typeof raw.toObject === "function" ? raw.toObject() : { ...(raw || {}) };

  if (!FIELD_TYPES.includes(source.type)) {
    throw new ApiError(400, `Unknown field type "${String(source.type ?? "").slice(0, 30)}"`);
  }
  const type = source.type;

  const page = parseInt(source.page, 10) || 1;
  if (page < 1 || (pageCount && page > pageCount)) {
    throw new ApiError(400, `A field is on page ${page}, but the document has ${pageCount} page${pageCount === 1 ? "" : "s"}`);
  }

  const widthPercent = clamp(toNumber(source.widthPercent, 0.2), 0.01, 1);
  const heightPercent = clamp(toNumber(source.heightPercent, 0.05), 0.005, 1);

  const field = {
    id: typeof source.id === "string" && source.id ? source.id.slice(0, 64) : source._id ? String(source._id) : newId(),
    type,
    page,
    // Kept wholly on the page
    xPercent: clamp(toNumber(source.xPercent, 0), 0, 1 - widthPercent),
    yPercent: clamp(toNumber(source.yPercent, 0), 0, 1 - heightPercent),
    widthPercent,
    heightPercent,
    label: shortText(source.label, MAX_LABEL_LENGTH).trim(),
    required: isRequired({ type, required: source.required }),
  };

  const fontSizePercent = toNumber(source.fontSizePercent, 0);
  if (fontSizePercent > 0) field.fontSizePercent = clamp(fontSizePercent, 0.002, 0.2);

  // Who the field is for, as the caller named them; send.service.js turns this into a recipient id
  for (const key of ["recipientId", "recipientEmail", "recipientPhone", "recipientName", "recipientColor", "roleId", "roleName", "roleColor"]) {
    if (typeof source[key] === "string" && source[key]) field[key] = source[key].slice(0, 200);
  }

  if (type === "text") {
    field.placeholder = shortText(source.placeholder, MAX_LABEL_LENGTH);
    field.format = TEXT_FORMATS.includes(source.format) ? source.format : "";
    field.value = shortText(source.value, MAX_FIELD_TEXT_LENGTH);
    // Read-only only makes sense with something written in it
    field.readOnly = Boolean(source.readOnly) && field.value.trim() !== "";
  }

  if (type === "dropdown") {
    const options = [...new Set((Array.isArray(source.options) ? source.options : []).map((o) => shortText(o, MAX_OPTION_LENGTH).trim()).filter(Boolean))].slice(0, MAX_OPTIONS);
    if (options.length === 0) throw new ApiError(400, `${nameOf(field)} needs at least one choice`);
    field.options = options;
    field.value = options.includes(source.value) ? source.value : "";
  }

  if (type === "radio") {
    field.groupId = shortText(source.groupId, 64) || field.id;
    field.checked = values === "layout" ? false : isTicked(source);
  }

  if (type === "checkbox") {
    field.checked = values === "layout" ? false : isTicked(source);
  }

  if (values !== "layout") {
    if (["name", "email", "date"].includes(type)) field.value = shortText(source.value, 120);
    if (IMAGE_FIELD_TYPES.has(type) && values === "all") {
      const image = (typeof source.signatureUrl === "string" && source.signatureUrl) || (typeof source.value === "string" && source.value) || "";
      field.signatureUrl = image;
      field.value = image;
    }
  }

  return field;
};

/** Cleans a list of fields. A radio group is required as a whole when any of its options is. */
export const normalizeFieldList = (list, options = {}) => {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new ApiError(400, "fields must be a list");
  if (list.length > MAX_FIELDS) throw new ApiError(400, `A document can have at most ${MAX_FIELDS} fields`);

  const seen = new Set();
  const fields = list.map((raw) => {
    const field = normalizeField(raw, options);
    if (seen.has(field.id)) field.id = newId();
    seen.add(field.id);
    return field;
  });

  const groupRequired = new Map();
  for (const field of fields) {
    if (field.type === "radio") groupRequired.set(field.groupId, groupRequired.get(field.groupId) || field.required);
  }
  for (const field of fields) {
    if (field.type === "radio") field.required = groupRequired.get(field.groupId);
  }
  return fields;
};

/**
 * Takes a signer's submission into their own fields and checks it.
 *
 * Only fields assigned to this recipient change. Dates, names and emails are written by the
 * server; read-only text keeps the sender's words; a radio group keeps one answer.
 * Throws 422 when a value is not valid or a required field is empty.
 *
 * Returns { merged: every field of the document, mine: this signer's fields }.
 */
export const mergeSignerFields = ({ fields, submitted, recipient, signedAt = new Date() }) => {
  const recipientId = String(recipient._id);
  const incomingById = new Map(
    (Array.isArray(submitted) ? submitted : []).filter((f) => f && typeof f.id === "string").map((f) => [f.id, f])
  );
  const signingDate = formatDate(signedAt);
  const isMine = (field) => field.recipientId && String(field.recipientId) === recipientId;

  const merged = (fields || []).map((stored) => {
    if (!isMine(stored)) return stored;
    const incoming = incomingById.get(stored.id) || {};
    const field = { ...stored, signedAt, signedBy: recipientId };

    if (stored.type === "date") field.value = signingDate;
    else if (stored.type === "name") field.value = recipient.name || "";
    else if (stored.type === "email") field.value = recipient.email || "";
    else if (IMAGE_FIELD_TYPES.has(stored.type)) {
      const image = (typeof incoming.signatureUrl === "string" && incoming.signatureUrl) || (typeof incoming.value === "string" && incoming.value) || "";
      field.signatureUrl = image;
      field.value = image;
    } else if (stored.type === "checkbox" || stored.type === "radio") {
      field.checked = isTicked(incoming);
      field.value = field.checked;
    } else if (stored.type === "text") {
      if (!stored.readOnly) {
        field.value = typeof incoming.value === "string" ? incoming.value.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_TEXT_LENGTH) : stored.value || "";
      }
    } else if (stored.type === "dropdown") {
      field.value = typeof incoming.value === "string" ? incoming.value.trim() : stored.value || "";
    }
    return field;
  });

  // One answer per radio group: the first ticked option stands
  const answered = new Set();
  for (const field of merged) {
    if (!isMine(field) || field.type !== "radio" || !field.checked) continue;
    const key = field.groupId || field.id;
    if (answered.has(key)) {
      field.checked = false;
      field.value = false;
    } else {
      answered.add(key);
    }
  }

  const mine = merged.filter(isMine);

  for (const field of mine) {
    const problem = problemWithValue(field);
    if (problem) throw new ApiError(422, problem, [{ field: field.id, message: problem }]);
  }

  const missing = missingRequired(mine);
  if (missing.length > 0) {
    throw new ApiError(
      422,
      `Please complete all required fields (${missing.length} remaining)`,
      missing.map((f) => ({ field: f.id, message: "Required" }))
    );
  }

  return { merged, mine };
};

/** What a signer's browser needs of their own fields: no other signer's fields or answers. */
export const fieldsForSigner = (fields, recipientId) =>
  (fields || []).filter((f) => f.recipientId && String(f.recipientId) === String(recipientId));
