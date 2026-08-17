import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function FontTestLab() {
  // Scenario 1: Headline Font
  const [headlineFont, setHeadlineFont] = useState("Outfit");
  // Scenario 2: UI & Controls Font
  const [uiFont, setUiFont] = useState("Plus Jakarta Sans");
  // Scenario 3: Legal & Contract Clause Font
  const [legalFont, setLegalFont] = useState("Lora");
  // Scenario 4: Cryptographic Mono Font
  const [monoFont, setMonoFont] = useState("JetBrains Mono");
  // Scenario 5: Signature Font
  const [sigFont, setSigFont] = useState("Great Vibes");

  const headlineOptions = [
    { name: "Outfit", style: "'Outfit', sans-serif", desc: "Geometric, modern, bold brutalist energy" },
    { name: "Space Grotesk", style: "'Space Grotesk', sans-serif", desc: "Tech-forward, sharp monospace roots" },
    { name: "Syne", style: "'Syne', sans-serif", desc: "Ultra distinctive, high fashion & avant-garde" },
    { name: "Archivo Black", style: "'Archivo Black', sans-serif", desc: "Heavy industrial poster headline impact" },
  ];

  const uiOptions = [
    { name: "Plus Jakarta Sans", style: "'Plus Jakarta Sans', sans-serif", desc: "Clean modern SaaS UI default" },
    { name: "Inter", style: "'Inter', sans-serif", desc: "Gold standard micro-legibility at small sizes" },
    { name: "DM Sans", style: "'DM Sans', sans-serif", desc: "Authoritative geometric balance" },
  ];

  const legalOptions = [
    { name: "Lora", style: "'Lora', serif", desc: "Contemporary editorial serif with formal authority" },
    { name: "Cormorant Garamond", style: "'Cormorant Garamond', serif", desc: "High-end legal covenant & traditional paper gravitas" },
    { name: "Newsreader", style: "'Newsreader', serif", desc: "Executive statutory clause & judiciary style" },
  ];

  const monoOptions = [
    { name: "JetBrains Mono", style: "'JetBrains Mono', monospace", desc: "Premier developer/security font with clear zero/one distinction" },
    { name: "Space Mono", style: "'Space Mono', monospace", desc: "Retro-brutalist mechanical typewriter character" },
    { name: "Fira Code", style: "'Fira Code', monospace", desc: "Dense tabular numbers & cryptographic checksum alignment" },
  ];

  const sigOptions = [
    { name: "Great Vibes", style: "'Great Vibes', cursive", desc: "Flowing executive cursive signature" },
    { name: "Dancing Script", style: "'Dancing Script', cursive", desc: "Casual fluid penmanship with natural rhythm" },
    { name: "Caveat", style: "'Caveat', cursive", desc: "Authentic ballpoint / felt marker signature" },
    { name: "Alex Brush", style: "'Alex Brush', cursive", desc: "Refined calligraphy quill signature" },
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-100 p-4 sm:p-8 font-sans selection:bg-yellow-400 selection:text-black">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Lab Header */}
        <div className="border-b-2 border-white/20 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-yellow-400 text-black text-[10px] font-black uppercase tracking-wider border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444]">
                Private Font Lab (/test)
              </span>
              <span className="text-xs text-gray-400 font-mono">Isolated Testing Suite</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Typography Showcase & Scenario Lab
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Test and compare suggested typography pairings across real application scenarios in real-time.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="self-start md:self-auto px-4 py-2 bg-[#151722] hover:bg-[#1f2233] text-gray-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] transition"
          >
            ← Exit Lab to Dashboard
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* SCENARIO 1: Brand & Hero Display Headlines */}
        {/* ========================================================================= */}
        <section className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Scenario 1</span>
              <h2 className="text-xl font-black text-white uppercase">Brand & Hero Headlines</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {headlineOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setHeadlineFont(opt.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    headlineFont === opt.name
                      ? "bg-red-600 text-white shadow-[2px_2px_0px_0px_#facc15]"
                      : "bg-[#090a0f] text-gray-400 hover:text-white shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active Font Description */}
          <div className="text-xs text-gray-400 font-mono">
            Active Headline Font: <strong className="text-yellow-400">{headlineFont}</strong> —{" "}
            {headlineOptions.find((o) => o.name === headlineFont)?.desc}
          </div>

          {/* Live Preview Box */}
          <div className="p-8 rounded-2xl bg-[#090a0f] border-2 border-white/20 text-center space-y-4">
            <h3
              style={{ fontFamily: headlineOptions.find((o) => o.name === headlineFont)?.style }}
              className="text-3xl sm:text-5xl lg:text-6xl font-black text-white uppercase tracking-tight leading-tight"
            >
              Sign Agreements <span className="bg-red-600 text-white px-3 py-1 border-2 border-white inline-block shadow-[4px_4px_0px_0px_#facc15] rotate-1">10x Faster</span> with Full Legal Non-Repudiation.
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm max-w-xl mx-auto font-medium">
              Sample subhead for high-velocity contract sealing, verified stamps, and tamper-evident audit logs.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SCENARIO 2: UI Controls, Navigation & Dense Tables */}
        {/* ========================================================================= */}
        <section className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#3b82f6] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Scenario 2</span>
              <h2 className="text-xl font-black text-white uppercase">UI Controls, Navigation & Tables</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {uiOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setUiFont(opt.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    uiFont === opt.name
                      ? "bg-blue-600 text-white shadow-[2px_2px_0px_0px_#facc15]"
                      : "bg-[#090a0f] text-gray-400 hover:text-white shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400 font-mono">
            Active UI Font: <strong className="text-blue-400">{uiFont}</strong> —{" "}
            {uiOptions.find((o) => o.name === uiFont)?.desc}
          </div>

          {/* Live UI Controls & Card Preview */}
          <div
            style={{ fontFamily: uiOptions.find((o) => o.name === uiFont)?.style }}
            className="p-6 rounded-2xl bg-[#090a0f] border-2 border-white/20 space-y-6"
          >
            {/* Filter Tabs Preview */}
            <div className="flex bg-[#13151f] p-1.5 rounded-xl border-2 border-white/20 gap-1 max-w-lg">
              <button className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]">
                All Docs (14)
              </button>
              <button className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg text-gray-300 hover:text-white">
                In Progress (3)
              </button>
              <button className="px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg text-gray-300 hover:text-white">
                Signed & Sealed (11)
              </button>
            </div>

            {/* Document Card Row */}
            <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-4 flex items-center justify-between shadow-[3px_3px_0px_0px_#000]">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-red-600 text-white font-black text-xs border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000]">
                  PDF
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Mutual-Non-Disclosure-Agreement.pdf</h4>
                  <p className="text-[11px] text-gray-400">1 page • Aug 17, 2026 • 2 Signers assigned</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-emerald-500 text-black shadow-[2px_2px_0px_0px_#fff]">
                  ✓ Signed & Sealed
                </span>
                <button className="py-2 px-3 bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#facc15]">
                  Sign Document
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SCENARIO 3: Statutory Legal Contracts & Clause Viewers */}
        {/* ========================================================================= */}
        <section className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#facc15] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400">Scenario 3</span>
              <h2 className="text-xl font-black text-white uppercase">Legal Contracts & Statutory Clauses</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {legalOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setLegalFont(opt.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    legalFont === opt.name
                      ? "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#ef4444]"
                      : "bg-[#090a0f] text-gray-400 hover:text-white shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400 font-mono">
            Active Legal Serif Font: <strong className="text-yellow-400">{legalFont}</strong> —{" "}
            {legalOptions.find((o) => o.name === legalFont)?.desc}
          </div>

          {/* Legal Contract Preview Document */}
          <div className="p-8 rounded-2xl bg-[#090a0f] border-2 border-white/20 space-y-4">
            <div className="border-b-2 border-white/10 pb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-400 font-mono">
                NON-DISCLOSURE AND PROPRIETARY INFORMATION AGREEMENT
              </span>
              <span className="text-[10px] font-mono text-gray-500">EXHIBIT A • SEC 10A COMPLIANT</span>
            </div>

            <div
              style={{ fontFamily: legalOptions.find((o) => o.name === legalFont)?.style }}
              className="text-sm sm:text-base leading-relaxed text-gray-200 space-y-3"
            >
              <p>
                <strong>1. Recognition of Statutory Authority.</strong> This electronic agreement is validly executed under Section 10A of the Indian Information Technology Act 2000, the US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS Regulation (No 910/2014).
              </p>
              <p>
                <strong>2. Non-Repudiation Covenants.</strong> Each party hereto acknowledges that cryptographic hashing and IP logging generate an indisputable evidentiary audit trail admissible in a court of law.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SCENARIO 4: Cryptographic Hashes, SHA-256 Checksums & Audit Logs */}
        {/* ========================================================================= */}
        <section className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#22c55e] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Scenario 4</span>
              <h2 className="text-xl font-black text-white uppercase">Cryptographic Hashes & Audit Certificates</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {monoOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setMonoFont(opt.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    monoFont === opt.name
                      ? "bg-emerald-500 text-black shadow-[2px_2px_0px_0px_#fff]"
                      : "bg-[#090a0f] text-gray-400 hover:text-white shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400 font-mono">
            Active Monospace Font: <strong className="text-emerald-400">{monoFont}</strong> —{" "}
            {monoOptions.find((o) => o.name === monoFont)?.desc}
          </div>

          {/* Audit Trail Terminal View */}
          <div
            style={{ fontFamily: monoOptions.find((o) => o.name === monoFont)?.style }}
            className="p-6 rounded-2xl bg-[#07080c] border-2 border-emerald-500/40 text-xs space-y-3 shadow-inner"
          >
            <div className="flex items-center justify-between text-[11px] text-gray-400 border-b border-white/10 pb-2">
              <span>SHA-256 AUDIT LOG MANIFEST</span>
              <span className="text-emerald-400">STATUS: TAMPER_EVIDENT_VERIFIED</span>
            </div>
            <div className="space-y-1.5 text-gray-300">
              <div><span className="text-gray-500">ORIGINAL_HASH :</span> e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
              <div><span className="text-gray-500">FINAL_SIGNED  :</span> 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08</div>
              <div><span className="text-gray-500">TIMESTAMP     :</span> 2026-08-17T22:45:12.890Z [UTC]</div>
              <div><span className="text-gray-500">SIGNER_IP     :</span> 157.34.192.88 (TLS 1.3 Encrypted Handshake)</div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SCENARIO 5: Handwritten Signatures & Monogram Seals */}
        {/* ========================================================================= */}
        <section className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#a855f7] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Scenario 5</span>
              <h2 className="text-xl font-black text-white uppercase">E-Signature Stamps & Monograms</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {sigOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setSigFont(opt.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black ${
                    sigFont === opt.name
                      ? "bg-purple-600 text-white shadow-[2px_2px_0px_0px_#facc15]"
                      : "bg-[#090a0f] text-gray-400 hover:text-white shadow-[2px_2px_0px_0px_#000]"
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-400 font-mono">
            Active Signature Font: <strong className="text-purple-400">{sigFont}</strong> —{" "}
            {sigOptions.find((o) => o.name === sigFont)?.desc}
          </div>

          {/* Signature Stamps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Signature Stamp 1 */}
            <div className="p-6 rounded-2xl bg-[#090a0f] border-2 border-red-500 shadow-[4px_4px_0px_0px_#ef4444] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded border border-black">
                  Verified E-Sign Stamp
                </span>
                <span className="text-[10px] font-mono text-yellow-400">ID: SEC-9A82F1</span>
              </div>
              <div
                style={{ fontFamily: sigOptions.find((o) => o.name === sigFont)?.style }}
                className="text-4xl text-white py-2"
              >
                Suleman Khan
              </div>
              <div className="text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
                Digitally Executed • 2026-08-17 22:45:00 UTC
              </div>
            </div>

            {/* Initials Monogram 2 */}
            <div className="p-6 rounded-2xl bg-[#090a0f] border-2 border-purple-500 shadow-[4px_4px_0px_0px_#a855f7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded border border-black">
                  Monogram Initials Seal
                </span>
                <span className="text-[10px] font-mono text-purple-300">ID: INT-44D9C0</span>
              </div>
              <div className="flex items-center gap-4">
                <div
                  style={{ fontFamily: sigOptions.find((o) => o.name === sigFont)?.style }}
                  className="w-16 h-16 rounded-full bg-purple-600 text-white border-2 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]"
                >
                  SK
                </div>
                <div>
                  <div className="text-xs font-black text-white uppercase">Suleman Khan</div>
                  <div className="text-[11px] text-gray-400">Margin Approval Initials</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-gray-400 border-t border-white/10 pt-2">
                Digitally Initialed • 2026-08-17 22:46:12 UTC
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
