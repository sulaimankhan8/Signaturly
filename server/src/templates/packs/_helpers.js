// Shorthand shared by the template packs, so each template reads as its questions and its wording.

export const text = (id, label, extra = {}) => ({ id, label, type: "text", required: true, ...extra });
export const longtext = (id, label, extra = {}) => ({ id, label, type: "longtext", required: true, ...extra });
export const money = (id, label, extra = {}) => ({ id, label, type: "money", required: true, min: 1, ...extra });
export const date = (id, label, extra = {}) => ({ id, label, type: "date", required: true, ...extra });
export const number = (id, label, extra = {}) => ({ id, label, type: "number", required: true, ...extra });
export const choice = (id, label, options, extra = {}) => ({
  id,
  label,
  type: "select",
  required: true,
  options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
  ...extra,
});
export const optional = (question) => ({ ...question, required: false });

export const BLUE = "#3b82f6";
export const GREEN = "#10b981";
export const PURPLE = "#8b5cf6";

export const STAMP_CHECK = "Stamp duty depends on the state and on the kind of document. Check what applies before relying on this.";

// Every template here is a starting draft from the development team with no lawyer's review:
// `reviewer: null` shows it as "not yet reviewed" and keeps it out of the catalogue in production.
export const pack = (name) => ({ version: 1, language: "en", pack: name, reviewer: null, stateNotes: [] });

export const role = (id, name, nameFrom, color = BLUE, signingOrder = 1) => ({ id, name, nameFrom, color, signingOrder });

// What kind of signature the document usually takes, in cautious words
export const hint = {
  esign: (what) => ({ level: "esign_ok", text: `An ordinary electronic signature is usually used for ${what}. ${STAMP_CHECK}` }),
  stamp: (words) => ({ level: "stamp_duty", text: words }),
  check: (words) => ({ level: "check", text: words }),
};

// Body blocks
export const title = (words) => ({ type: "title", text: words });
export const subtitle = (words) => ({ type: "subtitle", text: words });
export const p = (words, showIf) => ({ type: "paragraph", text: words, ...(showIf ? { showIf } : {}) });
export const c = (heading, words, extra = {}) => ({ type: "clause", heading, text: words, ...extra });
export const note = (words) => ({ type: "note", text: words });
export const table = (rows) => ({ type: "table", rows });
export const list = (items) => ({ type: "list", items });
export const sign = (roles) => ({ type: "signatures", ...(roles ? { roles } : {}) });

// Shows a block or item only for one answer to a choice question
export const when = (question, equals) => ({ question, equals });

// The closing clause most agreements share. The template must ask `cityQuestion`.
export const cityQuestion = text("city", "City whose courts will hear any dispute");
export const law = c("Law and disputes", "This document is governed by the laws of India. The courts at {{city}} have jurisdiction over any dispute arising from it.");
