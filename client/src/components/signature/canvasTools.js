// Drawing helpers shared by the ways of making a signature

// The server takes images up to 2 MB; this leaves room for the base64 text around them
const MAX_IMAGE_BYTES = 1.8 * 1024 * 1024;

/**
 * Waits until a web font is ready, so text drawn onto a canvas is in that typeface and not a
 * fallback. Gives up after a moment rather than leave the signer waiting on a slow network.
 */
export const ensureFont = async (family, { weight = "400", size = 64 } = {}) => {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  try {
    await Promise.race([document.fonts.load(`${weight} ${size}px "${family}"`), new Promise((resolve) => setTimeout(resolve, 2500))]);
  } catch {
    // Drawn in the fallback typeface
  }
};

/**
 * Sets ctx.font to the largest size (up to `max`) at which `text` fits in `maxWidth`.
 * `fontFor(size)` gives the CSS font string for a size. Returns the size used.
 */
export const fitFont = (ctx, text, fontFor, max, maxWidth, min = 14) => {
  ctx.font = fontFor(max);
  const width = ctx.measureText(text).width;
  const size = width > maxWidth ? Math.max(min, Math.floor((max * maxWidth) / width)) : max;
  ctx.font = fontFor(size);
  return size;
};

/** The canvas cropped to what is drawn on it, with a small margin, as a PNG data URL */
export const trimmedDataUrl = (canvas, margin = 10) => {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  if (!width || !height) return canvas.toDataURL("image/png");
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas.toDataURL("image/png");

  const left = Math.max(0, minX - margin);
  const top = Math.max(0, minY - margin);
  const right = Math.min(width, maxX + margin + 1);
  const bottom = Math.min(height, maxY + margin + 1);

  const out = document.createElement("canvas");
  out.width = right - left;
  out.height = bottom - top;
  out.getContext("2d").drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
};

const bitmapToDataUrl = (bitmap, maxSide) => {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

/**
 * An uploaded picture as a PNG small enough to send: a phone photo of a signature is made
 * smaller until it fits.
 */
export const fitImage = async (source) => {
  const bitmap = source instanceof Blob ? await createImageBitmap(source) : source;
  for (const maxSide of [1400, 1000, 700, 500]) {
    const dataUrl = bitmapToDataUrl(bitmap, maxSide);
    if (dataUrl.length * 0.75 <= MAX_IMAGE_BYTES) return dataUrl;
  }
  return bitmapToDataUrl(bitmap, 400);
};

/** The initials of a name: "Asha Rao" is AR */
export const initialsOf = (name = "") =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
