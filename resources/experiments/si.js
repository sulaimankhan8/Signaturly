console.log("[INIT] Signature remover loaded");

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const originalImg = document.getElementById("originalPreview");
const outputImg = document.getElementById("outputPreview");
const strengthSlider = document.getElementById("strength");

let sourceImage = null;
let outputBlob = null;

// ----------------- UI -----------------
dropZone.onclick = () => fileInput.click();

dropZone.ondragover = (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "#ff7a18";
};

dropZone.ondragleave = () => {
  dropZone.style.borderColor = "#c7c7cc";
};

dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "#c7c7cc";
  loadFile(e.dataTransfer.files[0]);
};

fileInput.onchange = () => loadFile(fileInput.files[0]);

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  console.log("[FILE] Loaded", file.name);

  const url = URL.createObjectURL(file);
  originalImg.src = url;
  sourceImage = new Image();
  sourceImage.src = url;

  processBtn.disabled = false;
  downloadBtn.disabled = true;
}

// ----------------- CORE PROCESS -----------------
processBtn.onclick = async () => {
  console.log("[PROCESS] Starting");
  const strength = parseFloat(strengthSlider.value);
  const blob = await  removeBackground(sourceImage, strength);
  outputBlob = blob;
  outputImg.src = URL.createObjectURL(blob);
  downloadBtn.disabled = false;
};

// ----------------- DOWNLOAD -----------------
downloadBtn.onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(outputBlob);
  a.download = "signature.png";
  a.click();
};

// ----------------- ALGORITHM -----------------
async  function removeBackground(img, strength) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  console.log("[CANVAS] Image drawn");

  // ---- Collect brightness samples ----
  const brightness = [];
  for (let i = 0; i < data.length; i += 4) {
    brightness.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }

  brightness.sort((a, b) => a - b);

  const ink = brightness[Math.floor(brightness.length * 0.05)];
  const bg = brightness[Math.floor(brightness.length * 0.95)];

  console.log("[ANALYSIS]", { ink, bg });

  // ---- Apply contrast-based alpha ----
  for (let i = 0; i < data.length; i += 4) {
    const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
    let alpha = (bg - b) / (bg - ink);
    alpha = Math.pow(Math.max(0, Math.min(1, alpha)), strength);

    data[i] = 0;     // force black ink
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = alpha * 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // ---- Auto-crop ----
  const cropped = await autoCrop(canvas);
  console.log("[DONE] Background removed");

  return cropped;
}

// ----------------- AUTO CROP -----------------
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

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;

  out.getContext("2d").drawImage(
    canvas,
    minX,
    minY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return new Promise((resolve) =>
    out.toBlob((b) => resolve(b), "image/png")
  );
}
