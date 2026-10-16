import { rgb } from "pdf-lib";

// PactDoc's mark, for the PDFs the server writes: the red tile with the glyph, the same drawing as
// client/src/components/BrandGlyph.jsx (a P drawn as a page with its corner folded, its stem a pen nib).
// PDF paths fill by the nonzero rule, so the P's counter runs the other way round to stay open.
const TILE = "M7 0H25C28.87 0 32 3.13 32 7V25C32 28.87 28.87 32 25 32H7C3.13 32 0 28.87 0 25V7C0 3.13 3.13 0 7 0Z";
const PAGE = "M6 3H19L26 10V22H13V24L9.5 29L6 24Z M13 10V16H19V10Z";
const FOLD = "M19 3V10H26Z";

const RED = rgb(0.863, 0.149, 0.149);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

// The mark, `size` points square, its top-left corner at (x, top)
export const drawBrandMark = (page, { x, top, size }) => {
  page.drawSvgPath(TILE, { x, y: top, scale: size / 32, color: RED, borderColor: BLACK, borderWidth: 1.6 });
  // The glyph stands at a little over half the tile's height, centred, as in the logo files
  const scale = (size * 0.56) / 26;
  const inset = size / 2 - 16 * scale;
  page.drawSvgPath(PAGE, { x: x + inset, y: top - inset, scale, color: WHITE });
  page.drawSvgPath(FOLD, { x: x + inset, y: top - inset, scale, color: BLACK });
};
