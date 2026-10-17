"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: string;
  status: "Paid" | "Refunded";
  plan: string;
}

const INVOICES: Invoice[] = [
  { id: "inv-101", invoiceNumber: "INV-2026-0812", date: "2026-08-01", amount: "₹1,499", status: "Paid", plan: "PactDoc Pro (Annual)" },
  { id: "inv-102", invoiceNumber: "INV-2026-0712", date: "2026-07-01", amount: "₹1,499", status: "Paid", plan: "PactDoc Pro (Monthly)" },
  { id: "inv-103", invoiceNumber: "INV-2026-0612", date: "2026-06-01", amount: "₹1,499", status: "Paid", plan: "PactDoc Pro (Monthly)" },
];

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

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
            <span className="text-xs font-bold uppercase tracking-wider text-white">Plans &amp; Billing</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-content-muted">Razorpay &amp; Stripe Verified Vault</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Subscription &amp; Document Quota
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
            Manage your organization's signature volume, active plan tier, and tax invoices.
          </p>
        </div>

        {/* Current Plan Overview Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg font-black text-white uppercase tracking-wide">PactDoc Professional</span>
                <span className="px-2 py-0.5 rounded bg-crimson-500/10 text-crimson-400 font-mono text-[10px] font-bold border border-crimson-500/25">
                  Active
                </span>
              </div>
              <p className="text-xs text-content-muted mt-1">
                Unlimited signature requests, custom branding, and multi-signer workflows.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-white font-mono">₹1,499</span>
              <span className="text-xs text-content-muted font-mono"> / month (Billed annually)</span>
              <p className="text-[11px] font-mono text-content-subtle mt-0.5">Renews on August 1, 2027</p>
            </div>
          </div>

          {/* Usage Meter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-content-secondary">Monthly Document Allowance</span>
              <span className="text-white font-bold">18 / 100 Documents Sent</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-subtle overflow-hidden">
              <div className="h-full bg-gradient-to-r from-crimson-600 to-crimson-500 rounded-full" style={{ width: "18%" }} />
            </div>
            <p className="text-[10px] font-mono text-content-muted">
              82 document allocations remaining. Quota resets on the 1st of every calendar month.
            </p>
          </div>
        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              Billing History &amp; GST Invoices
            </h3>
            <span className="text-[11px] font-mono text-content-muted">Tax ID: GSTIN27AAACP0129Q1Z8</span>
          </div>

          <div className="space-y-2">
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-elevated text-emerald-400 border border-surface-border flex items-center justify-center font-mono text-xs">
                    ₹
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white font-mono">{inv.invoiceNumber}</p>
                    <p className="text-[11px] text-content-muted font-mono">{inv.date} • {inv.plan}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs font-bold text-white">{inv.amount}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    {inv.status}
                  </span>
                  <button
                    onClick={() => alert(`Downloading ${inv.invoiceNumber}.pdf`)}
                    className="text-xs font-mono text-content-muted hover:text-white transition-colors"
                    title="Download PDF Invoice"
                  >
                    PDF ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
