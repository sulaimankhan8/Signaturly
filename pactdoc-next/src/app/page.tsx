import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-canvas text-content-primary">
      {/* Signature Top Accent Stripe */}
      <div className="w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />

      {/* Top Security & Live Status Bar */}
      <div className="bg-surface-elevated/80 border-b border-surface-border text-xs px-4 py-1.5 flex items-center justify-between text-content-muted">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[10px] text-content-secondary">
            Global Signing Infrastructure: Operational (eIDAS &amp; ESIGN Compliant)
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono">
          <span>SHA-256 Verified</span>
          <span>Zero-Knowledge Proofs</span>
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className="border-b border-surface-border bg-surface-canvas/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-crimson flex items-center justify-center font-black text-white shadow-elevation-1">
              P
            </div>
            <span className="font-black text-lg tracking-tight text-white uppercase">
              Pact<span className="text-crimson">Doc</span>
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 rounded-md">
              PRO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-content-secondary">
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/t" className="hover:text-white transition-colors">
              Legal Templates
            </Link>
            <Link href="/verify" className="hover:text-white transition-colors">
              Verify Signature
            </Link>
            <Link href="/userguide" className="hover:text-white transition-colors">
              Guide
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-bold uppercase tracking-wider text-content-secondary hover:text-white px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-[2px_2px_0px_#000000] hover:shadow-[3px_3px_0px_#ffffff] transition-all border-2 border-black"
            >
              Start Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative px-4 pt-8 sm:pt-10 pb-10 sm:pb-12 max-w-5xl mx-auto text-center space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card border-2 border-yellow-400/80 text-xs shadow-[2px_2px_0px_#facc15]">
            <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
            <span className="font-mono text-[10px] font-black tracking-wider text-yellow-300 uppercase">
              ENTERPRISE GRADE E-SIGNATURE SYSTEM
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.12] uppercase">
            Sign Agreements <br className="hidden sm:inline" />
            <span className="stamp-badge-faster my-1.5 inline-block text-2xl sm:text-4xl md:text-5xl">
              10X FASTER
            </span>{" "}
            With <br className="hidden sm:inline" />
            Legal Non-Repudiation.
          </h1>

          <p className="text-xs sm:text-sm text-content-muted max-w-xl mx-auto font-medium leading-relaxed">
            Execute contracts, verify multi-party signer identities, and generate tamper-proof SHA-256 audit
            certificates. Built for teams requiring velocity and ironclad compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-1">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3 bg-crimson hover:bg-crimson-hover text-white text-xs font-black uppercase tracking-wider rounded-xl btn-shelf-yellow transition-all"
            >
              Sign Your First Document Free →
            </Link>
            <Link
              href="/verify"
              className="w-full sm:w-auto px-7 py-3 bg-surface-card hover:bg-surface-elevated text-content-primary border border-surface-border text-xs font-black uppercase tracking-wider rounded-xl btn-shelf-crimson transition-all"
            >
              Verify Certificate Hash
            </Link>
          </div>

          {/* Metric Highlights */}
          <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-elevation-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-content-muted">Compliance</p>
              <p className="text-xl font-black text-white font-mono mt-1">ESIGN &amp; eIDAS</p>
              <p className="text-[11px] text-content-subtle mt-0.5">Court-admissible execution</p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-elevation-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-content-muted">Cryptography</p>
              <p className="text-xl font-black text-seal-emerald font-mono mt-1">SHA-256</p>
              <p className="text-[11px] text-content-subtle mt-0.5">Tamper-evident sealing</p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-elevation-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-content-muted">Execution Velocity</p>
              <p className="text-xl font-black text-seal-blue font-mono mt-1">&lt; 90 Seconds</p>
              <p className="text-[11px] text-content-subtle mt-0.5">Average turn-around</p>
            </div>

            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-elevation-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-content-muted">Security</p>
              <p className="text-xl font-black text-seal-amber font-mono mt-1">SOC 2 Type II</p>
              <p className="text-[11px] text-content-subtle mt-0.5">Bank-grade vault storage</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface-canvas py-8 text-center text-xs text-content-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} PactDoc Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/security" className="hover:text-white transition-colors">
              Security
            </Link>
            <Link href="/verify" className="hover:text-white transition-colors">
              Verify
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
