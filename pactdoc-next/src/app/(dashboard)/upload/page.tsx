"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const SIGNING_FLOWS = [
  {
    id: "me",
    title: "Only Me",
    badge: "Solo",
    description: "Self-sign this agreement immediately and download sealed PDF.",
    target: (docId: string) => `/editor/${docId}`,
  },
  {
    id: "both",
    title: "Me & Counterparties",
    badge: "Multi-party",
    description: "Place your own signature alongside sequential recipient roles.",
    target: (docId: string) => `/editor/${docId}?me=1`,
  },
  {
    id: "others",
    title: "Only Others",
    badge: "Dispatched",
    description: "Send out fields directly to external clients, vendors, or signers.",
    target: (docId: string) => `/editor/${docId}`,
  },
];

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFlow, setSelectedFlow] = useState<string>("me");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesAdded = (rawFiles: FileList | null) => {
    if (!rawFiles || rawFiles.length === 0) return;
    setErrorMessage(null);

    const incoming = Array.from(rawFiles);
    const validPdfs: QueuedFile[] = [];

    for (const f of incoming) {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        setErrorMessage(`"${f.name}" is not a PDF file. Only PDF files are supported.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setErrorMessage(`"${f.name}" exceeds the 25MB maximum limit.`);
        continue;
      }
      validPdfs.push({
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        file: f,
        name: f.name,
        size: f.size,
      });
    }

    setFiles((prev) => {
      const merged = [...prev, ...validPdfs];
      if (merged.length > MAX_FILES) {
        setErrorMessage(`Maximum of ${MAX_FILES} documents can be merged at once.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const moveFile = (index: number, direction: "up" | "down") => {
    setFiles((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      const formData = new FormData();
      if (files.length === 1) {
        formData.append("pdf", files[0].file);
      } else {
        files.forEach((f) => formData.append("pdfs", f.file));
      }

      setUploadProgress(45);

      const endpoint = files.length === 1 ? "/api/pdf/upload" : "/api/pdf/upload-joined";
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      setUploadProgress(85);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload document");
      }

      const data = await res.json();
      const docId = data.pdf?._id || data._id || data.id;

      setUploadProgress(100);

      // Route based on selected signer flow
      const flow = SIGNING_FLOWS.find((f) => f.id === selectedFlow) || SIGNING_FLOWS[0];
      router.push(flow.target(docId));
    } catch (err: any) {
      setErrorMessage(err.message || "Upload process failed. Ensure you are signed in.");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      {/* Top Header */}
      <header className="border-b border-surface-border bg-surface-canvas/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-content-muted hover:text-white flex items-center gap-1.5 transition-colors"
            >
              ← Back to Documents
            </Link>
            <span className="text-surface-border">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-white">Upload New Contract</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-content-muted">Direct S3 / GridFS Encrypted Channel</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Prepare Document for Execution
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
            Upload single or multi-part agreements. Merged documents will be signed in sequential order.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-crimson-900/30 border border-crimson-500/40 text-xs text-crimson-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-crimson-400 font-bold hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFilesAdded(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-crimson-500 bg-crimson-500/10"
              : "border-surface-border hover:border-surface-border-hover bg-surface-card hover:bg-surface-elevated"
          } shadow-elevation-1`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFilesAdded(e.target.files)}
            multiple
            accept="application/pdf"
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Drag &amp; Drop PDF Contracts Here
          </h3>
          <p className="text-xs text-content-muted mt-1.5 font-medium">
            or <span className="text-crimson-400 underline decoration-crimson-500/50">click to browse</span> from your computer
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-mono text-content-subtle">
            <span>Supports up to 10 joined files</span>
            <span>•</span>
            <span>25 MB max per file</span>
            <span>•</span>
            <span>256-bit AES-GCM Encrypted</span>
          </div>
        </div>

        {/* Selected Files Staging Area */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-content-secondary">
                Staged Files ({files.length} / {MAX_FILES})
              </span>
              <button
                onClick={() => setFiles([])}
                className="text-[11px] font-mono text-content-muted hover:text-crimson-400 transition-colors"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2">
              {files.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1"
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="font-mono text-xs font-bold text-content-muted w-5">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center text-crimson-400 border border-surface-border">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-content-muted">{formatSize(item.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {files.length > 1 && (
                      <div className="flex items-center border border-surface-border rounded-lg overflow-hidden">
                        <button
                          disabled={index === 0}
                          onClick={() => moveFile(index, "up")}
                          className="px-2 py-1 bg-surface-elevated hover:bg-surface-overlay disabled:opacity-30 text-xs text-content-secondary"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          disabled={index === files.length - 1}
                          onClick={() => moveFile(index, "down")}
                          className="px-2 py-1 bg-surface-elevated hover:bg-surface-overlay disabled:opacity-30 text-xs text-content-secondary"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(item.id)}
                      className="p-1.5 text-content-muted hover:text-crimson-400 transition-colors"
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Configuration Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-content-secondary block">
            Who Needs to Sign This Agreement?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SIGNING_FLOWS.map((flow) => {
              const active = selectedFlow === flow.id;
              return (
                <div
                  key={flow.id}
                  onClick={() => setSelectedFlow(flow.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    active
                      ? "border-crimson-500 bg-crimson-500/10 shadow-elevation-2"
                      : "border-surface-border bg-surface-card hover:bg-surface-elevated shadow-elevation-1"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-white">{flow.title}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        active
                          ? "bg-crimson-500 text-white font-bold"
                          : "bg-surface-elevated text-content-muted"
                      }`}
                    >
                      {flow.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-content-muted leading-relaxed font-normal">{flow.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Action Button */}
        <div className="pt-4 border-t border-surface-border flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-wider text-content-muted hover:text-white transition-colors"
          >
            Cancel
          </Link>

          <button
            disabled={files.length === 0 || isUploading}
            onClick={handleStartUpload}
            className="px-8 py-3 bg-crimson-600 hover:bg-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-2 hover:shadow-crimson-glow transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading ({uploadProgress}%)</span>
              </>
            ) : (
              <>
                <span>Proceed to Editor</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
