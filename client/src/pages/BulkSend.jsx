import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
    <div className="min-h-screen bg-[#090a0f] text-gray-100 py-10 px-4 sm:px-8 font-sans selection:bg-yellow-400 selection:text-black">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_#ef4444]">
                Batch Dispatch Engine
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">Bulk Document Dispatch</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1 font-medium">
              Generate and email customized legally binding agreements to dozens of signers in one batch.
            </p>
          </div>

          <button
            onClick={() => navigate("/templates")}
            className="px-4 py-2.5 bg-[#13151f] hover:bg-[#1f2233] text-gray-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Templates</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-300 text-xs font-bold shadow-[4px_4px_0px_0px_#ef4444] flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-white font-black ml-4">✕</button>
          </div>
        )}

        {/* Success Modal / Card */}
        {resultBatch ? (
          <div className="bg-[#13151f] border-2 border-emerald-500 rounded-3xl p-8 shadow-[8px_8px_0px_0px_#22c55e] text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500 text-black border-2 border-black rounded-2xl flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_#fff]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase">Batch Dispatched Successfully!</h2>
              <p className="text-gray-300 text-xs sm:text-sm mt-2 max-w-md mx-auto font-medium">
                We generated <strong className="text-emerald-400 font-bold">{resultBatch.totalDispatched} individual contracts</strong> and dispatched secure e-sign links to all signers.
              </p>
            </div>

            <div className="bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 my-6 text-left max-h-60 overflow-y-auto">
              <div className="text-[11px] font-black uppercase text-yellow-400 tracking-wider mb-2">
                Dispatched Manifest ({resultBatch.batchId})
              </div>
              {resultBatch.dispatchedDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 border-b-2 border-white/10 last:border-0 text-xs">
                  <div>
                    <span className="text-white font-black">{doc.recipientName}</span>
                    <span className="text-gray-400 font-mono text-[11px] ml-2">({doc.recipientEmail})</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-black border border-black">
                    Dispatched
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-xs rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#facc15] transition"
              >
                Go to Dashboard →
              </button>
              <button
                onClick={() => {
                  setResultBatch(null);
                  setParsedRecipients([]);
                  setCsvText("");
                }}
                className="px-6 py-3.5 bg-[#1e2235] hover:bg-[#282d47] text-gray-200 font-black uppercase tracking-wider text-xs rounded-xl border-2 border-white/20 shadow-[3px_3px_0px_0px_#000] transition"
              >
                Send Another Batch
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select Template */}
            <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-6 shadow-[5px_5px_0px_0px_#000]">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center font-black text-xs">
                  1
                </span>
                <h2 className="text-base font-black text-white uppercase">Select Base Document Template</h2>
              </div>

              {loadingTemplates ? (
                <div className="text-gray-400 text-xs font-bold animate-pulse">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-gray-400 text-xs p-4 bg-[#090a0f] rounded-xl border-2 border-white/10 font-medium">
                  No templates available yet. Please create a template or use prebuilt templates first.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl._id;
                    return (
                      <div
                        key={tpl._id}
                        onClick={() => setSelectedTemplateId(tpl._id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-yellow-400/10 border-yellow-400 shadow-[4px_4px_0px_0px_#ef4444]"
                            : "bg-[#090a0f] border-white/15 hover:border-white/40 shadow-[2px_2px_0px_0px_#000]"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="font-black text-white text-xs uppercase line-clamp-1">{tpl.name}</h3>
                          {tpl.isPrebuilt && (
                            <span className="px-2 py-0.5 rounded text-[9px] bg-red-600 text-white font-black border border-black">
                              PREBUILT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 font-medium">{tpl.description || "Standard legal document"}</p>
                        <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400 font-mono">
                          <span>{tpl.pageCount} {tpl.pageCount === 1 ? "page" : "pages"}</span>
                          <span>•</span>
                          <span>{tpl.fields?.length || 0} fields</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Upload or Paste CSV */}
            <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-6 shadow-[5px_5px_0px_0px_#000]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center font-black text-xs">
                    2
                  </span>
                  <h2 className="text-base font-black text-white uppercase">Import Signers</h2>
                </div>

                <button
                  onClick={downloadSampleCsv}
                  className="text-xs text-yellow-400 hover:text-yellow-300 font-black uppercase tracking-wider flex items-center gap-1.5 underline underline-offset-4"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex border-2 border-white/20 rounded-xl p-1 bg-[#090a0f] mb-4 max-w-xs gap-1">
                <button
                  onClick={() => setInputMode("csv")}
                  className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                    inputMode === "csv" ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Upload .CSV
                </button>
                <button
                  onClick={() => setInputMode("paste")}
                  className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                    inputMode === "paste" ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Paste Text
                </button>
              </div>

              {inputMode === "csv" ? (
                <div className="border-2 border-dashed border-white/20 hover:border-yellow-400 rounded-2xl p-8 text-center transition-all bg-[#090a0f]">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    id="csv-file-input"
                    className="hidden"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-yellow-400 text-black border-2 border-black flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_#ef4444]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span className="text-xs font-black text-white uppercase tracking-wider">Click to upload CSV spreadsheet</span>
                    <span className="text-[11px] text-gray-400 mt-1 font-mono">Accepts .csv with Name, Email columns</span>
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
                    className="w-full bg-[#090a0f] border-2 border-white/20 rounded-xl p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-yellow-400"
                  />
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedRecipients.length > 0 && (
                <div className="mt-6 border-2 border-white/20 rounded-xl overflow-hidden bg-[#090a0f]">
                  <div className="p-3 bg-[#151722] border-b-2 border-white/20 flex items-center justify-between text-xs">
                    <span className="font-black text-white uppercase">Parsed Signers ({parsedRecipients.length})</span>
                    <div className="flex gap-2">
                      <span className="text-emerald-400 font-black">{validCount} Valid</span>
                      {invalidCount > 0 && <span className="text-red-400 font-black">✕ {invalidCount} Invalid</span>}
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y-2 divide-white/10">
                    {parsedRecipients.map((rec, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-mono">#{i + 1}</span>
                          <span className="text-white font-black">{rec.name}</span>
                          <span className="text-gray-400 font-mono text-[11px]">({rec.email})</span>
                        </div>
                        {rec.valid ? (
                          <span className="px-2 py-0.5 rounded text-[9px] bg-emerald-500 text-black border border-black font-black uppercase">
                            READY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] bg-red-600 text-white border border-black font-black uppercase">
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
            <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-6 shadow-[5px_5px_0px_0px_#000]">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center font-black text-xs">
                  3
                </span>
                <h2 className="text-base font-black text-white uppercase">Custom Email Message (Optional)</h2>
              </div>

              <textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. Please review and sign this agreement at your earliest convenience."
                className="w-full bg-[#090a0f] border-2 border-white/20 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-yellow-400 font-medium"
              />

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-white/10">
                <div className="text-xs text-gray-400 font-medium">
                  Ready to dispatch to <strong className="text-yellow-400 font-black">{validCount}</strong> signer(s).
                </div>

                <button
                  disabled={submitting || validCount === 0 || !selectedTemplateId}
                  onClick={handleDispatch}
                  className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider text-xs rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#facc15] hover:shadow-[5px_5px_0px_0px_#fff] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Batch...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Dispatch All ({validCount}) →</span>
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
