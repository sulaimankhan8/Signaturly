import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SignatureRemover() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [outputImageUrl, setOutputImageUrl] = useState(null);
  const [strength, setStrength] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const outputBlobRef = useRef(null);
  const navigate = useNavigate();

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      loadFile(droppedFile);
    } else {
      alert("Please select a valid image file");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      loadFile(selectedFile);
    }
  };

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setOriginalImageUrl(url);
    setFile(file);
    setOutputImageUrl(null);
  };

  const removeBackground = useCallback(async (img, strength) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // ---- Collect brightness samples ----
    const brightness = [];
    for (let i = 0; i < data.length; i += 4) {
      brightness.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }

    brightness.sort((a, b) => a - b);

    const ink = brightness[Math.floor(brightness.length * 0.05)];
    const bg = brightness[Math.floor(brightness.length * 0.95)];

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
    return cropped;
  }, []);

  const autoCrop = (canvas) => {
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
  };

  const processImage = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    const img = new Image();
    img.src = originalImageUrl;
    
    await new Promise(resolve => {
      img.onload = resolve;
    });
    
    const blob = await removeBackground(img, strength);
    outputBlobRef.current = blob;
    setOutputImageUrl(URL.createObjectURL(blob));
    setIsProcessing(false);
  };

  const downloadImage = () => {
    if (!outputBlobRef.current) return;
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(outputBlobRef.current);
    a.download = "signature.png";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-black bg-opacity-20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Signature Background Remover</h1>
            </div>
            <button
              onClick={() => navigate('/upload')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Upload PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <p className="text-center text-gray-300 mb-6">Lighting-safe, gray-paper safe. Export clean PNG.</p>
          
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              isDragging 
                ? "border-orange-500 bg-orange-500 bg-opacity-10" 
                : "border-gray-600 hover:border-gray-500"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center">
              {/* Upload Icon */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                isDragging ? "bg-orange-500 scale-110" : "bg-gray-700"
              }`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              {/* Upload Text */}
              <h3 className="text-xl font-semibold text-white mb-2">
                {isDragging ? "Drop your signature image here" : "Click or drop a signature image here"}
              </h3>
              <p className="text-gray-400 text-sm mt-4">Supports JPG, PNG, GIF, WebP</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Controls */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Signature Strength</label>
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 text-sm">Subtle</span>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-gray-400 text-sm">Strong</span>
              <span className="text-orange-400 font-medium w-10 text-right">{strength}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 mt-6">
            <button
              onClick={processImage}
              disabled={!file || isProcessing}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                !file || isProcessing
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {isProcessing ? "Processing..." : "Remove Background"}
            </button>
            <button
              onClick={downloadImage}
              disabled={!outputImageUrl}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                !outputImageUrl
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              Download PNG
            </button>
          </div>

          {/* Preview */}
          {(originalImageUrl || outputImageUrl) && (
            <div className="mt-8 flex flex-col md:flex-row gap-6 justify-center">
              {originalImageUrl && (
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-300 mb-2">Original</div>
                  <div className="relative">
                    <img
                      src={originalImageUrl}
                      alt="Original signature"
                      className="max-w-xs max-h-60 border border-gray-600 rounded-lg bg-gray-800"
                    />
                  </div>
                </div>
              )}
              {outputImageUrl && (
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-300 mb-2">Result</div>
                  <div className="relative">
                    <img
                      src={outputImageUrl}
                      alt="Processed signature"
                      className="max-w-xs max-h-60 border border-gray-600 rounded-lg"
                      style={{
                        backgroundImage: "repeating-conic-gradient(#eee 0% 25%, #ddd 0% 50%)",
                        backgroundPosition: "50% 50%",
                        backgroundSize: "20px 20px"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}