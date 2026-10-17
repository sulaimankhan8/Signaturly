import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import PricingCards from "../components/PricingCards";
import BrandGlyph from "../components/BrandGlyph";
import { PRICING_FALLBACK } from "../config/pricingFallback";

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "Are electronic signatures generated with PactDoc legally binding?",
      a: "In India, electronic signatures on most commercial agreements are recognised under Section 10A of the Information Technology Act, 2000. Globally, they are fully admissible under the US ESIGN Act (15 U.S.C. § 7001) and EU eIDAS Regulation (No 910/2014). Every executed document comes with a sealed PDF, SHA-256 cryptographic hashes, and an audit trail certificate.",
    },
    {
      q: "What is the difference between a full signature and initials?",
      a: "A full signature is placed at the formal execution block: you can draw it, type it using authenticated cursive typography, or apply a cryptographic digital stamp with timestamp and IP verification. Initials are short page-level acknowledgment marks configured with distinct party monograms.",
    },
    {
      q: "Can I send contracts to multiple signers in a specific order?",
      a: "Yes. You can designate distinct color-coded participant roles (Primary Signer, Approver, Counterparty, Executive) and enforce sequential signing workflows so documents progress strictly down the chain of command.",
    },
    {
      q: "How does Bulk CSV Sending work?",
      a: "Select any prebuilt or customized legal template, upload a CSV spreadsheet containing recipient names and email addresses, and PactDoc automatically provisions customized contracts with private signing tokens dispatched in a single batch.",
    },
  ];

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary selection:bg-crimson-600 selection:text-white font-sans antialiased">
      {/* Signature Top Accent Stripe */}
      <div className="w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

      {/* Top Security & Compliance Ticker Bar */}
      <div className="bg-surface-elevated/90 border-b border-surface-border text-xs px-4 py-1.5 flex items-center justify-between text-content-muted font-mono min-h-[32px] backdrop-blur-md">
        <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap scrollbar-none text-[10px]">
          <span className="flex items-center gap-1 text-content-secondary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-crimson-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            IT ACT 2000 SECTION 10A COMPLIANT
          </span>
          <span className="text-surface-border">•</span>
          <span className="flex items-center gap-1 text-content-secondary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            256-BIT SHA-256 INTEGRITY CHECKSUMS
          </span>
          <span className="text-surface-border">•</span>
          <span className="flex items-center gap-1 text-content-secondary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-seal-gold"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            AUTHENTICATED E-SIGN SEALS
          </span>
          <span className="text-surface-border">•</span>
          <span className="flex items-center gap-1 text-content-secondary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            AUTOMATED REMINDERS
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 ml-4 text-[10px] text-content-muted font-mono font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>VAULT OPERATIONAL</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-surface-canvas/90 border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-crimson-600 to-crimson-700 rounded-xl flex items-center justify-center shadow-elevation-1 border border-crimson-500/30">
              <BrandGlyph className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-white">
                Pact<span className="text-crimson-500">Doc</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 rounded-md">
                PRO
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-content-secondary">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Workflow</a>
            <a href="#compliance" className="hover:text-white transition-colors">Compliance</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link to="/t" className="hover:text-white transition-colors">Templates</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="px-4 py-2 bg-crimson-600 hover:bg-crimson-500 text-white font-bold rounded-xl text-xs btn-shelf-yellow transition-all"
              >
                Open Dashboard →
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-wider rounded-xl text-xs shadow-[2px_2px_0px_#000000] hover:shadow-[3px_3px_0px_#ffffff] transition-all whitespace-nowrap border-2 border-black"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-10 pb-10 sm:pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle Precision Grid Backdrop */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
        
        {/* Ambient Crimson Glow behind hero */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[240px] bg-crimson-600/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4 sm:space-y-5">
          {/* Institutional Status Badge with neo-pop border */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card border-2 border-yellow-400/80 text-xs shadow-[2px_2px_0px_#facc15]">
            <span className="w-2 h-2 rounded-full bg-crimson-500 animate-pulse" />
            <span className="font-mono text-[10px] font-black tracking-wider text-yellow-300 uppercase">
              ENTERPRISE GRADE E-SIGNATURE SYSTEM
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-[1.12]">
            Sign Agreements <br className="hidden sm:inline" />
            <span className="stamp-badge-faster my-1.5 inline-block text-2xl sm:text-4xl md:text-5xl">
              10X FASTER
            </span>{" "}
            With <br className="hidden sm:inline" />
            Legal Non-Repudiation.
          </h1>

          <p className="text-content-secondary text-xs sm:text-sm max-w-xl mx-auto font-normal leading-relaxed">
            Create, send, and seal contracts in seconds. Equipped with reusable contract templates, automated signer reminders, CSV bulk dispatch, and cryptographic SHA-256 tamper-evident certificates.
          </p>

          {/* CTA Buttons with 3D tactile shelves */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-1">
            <Link
              to="/register"
              className="w-full sm:w-auto px-7 py-3 bg-crimson-600 hover:bg-crimson-500 text-white font-black uppercase tracking-wider rounded-xl btn-shelf-yellow text-xs flex items-center justify-center gap-2"
            >
              <span>Start Free (No Credit Card)</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <Link
              to="/templates"
              className="w-full sm:w-auto px-7 py-3 bg-surface-card hover:bg-surface-elevated text-content-primary font-black uppercase tracking-wider rounded-xl btn-shelf-crimson text-xs flex items-center justify-center gap-2"
            >
              <span>Explore Prebuilt Templates</span>
              <svg className="w-4 h-4 text-seal-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5 text-[10px] font-mono font-bold">
            <span className="px-2.5 py-1 bg-surface-card border-2 border-emerald-500/60 text-emerald-400 rounded-lg shadow-[2px_2px_0px_#22c55e] inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              FREE FOREVER TIER
            </span>
            <span className="px-2.5 py-1 bg-surface-card border-2 border-purple-500/60 text-purple-400 rounded-lg shadow-[2px_2px_0px_#a855f7] inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              5 PREBUILT CONTRACTS
            </span>
            <span className="px-2.5 py-1 bg-surface-card border-2 border-yellow-400/60 text-seal-gold rounded-lg shadow-[2px_2px_0px_#facc15] inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              SHA-256 AUDIT CERTIFICATES
            </span>
          </div>

          {/* Interactive Document Preview Mockup (Tightly contained with zero dead void) */}
          <div className="mt-5 relative max-w-3xl mx-auto rounded-2xl p-1 bg-surface-card border-2 border-surface-border shadow-[4px_4px_0px_#000000] contain-layout">
            <div className="bg-surface-canvas rounded-xl overflow-hidden border border-surface-border p-4 sm:p-5 text-left space-y-4">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-surface-border pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-crimson-600" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-content-secondary font-mono font-medium ml-1.5 truncate max-w-[200px] sm:max-w-none">MUTUAL_NON_DISCLOSURE_AGREEMENT.pdf</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold uppercase text-[10px] border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  EXECUTED &amp; SEALED
                </span>
              </div>

              {/* Sample Document Content */}
              <div className="space-y-1.5 text-content-muted text-xs leading-relaxed border-l-2 border-crimson-500 pl-3 py-0.5">
                <p className="font-mono font-semibold text-content-primary uppercase tracking-wider text-[11px]">Section 10A IT Act 2000 Statutory Execution Block</p>
                <p className="font-serif opacity-90 text-content-secondary text-xs">
                  "IN WITNESS WHEREOF, the Disclosing Party and Receiving Party have electronically executed this Agreement pursuant to Section 10A of the Indian Information Technology Act 2000 and the US ESIGN Act (15 U.S.C. § 7001)."
                </p>
              </div>

              {/* Signature & Monogram Stamp Preview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-surface-border">
                {/* Party 1: Verified E-Sign Stamp */}
                <div className="p-3 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-crimson-600/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center font-bold text-base shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wide">Alex Morgan (CTO)</div>
                    <div className="text-[10px] text-yellow-400 font-mono font-medium">ID: SEC-8F392B • Verified Stamp</div>
                    <div className="text-[9px] text-content-muted font-mono">2026-08-17 22:45:00 UTC</div>
                  </div>
                </div>

                {/* Party 2: Initials Monogram Seal */}
                <div className="p-3 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-600/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-serif font-black text-xs shrink-0">
                    SK
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wide">Suleman Khan</div>
                    <div className="text-[10px] text-purple-300 font-mono font-medium">Monogram Seal • Initialed</div>
                    <div className="text-[9px] text-content-muted font-mono">2026-08-17 22:46:12 UTC</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 border-t border-surface-border bg-surface-subtle">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-crimson-500/10 text-crimson-400 border border-crimson-500/25 font-mono text-[10px] font-bold uppercase tracking-wider">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Engineered for High-Velocity Execution
            </h2>
            <p className="text-content-muted text-xs sm:text-sm font-normal">
              Every workflow you need to eliminate friction in legal, sales, and employee onboarding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">Verified E-Sign &amp; Initials</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Tamper-evident badges with SHA security hash IDs, cursive fonts, drawing pads, and monogram circle seals.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">Reusable Templates &amp; Fast Fill</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Store standard contracts with pre-anchored roles. Use the 1-click "Fill My Details" button to send agreements in 10s.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">CSV Bulk Sending</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Import spreadsheets with recipient lists to batch-generate and dispatch personalized contracts to hundreds of signers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-seal-amber border border-amber-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">Automated Reminders</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Background cron engine automatically nudges pending signers via email and handles document expiration deadlines.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">Audit Certificates</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Download standalone PDF audit certificates detailing original and signed SHA-256 checksums, signer IPs, and event logs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover hover:bg-surface-elevated shadow-elevation-1 transition-all">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center text-lg mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-wide">Sequential Workflows</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Designate distinct color-coded roles with sequential signing orders so approvals route strictly from employee to executive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-surface-canvas border-t border-surface-border">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/25 font-mono text-[10px] font-bold uppercase tracking-wider">
              Simple 3-Step Flow
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Draft To Signed In Under 60 Seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-1 relative">
              <div className="w-9 h-9 rounded-xl bg-crimson-600/15 text-crimson-400 border border-crimson-500/30 flex items-center justify-center font-mono font-bold text-sm mb-4">
                01
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 uppercase tracking-wide">Upload or Pick Template</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Upload any PDF contract or select from our prebuilt legal contract library (NDAs, Offers, Leases, Independent Contractor Agreements).
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-1 relative">
              <div className="w-9 h-9 rounded-xl bg-purple-600/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-mono font-bold text-sm mb-4">
                02
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 uppercase tracking-wide">Assign Roles &amp; Drop Fields</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Drag-and-drop Signature, Initials, Date, and Text fields mapped to specific signers with automatic color-coding.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-1 relative">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-base font-bold text-white mb-1.5 uppercase tracking-wide">Signed &amp; Sealed</h3>
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                Recipients receive instant mobile-friendly signing links. Upon execution, all parties receive the finalized PDF and audit certificate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Statutory Compliance Banner */}
      <section id="compliance" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-y border-surface-border">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <span className="px-3 py-1 rounded-full bg-seal-amber/10 text-seal-amber border border-seal-amber/25 font-mono text-[10px] font-bold uppercase tracking-wider">
              Statutory Authority
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Worldwide Legal Non-Repudiation</h2>
            <p className="text-content-secondary text-xs sm:text-sm leading-relaxed font-normal">
              Every document signed on PactDoc satisfies electronic contract formation rules with cryptographic integrity safeguards:
            </p>
            <ul className="space-y-2 text-xs text-content-secondary">
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-seal-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span><strong className="text-white">Section 10A India Information Technology Act 2000</strong> (Validity of contracts formed through electronic means).</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-seal-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span><strong className="text-white">US ESIGN Act (15 U.S.C. § 7001)</strong> &amp; Uniform Electronic Transactions Act (UETA).</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-seal-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span><strong className="text-white">EU eIDAS Regulation (No 910/2014)</strong> for electronic signature validity.</span>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 text-center">
              <div className="text-2xl font-black text-crimson-500 font-mono">256-bit</div>
              <div className="text-[10px] font-bold text-content-muted mt-0.5 uppercase">SHA-256 Hashes</div>
            </div>
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 text-center">
              <div className="text-2xl font-black text-emerald-400 font-mono">100%</div>
              <div className="text-[10px] font-bold text-content-muted mt-0.5 uppercase">Court Admissible</div>
            </div>
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 text-center">
              <div className="text-2xl font-black text-seal-gold font-mono">0.1s</div>
              <div className="text-[10px] font-bold text-content-muted mt-0.5 uppercase">PDF Engine</div>
            </div>
            <div className="p-4 rounded-xl bg-surface-card border border-surface-border shadow-elevation-1 text-center">
              <div className="text-2xl font-black text-blue-400 font-mono">TLS</div>
              <div className="text-[10px] font-bold text-content-muted mt-0.5 uppercase">Encrypted Vault</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-surface-canvas">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-crimson-500/10 text-crimson-400 border border-crimson-500/25 font-mono text-[10px] font-bold uppercase tracking-wider">
              Transparent Pricing
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
              Pick Your Power Tier
            </h2>
            <p className="text-content-muted text-xs sm:text-sm max-w-lg mx-auto">
              Start with {PRICING_FALLBACK.plans[0].documentsPerMonth} free documents a month, and pay only when you send more. Prices are in rupees and include GST.
            </p>
          </div>

          <PricingCards user={user} large />

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/pricing"
              className="px-6 py-2.5 bg-crimson-600 hover:bg-crimson-500 text-white font-black text-xs uppercase tracking-wider rounded-xl btn-shelf-yellow transition-all"
            >
              Compare plans in full
            </Link>
            <Link to="/t" className="px-6 py-2.5 bg-surface-card hover:bg-surface-elevated text-content-primary font-bold text-xs uppercase tracking-wider rounded-xl border border-surface-border shadow-elevation-1 transition-all">
              Browse templates
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-surface-subtle border-t border-surface-border">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase">Frequently Asked Questions</h2>
            <p className="text-content-muted text-xs font-normal">Everything you need to know about PactDoc.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-2xl bg-surface-card border border-surface-border hover:border-surface-border-hover shadow-elevation-1 cursor-pointer transition-colors"
                onClick={() => toggleFaq(i)}
              >
                <div className="flex items-center justify-between font-bold text-white text-xs sm:text-sm">
                  <span>{faq.q}</span>
                  <span className="text-content-muted text-lg font-mono ml-3">{activeFaq === i ? "−" : "+"}</span>
                </div>
                {activeFaq === i && (
                  <p className="text-xs text-content-secondary mt-3 leading-relaxed border-t border-surface-border pt-3 font-normal">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-surface-border bg-surface-canvas text-content-muted text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-7 h-7 grid place-items-center rounded-lg bg-crimson-600 text-white shadow-elevation-1" aria-hidden="true">
              <BrandGlyph className="w-4 h-4" />
            </span>
            <span className="text-white text-sm font-black">Pact<span className="text-crimson-500">Doc</span></span>
            <span className="text-content-subtle">— The Non-Repudiation E-Signature Standard.</span>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <a href="#compliance" className="hover:text-white transition-colors">IT Act Compliance</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 text-center text-content-subtle text-[11px] font-mono">
          © {new Date().getFullYear()} PactDoc Technologies Inc. Compliant with IT Act 2000 Section 10A, US ESIGN, and EU eIDAS.
        </div>
      </footer>
    </div>
  );
};

export default Landing;

