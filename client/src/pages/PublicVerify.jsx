import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";

export default function PublicVerify() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState("timeline"); // timeline | signers | legal | raw
  const [isDragOver, setIsDragOver] = useState(false);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const cleanHashString = hash.trim().replace(/[\r\n\t]/g, "");
    if (!file && !cleanHashString) {
      setError("Please select a PDF file or paste a SHA-256 hash string.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("hash", cleanHashString);
      }

      const res = await API.post("/verify/document", formData, {
        headers: file ? { "Content-Type": "multipart/form-data" } : {},
      });

      setResult(res.data);
      if (res.data?.isAuthentic) {
        toast.success("Document cryptographic authenticity verified!");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Document verification failed.");
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, label = "Hash") => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handleReset = () => {
    setFile(null);
    setHash("");
    setResult(null);
    setError(null);
  };

  const handleDownloadCertificate = async (pdfId, originalName = "Document") => {
    try {
      toast.loading("Downloading certified audit PDF...", { id: "cert-dl" });
      const res = await API.get(`/pdf/${pdfId}/audit-certificate`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Certified-Audit-Trail-${originalName.replace(/\.pdf$/i, "")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Certificate downloaded successfully!", { id: "cert-dl" });
    } catch (err) {
      toast.error("Failed to download audit certificate", { id: "cert-dl" });
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />

      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Verification Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-mono font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Immutable Blockchain Ledger Validator
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            Verify Document Authenticity & Custody
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Upload any executed agreement, signed PDF, or audit certificate—or paste its SHA-256 cryptographic digest to audit the complete blockchain lifecycle against the immutable vault.
          </p>
        </div>

        {/* Verification Input Box */}
        <div className="bg-[#10131d] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleVerify} className="space-y-5">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.[0]) {
                  setFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${
                isDragOver
                  ? "border-red-500 bg-red-950/20 scale-[0.99]"
                  : file
                  ? "border-emerald-500/60 bg-emerald-950/10"
                  : "border-white/15 hover:border-red-500/50 bg-[#0a0c13]/80 hover:bg-[#0d0f18]"
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                id="pdfDocUpload"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${file ? "bg-emerald-600 text-white" : "bg-red-600/15 text-red-400 border border-red-500/20"}`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {file ? (
                  <div>
                    <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {file.name}
                    </p>
                    <p className="text-xs text-emerald-400/80 font-mono mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to verify
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-gray-200">
                      Click or drag & drop PDF contract or audit certificate here
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      Accepts original contracts, signed documents, or Section 63 BSA certificates
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-mono text-gray-500 uppercase tracking-widest">
              <span className="h-px bg-white/10 flex-1" />
              <span>OR ENTER DIGEST HASH</span>
              <span className="h-px bg-white/10 flex-1" />
            </div>

            {/* Cryptographic Hash Input */}
            <div>
              <label className="block text-xs font-mono font-bold text-gray-300 uppercase mb-2">
                SHA-256 Cryptographic Hash / Document ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 822121b0c0fdde94f0672d62f8d8fc996fd3a3222d4ebd309e2c0489f66d07c7"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  className="w-full px-4 py-3 bg-[#080a10] border border-white/15 rounded-xl text-white placeholder-gray-600 font-mono text-xs focus:outline-none focus:border-red-500 transition-colors pr-10"
                />
                {hash && (
                  <button
                    type="button"
                    onClick={() => setHash("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || (!file && !hash.trim())}
                className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 border border-red-500/30"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Verifying Ledger Cryptographic Proofs...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Verify Document Authenticity</span>
                  </>
                )}
              </button>

              {(result || file || hash) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
                >
                  Clear & Reset
                </button>
              )}
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-bold text-red-200">Verification Result: Unrecognized</p>
                <p className="mt-0.5 text-red-300/80">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Verification Result Showcase */}
        {result && (
          <div className="space-y-6">
            {/* Authenticity Certificate Card */}
            <div
              className={`rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all ${
                result.isAuthentic
                  ? "bg-gradient-to-b from-[#0b1b15] to-[#07110e] border-emerald-500/40 shadow-emerald-950/40"
                  : "bg-gradient-to-b from-[#1c0e0e] to-[#120707] border-red-500/40 shadow-red-950/40"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                      result.isAuthentic
                        ? "bg-emerald-500 text-black border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        : "bg-red-600 text-white border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    }`}
                  >
                    {result.isAuthentic ? (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          result.isAuthentic
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : "bg-red-950 text-red-300 border-red-800"
                        }`}
                      >
                        {result.isAuthentic ? "Cryptographic Ledger Verified" : "Tampered / Unrecognized"}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {result.totalEvents || 0} Ledger Blocks
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-white mt-1">
                      {result.isAuthentic
                        ? "Document Authenticity & Custody Verified"
                        : "Document Verification Failed"}
                    </h2>
                    <p className="text-xs text-gray-300 mt-1 max-w-2xl">
                      {result.isAuthentic
                        ? "The cryptographic hash matches an authentic executed agreement in our immutable ledger. The cryptographic Merkle hash chain is intact and legally binding."
                        : result.reason}
                    </p>
                  </div>
                </div>

                {result.documentId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDownloadCertificate(result.documentId, result.documentTitle)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Audit Certificate</span>
                    </button>

                    {result.signedDocUrl && (
                      <a
                        href={result.signedDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>View Executed PDF</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Matched Hash Diagnostic Badge */}
              <div className="mt-6 bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-gray-400">
                    Matched Hash Classification:
                  </span>
                  <p className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    {result.matchedClassification || "Cryptographic Fingerprint"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 truncate max-w-xs sm:max-w-md">
                    {result.matchedCandidate || result.computedHash}
                  </code>
                  <button
                    onClick={() => handleCopy(result.matchedCandidate || result.computedHash, "Digest Hash")}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    title="Copy Hash"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Core Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-mono text-gray-400">Document Title</p>
                  <p className="text-xs font-bold text-white mt-1 truncate" title={result.documentTitle}>
                    {result.documentTitle || "Contract"}
                  </p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-mono text-gray-400">Execution Status</p>
                  <p className="text-xs font-bold text-emerald-400 mt-1 uppercase">
                    {result.status || "Signed & Sealed"}
                  </p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-mono text-gray-400">Page Count</p>
                  <p className="text-xs font-bold text-white mt-1 font-mono">
                    {result.pageCount || 1} Pages
                  </p>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-mono text-gray-400">Executed Date</p>
                  <p className="text-xs font-bold text-white mt-1 font-mono">
                    {result.executedAt ? new Date(result.executedAt).toLocaleDateString() : "Recorded"}
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Ledger & Signers Tabs */}
            <div className="bg-[#10131d] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Tab Navigation */}
              <div className="flex bg-[#090b12] p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
                {[
                  { id: "timeline", label: `Blockchain Ledger (${result.ledgerChain?.length || 0} Events)` },
                  { id: "signers", label: `Signers Attribution (${result.signers?.length || 0})` },
                  { id: "legal", label: "Legal Compliance & Statutes" },
                  { id: "raw", label: "Merkle Proofs JSON" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLedgerTab(tab.id)}
                    className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all ${
                      activeLedgerTab === tab.id
                        ? "bg-red-600 text-white shadow-md border border-red-500/30"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Step-by-Step Merkle Blockchain Timeline */}
              {activeLedgerTab === "timeline" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Immutable Merkle Event Chain Progression
                    </h3>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/40">
                      ✓ 100% Tamper-Proof
                    </span>
                  </div>

                  <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/15">
                    {result.ledgerChain?.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className={`relative rounded-2xl p-4 sm:p-5 border transition-all ${
                          step.isMatched
                            ? "bg-red-950/30 border-red-500/60 shadow-lg shadow-red-950/40"
                            : "bg-[#090b12] border-white/10 hover:border-white/20"
                        }`}
                      >
                        {/* Circle Badge on Timeline */}
                        <div
                          className={`absolute -left-[31px] sm:-left-[39px] top-4 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black border-2 ${
                            step.isMatched
                              ? "bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                              : "bg-[#151824] text-gray-300 border-white/20"
                          }`}
                        >
                          {step.step}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white capitalize">{step.title}</span>
                            {step.isMatched && (
                              <span className="text-[9px] font-mono uppercase bg-red-600 text-white px-2 py-0.5 rounded-full font-black">
                                Matched Query
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-gray-400">
                            {new Date(step.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-gray-300 mt-2">{step.description}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/10 text-[11px]">
                          <div>
                            <span className="text-gray-500 font-mono">Actor:</span>{" "}
                            <span className="text-gray-200 font-semibold">{step.actorName} ({step.actorEmail})</span>
                          </div>
                          <div>
                            <span className="text-gray-500 font-mono">IP Address:</span>{" "}
                            <span className="text-gray-200 font-mono">{step.ipAddress}</span>
                          </div>
                        </div>

                        {/* Hash Hashes */}
                        <div className="mt-3 space-y-1.5 font-mono text-[10px] bg-black/50 p-3 rounded-xl border border-white/5">
                          {step.signedHash && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-500">Signed Hash:</span>
                              <span className="text-red-400 truncate">{step.signedHash}</span>
                            </div>
                          )}
                          {step.originalHash && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-500">Source Hash:</span>
                              <span className="text-emerald-400 truncate">{step.originalHash}</span>
                            </div>
                          )}
                          {step.eventHash && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-500">Event Block Hash:</span>
                              <span className="text-blue-400 truncate">{step.eventHash}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Signers Breakdown */}
              {activeLedgerTab === "signers" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Authorized Signers Attribution & OTP Verification
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.signers?.map((signer, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-[#090b12] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center font-bold text-xs">
                              {signer.name ? signer.name[0] : "S"}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{signer.name}</p>
                              <p className="text-[11px] text-gray-400">{signer.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase">
                            {signer.status || "Signed"}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-gray-400 font-mono">
                          <p>Auth: <span className="text-gray-200">{signer.authMethod}</span></p>
                          <p>Signed At: <span className="text-gray-200">{signer.signedAt ? new Date(signer.signedAt).toLocaleString() : "Confirmed"}</span></p>
                          <p>IP Address: <span className="text-gray-200">{signer.ipAddress}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Statutory Legal Compliance */}
              {activeLedgerTab === "legal" && (
                <div className="space-y-4 text-xs text-gray-300">
                  <div className="p-4 rounded-2xl bg-[#090b12] border border-white/10 space-y-2">
                    <p className="font-bold text-white text-sm">🇮🇳 India Statutory Enforceability</p>
                    <p className="text-gray-400 leading-relaxed">
                      {result.legalStanding?.indiaStatute || "Section 10A IT Act, 2000 & Section 63 Bharatiya Sakshya Adhiniyam, 2023."}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#090b12] border border-white/10 space-y-2">
                    <p className="font-bold text-white text-sm">🇺🇸 United States & Global Standing</p>
                    <p className="text-gray-400 leading-relaxed">
                      {result.legalStanding?.usStatute || "15 U.S.C. § 7001 (US ESIGN Act) and Uniform Electronic Transactions Act (UETA)."}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#090b12] border border-white/10 space-y-2">
                    <p className="font-bold text-white text-sm">🇪🇺 European Union Standing</p>
                    <p className="text-gray-400 leading-relaxed">
                      {result.legalStanding?.euStatute || "eIDAS Regulation (EU) No 910/2014 for electronic signature validity."}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 4: Raw Merkle JSON Export */}
              {activeLedgerTab === "raw" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">Cryptographic JSON Ledger Record:</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(result, null, 2), "Ledger JSON")}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy Full JSON Proof</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-[#05060a] border border-white/10 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-96">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
