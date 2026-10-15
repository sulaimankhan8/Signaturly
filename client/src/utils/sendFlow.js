import { RECIPIENT_PALETTE } from "./constants";

/**
 * What the three steps of sending a document share: 1 who signs, 2 where they sign, 3 review
 * and send. The work is saved as a draft on the server as the sender goes (see saveDraftApi),
 * so a refresh, the back button or a closed tab loses nothing.
 */

export const sendSteps = (pdfId, navigate, current, { canReview = true } = {}) => [
  { label: "Recipients", active: current === 1, done: current > 1, onClick: current === 1 ? null : () => navigate(`/send/${pdfId}`) },
  { label: "Fields", active: current === 2, done: current > 2, onClick: current === 2 ? null : () => navigate(`/assign/${pdfId}`) },
  { label: "Review", active: current === 3, done: false, onClick: current === 3 || !canReview ? null : () => navigate(`/review/${pdfId}`) },
];

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

export const newRecipient = (index, extra = {}) => ({
  id: newId(),
  name: "",
  email: "",
  phone: "",
  channel: "email",
  language: "en",
  role: "signer",
  color: RECIPIENT_PALETTE[index % RECIPIENT_PALETTE.length].color,
  authType: "none",
  signatureType: "electronic",
  ...extra,
});

/** Signers who would get a document with nowhere to sign */
export const signersWithoutSignature = (recipients, fields) =>
  recipients.filter((r) => r.role === "signer" && !fields.some((f) => f.recipientId === r.id && f.type === "signature"));

/** Problems that stop the document going out, in words, in the order the sender should fix them */
export const sendProblems = (recipients, fields) => {
  const problems = [];
  if (recipients.length === 0) problems.push("Add at least one recipient.");
  if (fields.length === 0) problems.push("Place at least one field on the document.");
  for (const r of signersWithoutSignature(recipients, fields)) problems.push(`${r.name || "A signer"} has no signature field.`);
  const ids = new Set(recipients.map((r) => r.id));
  if (fields.some((f) => !ids.has(f.recipientId))) problems.push("Some fields are not given to anyone.");
  return problems;
};

// Passcodes are never saved in a draft; they are kept here, in this tab only, until the
// document is sent. After a refresh the review step asks for them again.
const passcodes = new Map();

export const rememberPasscode = (pdfId, recipientId, passcode) => {
  const key = `${pdfId}:${recipientId}`;
  if (passcode) passcodes.set(key, passcode);
  else passcodes.delete(key);
};

export const passcodeFor = (pdfId, recipientId) => passcodes.get(`${pdfId}:${recipientId}`) || "";

export const forgetPasscodes = (pdfId) => {
  for (const key of [...passcodes.keys()]) if (key.startsWith(`${pdfId}:`)) passcodes.delete(key);
};
