// Formats for people in India, the launch market. Other markets will pass their own locale and time zone.

const DEFAULT_LOCALE = "en-IN";
const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/**
 * 11 Oct 2026 — the month is written as a word so 11/10 and 10/11 cannot be confused.
 */
export const formatDate = (date, { locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE } = {}) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone }).format(new Date(date));

/**
 * 11 Oct 2026, 14:05:09 IST — local time with the zone named.
 */
export const formatDateTime = (date, { locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE } = {}) => {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).format(new Date(date));
  return parts.replace("GMT+5:30", "IST");
};

/**
 * Evidence timestamps: UTC first (unambiguous anywhere), then the local time.
 * 2026-10-11 08:35:09 UTC (11 Oct 2026, 14:05:09 IST)
 */
export const formatEvidenceTime = (date, options) => {
  if (!date) return "-";
  const utc = `${new Date(date).toISOString().replace("T", " ").slice(0, 19)} UTC`;
  return `${utc} (${formatDateTime(date, options)})`;
};

/**
 * Rupee amounts with Indian digit grouping: ₹1,20,000.00
 */
export const formatMoney = (amount, currency = "INR", locale = DEFAULT_LOCALE) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(amount) || 0);
