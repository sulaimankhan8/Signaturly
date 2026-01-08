import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SignatureWorker from "../workers/signature.worker.js?worker";

export default function SignatureRemover() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [outputImageUrl, setOutputImageUrl] = useState(null);
  const [strength, setStrength] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const outputBlobRef = useRef(null);
  const workerRef = useRef(null);

  const navigate = useNavigate();

  /* ---------------- Worker setup ---------------- */

  useEffect(() => {
    if (!window.Worker) {
      console.warn("Web Workers not supported");
      return;
    }

    workerRef.current = new SignatureWorker();

    workerRef.current.onmessage = (e) => {
      const blob = e.data;
      outputBlobRef.current = blob;

      if (outputImageUrl) {
        URL.revokeObjectURL(outputImageUrl);
      }

      setOutputImageUrl(URL.createObjectURL(blob));
      setIsProcessing(false);
    };

    workerRef.current.onerror = (err) => {
      console.error("Worker error:", err);
      setIsProcessing(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /* ---------------- Cleanup URLs ---------------- */

  useEffect(() => {
    return () => {
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
      if (outputImageUrl) URL.revokeObjectURL(outputImageUrl);
    };
  }, [originalImageUrl, outputImageUrl]);

  /* ---------------- File handlers ---------------- */

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;

    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl);
    }

    const url = URL.createObjectURL(file);
    setOriginalImageUrl(url);
    setFile(file);
    setOutputImageUrl(null);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) loadFile(selectedFile);
  };

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

  /* ---------------- Processing ---------------- */

  const processImage = async () => {
    if (!file || !workerRef.current || isProcessing) return;

    setIsProcessing(true);

    const img = new Image();
    img.src = originalImageUrl;
    await img.decode();

    const bitmap = await createImageBitmap(img);

    workerRef.current.postMessage(
      { imageBitmap: bitmap, strength },
      [bitmap]
    );
  };

  const downloadImage = () => {
    if (!outputBlobRef.current) return;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(outputBlobRef.current);
    a.download = "signature.png";
    a.click();
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-black bg-opacity-20 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">
            Signature Background Remover
          </h1>
          <button
            onClick={() => navigate("/upload")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
          >
            Upload PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <p className="text-center text-gray-300 mb-6">
            Lighting-safe, gray-paper safe. Export clean PNG.
          </p>

          {/* Upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer ${
              isDragging
                ? "border-orange-500 bg-orange-500 bg-opacity-10"
                : "border-gray-600"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <h3 className="text-xl text-white font-semibold">
              Click or drop a signature image
            </h3>
            <p className="text-gray-400 text-sm mt-2">
              JPG, PNG, GIF, WebP supported
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Strength */}
          <div className="mt-6">
            <label className="text-gray-300 text-sm mb-2 block">
              Signature Strength
            </label>
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.1"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={processImage}
              disabled={!file || isProcessing}
              className={`flex-1 py-3 rounded-lg ${
                isProcessing
                  ? "bg-gray-700 text-gray-400"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {isProcessing ? "Processing..." : "Remove Background"}
            </button>

            <button
              onClick={downloadImage}
              disabled={!outputImageUrl}
              className={`flex-1 py-3 rounded-lg ${
                outputImageUrl
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              Download PNG
            </button>
          </div>

          {/* Preview */}
          {(originalImageUrl || outputImageUrl) && (
            <div className="mt-8 flex gap-6 justify-center flex-wrap">
              {originalImageUrl && (
                <img
                  src={originalImageUrl}
                  alt="Original"
                  className="max-h-60 border rounded-lg"
                />
              )}
              {outputImageUrl && (
                <img
                  src={outputImageUrl}
                  alt="Result"
                  className="max-h-60 border rounded-lg"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
