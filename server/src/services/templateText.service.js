import { normalizePhone } from "./messaging/index.js";

/**
 * The wording side of guided templates: checking a sender's answers against a template's
 * questions, and filling the answers into the template's text.
 *
 * Template text carries placeholders in double braces. A placeholder names a question and may
 * pass the answer through filters:
 *
 *   {{tenant_name}}                     the answer as typed
 *   {{rent|money}}                      Rs. 15,000
 *   {{rent|words}}                      Rupees Fifteen Thousand only
 *   {{start_date|date}}                 1 November 2026
 *   {{start_date|addMonths:11|date}}    1 October 2027
 *
 * Nothing here reads the clock, so the same answers always give the same text.
 */

// What an unanswered question leaves in the text, so a half-filled draft still reads as a document
export const BLANK = "____________";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDate = (value) => {
  const match = ISO_DATE.exec(String(value ?? ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  // Rejects dates such as 31 February, which JavaScript would roll into March
  return date.getUTCDate() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1 ? date : null;
};

const toIso = (date) => date.toISOString().slice(0, 10);

const LOCALES = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", gu: "gu-IN", bn: "bn-IN" };

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const belowThousand = (n) =>
  n < 100 ? belowHundred(n) : `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` and ${belowHundred(n % 100)}` : ""}`;

/**
 * A whole number in words, grouped the Indian way: 1,25,000 is "One Lakh Twenty Five Thousand".
 */
export const numberInWords = (value) => {
  const n = Math.floor(Math.abs(Number(value)));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "Zero";

  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${numberInWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
};

const FILTERS = {
  // English contracts write "Rs." so the amount stays ordinary, selectable text in the PDF
  money: (value, _arg, language) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return BLANK;
    const digits = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
    return language === "en" ? `Rs. ${digits}` : `₹${digits}`;
  },
  words: (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return BLANK;
    const paise = Math.round((amount - Math.floor(amount)) * 100);
    return `Rupees ${numberInWords(amount)}${paise ? ` and ${numberInWords(paise)} Paise` : ""} only`;
  },
  number: (value) => (Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-IN").format(Number(value)) : BLANK),
  inWords: (value) => (Number.isFinite(Number(value)) ? numberInWords(value) : BLANK),
  date: (value, _arg, language) => {
    const date = parseDate(value);
    if (!date) return BLANK;
    return new Intl.DateTimeFormat(LOCALES[language] || LOCALES.en, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  },
  addMonths: (value, arg) => {
    const date = parseDate(value);
    if (!date) return "";
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + Number(arg || 0));
    // 31 January plus one month is the last day of February, not 3 March
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return toIso(date);
  },
  addDays: (value, arg) => {
    const date = parseDate(value);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + Number(arg || 0));
    return toIso(date);
  },
  upper: (value) => String(value).toUpperCase(),
  yesNo: (value) => (value === true || value === "true" ? "Yes" : "No"),
};

export const KNOWN_FILTERS = Object.keys(FILTERS);

const PLACEHOLDER = /\{\{\s*([\w]+)((?:\s*\|\s*[\w]+(?::[-\w.]+)?)*)\s*\}\}/g;

/**
 * Every placeholder in a piece of template text: the question it names and its filters.
 */
export const placeholdersIn = (text) =>
  [...String(text ?? "").matchAll(PLACEHOLDER)].map((match) => ({
    question: match[1],
    filters: match[2]
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.split(":")[0]),
  }));

const isEmpty = (value) => value === undefined || value === null || value === "";

/**
 * Fills answers into template text. An unanswered question leaves a blank line to write on.
 * Select answers are shown by their label, not their stored value.
 */
export const fillText = (text, answers, { language = "en", questions = [] } = {}) =>
  String(text ?? "").replace(PLACEHOLDER, (_match, id, filterText) => {
    let value = answers?.[id];
    if (isEmpty(value)) return BLANK;

    const question = questions.find((q) => q.id === id);
    const filters = filterText
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    if (filters.length === 0 && question?.type === "select") {
      value = question.options?.find((option) => option.value === value)?.label ?? value;
    }

    for (const filter of filters) {
      const [name, arg] = filter.split(":");
      if (!FILTERS[name]) return BLANK;
      value = FILTERS[name](value, arg, language);
      if (isEmpty(value)) return BLANK;
    }
    return String(value);
  });

/**
 * Whether a block or a question applies, given the answers so far.
 *   { question: "has_deposit", equals: true }
 *   { question: "notice_by", notEquals: "none" }
 *   { question: "witness_name", answered: true }
 */
export const applies = (condition, answers) => {
  if (!condition) return true;
  const value = answers?.[condition.question];
  if ("equals" in condition) return value === condition.equals;
  if ("notEquals" in condition) return value !== condition.notEquals;
  if ("answered" in condition) return !isEmpty(value) === Boolean(condition.answered);
  return true;
};

const LIMITS = { text: 200, longtext: 2000 };

const checkOne = (question, raw) => {
  switch (question.type) {
    case "text":
    case "longtext": {
      if (typeof raw !== "string") return { error: "Enter text" };
      const value = raw.trim();
      const max = question.maxLength || LIMITS[question.type];
      if (value.length > max) return { error: `Keep this under ${max} characters` };
      return { value };
    }
    case "number":
    case "money": {
      const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[,\s]/g, ""));
      if (!Number.isFinite(value)) return { error: "Enter a number" };
      const min = question.min ?? 0;
      if (value < min) return { error: `Enter ${min} or more` };
      if (question.max !== undefined && value > question.max) return { error: `Enter ${question.max} or less` };
      if (question.type === "number" && !Number.isInteger(value) && !question.decimals) return { error: "Enter a whole number" };
      return { value };
    }
    case "date": {
      if (!parseDate(raw)) return { error: "Enter a date" };
      return { value: String(raw) };
    }
    case "select": {
      if (!question.options?.some((option) => option.value === raw)) return { error: "Choose one of the options" };
      return { value: raw };
    }
    case "boolean": {
      if (raw === true || raw === "true") return { value: true };
      if (raw === false || raw === "false") return { value: false };
      return { error: "Choose yes or no" };
    }
    case "email": {
      const value = String(raw).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: "Enter an email address" };
      return { value };
    }
    case "phone": {
      const value = normalizePhone(String(raw));
      if (!value) return { error: "Enter a mobile number" };
      return { value };
    }
    default:
      return { error: "Unknown question type" };
  }
};

