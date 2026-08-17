import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "Are electronic signatures generated with Signaturly Pro legally binding?",
      a: "Yes! Signaturly Pro complies with Section 10A of the Indian Information Technology Act 2000, the US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS statutory regulations. Every executed agreement comes with a court-admissible cryptographic SHA-256 audit certificate.",
    },
    {
      q: "What is the difference between a full signature and initials?",
      a: "Signaturly Pro provides dedicated studios for both. Full signatures generate our Verified E-Sign Stamp with unique security hash IDs, cursive typography, and drawing pads. Initials support monogram circle seals and compact stamps designed for document margin approval.",
    },
    {
      q: "Can I send contracts to multiple signers in a specific order?",
      a: "Yes! You can configure multi-party signing with individual color codes and strict sequential signing orders (e.g. Employee signs first, then HR Manager approves).",
    },
    {
      q: "How does Bulk Sending work?",
      a: "Simply pick any prebuilt or custom template, upload a CSV spreadsheet with recipient names and emails, and Signaturly Pro automatically generates customized contracts and dispatches private signing links in one batch.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-gray-100 selection:bg-yellow-400 selection:text-black font-sans antialiased">
      {/* Neo-Brutalist Top Ticker Bar */}
      <div className="bg-yellow-400 text-black border-b-2 border-black py-1.5 px-4 overflow-hidden font-mono font-black text-xs uppercase tracking-wider flex items-center justify-between">
        <div className="flex items-center gap-4 animate-pulse">
          <span>⚡ INDIA IT ACT 2000 SECTION 10A COMPLIANT</span>
          <span>•</span>
          <span>🔒 256-BIT SHA-256 CHECKSUMS</span>
          <span>•</span>
          <span>✍️ VERIFIED E-SIGN BADGES</span>
          <span>•</span>
          <span>🚀 BULK CSV DISPATCH ACTIVE</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-red-600 border border-black rounded-full" />
          <span className="text-[10px] font-bold">SYSTEM OPERATIONAL</span>
        </div>
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090a0f]/90 border-b-2 border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-600 border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#ffffff] transform -rotate-2 hover:rotate-0 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white">
                  Signatur<span className="text-red-500">ly</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_#ef4444] rounded">
                  PRO
                </span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-black uppercase tracking-wider text-gray-300">
            <a href="#features" className="hover:text-yellow-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-yellow-400 transition-colors">Workflow</a>
            <a href="#compliance" className="hover:text-yellow-400 transition-colors">Compliance</a>
            <a href="#pricing" className="hover:text-yellow-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-yellow-400 transition-colors">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs border-2 border-black shadow-[3px_3px_0px_0px_#ffffff] hover:shadow-[5px_5px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                Open Dashboard →
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider rounded-xl text-xs border-2 border-black shadow-[3px_3px_0px_0px_#ef4444] hover:shadow-[5px_5px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Neo Brutalist Background Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          {/* Sticker Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#151722] border-2 border-yellow-400 text-xs font-black text-yellow-300 shadow-[3px_3px_0px_0px_#ef4444] transform -rotate-1">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span>ENTERPRISE GRADE E-SIGNATURE SYSTEM</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08] uppercase">
            Sign Agreements <span className="bg-red-600 text-white px-3 py-1 border-2 border-white inline-block shadow-[4px_4px_0px_0px_#facc15] rotate-1">10x Faster</span> with Full Legal Non-Repudiation.
          </h1>

          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            Create, send, and seal contracts in seconds. Equipped with reusable contract templates, automated signer reminders, CSV bulk sending, and cryptographic SHA-256 tamper-evident certificates.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider rounded-2xl border-2 border-black shadow-[5px_5px_0px_0px_#facc15] hover:shadow-[7px_7px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>Start Free (No Credit Card)</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              to="/templates"
              className="w-full sm:w-auto px-8 py-4 bg-[#151722] hover:bg-[#1f2233] text-white font-black uppercase tracking-wider rounded-2xl border-2 border-white/30 shadow-[4px_4px_0px_0px_#ef4444] hover:shadow-[6px_6px_0px_0px_#ef4444] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>Explore Prebuilt Templates</span>
              <span className="text-yellow-400">⚡</span>
            </Link>
          </div>

          {/* Sticker Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-black">
            <span className="px-3 py-1 bg-[#151722] border-2 border-emerald-500 text-emerald-400 rounded-lg shadow-[2px_2px_0px_0px_#000]">
              ✓ FREE FOREVER TIER
            </span>
            <span className="px-3 py-1 bg-[#151722] border-2 border-purple-500 text-purple-400 rounded-lg shadow-[2px_2px_0px_0px_#000]">
              ★ 5 PREBUILT CONTRACTS
            </span>
            <span className="px-3 py-1 bg-[#151722] border-2 border-yellow-500 text-yellow-400 rounded-lg shadow-[2px_2px_0px_0px_#000]">
              🔒 SHA-256 AUDIT CERTIFICATES
            </span>
          </div>

          {/* Interactive Document Preview Mockup */}
          <div className="mt-14 relative max-w-4xl mx-auto rounded-3xl p-3 bg-[#151722] border-2 border-white/30 shadow-[8px_8px_0px_0px_#ef4444]">
            <div className="bg-[#0b0c10] rounded-2xl overflow-hidden border-2 border-white/20 p-6 sm:p-8 text-left space-y-6">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500 border border-black" />
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 border border-black" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-black" />
                  <span className="text-xs text-yellow-400 font-mono font-bold ml-2">MUTUAL_NON_DISCLOSURE_AGREEMENT.pdf</span>
                </div>
                <span className="px-3 py-1 rounded bg-emerald-500 text-black font-black uppercase text-[10px] border-2 border-black shadow-[2px_2px_0px_0px_#fff]">
                  ● EXECUTED & SEALED
                </span>
              </div>

              {/* Sample Document Content */}
              <div className="space-y-3 text-gray-300 text-xs sm:text-sm leading-relaxed border-l-4 border-yellow-400 pl-4 py-1">
                <p className="font-mono font-black text-white uppercase tracking-wider text-xs">Section 10A IT Act 2000 Statutory Execution Block</p>
                <p className="font-serif opacity-90">
                  "IN WITNESS WHEREOF, the Disclosing Party and Receiving Party have electronically executed this Agreement pursuant to Section 10A of the Indian Information Technology Act 2000 and the US ESIGN Act (15 U.S.C. § 7001)."
                </p>
              </div>

              {/* Brutalist Stamp & Monogram Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t-2 border-white/10">
                {/* Party 1: Verified E-Sign Stamp */}
                <div className="p-4 rounded-xl bg-[#151722] border-2 border-red-500 shadow-[4px_4px_0px_0px_#ef4444] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-600 text-white border-2 border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#000]">
                    ★
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">Alex Morgan (CTO)</div>
                    <div className="text-[10px] text-yellow-400 font-mono font-bold">ID: SEC-8F392B • Verified Stamp</div>
                    <div className="text-[10px] text-gray-400 font-mono">2026-08-17 22:45:00 UTC</div>
                  </div>
                </div>

                {/* Party 2: Initials Monogram Seal */}
                <div className="p-4 rounded-xl bg-[#151722] border-2 border-purple-500 shadow-[4px_4px_0px_0px_#a855f7] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-600 text-white border-2 border-black flex items-center justify-center font-serif font-black text-base shadow-[2px_2px_0px_0px_#000]">
                    SK
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">Suleman Khan</div>
                    <div className="text-[10px] text-purple-300 font-mono font-bold">Monogram Seal • Initialed</div>
                    <div className="text-[10px] text-gray-400 font-mono">2026-08-17 22:46:12 UTC</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-t-2 border-white/20 bg-[#0d0f17]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3.5 py-1.5 rounded bg-red-600 text-white font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0px_0px_#facc15]">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              Engineered for High-Velocity Execution
            </h2>
            <p className="text-gray-400 text-sm sm:text-base font-medium">
              Every workflow you need to eliminate friction in legal, sales, and employee onboarding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#ef4444] hover:shadow-[7px_7px_0px_0px_#ef4444] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                ✍️
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">Verified E-Sign & Initials</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Tamper-evident badges with SHA security hash IDs, cursive fonts, drawing pads, and monogram circle seals.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#a855f7] hover:shadow-[7px_7px_0px_0px_#a855f7] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-600 text-white border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                📑
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">Reusable Templates & Fast Fill</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Store standard contracts with pre-anchored roles. Use the 1-click "Fill My Details" button to send agreements in 10s.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#22c55e] hover:shadow-[7px_7px_0px_0px_#22c55e] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                ⚡
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">CSV Bulk Sending</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Import spreadsheets with recipient lists to batch-generate and dispatch personalized contracts to hundreds of signers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#facc15] hover:shadow-[7px_7px_0px_0px_#facc15] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-yellow-400 text-black border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                ⏰
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">Automated Reminders</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Background cron engine automatically nudges pending signers via email and handles document expiration deadlines.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#3b82f6] hover:shadow-[7px_7px_0px_0px_#3b82f6] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                🛡️
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">Audit Certificates</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Download standalone PDF audit certificates detailing original and signed SHA-256 checksums, signer IPs, and event logs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[5px_5px_0px_0px_#f43f5e] hover:shadow-[7px_7px_0px_0px_#f43f5e] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white border-2 border-black flex items-center justify-center text-xl mb-4 font-black shadow-[2px_2px_0px_0px_#000]">
                👥
              </div>
              <h3 className="text-lg font-black text-white mb-2 uppercase">Sequential Workflows</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Designate distinct color-coded roles with sequential signing orders so approvals route strictly from employee to executive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#090a0f] border-t-2 border-white/20">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3.5 py-1.5 rounded bg-purple-600 text-white font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0px_0px_#fff]">
              Simple 3-Step Flow
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              Draft To Signed In Under 60 Seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#ef4444] relative">
              <div className="w-10 h-10 rounded-lg bg-red-600 text-white font-black border-2 border-black flex items-center justify-center text-lg mb-6 shadow-[2px_2px_0px_0px_#000]">
                1
              </div>
              <h3 className="text-xl font-black text-white mb-2 uppercase">Upload or Pick Template</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Upload any PDF contract or select from our prebuilt legal contract library (NDAs, Offers, Leases, Independent Contractor Agreements).
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#a855f7] relative">
              <div className="w-10 h-10 rounded-lg bg-purple-600 text-white font-black border-2 border-black flex items-center justify-center text-lg mb-6 shadow-[2px_2px_0px_0px_#000]">
                2
              </div>
              <h3 className="text-xl font-black text-white mb-2 uppercase">Assign Roles & Drop Fields</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Drag-and-drop Signature, Initials, Date, and Text fields mapped to specific signers with automatic color-coding.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#22c55e] relative">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white font-black border-2 border-black flex items-center justify-center text-lg mb-6 shadow-[2px_2px_0px_0px_#000]">
                3
              </div>
              <h3 className="text-xl font-black text-white mb-2 uppercase">Signed & Sealed</h3>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                Recipients receive instant mobile-friendly signing links. Upon execution, all parties receive the finalized PDF and audit certificate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Statutory Compliance Banner */}
      <section id="compliance" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#151722] border-y-2 border-white/20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-4 max-w-xl">
            <span className="px-3 py-1 rounded bg-yellow-400 text-black font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_#fff]">
              Statutory Authority
            </span>
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Worldwide Legal Non-Repudiation</h2>
            <p className="text-gray-300 text-sm leading-relaxed font-medium">
              Every document signed on Signaturly Pro satisfies electronic contract formation rules with cryptographic integrity safeguards:
            </p>
            <ul className="space-y-2.5 text-xs text-gray-200 font-bold">
              <li className="flex items-center gap-2">
                <span className="text-yellow-400 text-sm">▶</span>
                <strong>Section 10A India Information Technology Act 2000</strong> (Validity of contracts formed through electronic means).
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400 text-sm">▶</span>
                <strong>US ESIGN Act (15 U.S.C. § 7001)</strong> & Uniform Electronic Transactions Act (UETA).
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400 text-sm">▶</span>
                <strong>EU eIDAS Regulation (No 910/2014)</strong> for electronic signature validity.
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="p-5 rounded-2xl bg-[#090a0f] border-2 border-white/20 shadow-[4px_4px_0px_0px_#ef4444] text-center">
              <div className="text-3xl font-black text-red-500 font-mono">256-bit</div>
              <div className="text-xs font-bold text-gray-300 mt-1 uppercase">SHA-256 Hashes</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#090a0f] border-2 border-white/20 shadow-[4px_4px_0px_0px_#22c55e] text-center">
              <div className="text-3xl font-black text-emerald-400 font-mono">100%</div>
              <div className="text-xs font-bold text-gray-300 mt-1 uppercase">Court Admissible</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#090a0f] border-2 border-white/20 shadow-[4px_4px_0px_0px_#facc15] text-center">
              <div className="text-3xl font-black text-yellow-400 font-mono">0.1s</div>
              <div className="text-xs font-bold text-gray-300 mt-1 uppercase">PDF Engine</div>
            </div>
            <div className="p-5 rounded-2xl bg-[#090a0f] border-2 border-white/20 shadow-[4px_4px_0px_0px_#3b82f6] text-center">
              <div className="text-3xl font-black text-blue-400 font-mono">TLS</div>
              <div className="text-xs font-bold text-gray-300 mt-1 uppercase">Encrypted Vault</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#090a0f]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3.5 py-1.5 rounded bg-yellow-400 text-black font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0px_0px_#ef4444]">
              Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
              Pick Your Power Tier
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Starter Plan */}
            <div className="p-8 rounded-3xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#fff] flex flex-col justify-between">
              <div>
                <span className="px-2.5 py-1 bg-white/10 text-gray-300 text-[10px] font-black uppercase tracking-wider rounded border border-white/20">
                  Individual
                </span>
                <h3 className="text-2xl font-black text-white mt-3 uppercase">Starter</h3>
                <div className="my-6">
                  <span className="text-5xl font-black text-white font-mono">$0</span>
                  <span className="text-xs text-gray-400 font-bold"> / forever</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-300 font-bold">
                  <li className="flex items-center gap-2">✓ 3 Signature requests per month</li>
                  <li className="flex items-center gap-2">✓ 5 Prebuilt legal templates</li>
                  <li className="flex items-center gap-2">✓ Verified signature pad</li>
                  <li className="flex items-center gap-2">✓ Basic audit logs</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-3.5 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-white/30 transition"
              >
                Sign Up Free
              </Link>
            </div>

            {/* Pro Plan (Highlighted Neo-Brutalist) */}
            <div className="p-8 rounded-3xl bg-[#191c2b] border-4 border-yellow-400 shadow-[8px_8px_0px_0px_#ef4444] flex flex-col justify-between relative transform -translate-y-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded bg-red-600 text-white text-[11px] font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#fff]">
                ★ MOST POPULAR
              </div>
              <div>
                <span className="px-2.5 py-1 bg-yellow-400/20 text-yellow-300 text-[10px] font-black uppercase tracking-wider rounded border border-yellow-400/40">
                  Fast-Growing Teams
                </span>
                <h3 className="text-2xl font-black text-white mt-3 uppercase">Professional</h3>
                <div className="my-6">
                  <span className="text-5xl font-black text-white font-mono">$12</span>
                  <span className="text-xs text-gray-400 font-bold"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-200 font-bold">
                  <li className="flex items-center gap-2 text-yellow-400">✓ Unlimited document signatures</li>
                  <li className="flex items-center gap-2">✓ Unlimited custom reusable templates</li>
                  <li className="flex items-center gap-2">✓ CSV Bulk Sending engine</li>
                  <li className="flex items-center gap-2">✓ Verified E-Sign Badge & Monogram Initials</li>
                  <li className="flex items-center gap-2">✓ Automated signer reminders & expiration</li>
                  <li className="flex items-center gap-2">✓ Standalone Cryptographic PDF Certificates</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider rounded-xl text-xs border-2 border-black shadow-[4px_4px_0px_0px_#ef4444] hover:shadow-[6px_6px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              >
                Start Free Trial →
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="p-8 rounded-3xl bg-[#151722] border-2 border-white/20 shadow-[6px_6px_0px_0px_#fff] flex flex-col justify-between">
              <div>
                <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider rounded border border-purple-500/40">
                  High Volume
                </span>
                <h3 className="text-2xl font-black text-white mt-3 uppercase">Enterprise</h3>
                <div className="my-6">
                  <span className="text-5xl font-black text-white font-mono">$39</span>
                  <span className="text-xs text-gray-400 font-bold"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-300 font-bold">
                  <li className="flex items-center gap-2">✓ Everything in Professional</li>
                  <li className="flex items-center gap-2">✓ Custom email branding & white-label</li>
                  <li className="flex items-center gap-2">✓ High-volume batch API access</li>
                  <li className="flex items-center gap-2">✓ Dedicated account manager & SLA</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-3.5 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-wider rounded-xl text-xs border-2 border-white/30 transition"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0d0f17] border-t-2 border-white/20">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black text-white uppercase">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-xs sm:text-sm font-medium">Everything you need to know about Signaturly Pro.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#151722] border-2 border-white/20 shadow-[4px_4px_0px_0px_#ef4444] cursor-pointer transition"
                onClick={() => toggleFaq(i)}
              >
                <div className="flex items-center justify-between font-black text-white text-sm">
                  <span>{faq.q}</span>
                  <span className="text-yellow-400 text-xl font-mono ml-4">{activeFaq === i ? "−" : "+"}</span>
                </div>
                {activeFaq === i && (
                  <p className="text-xs text-gray-300 mt-4 leading-relaxed border-t-2 border-white/10 pt-4 font-medium">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t-2 border-white/20 bg-[#090a0f] text-gray-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-white text-sm font-black">Signatur<span className="text-red-500">ly</span>PRO</span>
            <span>— The Non-Repudiation E-Signature Standard.</span>
          </div>

          <div className="flex items-center gap-6 font-bold">
            <a href="#compliance" className="hover:text-yellow-400 transition">IT Act Compliance</a>
            <a href="#pricing" className="hover:text-yellow-400 transition">Pricing</a>
            <Link to="/login" className="hover:text-yellow-400 transition">Sign In</Link>
            <Link to="/register" className="hover:text-yellow-400 transition">Register</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 text-center text-gray-500 text-[11px] font-mono">
          © {new Date().getFullYear()} Signaturly Pro. Compliant with IT Act 2000 Section 10A, US ESIGN, and EU eIDAS.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
