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

  // TOP-LEFT → PDF bottom-left
  const x = xPercent * pdfWidth;
  const y = pdfHeight - (yPercent * pdfHeight) - height;

  return { x, y, width, height };
};
