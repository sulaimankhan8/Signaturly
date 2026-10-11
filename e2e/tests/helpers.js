import { CONTROL_URL } from "../playwright.config.js";
import en from "../../client/src/i18n/locales/en.js";
import hi from "../../client/src/i18n/locales/hi.js";

export { en, hi };

export const seed = async (options = {}) => {
  const res = await fetch(`${CONTROL_URL}/seed`, { method: "POST", body: JSON.stringify(options) });
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
  return res.json();
};

export const draft = async (options = {}) => {
  const res = await fetch(`${CONTROL_URL}/draft`, { method: "POST", body: JSON.stringify(options) });
  if (!res.ok) throw new Error(`draft failed: ${res.status} ${await res.text()}`);
  return res.json();
};

export const adminAccount = async () => (await fetch(`${CONTROL_URL}/admin`, { method: "POST" })).json();

export const latestDocumentOf = async (ownerEmail) =>
  (await fetch(`${CONTROL_URL}/documents?owner=${encodeURIComponent(ownerEmail)}`)).json();

export const signIn = async (page, account) => {
  await page.goto("/login");
  await page.getByPlaceholder("name@company.com").fill(account.ownerEmail);
  await page.getByPlaceholder("••••••••").fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
};

export const recipientsOf = async (pdfId) => (await fetch(`${CONTROL_URL}/recipients?pdfId=${pdfId}`)).json();

export const recipientState = async (token) => (await fetch(`${CONTROL_URL}/recipient?token=${token}`)).json();

export const otpFor = async (email) => (await (await fetch(`${CONTROL_URL}/otp?email=${encodeURIComponent(email)}`)).json()).code;

// Wording with its {{placeholders}} filled in, as the page shows it
export const fill = (text, values) => text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name]));

export const flatten = (object) =>
  Object.values(object).flatMap((value) => (typeof value === "string" ? [value] : flatten(value)));

export const pageCanvas = (page) => page.locator(".react-pdf__Page__canvas");

// True when nothing on the page is wider than the screen
export const fitsScreen = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

/**
 * Draws a stroke with a finger. Sent as real touch input, so it fails if the pad
 * lets the page scroll instead of drawing.
 */
export const drawWithFinger = async (page, locator) => {
  const box = await locator.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const point = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  const path = [point(0.15, 0.6), point(0.3, 0.3), point(0.45, 0.7), point(0.6, 0.35), point(0.8, 0.6)];

  // Moved at the pace of a hand and held still before lifting. A stroke sent all at once reads
  // as a flick, and the browser then swallows the next tap as "stop the flick".
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const STEPS = 6;

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [path[0]] });
  for (let i = 1; i < path.length; i++) {
    for (let step = 1; step <= STEPS; step++) {
      const x = Math.round(path[i - 1].x + ((path[i].x - path[i - 1].x) * step) / STEPS);
      const y = Math.round(path[i - 1].y + ((path[i].y - path[i - 1].y) * step) / STEPS);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await pause(16);
    }
  }
  await pause(250);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await pause(100);
};

// The share of a canvas that has been drawn on
export const inkOn = (locator) =>
  locator.evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn += 1;
    return drawn;
  });

// Puts an account on a paid plan without going through checkout
export const setPlan = async (ownerEmail, plan) => {
  const res = await fetch(`${CONTROL_URL}/plan`, { method: "POST", body: JSON.stringify({ ownerEmail, plan }) });
  if (!res.ok) throw new Error(`plan failed: ${res.status} ${await res.text()}`);
};

// The token in the link of the newest team invitation emailed to an address
export const invitationFor = async (email) => (await (await fetch(`${CONTROL_URL}/invitation?email=${encodeURIComponent(email)}`)).json()).token;

// A PDF for a file picker, in the shape Playwright's setInputFiles takes
export const pdfFile = async (name, pages = 1) => {
  const { base64 } = await (await fetch(`${CONTROL_URL}/pdf?pages=${pages}`)).json();
  return { name, mimeType: "application/pdf", buffer: Buffer.from(base64, "base64") };
};

/**
 * The six-digit code an authenticator app would show for a key, as RFC 6238 defines it.
 * `ahead` gives the code of a later 30-second step, for a second sign-in inside the same step.
 */
export const authenticatorCode = async (key, ahead = 0) => {
  const { createHmac } = await import("node:crypto");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...key.replace(/\s/g, "").toUpperCase()].map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const secret = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30) + ahead));
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const number = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1000000).padStart(6, "0");
};

// The address of another website that shows the given page of the app inside a frame
export const framedElsewhere = (url) => `${CONTROL_URL}/frame?src=${encodeURIComponent(url)}`;

// A document of a team that has its own name and colour, sent to one signer
export const teamDocument = async () => {
  const res = await fetch(`${CONTROL_URL}/team-document`, { method: "POST" });
  if (!res.ok) throw new Error(`team document failed: ${res.status} ${await res.text()}`);
  return res.json();
};
