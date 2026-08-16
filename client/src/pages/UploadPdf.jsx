import { uploadPdfApi } from "../api/pdf.api";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";

export default function UploadPdf() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
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
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      toast.success("PDF file selected");
    } else {
      toast.error("Please select a valid PDF file");
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      toast.success("PDF file selected");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const upload = async () => {
    if (!file) {
      toast.error("Please select a PDF file first");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 150);

      const data = await uploadPdfApi(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success("PDF uploaded successfully!");

      setTimeout(() => {
        navigate(`/editor/${data.id}`);
      }, 400);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.message || "Upload failed. Please try again.");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Upload PDF Document</h2>
            <p className="text-gray-400 text-xs mt-1">Select or drop your PDF document to place e-signatures and fields.</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-300 ${
              isDragging
                ? "border-red-500 bg-red-950/20 scale-[1.01]"
                : "border-white/10 hover:border-red-500/50 bg-[#08090d]/60"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
                  isDragging ? "bg-red-600 scale-110 shadow-lg shadow-red-900/50" : "bg-red-950/60 border border-red-800/40 text-red-400"
                }`}
              >
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-display font-semibold text-white mb-2">
                {isDragging ? "Drop your PDF here" : "Drag & Drop your PDF document"}
              </h3>
              <p className="text-gray-400 text-xs mb-6">Support for single or multi-page documents</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs px-8 py-3.5 rounded-xl font-bold cursor-pointer transition-all shadow-lg shadow-red-900/40 border border-red-500/30 inline-block"
              >
                Browse PDF File
              </label>

              <p className="text-gray-500 text-[11px] mt-4">Maximum file size: 50MB</p>
            </div>
          </div>

          {file && (
            <div className="bg-[#08090d] rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-red-950/80 border border-red-800/40 text-red-400 font-display font-bold text-xs rounded-xl flex items-center justify-center">
                    PDF
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-xs truncate max-w-xs">{file.name}</h4>
                    <p className="text-gray-500 text-[11px] font-mono mt-0.5">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                <button
                  onClick={removeFile}
                  className="text-gray-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isUploading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium">Uploading document...</span>
                    <span className="text-red-400 font-bold font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-red-600 to-red-800 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isUploading && (
                <button
                  onClick={upload}
                  className="w-full mt-6 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-red-900/40 flex items-center justify-center space-x-2 border border-red-500/30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload & Open in Editor</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}