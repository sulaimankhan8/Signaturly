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
      a: "Yes. Documents executed via Signaturly Pro comply with Section 10A of the Indian Information Technology Act 2000, the US ESIGN Act (15 U.S.C. § 7001), and EU eIDAS regulations. Every transaction includes a cryptographic SHA-256 audit certificate.",
    },
    {
      q: "What is the difference between a full signature and initials?",
      a: "Signaturly Pro provides dedicated studios for both. Full signatures feature our Verified E-Sign Stamp with security hash IDs, cursive handwriting, and drawing pads. Initials support monogram circle seals and compact stamps for margin signing.",
    },
    {
      q: "Can I send contracts to multiple signers in a specific order?",
      a: "Yes! You can configure multi-party signing with individual color codes and strict sequential signing orders (e.g. Employee signs first, then HR Manager approves).",
    },
    {
      q: "How does Bulk Sending work?",
      a: "Simply choose any prebuilt or custom template, upload a CSV spreadsheet with recipient names and emails, and Signaturly Pro automatically generates customized contracts and dispatches private signing links in one click.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 selection:bg-red-600 selection:text-white font-sans antialiased">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#08090d]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-500/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Signaturly<span className="text-red-500">Pro</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                Enterprise
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#compliance" className="hover:text-white transition-colors">Legal Compliance</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-950/50 transition-all hover:scale-105"
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-950/50 transition-all hover:scale-105 border border-red-500/30"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-red-600/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-purple-600/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161822] border border-red-500/30 text-xs text-red-300 font-semibold shadow-inner">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Compliant with India IT Act 2000 & US ESIGN</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            The Modern E-Signature Platform for <span className="bg-gradient-to-r from-red-400 via-rose-500 to-red-600 bg-clip-text text-transparent">Fast-Moving Teams</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Create, send, and legally execute agreements in seconds. Complete with reusable contract templates, automated signer reminders, CSV bulk dispatching, and cryptographic SHA-256 audit trails.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-2xl shadow-xl shadow-red-950/60 transition-all hover:scale-105 border border-red-500/30 text-sm flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              to="/templates"
              className="w-full sm:w-auto px-8 py-4 bg-[#12141c] hover:bg-white/10 text-gray-200 font-semibold rounded-2xl transition border border-white/10 text-sm flex items-center justify-center gap-2"
            >
              <span>Explore Prebuilt Templates</span>
              <span className="text-red-400">⚡</span>
            </Link>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-bold">✓</span> No credit card required</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-bold">✓</span> 5 Free prebuilt legal contracts</span>
            <span className="flex items-center gap-1.5"><span className="text-emerald-400 font-bold">✓</span> Tamper-evident audit certificates</span>
          </div>

          {/* Interactive Document Preview Mockup */}
          <div className="mt-14 relative max-w-4xl mx-auto rounded-3xl p-3 bg-gradient-to-b from-white/15 to-white/5 border border-white/10 shadow-2xl">
            <div className="bg-[#0e1017] rounded-2xl overflow-hidden border border-white/10 p-6 sm:p-8 text-left space-y-6">
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs text-gray-400 font-mono ml-2">MUTUAL_NON_DISCLOSURE_AGREEMENT.pdf</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Legally Executed
                </span>
              </div>

              {/* Sample Document Content */}
              <div className="space-y-3 font-serif text-gray-300 text-xs sm:text-sm leading-relaxed max-w-3xl opacity-90">
                <p className="font-sans font-bold text-white uppercase tracking-wider text-xs">Section 10A Statutory Execution Block</p>
                <p>
                  "IN WITNESS WHEREOF, the Disclosing Party and Receiving Party have electronically executed this Agreement as of the date sealed below pursuant to Section 10A of the Indian Information Technology Act 2000 and the Electronic Signatures in Global and National Commerce Act (ESIGN)."
                </p>
              </div>

              {/* Verified Stamp & Monogram Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-800/80">
                {/* Party 1: Verified E-Sign Stamp */}
                <div className="p-4 rounded-xl bg-[#08090d] border border-red-500/30 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-600/10 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xl">
                    ★
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Alex Morgan</div>
                    <div className="text-[10px] text-red-400 font-mono">ID: SEC-8F392B • Verified E-Sign</div>
                    <div className="text-[10px] text-gray-500">2026-08-17 22:45:00 UTC</div>
                  </div>
                </div>

                {/* Party 2: Initials Monogram Seal */}
                <div className="p-4 rounded-xl bg-[#08090d] border border-purple-500/30 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-600/10 text-purple-400 border-2 border-dashed border-purple-500/40 flex items-center justify-center font-serif font-black text-sm">
                    SK
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Suleman Khan</div>
                    <div className="text-[10px] text-purple-400 font-mono">Monogram Seal • Initials Verified</div>
                    <div className="text-[10px] text-gray-500">2026-08-17 22:46:12 UTC</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-[#0a0c12]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
              Comprehensive Feature Set
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Everything You Need to Scale Document Operations
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Built for speed, security, and statutory compliance across enterprise hiring, sales, and legal workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                ✍️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Verified E-Sign & Initials Studios</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Generate tamper-evident digital badges with security hash IDs, cursive typography, native drawing pads, and monogram circle seals.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                📑
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Reusable Templates & Fast Fill</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Save standard agreements with pre-anchored roles. Use our 1-click "Fill My Details" button to send contracts in 10 seconds.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white mb-2">CSV Bulk Sending</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Import spreadsheets with recipient lists to batch-generate and dispatch personalized, legally binding documents to hundreds of signers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                ⏰
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automated Reminders & Expiration</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Background cron engine automatically nudges pending signers via email and handles document expiration deadlines without manual intervention.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                🛡️
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Cryptographic Audit Certificates</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Download standalone PDF audit certificates detailing original and executed SHA-256 checksums, signer IPs, and timestamped event logs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-[#12141c] border border-white/10 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                👥
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Multi-Party Sequential Signing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Designate distinct color-coded roles with sequential signing orders so approvals route strictly from employee to executive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#08090d]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Intuitive 3-Step Flow
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              From Draft to Legally Executed in Seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-[#12141c] border border-white/10 relative">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white font-black flex items-center justify-center text-lg mb-6 shadow-lg shadow-red-900/40">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Upload or Pick Template</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Upload any PDF contract or choose from our prebuilt legal contract library (NDAs, Offers, Leases, Independent Contractor Agreements).
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#12141c] border border-white/10 relative">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center text-lg mb-6 shadow-lg shadow-purple-900/40">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Assign Roles & Drop Fields</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Drag-and-drop Signature, Initials, Date, and Text fields mapped to specific signers with automatic color-coding.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-[#12141c] border border-white/10 relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg mb-6 shadow-lg shadow-emerald-900/40">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Signed & Cryptographically Sealed</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Recipients receive instant mobile-friendly signing links. Upon execution, all parties receive the finalized PDF and audit certificate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Legal & Compliance Banner */}
      <section id="compliance" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-red-950/40 via-[#12141c] to-purple-950/40 border-y border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-4 max-w-xl">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              Legal & Statutory Authority
            </span>
            <h2 className="text-3xl font-extrabold text-white">Full Global Legal Enforceability</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every document signed on Signaturly Pro satisfies electronic contract formation rules worldwide with strict non-repudiation safeguards:
            </p>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <strong>India IT Act 2000 Section 10A</strong> (Validity of contracts formed through electronic means).
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <strong>US ESIGN Act (15 U.S.C. § 7001)</strong> & Uniform Electronic Transactions Act (UETA).
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <strong>EU eIDAS Regulation (No 910/2014)</strong> for electronic signature validity.
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="p-4 rounded-xl bg-[#08090d] border border-white/10 text-center">
              <div className="text-2xl mb-1 font-bold text-red-400">256-bit</div>
              <div className="text-xs text-gray-400">SHA-256 Document Fingerprints</div>
            </div>
            <div className="p-4 rounded-xl bg-[#08090d] border border-white/10 text-center">
              <div className="text-2xl mb-1 font-bold text-emerald-400">100%</div>
              <div className="text-xs text-gray-400">Court-Admissible Audit Trail</div>
            </div>
            <div className="p-4 rounded-xl bg-[#08090d] border border-white/10 text-center">
              <div className="text-2xl mb-1 font-bold text-purple-400">0s</div>
              <div className="text-xs text-gray-400">Instant PDF Rendering Engine</div>
            </div>
            <div className="p-4 rounded-xl bg-[#08090d] border border-white/10 text-center">
              <div className="text-2xl mb-1 font-bold text-blue-400">SSL</div>
              <div className="text-xs text-gray-400">End-to-End Vault Encryption</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#08090d]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
              Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Simple Plans for Every Stage
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Start signing for free or scale your organization with Pro features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="p-8 rounded-3xl bg-[#12141c] border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Starter</h3>
                <p className="text-xs text-gray-400 mt-1">For freelancers & individuals</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-gray-400"> / forever</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-center gap-2">✓ 3 Signature requests per month</li>
                  <li className="flex items-center gap-2">✓ 5 Prebuilt legal templates</li>
                  <li className="flex items-center gap-2">✓ Standard signature pad</li>
                  <li className="flex items-center gap-2">✓ Basic email audit logs</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition"
              >
                Sign Up Free
              </Link>
            </div>

            {/* Pro Plan (Highlighted) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-[#1a1d28] to-[#12141c] border-2 border-red-500/50 flex flex-col justify-between shadow-2xl relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-red-800 text-white text-[10px] font-extrabold uppercase tracking-wider border border-red-400/40">
                Most Popular
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Professional</h3>
                <p className="text-xs text-gray-400 mt-1">For growing teams & businesses</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-white">$12</span>
                  <span className="text-xs text-gray-400"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-center gap-2 text-red-300 font-semibold">✓ Unlimited document signatures</li>
                  <li className="flex items-center gap-2">✓ Unlimited custom reusable templates</li>
                  <li className="flex items-center gap-2">✓ CSV Bulk Sending engine</li>
                  <li className="flex items-center gap-2">✓ Verified E-Sign Badge & Initials Studio</li>
                  <li className="flex items-center gap-2">✓ Automated signer reminders & expiration</li>
                  <li className="flex items-center gap-2">✓ Cryptographic PDF Audit Certificates</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-950/60 transition-all hover:scale-105"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="p-8 rounded-3xl bg-[#12141c] border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise</h3>
                <p className="text-xs text-gray-400 mt-1">For high-volume operations</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-white">$39</span>
                  <span className="text-xs text-gray-400"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-center gap-2">✓ Everything in Pro</li>
                  <li className="flex items-center gap-2">✓ Custom email branding & white-label</li>
                  <li className="flex items-center gap-2">✓ High-volume batch API access</li>
                  <li className="flex items-center gap-2">✓ Dedicated account manager & SLA</li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0a0c12] border-t border-white/5">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-xs sm:text-sm">Everything you need to know about Signaturly Pro.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[#12141c] border border-white/10 cursor-pointer transition"
                onClick={() => toggleFaq(i)}
              >
                <div className="flex items-center justify-between font-bold text-white text-sm">
                  <span>{faq.q}</span>
                  <span className="text-red-400 text-lg ml-4">{activeFaq === i ? "−" : "+"}</span>
                </div>
                {activeFaq === i && (
                  <p className="text-xs text-gray-400 mt-3 leading-relaxed border-t border-gray-800 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-[#08090d] text-gray-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Signaturly<span className="text-red-500">Pro</span></span>
            <span>— The Enterprise E-Signature Standard.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#compliance" className="hover:text-gray-300 transition">IT Act Compliance</a>
            <a href="#pricing" className="hover:text-gray-300 transition">Pricing</a>
            <Link to="/login" className="hover:text-gray-300 transition">Sign In</Link>
            <Link to="/register" className="hover:text-gray-300 transition">Register</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 text-center text-gray-600 text-[11px]">
          © {new Date().getFullYear()} Signaturly Pro. All rights reserved. Compliant with IT Act 2000 Section 10A, US ESIGN, and EU eIDAS.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
