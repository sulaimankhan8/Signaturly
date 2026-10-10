// Dates written into a document use the month as a word (11 Oct 2026), so 11/10 and 10/11
// cannot be confused between Indian and American readers.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatFieldDate = (date = new Date()) =>
  `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

/**
 * Reads a date written by formatFieldDate. Older documents hold dates in the browser's own format,
 * so anything else is handed to the browser's parser. Returns null when the text is not a date.
 */
export const parseFieldDate = (value) => {
  if (!value) return null;

  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(String(value).trim());
  if (match) {
    const month = MONTHS.indexOf(match[2]);
    if (month >= 0) return new Date(Number(match[3]), month, Number(match[1]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// The value an <input type="date"> expects, in local time
export const toDateInputValue = (date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
