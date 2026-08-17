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
        <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_#ef4444] space-y-8">
          <div>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444] mb-2 inline-block">
              PDF Ingestion
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">Upload PDF Document</h2>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 font-medium">Select or drop your PDF document to place e-signatures and fields.</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-300 ${
              isDragging
                ? "border-yellow-400 bg-[#090a0f] scale-[1.01]"
                : "border-white/25 hover:border-yellow-400 bg-[#090a0f]"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 border-2 border-black shadow-[3px_3px_0px_0px_#facc15] ${
                  isDragging ? "bg-yellow-400 text-black" : "bg-red-600 text-white"
                }`}
              >
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mb-2">
                {isDragging ? "Drop your PDF here" : "Drag & Drop your PDF document"}
              </h3>
              <p className="text-gray-400 text-xs mb-6 font-medium">Support for single or multi-page PDF documents</p>

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
                className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs px-8 py-3.5 rounded-xl font-black uppercase tracking-wider cursor-pointer transition-all border-2 border-black shadow-[3px_3px_0px_0px_#ef4444] inline-block hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                Browse PDF File
              </label>

              <p className="text-gray-400 text-[11px] font-mono mt-4">Maximum file size: 50MB</p>
            </div>
          </div>

          {file && (
            <div className="bg-[#090a0f] rounded-2xl p-6 border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-red-600 border-2 border-black text-white font-black text-xs rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
                    PDF
                  </div>
                  <div>
                    <h4 className="text-white font-black text-xs truncate max-w-xs">{file.name}</h4>
                    <p className="text-gray-400 text-[11px] font-mono mt-0.5">{formatFileSize(file.size)}</p>
                  </div>
                </div>

                <button
                  onClick={removeFile}
                  className="text-gray-400 hover:text-red-400 p-2 rounded-xl hover:bg-white/5 transition-colors font-black"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isUploading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-black uppercase tracking-wider">Uploading document...</span>
                    <span className="text-yellow-400 font-mono font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#13151f] rounded-full h-3 overflow-hidden border-2 border-white/20">
                    <div
                      className="bg-red-600 h-3 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isUploading && (
                <button
                  onClick={upload}
                  className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white text-xs py-3.5 rounded-xl font-black uppercase tracking-wider transition-all shadow-[4px_4px_0px_0px_#facc15] hover:shadow-[5px_5px_0px_0px_#fff] flex items-center justify-center space-x-2 border-2 border-black"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload & Open in Editor →</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}