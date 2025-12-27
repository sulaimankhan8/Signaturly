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

  console.log("percentToPdfCoords", {
    xPercent,
    yPercent,
    widthPercent,
    heightPercent,
    pdfWidth,
    pdfHeight,
    x,
    y,
    width,
    height,
  });

  return { x, y, width, height };
};
