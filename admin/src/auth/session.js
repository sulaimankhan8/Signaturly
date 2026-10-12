/**
 * The admin session: one token, kept for this browser tab only.
 *
 * It lives in sessionStorage, so it is gone when the tab is closed and is not shared with
 * other tabs. The server gives it eight hours; the app signs out by itself at that moment
 * and does not wait for a request to be refused.
 */

const KEY = "pactdoc_admin_token";
// Why the last session ended, shown once on the sign-in page
const NOTE_KEY = "pactdoc_admin_note";

const listeners = new Set();

const read = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

// When the token stops working, in milliseconds, or null if it cannot be read
export const expiryOf = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const getToken = () => {
  const token = read(KEY);
  if (!token) return null;
  const expiry = expiryOf(token);
  return expiry && expiry <= Date.now() ? null : token;
};

export const startSession = (token) => {
  sessionStorage.setItem(KEY, token);
  sessionStorage.removeItem(NOTE_KEY);
  listeners.forEach((listener) => listener());
};

// `why` is "signed_out" (the operator chose to) or "ended" (the session ran out or was refused)
export const endSession = (why = "signed_out") => {
  if (!read(KEY)) return;
  sessionStorage.removeItem(KEY);
  if (why === "ended") sessionStorage.setItem(NOTE_KEY, "Your session has ended. Sign in again.");
  listeners.forEach((listener) => listener());
};

export const takeNote = () => {
  const note = read(NOTE_KEY);
  if (note) sessionStorage.removeItem(NOTE_KEY);
  return note;
};

export const onSessionChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
