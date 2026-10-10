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