/**
 * Checks answers against a template's questions.
 *
 * @param {{ partial?: boolean, today?: string, defaults?: boolean }} options
 *   partial:  a draft or a preview, where unanswered questions are allowed
 *   today:    the sender's date (YYYY-MM-DD), used by questions whose default is "today"
 *   defaults: false leaves unanswered questions unanswered. A saved draft must not freeze
 *             "today" as the day the draft was saved.
 * @returns {{ answers: object, errors: object }} cleaned answers, and a message per question at fault.
 *   Answers to questions the template does not ask are dropped.
 */
export const checkAnswers = (definition, given = {}, { partial = false, today, defaults = true } = {}) => {
  const answers = {};
  const errors = {};
  const source = given && typeof given === "object" && !Array.isArray(given) ? given : {};

  for (const question of definition.questions || []) {
    let raw = source[question.id];
    if (defaults && isEmpty(raw) && question.default !== undefined) {
      raw = question.default === "today" ? today : question.default;
    }

    if (isEmpty(raw)) {
      // A question that does not apply is not missing. Later questions may depend on earlier answers.
      if (!partial && question.required && applies(question.showIf, answers)) errors[question.id] = "This is needed";
      continue;
    }

    const { value, error } = checkOne(question, raw);
    if (error) errors[question.id] = error;
    else answers[question.id] = value;
  }

  return { answers, errors };
};
