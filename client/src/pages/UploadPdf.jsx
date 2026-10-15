import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import { uploadPdfApi, uploadJoinedPdfsApi } from "../api/pdf.api";

// Up to this many PDFs can be joined into one document
const MAX_FILES = 10;
// The largest file the server takes
const MAX_BYTES = 25 * 1024 * 1024;

// What happens after the upload, as in every signing product: who signs decides the next screen
const NEXT_STEPS = [
  { id: "me", title: "Only me", hint: "Place your signature and finish now.", path: (id) => `/editor/${id}` },
  { id: "both", title: "Me & others", hint: "You sign too, with the people you add.", path: (id) => `/send/${id}?me=1` },
  { id: "others", title: "Only others", hint: "Send it to the people who need to sign.", path: (id) => `/send/${id}` },
];

export default function UploadPdf() {
  // One PDF, or several that will be joined in this order and signed as one document
  const [files, setFiles] = useState([]);
  const file = files[0] || null;

  const addFiles = (chosen) => {
    const all = Array.from(chosen || []);
    const tooBig = all.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length > 0) toast.error(`${tooBig[0].name} is larger than 25 MB`);
    const pdfs = all.filter((f) => f.type === "application/pdf" && f.size <= MAX_BYTES);
    if (pdfs.length === 0) {
      if (tooBig.length === 0) toast.error("Please select a valid PDF file");
      return;
    }
    setFiles((current) => {
      const next = [...current, ...pdfs].slice(0, MAX_FILES);
      if (current.length + pdfs.length > MAX_FILES) toast.error(`At most ${MAX_FILES} files can be joined`);
      return next;
    });
    toast.success(pdfs.length === 1 ? "PDF file selected" : `${pdfs.length} PDF files selected`);
  };

  const moveUp = (index) =>
    setFiles((current) => {
      if (index === 0) return current;
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // The uploaded document, while the sender chooses who signs it
  const [uploaded, setUploaded] = useState(null);
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

    addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    addFiles(e.target.files);
    // So the same file can be chosen again after being removed
    e.target.value = "";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, i) => i !== index));
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
      // The bar shows the bytes actually sent; the last step is the server reading the file
      const onProgress = (share) => setUploadProgress(Math.min(95, Math.round(share * 95)));
      const data = files.length > 1 ? await uploadJoinedPdfsApi(files, onProgress) : await uploadPdfApi(file, onProgress);

      setUploadProgress(100);
      setIsUploading(false);
      setUploaded(data);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.message || "Upload failed. Please try again.");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (uploaded) {
    return (
      <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
        <Toaster position="top-right" />
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
            <div>
              <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-black border-2 border-black rounded inline-block mb-2">Uploaded</span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">Who needs to sign?</h2>
              <p className="text-gray-300 text-sm mt-1 truncate">{uploaded.originalFileName || file?.name}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {NEXT_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  autoFocus={index === 0}
                  onClick={() => navigate(step.path(uploaded.id))}
                  className="text-left p-5 rounded-2xl border-2 border-black bg-[#1e2235] hover:bg-[#282d47] shadow-[4px_4px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#facc15] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400"
                >
                  <span className="block text-lg font-black uppercase text-white">{step.title}</span>
                  <span className="block text-xs text-gray-300 mt-1">{step.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">The document is saved in your documents either way, and you can change your mind later.</p>
          </div>
        </main>
      </div>
    );
  }

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
              <p className="text-gray-400 text-xs mb-6 font-medium">One PDF, or several to be joined into one document and signed together</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
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

              <p className="text-gray-400 text-[11px] font-mono mt-4">Maximum size: 25 MB, up to {MAX_FILES} files</p>
            </div>
          </div>

          {file && (
            <div className="bg-[#090a0f] rounded-2xl p-6 border-2 border-white/20 shadow-[3px_3px_0px_0px_#000]">
              {files.length > 1 && (
                <p className="text-[11px] text-gray-400 mb-4" data-testid="join-note">
                  These {files.length} files will be joined in this order into one document. Signers sign it once.
                </p>
              )}
              <ul className="space-y-3" data-testid="chosen-files">
                {files.map((chosen, index) => (
                  <li key={`${chosen.name}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-12 h-12 shrink-0 bg-red-600 border-2 border-black text-white font-black text-xs rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
                        {files.length > 1 ? index + 1 : "PDF"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-black text-xs truncate max-w-xs">{chosen.name}</h4>
                        <p className="text-gray-400 text-[11px] font-mono mt-0.5">{formatFileSize(chosen.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center shrink-0">
                      {index > 0 && !isUploading && (
                        <button onClick={() => moveUp(index)} title="Move up" className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors font-black">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                      )}
                      {!isUploading && (
                        <button
                          onClick={() => removeFile(index)}
                          title="Remove"
                          className="text-gray-400 hover:text-red-400 p-2 rounded-xl hover:bg-white/5 transition-colors font-black"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

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
                  <span>{files.length > 1 ? "Join & Upload →" : "Upload →"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}