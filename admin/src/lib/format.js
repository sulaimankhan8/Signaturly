/**
 * How things are written on screen: money in rupees, dates as India writes them and in
 * India's time, and plain names for the server's status words.
 */

const INDIA = "Asia/Kolkata";

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupeesExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-IN");
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: INDIA });
const timeFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: INDIA });
const shortDayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const valid = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Whole rupees, or to the paisa when the amount has a fraction
export const inr = (amount) => {
  const value = Number(amount) || 0;
  return Number.isInteger(value) ? rupees.format(value) : rupeesExact.format(value);
};
export const paise = (amount) => rupeesExact.format((Number(amount) || 0) / 100);
export const count = (value) => whole.format(Number(value) || 0);

// 11 Oct 2026
export const day = (value) => {
  const date = valid(value);
  return date ? dayFormat.format(date) : "";
};
// 11 Oct 2026, 14:05
export const dateTime = (value) => {
  const date = valid(value);
  return date ? timeFormat.format(date) : "";
};
// "2026-10-11", a calendar day from the server, as 11 Oct
export const shortDay = (isoDay) => {
  const date = valid(`${isoDay}T00:00:00Z`);
  return date ? shortDayFormat.format(date) : "";
};

export const plural = (n, one, many = `${one}s`) => `${count(n)} ${Number(n) === 1 ? one : many}`;

// "partially_signed" as "Partially signed"
export const words = (value) => {
  const text = String(value || "").replace(/[_.]/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
};

// Tones: green is finished or healthy, amber wants attention, red is a failure, blue is under way
const TONES = {
  document: {
    draft: "neutral",
    uploaded: "neutral",
    pending: "blue",
    partially_signed: "blue",
    signed: "green",
    declined: "amber",
    expired: "amber",
    voided: "neutral",
    failed: "red",
  },
  subscription: { active: "green", past_due: "amber", incomplete: "amber", canceled: "neutral", expired: "neutral", free: "neutral" },
  account: { active: "green", unverified: "amber", suspended: "red", closed: "neutral" },
  payment: { purchase: "green", renewal: "green", topup: "blue", wallet: "blue", seats: "blue", failed: "red" },
  job: { pending: "blue", running: "blue", done: "green", failed: "red" },
  delivery: { pending: "blue", delivered: "green", failed: "red" },
  signer: { pending: "neutral", sent: "blue", viewed: "blue", signed: "green", declined: "amber" },
};

const LABELS = {
  document: { pending: "Out for signature", partially_signed: "Partly signed", signed: "Completed" },
  subscription: { past_due: "Payment overdue", canceled: "Cancelled", free: "Free" },
  account: { unverified: "Email not confirmed" },
  payment: { purchase: "Plan bought", renewal: "Plan renewed", topup: "Extra documents", wallet: "Wallet credit", seats: "Seats added", failed: "Failed" },
  job: { pending: "Waiting", done: "Done" },
  signer: { sent: "Invited", viewed: "Opened" },
};

export const toneOf = (kind, value) => TONES[kind]?.[value] || "neutral";
export const labelOf = (kind, value) => LABELS[kind]?.[value] || words(value);

// "Pro, ₹299 a month" from a plan as the server describes it
export const planPrice = (plan) => {
  if (!plan || plan.priceInr === null || plan.priceInr === undefined) return "Not sold";
  if (plan.priceInr === 0) return "Free";
  const each = `${plan.priceIsFrom ? "from " : ""}${inr(plan.priceInr)}`;
  const period = plan.interval ? ` a ${plan.interval}` : "";
  return `${each}${plan.perSeat ? " a seat" : ""}${period}`;
};

/**
 * What a yearly price comes to beside the monthly one: what it is a month, and what it saves
 * over twelve single months, as a share and (when it comes to a whole number) in months.
 * Null where either price is missing.
 */
export const yearlySaving = (monthlyInr, yearlyInr) => {
  if (!(monthlyInr >= 1) || !(yearlyInr >= 1)) return null;
  const twelve = monthlyInr * 12;
  const monthsFree = (twelve - yearlyInr) / monthlyInr;
  return { perMonthInr: Math.round(yearlyInr / 12), percent: Math.round((1 - yearlyInr / twelve) * 100), monthsFree: Number.isInteger(monthsFree) && monthsFree > 0 ? monthsFree : null };
};

export const allowance = (documentsPerMonth) => (documentsPerMonth === null || documentsPerMonth >= 999999 ? "No monthly limit" : `${count(documentsPerMonth)} documents a month`);
