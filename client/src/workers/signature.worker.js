self.onmessage = async (e) => {
  const { imageBitmap, strength } = e.data;

  const canvas = new OffscreenCanvas(
    imageBitmap.width,
    imageBitmap.height
  );
  const ctx = canvas.getContext("2d");

  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const data = imageData.data;

  // ---- Brightness sampling ----
  const brightness = new Float32Array(data.length / 4);
  let bi = 0;
  for (let i = 0; i < data.length; i += 4) {
    brightness[bi++] =
      (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  brightness.sort();

  const ink = brightness[Math.floor(brightness.length * 0.05)];
  const bg = brightness[Math.floor(brightness.length * 0.95)];

  // ---- Alpha transform ----
  for (let i = 0; i < data.length; i += 4) {
    const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
    let alpha = (bg - b) / (bg - ink);
    alpha = Math.pow(Math.max(0, Math.min(1, alpha)), strength);

    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = alpha * 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // ---- Auto crop ----
  const crop = autoCrop(canvas);
  const blob = await crop.convertToBlob({ type: "image/png" });

  self.postMessage(blob);
};

function autoCrop(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const out = new OffscreenCanvas(
    maxX - minX + 1,
    maxY - minY + 1
  );

  out
    .getContext("2d")
    .drawImage(
      canvas,
      minX,
      minY,
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height
    );

  return out;
}
