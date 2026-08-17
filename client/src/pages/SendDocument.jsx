import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RECIPIENT_PALETTE } from "../utils/constants";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

export default function SendDocument() {
  const { pdfId } = useParams();
  const navigate = useNavigate();

  const [docMeta, setDocMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signingOrder, setSigningOrder] = useState(false);
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [recipients, setRecipients] = useState([
    {
      id: crypto.randomUUID(),
      name: "",
      email: "",
      role: "signer",
      color: RECIPIENT_PALETTE[0].color,
    },
  ]);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await API.get(`/pdf/${pdfId}`);
        setDocMeta(res.data.data);
      } catch (err) {
        console.error("Error fetching PDF meta:", err);
        toast.error("Failed to load document details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoc();
  }, [pdfId]);

  const addRecipient = () => {
    const nextColorIdx = recipients.length % RECIPIENT_PALETTE.length;
    setRecipients((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        email: "",
        role: "signer",
        color: RECIPIENT_PALETTE[nextColorIdx].color,
      },
    ]);
  };

  const updateRecipient = (id, updates) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const removeRecipient = (id) => {
    if (recipients.length <= 1) {
      toast.error("At least one recipient is required");
      return;
    }
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const moveRecipient = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= recipients.length) return;
    const copy = [...recipients];
    const item = copy.splice(index, 1)[0];
    copy.splice(newIdx, 0, item);
    setRecipients(copy);
  };

  const proceedToFieldAssignment = () => {
    // Validate recipients
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      if (!r.name.trim()) {
        toast.error(`Please provide a name for Recipient #${i + 1}`);
        return;
      }
      if (!r.email.trim() || !r.email.includes("@")) {
        toast.error(`Please provide a valid email for Recipient #${i + 1}`);
        return;
      }
    }

    // Pass configuration to AssignFields stage
    navigate(`/assign/${pdfId}`, {
      state: {
        recipients: recipients.map((r, idx) => ({
          ...r,
          signingOrder: idx + 1,
        })),
        signingOrder,
        message,
        expiresAt,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-red-400 font-bold uppercase tracking-wider mb-1">
              <span>Step 1 of 2</span>
              <span>•</span>
              <span>Workflow Setup</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Add Recipients & Configure Flow
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              Document: <span className="text-white font-semibold">{docMeta?.originalFileName}</span> ({docMeta?.pageCount} pages)
            </p>
          </div>

          <button
            onClick={proceedToFieldAssignment}
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Next: Place Form Fields</span>
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Recipients Card */}
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-display font-bold text-white">Document Signers</h2>
              <p className="text-gray-400 text-xs mt-0.5">Specify who needs to sign or review this agreement.</p>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <input
                type="checkbox"
                checked={signingOrder}
                onChange={(e) => setSigningOrder(e.target.checked)}
                className="accent-red-600 rounded"
              />
              <span className="text-xs font-semibold text-gray-200">Enforce Sequential Order</span>
            </label>
          </div>

          {/* Recipient Rows */}
          <div className="space-y-4">
            {recipients.map((recipient, index) => (
              <div
                key={recipient.id}
                className="bg-[#08090d] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:border-white/20"
                style={{ borderLeftColor: recipient.color, borderLeftWidth: "4px" }}
              >
                {/* Index / Reorder handle */}
                <div className="flex items-center space-x-2">
                  <div
                    className="w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow"
                    style={{ backgroundColor: recipient.color }}
                  >
                    #{index + 1}
                  </div>

                  {signingOrder && (
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveRecipient(index, -1)}
                        className="text-gray-500 hover:text-white disabled:opacity-20 p-0.5"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === recipients.length - 1}
                        onClick={() => moveRecipient(index, 1)}
                        className="text-gray-500 hover:text-white disabled:opacity-20 p-0.5"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 w-full sm:w-auto">
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                    Signer Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(recipient.id, { name: e.target.value })}
                    className="w-full px-3 py-2 bg-[#12141c] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Email */}
                <div className="flex-1 w-full sm:w-auto">
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="john@company.com"
                    value={recipient.email}
                    onChange={(e) => updateRecipient(recipient.id, { email: e.target.value })}
                    className="w-full px-3 py-2 bg-[#12141c] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Role */}
                <div className="w-full sm:w-32">
                  <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                    Role
                  </label>
                  <select
                    value={recipient.role}
                    onChange={(e) => updateRecipient(recipient.id, { role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#12141c] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
                  >
                    <option value="signer">Signer</option>
                    <option value="viewer">Viewer</option>
                    <option value="approver">Approver</option>
                  </select>
                </div>

                {/* Remove */}
                {recipients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient.id)}
                    className="self-end sm:self-center p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                    title="Remove Recipient"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRecipient}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Another Signer</span>
          </button>
        </div>

        {/* Message & Expiration Settings Card */}
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <h2 className="text-base font-display font-bold text-white">Email & Expiration Settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                Personal Invitation Note (Included in Email)
              </label>
              <textarea
                rows={3}
                placeholder="Please review and sign this agreement at your earliest convenience."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                Expiration Date (Optional)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-end pt-4">
          <button
            onClick={proceedToFieldAssignment}
            className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all hover:scale-105"
          >
            Proceed to Field Placement →
          </button>
        </div>
      </main>
    </div>
  );
}
