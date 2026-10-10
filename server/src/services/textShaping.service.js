import fs from "fs";
import path from "path";
import { createRequire } from "module";
import * as hb from "harfbuzzjs";
import { rgb } from "pdf-lib";

/**
 * Draws text in any supported script onto a PDF page.
 *
 * pdf-lib's own text drawing places one glyph per character, which breaks scripts that join,
 * reorder or stack characters (Hindi, Tamil, Bengali and others). Here the text is shaped by
 * HarfBuzz, the engine browsers use, and each glyph outline is drawn at its shaped position.
 * See docs/decisions/0001-text-rendering-for-indic-scripts.md.
 *
 * The result is vector outlines: sharp at any zoom, identical in every PDF reader, but not
 * selectable as text.
 */

const require = createRequire(import.meta.url);

// Script name -> [package, file prefix]. Add a row (and the font package) to support another script.
const FONT_FILES = {
  latin: ["noto-sans", "NotoSans"],
  devanagari: ["noto-sans-devanagari", "NotoSansDevanagari"],
  bengali: ["noto-sans-bengali", "NotoSansBengali"],
  gujarati: ["noto-sans-gujarati", "NotoSansGujarati"],
  tamil: ["noto-sans-tamil", "NotoSansTamil"],
  telugu: ["noto-sans-telugu", "NotoSansTelugu"],
  kannada: ["noto-sans-kannada", "NotoSansKannada"],
};

// Unicode blocks of the scripts above
const SCRIPT_RANGES = [
  [0x0900, 0x097f, "devanagari"],
  [0xa8e0, 0xa8ff, "devanagari"],
  [0x0980, 0x09ff, "bengali"],
  [0x0a80, 0x0aff, "gujarati"],
  [0x0b80, 0x0bff, "tamil"],
  [0x0c00, 0x0c7f, "telugu"],
  [0x0c80, 0x0cff, "kannada"],
];

const scriptOf = (codePoint) => {
  for (const [start, end, script] of SCRIPT_RANGES) {
    if (codePoint >= start && codePoint <= end) return script;
  }
  // Spaces, digits and punctuation belong to whichever script surrounds them
  if (codePoint <= 0x40 || (codePoint >= 0x5b && codePoint <= 0x60) || (codePoint >= 0x7b && codePoint <= 0xbf)) {
    return "common";
  }
  if (codePoint === 0x200c || codePoint === 0x200d || codePoint === 0x0964 || codePoint === 0x0965) return "common";
  return "latin";
};

const fonts = new Map();

const loadFont = (script, weight = "400Regular") => {
  const key = `${script}:${weight}`;
  if (fonts.has(key)) return fonts.get(key);

  const [pkg, prefix] = FONT_FILES[script];
  const packageDir = path.dirname(require.resolve(`@expo-google-fonts/${pkg}`));
  const bytes = fs.readFileSync(path.join(packageDir, weight, `${prefix}_${weight}.ttf`));

  const face = new hb.Face(new hb.Blob(bytes), 0);
  const font = { face, hbFont: new hb.Font(face), upem: face.upem, paths: new Map() };
  fonts.set(key, font);
  return font;
};

// Font outlines have y pointing up; pdf-lib's SVG path drawing expects y pointing down
const flipY = (d) =>
  d.replace(/([MLQCZ])([^MLQCZ]*)/g, (_, command, args) => {
    const numbers = args.trim().split(/[ ,]+/).filter(Boolean).map(Number);
    return command + numbers.map((value, i) => (i % 2 === 1 ? -value : value)).join(" ");
  });

const pathFor = (font, glyphId) => {
  if (!font.paths.has(glyphId)) {
    const d = font.hbFont.glyphToPath(glyphId);
    font.paths.set(glyphId, d ? flipY(d) : "");
  }
  return font.paths.get(glyphId);
};

/**
 * Splits text into runs that each use one font. Neutral characters join the run before them,
 * or the run after them when they come first.
 */
export const splitIntoRuns = (text) => {
  const runs = [];
  let pendingCommon = "";

  for (const char of String(text)) {
    const script = scriptOf(char.codePointAt(0));
    const last = runs[runs.length - 1];

    if (script === "common") {
      if (last) last.text += char;
      else pendingCommon += char;
    } else if (last && last.script === script) {
      last.text += char;
    } else {
      runs.push({ script, text: pendingCommon + char });
      pendingCommon = "";
    }
  }

  if (pendingCommon) runs.push({ script: "latin", text: pendingCommon });
  return runs;
};

const shapeRun = (run, weight) => {
  const font = loadFont(run.script, weight);
  const buffer = new hb.Buffer();
  buffer.addText(run.text);
  buffer.guessSegmentProperties();
  hb.shape(font.hbFont, buffer);
  return { font, glyphs: buffer.getGlyphInfosAndPositions() };
};

/**
 * Shapes text into positioned glyphs. Returned widths are for a font size of 1.
 */
export const shapeText = (text, { bold = false } = {}) => {
  const weight = bold ? "700Bold" : "400Regular";
  const shaped = [];
  let width = 0;
  let missing = 0;

  for (const run of splitIntoRuns(text)) {
    const { font, glyphs } = shapeRun(run, weight);
    for (const glyph of glyphs) {
      // Glyph 0 means the font has no shape for this character; it is skipped rather than drawn as a box
      if (glyph.codepoint === 0) missing += 1;
      shaped.push({
        font,
        glyphId: glyph.codepoint,
        x: width + (glyph.xOffset || 0) / font.upem,
        y: (glyph.yOffset || 0) / font.upem,
      });
      width += (glyph.xAdvance || 0) / font.upem;
    }
  }

  return { glyphs: shaped, width, missing };
};

export const measureText = (text, size, options) => shapeText(text, options).width * size;

/**
 * Draws one line of text with its baseline starting at (x, y).
 * With `maxWidth`, the text is shrunk (down to `minSize`) so it stays inside its box.
 * Returns the size actually used and the width drawn.
 */
export const drawShapedText = (page, text, { x, y, size, color = rgb(0, 0, 0), bold = false, maxWidth, minSize = 6 }) => {
  const value = String(text ?? "");
  if (!value) return { size, width: 0 };

  const shaped = shapeText(value, { bold });

  let drawSize = size;
  if (maxWidth && shaped.width * drawSize > maxWidth) {
    drawSize = Math.max(minSize, maxWidth / shaped.width);
  }

  for (const glyph of shaped.glyphs) {
    if (glyph.glyphId === 0) continue;
    const d = pathFor(glyph.font, glyph.glyphId);
    if (!d) continue; // spaces have no outline

    page.drawSvgPath(d, {
      x: x + glyph.x * drawSize,
      y: y + glyph.y * drawSize,
      scale: drawSize / glyph.font.upem,
      color,
      borderWidth: 0,
    });
  }

  return { size: drawSize, width: shaped.width * drawSize };
};

// True when the built-in PDF fonts can show the text as it is
export const isPlainLatin = (text) => /^[\x20-\x7E\xA0-\xFF]*$/.test(String(text ?? ""));
