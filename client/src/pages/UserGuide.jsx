import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function UserGuide() {
  const [activeSection, setActiveSection] = useState("overview");

  // Ingestion Simulator State
  const [uploadSimState, setUploadSimState] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  // EXACT PDF EDITOR SIMULATOR STATE
  const [editorFields, setEditorFields] = useState([
    { id: 1, type: "signature", label: "Executive Signature", x: 15, y: 70, w: 32, h: 10, role: "Signer 1", color: "#ef4444" },
    { id: 2, type: "date", label: "Execution Date", x: 55, y: 70, w: 25, h: 8, role: "Signer 2", color: "#eab308" },
  ]);
  const [editorPage, setEditorPage] = useState(1);
  const [editorZoom, setEditorZoom] = useState("100%");
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(true);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [crosshair, setCrosshair] = useState({ x: 220, y: 180 });

  // Routing Simulator State
  const [routingMode, setRoutingMode] = useState("sequential");
  const [activeSignerStep, setActiveSignerStep] = useState(1);

  // Signer Experience & OTP State
  const [dummyOtp, setDummyOtp] = useState(["4", "8", "1", "9", "2", "0"]);
  const [dummySigName, setDummySigName] = useState("Alexandre Hamilton");
  const [dummySigFont, setDummySigFont] = useState("'Great Vibes', cursive");

  // Background Eraser Slider State
  const [bgThreshold, setBgThreshold] = useState(1.4);

  const startUploadSim = () => {
    setUploadSimState("uploading");
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadSimState("complete");
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const addEditorField = (type) => {
    const config = {
      signature: { label: "Signature", color: "#ef4444", w: 30, h: 10 },
      initials: { label: "Initials", color: "#ec4899", w: 15, h: 8 },
      text: { label: "Text Field", color: "#3b82f6", w: 25, h: 7 },
      date: { label: "Date Field", color: "#eab308", w: 22, h: 7 },
      checkbox: { label: "Checkbox", color: "#10b981", w: 8, h: 6 },
    };
    const c = config[type] || config.signature;
    const newField = {
      id: Date.now(),
      type,
      label: c.label,
      x: 15 + (editorFields.length % 3) * 25,
      y: 35 + (editorFields.length % 3) * 12,
      w: c.w,
      h: c.h,
      role: `Signer ${(editorFields.length % 2) + 1}`,
      color: c.color,
    };
    setEditorFields([...editorFields, newField]);
    setActiveFieldId(newField.id);
  };

  const removeEditorField = (id) => {
    setEditorFields(editorFields.filter((f) => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const sections = [
    { id: "overview", num: "01", label: "System Architecture", tag: "Engine & Standards" },
    { id: "landing-auth", num: "02", label: "Gateway & Auth", tag: "Landing & Vault Access" },
    { id: "dashboard", num: "03", label: "Command Dashboard", tag: "Document Management" },
    { id: "ingestion", num: "04", label: "Document Ingestion", tag: "PDF Drag & Drop" },
    { id: "editor", num: "05", label: "Visual Field Editor", tag: "Exact Editor Replica" },
    { id: "routing", num: "06", label: "Multi-Party Routing", tag: "Sequential Handshake" },
    { id: "signer-portal", num: "07", label: "Signer Portal & OTP", tag: "4 Cursive Fonts" },
    { id: "audit-trail", num: "08", label: "SHA-256 Audit Trail", tag: "Legal Non-Repudiation" },
    { id: "superpowers", num: "09", label: "Templates & Bulk Send", tag: "Speed Multipliers" },
  ];

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-yellow-400 selection:text-black">
      {/* Top Application Bar */}
      <header className="border-b-2 border-white/20 bg-[#13151f] sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#facc15]">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black px-2 py-0.5 rounded border border-black">
                  Signaturly Pro
                </span>
                <span className="text-[11px] font-mono text-gray-400">/userguide</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  Interactive Lab
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-display font-black text-white uppercase tracking-tight">
                Complete User Guide & Real-Time Application Walkthrough
              </h1>
            </div>
          </div>

          <Link
            to="/dashboard"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#facc15] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
          >
            ← Exit to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-3.5 shadow-[4px_4px_0px_0px_#000] sticky top-20 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400 block px-2 mb-2">
              Walkthrough Table of Contents
            </span>
            {sections.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                className={`block w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
                  activeSection === sec.id
                    ? "bg-red-600 text-white border-black shadow-[2px_2px_0px_0px_#facc15]"
                    : "bg-[#090a0f] text-gray-400 hover:text-white border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{sec.num}. {sec.label}</span>
                </div>
                <span className="text-[9px] font-mono text-gray-500 block font-normal lowercase">{sec.tag}</span>
              </a>
            ))}

            <div className="pt-3 border-t-2 border-white/10 mt-3 space-y-1.5 text-center">
              <span className="text-[9px] font-mono text-gray-500 block uppercase font-bold">
                Compliance Standards
              </span>
              <div className="px-2 py-1 bg-[#090a0f] rounded-lg border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                ✓ IT Act Sec 10A • 15 USC 7001
              </div>
            </div>
          </div>
        </aside>

        {/* Dense Content Stream */}
        <main className="lg:col-span-9 space-y-10">
          {/* ========================================================================= */}
          {/* 1. CORE ENGINE ARCHITECTURE */}
          {/* ========================================================================= */}
          <section id="overview" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 01
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    End-to-End System Architecture
                  </h2>
                </div>
                <span className="text-xs font-mono text-yellow-400">Life-Cycle of a Sealed Contract</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    <strong>Signaturly Pro</strong> combines client-side WebAssembly / PDF.js rendering with server-side <strong>pdf-lib</strong> vector burning to guarantee 100% pixel-perfect signature alignment.
                  </p>
                  <div className="space-y-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-yellow-400 block font-black uppercase text-[10px]">1. Coordinate Space</strong>
                      Canvas coordinates are normalized to standard PDF point scale (72 DPI) regardless of screen resolution or device viewport.
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-emerald-400 block font-black uppercase text-[10px]">2. Vector Injection</strong>
                      Signatures and text are burned directly into PDF content streams, preserving sharpness at any print or zoom level.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 font-mono block border-b border-white/10 pb-1">
                    PIPELINE ARCHITECTURE FLOWCHART
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { num: "01", title: "PDF Ingest", sub: "SHA-256 baseline + Page parsing", border: "border-red-500", badge: "bg-red-600 text-white" },
                      { num: "02", title: "Visual Studio", sub: "XY placement & role palette", border: "border-yellow-400", badge: "bg-yellow-400 text-black" },
                      { num: "03", title: "Signer Handshake", sub: "OTP unlock + Vector adoption", border: "border-blue-500", badge: "bg-blue-600 text-white" },
                      { num: "04", title: "SHA-256 Seal", sub: "Evidentiary audit certificate", border: "border-emerald-500", badge: "bg-emerald-500 text-black" },
                    ].map((step) => (
                      <div key={step.num} className={`p-3 rounded-xl bg-[#13151f] border-2 ${step.border} shadow-[2px_2px_0px_0px_#000] flex items-start gap-2.5`}>
                        <span className={`w-6 h-6 rounded-md font-black text-[11px] flex items-center justify-center shrink-0 border border-black ${step.badge}`}>
                          {step.num}
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase">{step.title}</h4>
                          <p className="text-[10px] text-gray-400">{step.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2.5 bg-black/50 rounded-xl border border-white/10 font-mono text-[10px] text-gray-400 flex items-center justify-between">
                    <span>STATUS: ALL_SYSTEMS_OPERATIONAL</span>
                    <span className="text-emerald-400">TLS 1.3 ENCRYPTED</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 2. LANDING & GATEWAY AUTH */}
          {/* ========================================================================= */}
          <section id="landing-auth" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#facc15] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444]">
                    Module 02
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Landing Experience & Vault Authentication
                  </h2>
                </div>
                <span className="text-xs font-mono text-gray-400">Public Portal & Gateway</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    The landing page introduces clients to high-speed digital signing with instant legal compliance ciphers.
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-white block font-black uppercase text-[10px]">Instant Return Safety:</strong>
                      Every authentication screen (Login, Register, Forgot Password) provides a prominent <code>← Back to Home</code> tactile button to prevent dead ends.
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-yellow-400 block font-black uppercase text-[10px]">Gmail SMTP Relay:</strong>
                      Password resets and signature invites are delivered in seconds via configured Google SMTP infrastructure.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-[10px] font-mono text-yellow-400 font-bold">REALISTIC UI: AUTHENTICATION MODAL</span>
                    <span className="text-[9px] font-mono text-gray-400">/login</span>
                  </div>

                  <div className="p-4 bg-[#13151f] border-2 border-white/20 rounded-xl space-y-3 shadow-inner max-w-sm mx-auto">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-gray-400">Signaturly Vault</div>
                      <span className="px-2 py-0.5 bg-yellow-400 text-black text-[9px] font-black uppercase rounded border border-black">
                        Secure
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[9px] font-mono text-gray-400 block uppercase">Work Email</label>
                        <input
                          type="email"
                          disabled
                          value="counsel@enterprise.com"
                          className="w-full p-2 bg-[#090a0f] border border-white/20 rounded-lg text-white font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-gray-400 block uppercase">Password</label>
                        <input
                          type="password"
                          disabled
                          value="••••••••••••"
                          className="w-full p-2 bg-[#090a0f] border border-white/20 rounded-lg text-white font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button className="flex-1 py-2 bg-red-600 text-white font-black text-xs uppercase rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#facc15]">
                        Sign In →
                      </button>
                      <button className="px-3 py-2 bg-[#1e2235] text-gray-300 font-bold text-xs uppercase rounded-xl border border-white/20">
                        ← Home
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 3. COMMAND DASHBOARD */}
          {/* ========================================================================= */}
          <section id="dashboard" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#3b82f6] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 03
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Command Dashboard & Document Vault
                  </h2>
                </div>
                <span className="text-xs font-mono text-blue-400">Mission Control</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    Manage corporate contracts across your organization with centralized search, status filtering, and actionable execution buttons.
                  </p>
                  <div className="space-y-1.5">
                    <div className="p-2 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-white block font-black uppercase text-[10px]">Filter Tabs:</strong>
                      Instantly filter by <em>All Documents</em>, <em>In Progress</em>, or <em>Signed & Sealed</em>.
                    </div>
                    <div className="p-2 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-blue-400 block font-black uppercase text-[10px]">Audit Log Drawer:</strong>
                      View every IP address, timestamp, and verification handshake with one click.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex gap-1.5">
                      <span className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg border border-black shadow">
                        All (14)
                      </span>
                      <span className="px-2.5 py-1 bg-[#13151f] text-gray-400 text-[10px] font-bold uppercase rounded-lg border border-white/10">
                        In Progress (3)
                      </span>
                      <span className="px-2.5 py-1 bg-[#13151f] text-gray-400 text-[10px] font-bold uppercase rounded-lg border border-white/10">
                        Signed (11)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">Search: 🔍</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { name: "Executive-Employment-Agreement.pdf", pages: "4 pages", signers: "2/2 Signed", status: "Signed & Sealed", badge: "bg-emerald-500 text-black" },
                      { name: "Vendor-Master-Services-MSA.pdf", pages: "8 pages", signers: "1/2 Signed (Waiting Signer 2)", status: "In Progress", badge: "bg-yellow-400 text-black" },
                    ].map((doc, idx) => (
                      <div key={idx} className="p-3 bg-[#13151f] border-2 border-white/20 rounded-xl flex items-center justify-between shadow">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-red-600 text-white font-black text-xs flex items-center justify-center border border-black">
                            PDF
                          </span>
                          <div>
                            <h4 className="text-xs font-black text-white truncate max-w-[200px]">{doc.name}</h4>
                            <span className="text-[9px] font-mono text-gray-400">{doc.pages} • {doc.signers}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border border-black ${doc.badge}`}>
                            {doc.status}
                          </span>
                          <button className="px-2 py-1 bg-[#090a0f] hover:bg-black text-white text-[10px] font-mono rounded border border-white/20">
                            ⋮
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 4. DOCUMENT INGESTION */}
          {/* ========================================================================= */}
          <section id="ingestion" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#a855f7] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 04
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Document Ingestion & File Parsing
                  </h2>
                </div>
                <span className="text-xs font-mono text-purple-400">Step 1: Upload Any Contract</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-yellow-400 text-black font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                      <div>
                        <strong className="text-white">Supported Formats:</strong> Multi-page PDF documents up to 50MB. (Single page agreements, 50+ page leases, NDA covenants).
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-yellow-400 text-black font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                      <div>
                        <strong className="text-white">Initial Checksum:</strong> Upon ingestion, the server computes a <code>SHA-256</code> hash of the unaltered source binary to establish legal baseline integrity.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-yellow-400 text-black font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                      <div>
                        <strong className="text-white">Zero Cloud Leakage:</strong> Files are stored locally in the isolated upload vault with strict UUID tokens.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-5 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono block">
                    INTERACTIVE INGESTION ACTION SIMULATOR
                  </span>

                  <div className="relative border-2 border-dashed border-yellow-400 rounded-2xl p-6 bg-[#13151f] text-center overflow-hidden">
                    <div className="flex items-center justify-center gap-4 py-2">
                      <div className="w-20 p-2 bg-[#1e2235] border-2 border-white/20 rounded-xl shadow-lg flex flex-col items-center animate-pulse">
                        <div className="w-8 h-10 bg-red-600 rounded text-white font-black text-[9px] flex items-center justify-center border border-black">
                          PDF
                        </div>
                        <span className="text-[9px] font-mono text-gray-300 mt-1 truncate w-full">contract.pdf</span>
                        <span className="text-[8px] text-gray-500">2.4 MB</span>
                      </div>

                      <div className="flex items-center gap-1 text-yellow-400">
                        <span className="text-xs font-mono font-bold">DRAGGING</span>
                        <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>

                      <div className="w-28 p-3 bg-yellow-400/10 border-2 border-yellow-400 rounded-xl flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black text-xs border border-black shadow">
                          📥
                        </div>
                        <span className="text-[9px] font-black uppercase text-yellow-400 mt-1">Dropzone Target</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400">
                        {uploadSimState === "idle" && "Ready to simulate drop"}
                        {uploadSimState === "uploading" && `Ingesting PDF (${uploadProgress}%)`}
                        {uploadSimState === "complete" && "✓ Document Parsed & Ready for Editor"}
                      </span>
                      <button
                        onClick={startUploadSim}
                        disabled={uploadSimState === "uploading"}
                        className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#ef4444]"
                      >
                        {uploadSimState === "uploading" ? "Parsing..." : "Simulate File Drop →"}
                      </button>
                    </div>

                    {uploadSimState === "uploading" && (
                      <div className="w-full bg-black rounded-full h-2 mt-3 overflow-hidden border border-white/20">
                        <div className="bg-yellow-400 h-2 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 5. VISUAL FIELD EDITOR (EXACT APPLICATION LAYOUT REPLICA) */}
          {/* ========================================================================= */}
          <section id="editor" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 05
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Visual Field Editor (Exact Layout Replica)
                  </h2>
                </div>
                <span className="text-xs font-mono text-red-400">Step 2: Coordinate Space Precision</span>
              </div>

              {/* Technical Description Strip */}
              <div className="p-4 bg-[#090a0f] rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-yellow-400 text-black font-black flex items-center justify-center text-sm border border-black shadow">
                    ✍️
                  </span>
                  <div>
                    <strong className="text-white block font-display uppercase tracking-wide">Interactive Editor Workbench:</strong>
                    <span className="text-gray-400">Click any field tool in the left palette to drop onto the contract canvas. Drag crosshairs to inspect live XY coordinates.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-[#13151f] border border-white/20 font-mono text-[11px] text-yellow-400">
                    Fields: {editorFields.length}
                  </span>
                  <button
                    onClick={() => setEditorSidebarOpen(!editorSidebarOpen)}
                    className="px-2.5 py-1 rounded bg-[#13151f] hover:bg-white/10 text-white border border-white/20 text-xs font-bold"
                  >
                    {editorSidebarOpen ? "Hide Tools Sidebar" : "Show Tools Sidebar"}
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* EXACT FULL-SCREEN REPLICA OF THE PDF EDITOR */}
              {/* ========================================================================= */}
              <div className="bg-[#08090d] border-2 border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[460px]">
                {/* 1. Editor Top Navigation Bar */}
                <div className="bg-[#12141c] border-b border-white/10 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 select-none">
                  {/* Left: Document info */}
                  <div className="flex items-center space-x-3">
                    <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5 text-[11px] font-bold">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Gallery</span>
                    </div>

                    <div className="h-4 w-px bg-white/20" />

                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Consulting-Agreement-2026.pdf</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-mono font-bold">
                          READY
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono">ID: doc-948a20e1</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow">
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send for Signature</span>
                    </button>

                    <button className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-lg border border-black shadow-[2px_2px_0px_0px_#facc15]">
                      Sign Document →
                    </button>
                  </div>
                </div>

                {/* 2. Editor Body (Split Layout: Left Palette + Right PDF Canvas) */}
                <div className="flex flex-1 overflow-hidden relative">
                  {/* Left Sidebar Palette */}
                  {editorSidebarOpen && (
                    <aside className="w-64 sm:w-72 bg-[#12141c] border-r border-white/10 p-4 space-y-4 shrink-0 flex flex-col justify-between select-none">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1 border-b border-white/10">
                          <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider flex items-center">
                            <svg className="w-4 h-4 mr-1.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                            Field Tools
                          </h3>
                          <span className="text-[10px] font-mono text-gray-400">Click to Add</span>
                        </div>

                        {/* Exact Field Palette Tool Cards */}
                        <div className="space-y-1.5">
                          {[
                            { type: "signature", label: "Signature", desc: "Draw or place e-signature", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
                            { type: "initials", label: "Initials", desc: "Compact initials stamp", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30" },
                            { type: "text", label: "Text Field", desc: "Single-line or free text", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
                            { type: "date", label: "Date Field", desc: "Auto-fill or calendar picker", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
                            { type: "checkbox", label: "Checkbox", desc: "Optional or mandatory toggle", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
                          ].map((tool) => (
                            <button
                              key={tool.type}
                              onClick={() => addEditorField(tool.type)}
                              className="group w-full p-2 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-yellow-400 rounded-xl text-left transition-all flex items-center justify-between shadow-sm"
                            >
                              <div className="flex items-center space-x-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border font-bold text-xs ${tool.bg} ${tool.color}`}>
                                  ✦
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors">
                                    {tool.label}
                                  </p>
                                  <p className="text-[9px] text-gray-400">{tool.desc}</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors">
                                +
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fields Summary Counter */}
                      <div className="p-2.5 bg-[#090a0f] rounded-xl border border-white/10 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-gray-400">Placed on Canvas:</span>
                          <span className="text-yellow-400 font-mono">{editorFields.length} Fields</span>
                        </div>
                        <div className="text-[9px] text-gray-500 font-mono">Normalized to 72 DPI PDF coordinates</div>
                      </div>
                    </aside>
                  )}

                  {/* Right Main PDF Canvas Viewport */}
                  <main className="flex-1 bg-[#08090d] p-4 flex flex-col items-center justify-start overflow-y-auto space-y-3">
                    {/* PDF Page Controls Toolbar */}
                    <div className="w-full max-w-xl bg-[#13151f] border border-white/10 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs select-none">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditorPage((p) => Math.max(1, p - 1))}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-bold"
                        >
                          ‹ Prev
                        </button>
                        <span className="text-[11px] font-mono text-gray-300">
                          Page {editorPage} of 3
                        </span>
                        <button
                          onClick={() => setEditorPage((p) => Math.min(3, p + 1))}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-bold"
                        >
                          Next ›
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-gray-400">Zoom:</span>
                        {["100%", "125%"].map((z) => (
                          <button
                            key={z}
                            onClick={() => setEditorZoom(z)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              editorZoom === z ? "bg-red-600 text-white font-bold" : "text-gray-400 hover:text-white"
                            }`}
                          >
                            {z}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PDF Sheet Canvas */}
                    <div
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setCrosshair({
                          x: Math.round(e.clientX - rect.left),
                          y: Math.round(e.clientY - rect.top),
                        });
                      }}
                      className="relative bg-white text-black w-full max-w-xl min-h-[300px] p-6 rounded-lg shadow-2xl border border-slate-300 cursor-crosshair select-none"
                    >
                      {/* Real-time Coordinate Crosshair HUD */}
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/90 text-yellow-400 text-[9px] font-mono rounded border border-white/20 shadow">
                        Live Crosshair: X:{crosshair.x}px • Y:{crosshair.y}px
                      </div>

                      {/* Document Legal Content Simulation */}
                      <div className="border-b-2 border-slate-200 pb-2 mb-3">
                        <h4 className="text-xs font-serif font-black uppercase text-slate-800 tracking-wider text-center">
                          EXECUTIVE CONSULTING SERVICES AGREEMENT
                        </h4>
                        <p className="text-[9px] text-slate-500 font-mono text-center">CONTRACT REF #2026-MSA-0091</p>
                      </div>

                      <p className="text-[9px] font-serif text-slate-600 leading-relaxed mb-3">
                        1. <strong>Scope of Services:</strong> The Contractor shall provide advisory services in full compliance with corporate specifications.
                      </p>
                      <p className="text-[9px] font-serif text-slate-600 leading-relaxed mb-4">
                        2. <strong>Execution & Delivery:</strong> This instrument is executed under the legal frameworks of statutory electronic signature provisions.
                      </p>

                      {/* Placed Interactive Draggable Fields */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {editorFields.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => setActiveFieldId(f.id)}
                            className={`p-2 rounded-lg border-2 border-dashed bg-slate-50 relative flex items-center justify-between text-[10px] font-bold shadow-sm transition-all ${
                              activeFieldId === f.id ? "ring-2 ring-yellow-400 scale-[1.02]" : ""
                            }`}
                            style={{ borderColor: f.color }}
                          >
                            <div className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                              <span style={{ color: f.color }}>{f.label} ({f.role})</span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEditorField(f.id);
                              }}
                              className="text-red-500 hover:text-red-700 font-black text-xs ml-2"
                              title="Delete Field"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </main>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 6. MULTI-SIGNER ROUTING */}
          {/* ========================================================================= */}
          <section id="routing" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#3b82f6] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 06
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Multi-Party Routing & Sequential Logic
                  </h2>
                </div>
                <span className="text-xs font-mono text-blue-400">Step 3: Automated Handshake</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    When distributing contracts involving multiple stakeholders, Signaturly provides two execution modes:
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-purple-400 block font-black uppercase text-[10px]">Sequential Handshake</strong>
                      Signer 2 cannot view or sign until Signer 1 completes their execution. The backend server automatically triggers the next invitation upon each signed webhook.
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-blue-400 block font-black uppercase text-[10px]">Parallel Execution</strong>
                      All recipients receive invitations simultaneously. The document is sealed once all signatures are gathered.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 font-mono">
                      LIVE ROUTING STEPPER SIMULATOR
                    </span>
                    <button
                      onClick={() => setRoutingMode(routingMode === "sequential" ? "parallel" : "sequential")}
                      className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded border border-black"
                    >
                      Mode: {routingMode}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { step: 1, role: "Signer 1 (Initiator)", name: "Suleman Khan", status: "Executed ✓", color: "border-emerald-500 text-emerald-400" },
                      { step: 2, role: "Signer 2 (Client VP)", name: "Sarah Connor", status: activeSignerStep >= 2 ? "Active Signing Session ✍️" : "Queued (Waiting on Step 1) 🔒", color: activeSignerStep >= 2 ? "border-yellow-400 text-yellow-400" : "border-gray-700 text-gray-500" },
                      { step: 3, role: "Signer 3 (Auditor)", name: "Legal Counsel", status: activeSignerStep >= 3 ? "Signed & Sealed ✓" : "Queued (Waiting on Step 2) 🔒", color: activeSignerStep >= 3 ? "border-emerald-500 text-emerald-400" : "border-gray-700 text-gray-500" },
                    ].map((s) => (
                      <div key={s.step} className={`p-3 rounded-xl bg-[#13151f] border-2 ${s.color} flex items-center justify-between shadow-[2px_2px_0px_0px_#000]`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-black text-xs flex items-center justify-center border border-black">
                            #{s.step}
                          </span>
                          <div>
                            <div className="text-xs font-black text-white">{s.role}</div>
                            <div className="text-[10px] font-mono text-gray-400">{s.name}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold">{s.status}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setActiveSignerStep((prev) => (prev >= 3 ? 1 : prev + 1))}
                      className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#ef4444]"
                    >
                      Simulate Next Signer Webhook →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 7. SIGNER PORTAL & OTP */}
          {/* ========================================================================= */}
          <section id="signer-portal" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#22c55e] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#fff]">
                    Module 07
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Signer Experience & Two-Factor OTP
                  </h2>
                </div>
                <span className="text-xs font-mono text-emerald-400">Step 4: Identity Verification</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    Recipients need <strong>no account or software installation</strong>. They click the one-time link in their invitation email, pass two-factor OTP verification, and adopt a digital signature.
                  </p>
                  <div className="p-3 bg-[#090a0f] rounded-xl border border-white/10 space-y-1.5 font-mono text-[11px]">
                    <div className="text-emerald-400 font-bold">✓ 4 Cursive Font Options:</div>
                    <div className="text-gray-300 pl-2">1. Great Vibes (Executive)</div>
                    <div className="text-gray-300 pl-2">2. Dancing Script (Penmanship)</div>
                    <div className="text-gray-300 pl-2">3. Caveat (Natural Pen)</div>
                    <div className="text-gray-300 pl-2">4. Alex Brush (Calligraphy)</div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-white/20 rounded-2xl p-4 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono block border-b border-white/10 pb-1">
                    REALISTIC SIGNER INTERFACE PREVIEW
                  </span>

                  <div className="p-3 bg-[#13151f] rounded-xl border border-white/10 space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                      <span>Two-Factor Security Code</span>
                      <span className="text-yellow-400">Sent to Email</span>
                    </div>
                    <div className="flex justify-between gap-1.5">
                      {dummyOtp.map((d, i) => (
                        <div key={i} className="w-8 h-9 rounded-lg bg-[#090a0f] border border-yellow-400 text-white font-mono font-black text-sm flex items-center justify-center shadow">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-[#13151f] rounded-xl border border-white/10 space-y-2">
                    <input
                      type="text"
                      value={dummySigName}
                      onChange={(e) => setDummySigName(e.target.value)}
                      className="w-full p-2 bg-[#090a0f] border border-white/20 rounded-lg text-white text-xs font-medium"
                      placeholder="Type name..."
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        { name: "Great Vibes", font: "'Great Vibes', cursive" },
                        { name: "Dancing Script", font: "'Dancing Script', cursive" },
                        { name: "Caveat", font: "'Caveat', cursive" },
                        { name: "Alex Brush", font: "'Alex Brush', cursive" },
                      ].map((f) => (
                        <button
                          key={f.name}
                          onClick={() => setDummySigFont(f.font)}
                          className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${
                            dummySigFont === f.font ? "bg-yellow-400 text-black border-black" : "bg-[#090a0f] text-gray-400 border-white/10"
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-black text-center min-h-[50px] flex items-center justify-center">
                      <span style={{ fontFamily: dummySigFont, fontSize: "28px", color: "#000" }}>
                        {dummySigName || "Signature"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 8. SHA-256 AUDIT TRAIL */}
          {/* ========================================================================= */}
          <section id="audit-trail" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white border-2 border-black rounded shadow-[2px_2px_0px_0px_#facc15]">
                    Module 08
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Statutory Compliance & SHA-256 Audit Trail
                  </h2>
                </div>
                <span className="text-xs font-mono text-red-400">Step 5: Court Admissibility</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 space-y-3 text-xs leading-relaxed text-gray-300 font-medium">
                  <p>
                    Every completed transaction produces an immutable <strong>Certificate of Completion</strong> appended to the final PDF.
                  </p>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-white block">Statutory Non-Repudiation:</strong>
                      Compliant with Section 10A of the Indian Information Technology Act 2000, 15 U.S.C. § 7001 (US ESIGN), and EU eIDAS Regulations.
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#090a0f] border border-white/10">
                      <strong className="text-yellow-400 block">Tamper Detection:</strong>
                      Modifying a single byte of the signed PDF will immediately invalidate the SHA-256 hash checksum.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 bg-[#090a0f] border-2 border-emerald-500 rounded-2xl p-4 space-y-3 shadow-[4px_4px_0px_0px_#22c55e]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="px-2 py-0.5 bg-emerald-500 text-black font-black uppercase text-[10px] rounded border border-black">
                      CERTIFICATE OF COMPLETION
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">TAMPER_EVIDENT_VERIFIED ✓</span>
                  </div>

                  <div className="p-3 bg-[#13151f] rounded-xl border border-white/10 font-mono text-[10px] space-y-1 text-gray-300">
                    <div><span className="text-gray-500">ORIGINAL_HASH :</span> e3b0c44298fc1c149afbf4c8996fb92427...</div>
                    <div><span className="text-gray-500">SEALED_HASH   :</span> 9f86d081884c7d659a2feaa0c55ad015a3...</div>
                    <div><span className="text-gray-500">SIGNER_IP     :</span> 157.34.192.88 (TLS 1.3 Handshake)</div>
                    <div><span className="text-gray-500">TIMESTAMP     :</span> 2026-08-17T22:45:12.890Z [UTC]</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* 9. SPEED MULTIPLIERS */}
          {/* ========================================================================= */}
          <section id="superpowers" className="scroll-mt-20">
            <div className="bg-[#13151f] border-2 border-white/20 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#facc15] space-y-6">
              <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black border-2 border-black rounded shadow-[2px_2px_0px_0px_#ef4444]">
                    Module 09
                  </span>
                  <h2 className="text-xl sm:text-2xl font-display font-black uppercase text-white tracking-tight">
                    Speed Multipliers: Templates, Bulk Send & Studio
                  </h2>
                </div>
                <span className="text-xs font-mono text-gray-400">Step 6: Workflow Automation</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#090a0f] border-2 border-white/20 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-yellow-400 text-black border border-black">
                      1. Prebuilt Templates
                    </span>
                    <h4 className="text-xs font-black text-white uppercase mt-1">Contract Library</h4>
                    <p className="text-[10px] text-gray-400">Launch standard NDAs, Offer Letters, and Contractor Agreements in 1 click.</p>
                  </div>
                  <span className="text-[9px] font-black text-yellow-400 uppercase pt-2 block">1-Click Launch →</span>
                </div>

                <div className="p-4 rounded-xl bg-[#090a0f] border-2 border-white/20 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-blue-600 text-white border border-black">
                      2. Bulk CSV Mailmerge
                    </span>
                    <h4 className="text-xs font-black text-white uppercase mt-1">Mass Dispatch</h4>
                    <p className="text-[10px] text-gray-400">Send 100+ personalized agreements with individual tracking and zip download.</p>
                  </div>
                  <span className="text-[9px] font-black text-blue-400 uppercase pt-2 block">CSV Upload →</span>
                </div>

                <div className="p-4 rounded-xl bg-[#090a0f] border-2 border-white/20 shadow-[3px_3px_0px_0px_#000] flex flex-col justify-between space-y-2">
                  <div>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-purple-600 text-white border border-black">
                      3. Signature Studio
                    </span>
                    <h4 className="text-xs font-black text-white uppercase mt-1">Paper Shadow Eraser</h4>
                    <p className="text-[10px] text-gray-400">Web Worker luminance filter strips paper shadows into transparent PNGs.</p>
                  </div>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="0.8"
                      max="2.5"
                      step="0.1"
                      value={bgThreshold}
                      onChange={(e) => setBgThreshold(parseFloat(e.target.value))}
                      className="w-full accent-red-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
