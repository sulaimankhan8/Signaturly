import { createRequire } from "module";
import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

/**
 * Renders one page of a PDF to a canvas, the way a PDF reader would show it.
 */
export const renderPdfPage = async (buffer, pageNumber = 1, scale = 2) => {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return { canvas, pageCount: doc.numPages };
};

const registered = new Set();

/**
 * Draws text with the canvas engine's own shaping, as the reference for "how this text should look".
 */
export const renderReferenceText = (text, { fontPackage, filePrefix, family, width, height, x, baseline, size }) => {
  if (!registered.has(family)) {
    const dir = path.dirname(require.resolve(`@expo-google-fonts/${fontPackage}`));
    GlobalFonts.registerFromPath(path.join(dir, "400Regular", `${filePrefix}_400Regular.ttf`), family);
    registered.add(family);
  }

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#000";
  context.font = `${size}px "${family}"`;
  context.fillText(text, x, baseline);
  return canvas;
};

const inkMask = (canvas) => {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 384 ? 1 : 0;
  }
  return mask;
};

// Every pixel within `radius` of ink also counts as ink
const dilate = (mask, width, height, radius) => {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1;
        }
      }
    }
  }
  return out;
};

/**
 * How well two renderings agree, from 0 (nothing in common) to 1 (identical).
 * It is the share of each image's ink that lies within `tolerance` pixels of the other's ink,
 * taking the worse of the two directions. The tolerance absorbs anti-aliasing and sub-pixel
 * placement, which differ between renderers; misplaced or missing glyphs still score low.
 */
export const inkOverlap = (a, b, tolerance = 2) => {
  const maskA = inkMask(a);
  const maskB = inkMask(b);
  const nearA = dilate(maskA, a.width, a.height, tolerance);
  const nearB = dilate(maskB, b.width, b.height, tolerance);

  let inkA = 0;
  let inkB = 0;
  let aNearB = 0;
  let bNearA = 0;
  for (let i = 0; i < maskA.length; i++) {
    if (maskA[i]) {
      inkA += 1;
      if (nearB[i]) aNearB += 1;
    }
    if (maskB[i]) {
      inkB += 1;
      if (nearA[i]) bNearA += 1;
    }
  }
  if (inkA === 0 || inkB === 0) return 0;
  return Math.min(aNearB / inkA, bNearA / inkB);
};

export const inkPixels = (canvas) => inkMask(canvas).reduce((sum, v) => sum + v, 0);

/**
 * The selectable text of a PDF, page by page, as a reader's "select all" would give it.
 * Text drawn as outlines (Indian scripts) is not in it.
 */
export const pdfText = async (buffer) => {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 }).promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const content = await (await doc.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => item.str).join(" ").replace(/\s+/g, " "));
  }
  return pages;
};
