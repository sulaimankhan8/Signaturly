"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  contractsCount: number;
}

const INITIAL_CONTACTS: Contact[] = [
  { id: "c-1", name: "David Miller", email: "david.miller@acme.corp", company: "Acme Corp", contractsCount: 4 },
  { id: "c-2", name: "Sarah Jenkins", email: "sarah.j@acme.corp", company: "Acme Corp", contractsCount: 2 },
  { id: "c-3", name: "Michael Chang", email: "mchang@venture.io", company: "Venture IO", contractsCount: 8 },
  { id: "c-4", name: "Priya Sharma", email: "priya@legaltech.in", company: "LegalTech India", contractsCount: 5 },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setContacts((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        name,
        email,
        company: company || "Independent",
        contractsCount: 0,
      },
    ]);
    setName("");
    setEmail("");
    setCompany("");
    setIsModalOpen(false);
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
            <span className="text-xs font-bold uppercase tracking-wider text-white">Signer Address Book</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-1 transition-all"
          >
            + Add Contact
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Signer Contacts &amp; Parties
            </h1>
            <p className="text-xs sm:text-sm text-content-muted mt-1 font-medium">
              Save frequent counterparties, external counsel, and client signers for fast 1-click role mapping.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-surface-card border border-surface-border text-xs text-white placeholder-content-muted focus:outline-none focus:border-crimson-500 sm:w-64"
          />
        </div>

        {/* Contacts Table */}
        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-crimson-600/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center font-bold text-xs uppercase">
                  {c.name.slice(0, 2)}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{c.name}</p>
                  <p className="text-[11px] font-mono text-content-muted">
                    {c.email} • {c.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-[11px] text-content-muted">
                  {c.contractsCount} documents
                </span>
                <Link
                  href="/upload"
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-overlay text-white font-mono text-xs border border-surface-border transition-colors"
                >
                  Send Document →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddContact}
            className="w-full max-w-md rounded-2xl bg-surface-card border border-surface-border p-6 space-y-4 shadow-elevation-3"
          >
            <h3 className="text-sm font-bold text-white uppercase">Add Signer Contact</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-content-muted uppercase block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-content-muted uppercase block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-content-muted uppercase block mb-1">Company / Firm</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs text-content-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold rounded-xl"
              >
                Save Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
