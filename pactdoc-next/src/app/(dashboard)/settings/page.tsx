"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "api">("profile");
  const [fullName, setFullName] = useState("Suleman Khan");
  const [email] = useState("admin@pactdoc.com");
  const [company, setCompany] = useState("PactDoc Technologies");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const mockApiKey = "pk_live_948f21e09214a7e937d0c8b3";
  const mockWebhookUrl = "https://api.pactdoc.com/v1/webhooks/contract-signed";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(mockApiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2500);
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
            <span className="text-xs font-bold uppercase tracking-wider text-white">Account Settings</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-content-muted">Security Level: Enterprise Tier</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Settings &amp; Security Controls
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
            Manage your legal signature credentials, authentication factors, and developer API keys.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-surface-border pb-3">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "profile"
                ? "bg-surface-card text-white border border-surface-border shadow-elevation-1"
                : "text-content-muted hover:text-white"
            }`}
          >
            Profile &amp; Identity
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "security"
                ? "bg-surface-card text-white border border-surface-border shadow-elevation-1"
                : "text-content-muted hover:text-white"
            }`}
          >
            2FA &amp; Security
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "api"
                ? "bg-surface-card text-white border border-surface-border shadow-elevation-1"
                : "text-content-muted hover:text-white"
            }`}
          >
            API &amp; Webhooks
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            <span>Settings successfully committed to institutional vault.</span>
          </div>
        )}

        {/* Tab: Profile */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-5 shadow-elevation-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                Legal Signer Identity
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-content-muted uppercase">Full Legal Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-content-muted uppercase">Organization / Firm</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-content-muted uppercase">Registered Signer Email</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-content-muted text-xs cursor-not-allowed"
                />
                <span className="text-[10px] text-content-subtle font-mono">
                  Email updates require cryptographic re-verification for digital certificates.
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-1 hover:shadow-crimson-glow transition-all"
              >
                Save Identity Changes
              </button>
            </div>
          </form>
        )}

        {/* Tab: Security */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-6 shadow-elevation-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Two-Factor Authentication (TOTP)
                  </h3>
                  <p className="text-xs text-content-muted mt-0.5">
                    Requires a 6-digit cryptographic TOTP token from an authenticator app upon signing access.
                  </p>
                </div>

                <button
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                    twoFactorEnabled
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-surface-elevated text-content-muted border border-surface-border"
                  }`}
                >
                  {twoFactorEnabled ? "Active & Enforced" : "Disabled"}
                </button>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Active Sessions &amp; IPs</h3>
                  <p className="text-xs text-content-muted mt-0.5">
                    Audit trail logs track incoming client IPs and TLS cipher suites.
                  </p>
                </div>
                <button className="px-3.5 py-1.5 bg-surface-elevated hover:bg-surface-overlay text-content-secondary text-xs rounded-xl border border-surface-border transition-colors">
                  Revoke Other Sessions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: API & Webhooks */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border space-y-6 shadow-elevation-1">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Production REST API Key</h3>
                <p className="text-xs text-content-muted font-normal">
                  Authenticate outbound signature requests, template fills, and audit verification queries.
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="password"
                    readOnly
                    value={mockApiKey}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border font-mono text-xs text-content-secondary"
                  />
                  <button
                    onClick={copyApiKey}
                    className="px-4 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold rounded-xl shadow-elevation-1 transition-all"
                  >
                    {apiKeyCopied ? "Copied!" : "Copy Secret"}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-border space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Webhook Delivery Endpoint</h3>
                <p className="text-xs text-content-muted font-normal">
                  PactDoc sends signed payloads and checksum certificates to your endpoint upon final document execution.
                </p>
                <input
                  type="text"
                  readOnly
                  value={mockWebhookUrl}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border font-mono text-xs text-content-secondary"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
