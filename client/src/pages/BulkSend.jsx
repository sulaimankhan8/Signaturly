import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchMyTemplatesApi, fetchTemplateDetailsApi } from "../api/template.api";
import { bulkSendFromTemplateApi } from "../api/bulk.api";

const BulkSend = () => {
  const [searchParams] = useSearchParams();
  const initialTemplateId = searchParams.get("templateId");
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId || "");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [inputMode, setInputMode] = useState("csv"); // 'csv' | 'paste'
  const [csvText, setCsvText] = useState("");
  const [parsedRecipients, setParsedRecipients] = useState([]);
  const [customMessage, setCustomMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultBatch, setResultBatch] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateDetails(selectedTemplateId);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await fetchMyTemplatesApi();
      setTemplates(data || []);
      if (!selectedTemplateId && data && data.length > 0) {
        setSelectedTemplateId(data[0]._id);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load templates.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplateDetails = async (id) => {
    try {
      const data = await fetchTemplateDetailsApi(id);
      setSelectedTemplate(data);
    } catch (err) {
      console.error(err);
    }
  };


  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text) => {
    setErrorMsg("");
    if (!text.trim()) {
      setParsedRecipients([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const results = [];

    // Check if line 1 is a header
    const startIndex = lines[0].toLowerCase().includes("email") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        const name = parts[0];
        const email = parts[1];
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        results.push({ name, email, valid: isValidEmail });
      } else if (parts.length === 1 && parts[0].includes("@")) {
        const email = parts[0];
        const name = email.split("@")[0];
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        results.push({ name, email, valid: isValidEmail });
      }
    }

    setParsedRecipients(results);
  };

  const downloadSampleCsv = () => {
    const sample = "Name,Email\nJane Doe,jane.doe@example.com\nAlex Smith,alex.smith@example.com\nMichael Scott,michael.scott@dundermifflin.com";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signaturly_bulk_recipients_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDispatch = async () => {
    if (!selectedTemplateId) {
      setErrorMsg("Please select a document template first.");
      return;
    }

    const validRecipients = parsedRecipients.filter((r) => r.valid);
    if (validRecipients.length === 0) {
      setErrorMsg("No valid recipients detected. Please add at least 1 recipient with a valid email.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");
      const res = await bulkSendFromTemplateApi({
        templateId: selectedTemplateId,
        recipients: validRecipients.map((r) => ({ name: r.name, email: r.email })),
        message: customMessage,
      });
      setResultBatch(res);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || "Failed to dispatch bulk documents.");
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = parsedRecipients.filter((r) => r.valid).length;
  const invalidCount = parsedRecipients.filter((r) => !r.valid).length;

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 py-10 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                ⚡ Enterprise Batch Flow
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Bulk Document Dispatch</h1>
            <p className="text-gray-400 text-sm mt-1">
              Generate and email customized legally binding agreements to dozens of signers in one click.
            </p>
          </div>

          <button
            onClick={() => navigate("/templates")}
            className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition border border-gray-700/50"
          >
            ← Back to Templates
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* Success Modal / Card */}
        {resultBatch ? (
          <div className="bg-[#12141c] border border-emerald-500/30 rounded-2xl p-8 shadow-2xl animate-fade-in text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-white">Batch Dispatched Successfully!</h2>
            <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
              We generated <span className="text-emerald-400 font-bold">{resultBatch.totalDispatched} individual contracts</span> and dispatched secure e-sign links to all signers.
            </p>

            <div className="bg-[#08090d] border border-gray-800 rounded-xl p-4 my-6 text-left max-h-60 overflow-y-auto">
              <div className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Dispatched Manifest ({resultBatch.batchId})</div>
              {resultBatch.dispatchedDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0 text-sm">
                  <div>
                    <span className="text-white font-medium">{doc.recipientName}</span>
                    <span className="text-gray-500 text-xs ml-2">({doc.recipientEmail})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Email Sent ✉️
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg transition"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setResultBatch(null);
                  setParsedRecipients([]);
                  setCsvText("");
                }}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl transition"
              >
                Send Another Batch
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select Template */}
            <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-sm">
                  1
                </span>
                <h2 className="text-lg font-bold text-white">Select Base Document Template</h2>
              </div>

              {loadingTemplates ? (
                <div className="text-gray-500 text-sm animate-pulse">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-gray-400 text-sm p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                  No templates available yet. Please create a template or use prebuilt templates first.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl._id;
                    return (
                      <div
                        key={tpl._id}
                        onClick={() => setSelectedTemplateId(tpl._id)}
                        className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-red-500/10 border-red-500/50 shadow-md shadow-red-500/5"
                            : "bg-[#0c0d14] border-gray-800/80 hover:border-gray-700 hover:bg-gray-800/20"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-white text-sm line-clamp-1">{tpl.name}</h3>
                          {tpl.isPrebuilt && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-bold">
                              PREBUILT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1">{tpl.description || "Standard legal document"}</p>
                        <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                          <span>📄 {tpl.pageCount} page(s)</span>
                          <span>✍️ {tpl.fields?.length || 0} fields</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Upload or Paste CSV */}
            <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-sm">
                    2
                  </span>
                  <h2 className="text-lg font-bold text-white">Import Signers</h2>
                </div>

                <button
                  onClick={downloadSampleCsv}
                  className="text-xs text-red-400 hover:text-red-300 font-medium underline flex items-center gap-1"
                >
                  📥 Download Sample CSV
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex border border-gray-800 rounded-xl p-1 bg-[#0a0b10] mb-4 max-w-xs">
                <button
                  onClick={() => setInputMode("csv")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    inputMode === "csv" ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  📁 Upload .CSV
                </button>
                <button
                  onClick={() => setInputMode("paste")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    inputMode === "paste" ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  📋 Paste Text
                </button>
              </div>

              {inputMode === "csv" ? (
                <div className="border-2 border-dashed border-gray-800 hover:border-red-500/40 rounded-2xl p-8 text-center transition bg-[#090a0f]">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    id="csv-file-input"
                    className="hidden"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                    <span className="text-3xl mb-2">📊</span>
                    <span className="text-sm font-semibold text-white">Click to upload CSV spreadsheet</span>
                    <span className="text-xs text-gray-500 mt-1">Accepts .csv with Name, Email format</span>
                  </label>
                </div>
              ) : (
                <div>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      parseCsv(e.target.value);
                    }}
                    placeholder={`Name, Email\nJane Doe, jane@example.com\nAlex Smith, alex@example.com`}
                    className="w-full bg-[#08090d] border border-gray-800 rounded-xl p-3 text-sm text-gray-200 font-mono focus:outline-none focus:border-red-500/60"
                  />
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedRecipients.length > 0 && (
                <div className="mt-6 border border-gray-800/80 rounded-xl overflow-hidden bg-[#090a0f]">
                  <div className="p-3 bg-[#0e1017] border-b border-gray-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-300">Parsed Signers ({parsedRecipients.length})</span>
                    <div className="flex gap-2">
                      <span className="text-emerald-400 font-semibold">✓ {validCount} Valid</span>
                      {invalidCount > 0 && <span className="text-amber-400 font-semibold">⚠️ {invalidCount} Invalid</span>}
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-800/40">
                    {parsedRecipients.map((rec, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-mono">#{i + 1}</span>
                          <span className="text-white font-medium">{rec.name}</span>
                          <span className="text-gray-400">({rec.email})</span>
                        </div>
                        {rec.valid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            READY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                            INVALID EMAIL
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Message & Dispatch */}
            <div className="bg-[#12141c] border border-gray-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-sm">
                  3
                </span>
                <h2 className="text-lg font-bold text-white">Custom Email Message (Optional)</h2>
              </div>

              <textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. Please review and sign this agreement at your earliest convenience."
                className="w-full bg-[#08090d] border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-red-500/60"
              />

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-800/80">
                <div className="text-xs text-gray-400">
                  Ready to dispatch to <strong className="text-white">{validCount}</strong> signer(s).
                </div>

                <button
                  disabled={submitting || validCount === 0 || !selectedTemplateId}
                  onClick={handleDispatch}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xl shadow-red-900/30 transition flex items-center gap-2 text-sm"
                >
                  {submitting ? (
                    <>
                      <span className="animate-spin text-lg">⏳</span>
                      <span>Dispatching Batch...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀 Dispatch All ({validCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkSend;
