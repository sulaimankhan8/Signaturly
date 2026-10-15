/**
 * The kinds of field a document can hold, and what a signer must do with each.
 *
 * The server applies the same rules (server/src/services/fieldRules.service.js); change both
 * together so the signer is guided exactly the way their submission is checked.
 *
 * Sizes are in PDF points (1/72 inch), so a field is the same physical size on an A4, a Letter
 * or a landscape page.
 */
import { formatFieldDate } from "../../utils/fieldDate";

export const FIELD_TYPES = {
  signature: { label: "Signature", hint: "Drawn, typed or stamped", size: [170, 50], image: true },
  initials: { label: "Initials", hint: "A short mark on each page", size: [64, 40], image: true },
  stamp: { label: "Company stamp", hint: "The signer adds their seal", size: [96, 96], image: true },
  name: { label: "Full name", hint: "Filled with the signer's name", size: [170, 22], auto: true, text: true },
  email: { label: "Email", hint: "Filled with the signer's email", size: [190, 22], auto: true, text: true },
  date: { label: "Date signed", hint: "The day they sign", size: [110, 22], auto: true, text: true },
  text: { label: "Text", hint: "Anything they type", size: [170, 22], text: true },
  dropdown: { label: "Dropdown", hint: "One choice from a list", size: [150, 22], text: true },
  checkbox: { label: "Checkbox", hint: "Ticked or left empty", size: [16, 16], square: true },
  radio: { label: "Radio group", hint: "One answer from options", size: [16, 16], square: true },
};

// What each editor offers. Signing your own document needs no questions for anyone else.
export const PALETTE = {
  self: ["signature", "initials", "name", "email", "date", "text", "checkbox"],
  send: ["signature", "initials", "stamp", "name", "email", "date", "text", "dropdown", "checkbox", "radio"],
  template: ["signature", "initials", "stamp", "name", "email", "date", "text", "dropdown", "checkbox", "radio"],
};

export const TEXT_FORMATS = [
  { value: "", label: "Any text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email address" },
  { value: "date", label: "Date" },
];

export const typeOf = (field) => FIELD_TYPES[field?.type] || FIELD_TYPES.text;

export const labelOf = (field) => (field ? field.label || typeOf(field).label : "");

/** Whether the signer must complete it. Filled-in-for-you fields never wait on the signer. */
export const isRequired = (field) => {
  if (typeOf(field).auto) return false;
  if (typeof field.required === "boolean") return field.required;
  return field.type !== "checkbox";
};

export const isTicked = (field) => field.checked === true || field.value === true || field.value === "true";

export const isFilled = (field) => {
  if (typeOf(field).image) return Boolean(field.signatureUrl || field.value);
  if (field.type === "checkbox" || field.type === "radio") return isTicked(field);
  if (typeOf(field).auto) return true;
  return typeof field.value === "string" && field.value.trim() !== "";
};

/** Required fields still empty, in reading order. A radio group counts once. */
export const outstandingRequired = (fields) => {
  const missing = [];
  const groups = new Map();

  for (const field of sortForReading(fields)) {
    if (!isRequired(field)) continue;
    if (field.type === "radio") {
      const key = field.groupId || field.id;
      if (!groups.has(key)) {
        groups.set(key, []);
        missing.push({ group: key, field });
      }
      groups.get(key).push(field);
    } else if (!isFilled(field)) {
      missing.push({ field });
    }
  }

  return missing
    .filter((entry) => !entry.group || !groups.get(entry.group).some(isTicked))
    .map((entry) => entry.field);
};

/** Page by page, top to bottom, left to right: the order a person reads and tabs through */
export const sortForReading = (fields) =>
  [...fields].sort((a, b) => a.page - b.page || a.yPercent - b.yPercent || a.xPercent - b.xPercent);

// ---- checks on what was typed, matching the server's ----

const NUMBER_PATTERN = /^-?(\d{1,3}(,\d{2,3})*|\d+)(\.\d+)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const problemWithValue = (field) => {
  const value = typeof field.value === "string" ? field.value.trim() : "";
  if (!value || field.type !== "text") return null;
  if (field.format === "number" && !NUMBER_PATTERN.test(value)) return "Enter a number";
  if (field.format === "email" && !EMAIL_PATTERN.test(value)) return "Enter an email address";
  return null;
};

// ---- making fields ----

export const newFieldId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A new field of `type` centred on (xPercent, yPercent) of a page whose natural size is
 * `pageSize` in points, kept wholly on the page.
 */
export const makeField = (type, { page, xPercent, yPercent, pageSize, owner = {}, mode = "send" }) => {
  const [wPt, hPt] = FIELD_TYPES[type].size;
  const widthPercent = Math.min(0.9, wPt / (pageSize?.width || 612));
  const heightPercent = Math.min(0.5, hPt / (pageSize?.height || 792));

  const field = {
    id: newFieldId(),
    type,
    page,
    xPercent: clamp(xPercent - widthPercent / 2, 0, 1 - widthPercent),
    yPercent: clamp(yPercent - heightPercent / 2, 0, 1 - heightPercent),
    widthPercent,
    heightPercent,
    required: type === "checkbox" ? false : !FIELD_TYPES[type].auto,
    label: "",
    value: "",
    checked: false,
    ...owner,
  };

  if (type === "dropdown") field.options = ["Option 1", "Option 2"];
  if (type === "radio") field.groupId = newFieldId();
  if (type === "text") {
    field.placeholder = "";
    field.format = "";
  }
  if (mode === "self" && type === "date") field.value = formatFieldDate();
  return field;
};

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Keeps a field's box on its page */
export const clampToPage = (field) => {
  const widthPercent = clamp(field.widthPercent, 0.01, 1);
  const heightPercent = clamp(field.heightPercent, 0.005, 1);
  return {
    ...field,
    widthPercent,
    heightPercent,
    xPercent: clamp(field.xPercent, 0, 1 - widthPercent),
    yPercent: clamp(field.yPercent, 0, 1 - heightPercent),
  };
};

