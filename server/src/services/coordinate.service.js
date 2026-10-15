/**
 * Field positions are stored as shares of the page as a reader sees it: the crop box, turned by
 * the page's /Rotate. The browser draws pages the same way (pdf.js), so a field sits where the
 * sender put it whatever the page's rotation or crop.
 *
 * Positions are measured from the top-left of that view; PDF drawing starts at the bottom-left.
 */
export const percentToPdfCoords = ({
  xPercent,
  yPercent,
  widthPercent,
  heightPercent,
  pdfWidth,
  pdfHeight,
}) => {
  const width = widthPercent * pdfWidth;
  const height = heightPercent * pdfHeight;

  const x = xPercent * pdfWidth;
  const y = pdfHeight - yPercent * pdfHeight - height;

  return { x, y, width, height };
};

const normalAngle = (angle) => (((Number(angle) || 0) % 360) + 360) % 360;

/**
 * The page as a reader sees it, and the matrix that takes drawing in that view onto the page.
 *
 * Drawing inside `withVisualFrame` uses view coordinates: (0, 0) is the bottom-left of the page
 * as shown, x runs right and y runs up, whatever the page's rotation or crop.
 *
 * Returns { width, height, matrix: [a, b, c, d, e, f] }.
 */
export const visualFrameOf = (page) => {
  const crop = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, ...page.getSize() };
  const { x: cx, y: cy, width: cw, height: ch } = crop;
  const angle = normalAngle(page.getRotation?.().angle);

  switch (angle) {
    case 90:
      // Shown turned a quarter clockwise: up on screen is toward the page's left edge
      return { width: ch, height: cw, matrix: [0, 1, -1, 0, cx + cw, cy] };
    case 180:
      return { width: cw, height: ch, matrix: [-1, 0, 0, -1, cx + cw, cy + ch] };
    case 270:
      return { width: ch, height: cw, matrix: [0, -1, 1, 0, cx, cy + ch] };
    default:
      return { width: cw, height: ch, matrix: [1, 0, 0, 1, cx, cy] };
  }
};
