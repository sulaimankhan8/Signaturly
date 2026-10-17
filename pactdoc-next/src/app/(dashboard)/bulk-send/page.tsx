"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

interface RecipientRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Valid" | "Error";
}

const TEMPLATES = [
  { id: "tmpl-nda", title: "Mutual Non-Disclosure Agreement (NDA)", roles: ["Counterparty"] },
  { id: "tmpl-offer", title: "Standard Employee Offer Letter", roles: ["Employee"] },
  { id: "tmpl-vendor", title: "Master Services Agreement (MSA)", roles: ["Vendor Lead"] },
];

export default function BulkSendPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { id: "1", name: "David Miller", email: "david.miller@acme.corp", role: "Counterparty", status: "Valid" },
    { id: "2", name: "Sarah Jenkins", email: "sarah.j@acme.corp", role: "Counterparty", status: "Valid" },
    { id: "3", name: "Michael Chang", email: "mchang@venture.io", role: "Counterparty", status: "Valid" },
  ]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchComplete, setDispatchComplete] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      const parsed: RecipientRow[] = [];

      // skip header if line 1 contains "name" or "email"
      const startIndex = lines[0].toLowerCase().includes("email") ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          const email = parts[1] || parts[0];
          const name = parts[0];
          parsed.push({
            id: `row-${i}-${Date.now()}`,
            name: name || "Recipient",
            email: email,
            role: "Counterparty",
            status: email.includes("@") ? "Valid" : "Error",
          });
        }
      }

      if (parsed.length > 0) {
        setRecipients(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleDispatch = async () => {
    setIsDispatching(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsDispatching(false);
    setDispatchComplete(true);
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
            <span className="text-xs font-bold uppercase tracking-wider text-white">CSV Bulk Dispatch Engine</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-content-muted">Batch Sending Queue Ready</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            High-Volume Document Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
            Send customized legal contracts to hundreds of signers simultaneously with individual private tokens.
          </p>
        </div>

        {/* Step 1: Select Template */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-elevation-1">
          <span className="px-2.5 py-1 rounded bg-crimson-500/10 text-crimson-400 font-mono text-[10px] uppercase font-bold border border-crimson-500/25">
            Step 1: Choose Contract Template
          </span>

          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500 font-medium"
          >
            {TEMPLATES.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>
                {tmpl.title} (Requires: {tmpl.roles.join(", ")})
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Upload CSV */}
        <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-4 shadow-elevation-1">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 font-mono text-[10px] uppercase font-bold border border-purple-500/25">
              Step 2: Upload Recipient CSV Spreadsheet
            </span>

            <button
              onClick={() => {
                const csvSample = "Full Name,Email Address\nJohn Doe,john@acme.com\nJane Smith,jane@acme.com";
                const blob = new Blob([csvSample], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "pactdoc_sample_recipients.csv";
                a.click();
              }}
              className="text-[11px] font-mono text-content-muted hover:text-white transition-colors"
            >
              Download Sample CSV ↓
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-surface-border hover:border-surface-border-hover bg-surface-subtle p-8 rounded-xl text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-xs font-bold text-white uppercase">Click to Select CSV File</p>
            <p className="text-[11px] text-content-muted mt-1 font-mono">Format: Name, Email (up to 500 rows per batch)</p>
          </div>
        </div>

        {/* Step 3: Staged Recipients Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-content-muted px-2">
            <span>Staged Recipients ({recipients.length})</span>
            <span>Status</span>
          </div>

          <div className="space-y-2">
            {recipients.map((r, i) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-content-muted w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">{r.name}</p>
                    <p className="text-[11px] font-mono text-content-muted">{r.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-content-secondary border border-surface-border">
                    {r.role}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                      r.status === "Valid"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : "bg-crimson-500/10 text-crimson-400 border border-crimson-500/25"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dispatch Button / Confirmation */}
        <div className="pt-4 border-t border-surface-border flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-wider text-content-muted hover:text-white"
          >
            Cancel
          </Link>

          {!dispatchComplete ? (
            <button
              disabled={recipients.length === 0 || isDispatching}
              onClick={handleDispatch}
              className="px-8 py-3.5 bg-crimson-600 hover:bg-crimson-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-2 hover:shadow-crimson-glow transition-all flex items-center gap-2"
            >
              {isDispatching ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching {recipients.length} Contracts...</span>
                </>
              ) : (
                <span>Dispatch Batch ({recipients.length} Signers) →</span>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-emerald-400 font-bold">
                ✓ Batch dispatched successfully!
              </span>
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-surface-elevated hover:bg-surface-overlay text-white text-xs font-bold rounded-xl border border-surface-border"
              >
                Return to Dashboard
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
