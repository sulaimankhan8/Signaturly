import { useState, useRef, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import SignatureWorker from "../workers/signature.worker.js?worker";
import Navbar from "../components/Navbar";

function SignaturePad({ onConfirm }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const strokesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    ctxRef.current = ctx;
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure || 0.5,
    };
  };

  const redraw = () => {
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    strokesRef.current.forEach((stroke) => {
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach((p) => {
        ctx.lineWidth = 1.5 + p.p * 2;
        ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  const down = (e) => {
    e.preventDefault();
    setDrawing(true);
    strokesRef.current.push([getPos(e)]);
  };

  const move = (e) => {
    if (!drawing) return;
    strokesRef.current.at(-1).push(getPos(e));
    redraw();
  };

  const up = () => setDrawing(false);

  const clear = () => {
    strokesRef.current = [];
    redraw();
    toast.success("Pad cleared");
  };

  const confirm = async () => {
    if (strokesRef.current.length === 0) {
      toast.error("Please draw a signature first");
      return;
    }
    const blob = await new Promise((r) =>
      canvasRef.current.toBlob(r, "image/png")
    );

    const reader = new FileReader();
    reader.onload = (evt) => {
      onConfirm(evt.target.result, blob);
    };
    reader.readAsDataURL(blob);

    toast.success("Signature captured!");
  };

  return (
    <div className="mt-6">
      <div className="border-2 border-dashed border-white/10 hover:border-red-500/50 rounded-2xl h-48 bg-white overflow-hidden shadow-inner transition-colors">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={clear}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-xs transition-colors border border-white/10"
        >
          Clear Pad
        </button>
        <button
          onClick={confirm}
          className="ml-auto px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-red-950/50 border border-red-500/30"
        >
          Use Signature
        </button>
      </div>
    </div>
  );
}

export default function SignatureRemover() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [outputImageUrl, setOutputImageUrl] = useState(null);
  const [base64Output, setBase64Output] = useState("");
  const [strength, setStrength] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const outputBlobRef = useRef(null);
  const workerRef = useRef(null);
  const toastIdRef = useRef(null);

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

      const url = URL.createObjectURL(blob);
      setOutputImageUrl(url);

      const reader = new FileReader();
      reader.onload = (evt) => {
        setBase64Output(evt.target.result);
      };
      reader.readAsDataURL(blob);

      setIsProcessing(false);

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.success("Background removed cleanly!");
    };

    workerRef.current.onerror = (err) => {
      console.error("Worker error:", err);
      setIsProcessing(false);
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.error("Error processing signature image");
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl);
      if (outputImageUrl) URL.revokeObjectURL(outputImageUrl);
    };
  }, [originalImageUrl, outputImageUrl]);

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (originalImageUrl) {
      URL.revokeObjectURL(originalImageUrl);
    }

    const url = URL.createObjectURL(file);
    setOriginalImageUrl(url);
    setFile(file);
    setOutputImageUrl(null);
    setBase64Output("");
    toast.success("Signature image loaded");
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
      toast.error("Please select a valid image file");
    }
  };

  const processImage = async () => {
    if (!file || !workerRef.current || isProcessing) return;

    setIsProcessing(true);
    toastIdRef.current = toast.loading("Removing paper background...");

    try {
      const img = new Image();
      img.src = originalImageUrl;
      await img.decode();

      const bitmap = await createImageBitmap(img);

      workerRef.current.postMessage(
        { imageBitmap: bitmap, strength },
        [bitmap]
      );
    } catch (e) {
      console.error("Bitmap decode error:", e);
      setIsProcessing(false);
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.error("Failed to decode image");
    }
  };

  const downloadImage = () => {
    let downloadUrl = outputImageUrl;

    if (outputBlobRef.current) {
      downloadUrl = URL.createObjectURL(outputBlobRef.current);
    }

    if (!downloadUrl) {
      toast.error("No signature available to download");
      return;
    }

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "transparent-signature.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success("Downloaded transparent signature PNG!");
  };

  const handleLiveSignature = (base64DataUrl, blob) => {
    setBase64Output(base64DataUrl);
    setOutputImageUrl(base64DataUrl);
    outputBlobRef.current = blob || null;
    setOriginalImageUrl(null);
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Signature Studio</h2>
            <p className="text-gray-400 text-xs mt-1">
              Remove paper background lighting automatically or draw a digital signature for transparent PDF burning.
            </p>
          </div>

          {/* Upload Box */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-red-500 bg-red-950/20 scale-[1.01]"
                : "border-white/10 hover:border-red-500/50 bg-[#08090d]/60"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 bg-red-950/60 text-red-400 border border-red-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-display font-semibold text-white">
              Click or drag a photo of your paper signature
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              JPG, PNG, WebP supported. High contrast produces best results.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Strength Slider */}
          {file && (
            <div className="bg-[#08090d] p-4 rounded-xl border border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Threshold Strength:</span>
                <span className="font-mono text-red-400 font-bold">{strength}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                className="w-full accent-red-600"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={processImage}
              disabled={!file || isProcessing}
              className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-950/50 border border-red-500/30"
            >
              {isProcessing ? "Processing BG..." : "Remove Paper Background"}
            </button>

            <button
              onClick={downloadImage}
              disabled={!outputImageUrl}
              className="flex-1 py-3.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/50 disabled:opacity-40 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Transparent PNG</span>
            </button>
          </div>

          {/* Draw Signature */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-sm font-display font-bold text-white mb-1 uppercase tracking-wider">
              Or Draw Digital Signature
            </h3>
            <p className="text-gray-400 text-xs">
              Draw directly on pad using mouse, touch screen, or pen.
            </p>
            <SignaturePad onConfirm={handleLiveSignature} />
          </div>

          {/* Previews */}
          {(originalImageUrl || outputImageUrl) && (
            <div className="pt-6 border-t border-white/10 flex flex-col items-center space-y-4">
              <div className="flex gap-6 justify-center flex-wrap w-full">
                {originalImageUrl && (
                  <div className="text-center space-y-2">
                    <span className="text-xs text-gray-400 font-medium">Original Upload:</span>
                    <img
                      src={originalImageUrl}
                      alt="Original"
                      className="max-h-48 border border-white/10 rounded-xl bg-white/5 p-2"
                    />
                  </div>
                )}
                {outputImageUrl && (
                  <div className="text-center space-y-2">
                    <span className="text-xs text-emerald-400 font-semibold">Transparent PNG Result:</span>
                    <div className="border border-emerald-800/50 rounded-xl bg-[#08090d] p-3 shadow-lg shadow-emerald-950/40">
                      <img
                        src={outputImageUrl}
                        alt="Result"
                        className="max-h-48 max-w-full object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>

              {outputImageUrl && (
                <button
                  onClick={downloadImage}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Signature as PNG</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
