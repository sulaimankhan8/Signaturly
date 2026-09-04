import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function UserGuide() {
  const [selectedJourney, setSelectedJourney] = useState("journey-send-contract");
  const [activeStepIndex, setActiveStepIndex] = useState(1);

  // Interactive PDF Editor Simulator State for Flow 3
  const [editorFields, setEditorFields] = useState([
    { id: 1, type: "signature", label: "Signature", role: "Signer 1 (Red)", color: "#ef4444", x: 120, y: 380, w: 220, h: 60 },
    { id: 2, type: "date", label: "Date Signed", role: "Signer 1 (Red)", color: "#eab308", x: 360, y: 380, w: 140, h: 45 },
    { id: 3, type: "text", label: "Job Title", role: "Signer 2 (Blue)", color: "#3b82f6", x: 120, y: 280, w: 200, h: 40 },
  ]);
  const [editorPage, setEditorPage] = useState(1);
  const [editorZoom, setEditorZoom] = useState("100%");
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(true);
  const [activeFieldId, setActiveFieldId] = useState(1);
  const [crosshair, setCrosshair] = useState({ x: 220, y: 180 });

  const addEditorField = (type) => {
    const config = {
      signature: { label: "Signature", color: "#ef4444", w: 220, h: 60 },
      initials: { label: "Initials", color: "#ec4899", w: 100, h: 50 },
      text: { label: "Text Field", color: "#3b82f6", w: 180, h: 40 },
      date: { label: "Date Field", color: "#eab308", w: 140, h: 40 },
      checkbox: { label: "Checkbox", color: "#10b981", w: 32, h: 32 },
    };
    const c = config[type] || config.signature;
    const newField = {
      id: Date.now(),
      type,
      label: c.label,
      role: `Signer ${(editorFields.length % 2) + 1} (${(editorFields.length % 2) === 0 ? "Red" : "Blue"})`,
      color: c.color,
      x: 100 + (editorFields.length % 3) * 40,
      y: 200 + (editorFields.length % 3) * 30,
      w: c.w,
      h: c.h,
    };
    setEditorFields([...editorFields, newField]);
    setActiveFieldId(newField.id);
  };

  const removeEditorField = (id) => {
    setEditorFields(editorFields.filter((f) => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  // Journeys metadata with actual screenshot bindings & labeled pins
  const journeys = [
    {
      id: "journey-send-contract",
      num: "03",
      title: "Create, Edit & Dispatch Contract Journey",
      badge: "Core Workflow",
      color: "border-blue-500",
      desc: "Complete flow: Ingesting PDF ➔ Visual coordinate placement in Inner PDF Editor ➔ Sequential multi-party routing & 2FA OTP ➔ Dispatch.",
      steps: [
        {
          title: "Step 1: PDF Document Ingestion",
          url: "/upload",
          screenshot: "/guide_screenshots/05_upload.png",
          actionDescription: "Upload any contract PDF (NDAs, Leases, MSA, Employment Offers) to calculate the SHA-256 tamper baseline.",
          callouts: [
            { pin: "①", title: "Drag & Drop Zone", text: "Drop PDF file or click 'Browse Files' (supports multi-page contracts up to 50MB)." },
            { pin: "②", title: "SHA-256 Checksum", text: "Server automatically computes cryptographic hash of original binary to establish legal baseline integrity." },
            { pin: "③", title: "Zero Cloud Leakage", text: "Files are stored locally in the isolated upload vault with strict UUID tokens." },
            { pin: "④", title: "Continue to Editor", text: "Click button to launch the 72 DPI Visual PDF Field Editor." },
          ],
        },
        {
          title: "Step 2: Visual PDF Field Editor & Tools Workbench",
          url: "/editor/:pdfId",
          isInteractiveEditor: true,
          actionDescription: "Interactive workbench: drag & drop signature, initial, text, date, and checkbox fields onto the 72 DPI normalized PDF canvas with live XY crosshairs.",
          callouts: [
            { pin: "①", title: "Field Palette (Left Sidebar)", text: "Click any tool (Signature, Initials, Text, Date, Checkbox) to instantly add a movable field onto the contract canvas." },
            { pin: "②", title: "72 DPI Normalized Canvas", text: "Coordinates are normalized to standard PDF point scale (72 DPI) to ensure 100% pixel-perfect vector burning regardless of screen resolution." },
            { pin: "③", title: "Live XY Crosshair HUD", text: "Real-time coordinate tracking overlay showing exact cursor position (X: Y: px) on the document page." },
            { pin: "④", title: "Pagination & Zoom Bar", text: "Switch pages (< Prev / Next >) across multi-page contracts and adjust magnification (100%, 125%, 150%)." },
            { pin: "⑤", title: "Signer Role Assignment", text: "Assign fields to specific signers (Signer 1, Signer 2) with distinct color badges (Red, Blue, Yellow)." },
            { pin: "⑥", title: "Header Action CTAs", text: "'Save Draft' preserves placed coordinates without sending. 'Send for Signature' proceeds to multi-party recipient routing." },
          ],
        },
        {
          title: "Step 3: Multi-Party Routing & 2FA OTP Gate",
          url: "/send/:pdfId",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "Configure recipient order (Sequential Handshake vs Parallel), 2-Factor OTP verification, and custom email invitation messages.",
          callouts: [
            { pin: "①", title: "Sequential Handshake", text: "Signer 2 only receives signing invitation email after Signer 1 completes their signature." },
            { pin: "②", title: "Require 2FA OTP", text: "Toggle SMS/Email 6-digit OTP passcode requirement for high-confidentiality contracts." },
            { pin: "③", title: "Custom Invitation Message", text: "Add custom subject line and personal instructions delivered to each recipient." },
            { pin: "④", title: "Dispatch Envelope", text: "Click 'Send for Signature' to seal tokens, notify participants, and begin live status tracking." },
          ],
        },
        {
          title: "Step 4: Dispatch Confirmation & Live Lifecycle Tracking",
          url: "/dashboard",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "Live dashboard monitoring: track real-time signer progression, send reminders, or download completed certificates.",
          callouts: [
            { pin: "①", title: "Live Progress Badges", text: "Real-time indicators show current stage (e.g. '1/2 Signed - Waiting Signer 2')." },
            { pin: "②", title: "Send Reminder (🔔)", text: "Nudge pending recipients with 1-click automated reminder emails." },
            { pin: "③", title: "Void Envelope (🚫)", text: "Cancel in-progress contracts with mandatory reason logging." },
            { pin: "④", title: "Download Sealed PDF & Certificate", text: "Download tamper-evident executed contract with full forensic audit trail." },
          ],
        },
      ],
    },
    {
      id: "journey-signup",
      num: "01",
      title: "New User Registration & Onboarding Journey",
      badge: "Account Creation",
      color: "border-red-500",
      desc: "Complete flow: Visiting landing page ➔ Filling registration form with E-Consent ➔ Hydrating personal Command Dashboard.",
      steps: [
        {
          title: "Step 1: Landing Page & Onboarding Entry",
          url: "/landing",
          screenshot: "/guide_screenshots/01_landing.png",
          actionDescription: "User visits the Signaturly homepage and clicks the primary onboarding button.",
          callouts: [
            { pin: "①", title: "Top Navigation CTA", text: "Click 'Get Started' button in navbar to open registration form." },
            { pin: "②", title: "Verify Doc Portal", text: "Direct public access to cryptographic signature validation (/verify)." },
            { pin: "③", title: "Hero Dropzone Target", text: "Alternatively, drop any PDF contract directly onto the hero zone to upload and sign immediately." },
          ],
        },
        {
          title: "Step 2: Sign-Up Form & Legal E-Consent",
          url: "/register",
          screenshot: "/guide_screenshots/02_register.png",
          actionDescription: "User fills legal identity, credentials, and agrees to statutory electronic signature consent.",
          callouts: [
            { pin: "①", title: "Full Legal Name", text: "Used as legal signer identity and default for 4 cursive font signatures." },
            { pin: "②", title: "Work/Personal Email", text: "Receives OTP passcodes, invitation webhooks, and sealed PDF certificates." },
            { pin: "③", title: "8+ Char Password", text: "Bcrypt salted & hashed vault credentials." },
            { pin: "④", title: "Statutory E-Consent", text: "Mandatory checkbox under Section 10A of Indian IT Act 2000 & US ESIGN Act." },
            { pin: "⑤", title: "Submit Registration", text: "Click 'Create Free Account' to generate JWT session." },
          ],
        },
        {
          title: "Step 3: Initialized Command Dashboard",
          url: "/dashboard",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "User is automatically authenticated and redirected into their personal Command Dashboard.",
          callouts: [
            { pin: "①", title: "Envelopes Metrics HUD", text: "Real-time count of All, In Progress, Signed & Sealed, and Voided contracts." },
            { pin: "②", title: "Upload New Document", text: "Click 'Upload Document' button to initiate contract preparation." },
            { pin: "③", title: "Profile & Settings", text: "Access saved signature vault to draw or select default cursive fonts." },
          ],
        },
      ],
    },
    {
      id: "journey-login",
      num: "02",
      title: "Sign In & Password Recovery Journey",
      badge: "Authentication",
      color: "border-yellow-400",
      desc: "Authentication flow: Landing page ➔ Entering vault credentials ➔ Session hydration & Google SMTP recovery.",
      steps: [
        {
          title: "Step 1: Sign In Modal",
          url: "/login",
          screenshot: "/guide_screenshots/03_login.png",
          actionDescription: "Enter registered email and password to access existing contracts.",
          callouts: [
            { pin: "①", title: "Email Input", text: "Enter your registered email address (e.g. suleman111111111111111@gmail.com)." },
            { pin: "②", title: "Password Input", text: "Enter your secure account password." },
            { pin: "③", title: "Forgot Password?", text: "Click to trigger password reset token delivery via Google SMTP relay." },
            { pin: "④", title: "Sign In Action", text: "Click 'Sign In' button to authenticate and load dashboard." },
            { pin: "⑤", title: "Return Safety", text: "Click '← Back to Home' to return to landing page safely." },
          ],
        },
        {
          title: "Step 2: Authenticated Dashboard Access",
          url: "/dashboard",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "Live dashboard with all existing active envelopes, search filters, and action menus.",
          callouts: [
            { pin: "①", title: "Status Filter Tabs", text: "Filter by Pending (Awaiting signature) or Completed (Sealed)." },
            { pin: "②", title: "Document Action Menu (⋮)", text: "Trigger actions: View Details, Send Reminder, Void Envelope, Download PDF." },
          ],
        },
      ],
    },
    {
      id: "journey-signer-experience",
      num: "04",
      title: "Signer Experience & Execution Journey",
      badge: "Signer Journey",
      color: "border-emerald-500",
      desc: "Recipient experience: Email notification ➔ 2FA OTP gate ➔ Cursive font adoption ➔ SHA-256 sealed certificate.",
      steps: [
        {
          title: "Step 1: Recipient Email & OTP Verification",
          url: "/sign/:token",
          screenshot: "/guide_screenshots/03_login.png",
          actionDescription: "Recipient opens magic link in email and passes 2-factor OTP verification.",
          callouts: [
            { pin: "①", title: "Email Notification", text: "Signer clicks 'Review & Sign Document' in their email inbox." },
            { pin: "②", title: "2FA OTP Passcode", text: "Enter 6-digit one-time passcode delivered to their email to unlock document." },
            { pin: "③", title: "Zero Account Required", text: "Signers execute legally binding contracts without downloading software." },
          ],
        },
        {
          title: "Step 2: Adopt Cursive Signature & Initials",
          url: "/settings",
          screenshot: "/guide_screenshots/09_settings.png",
          actionDescription: "Adopt signature using 4 authentic cursive fonts, draw canvas, or transparent upload.",
          callouts: [
            { pin: "①", title: "4 Cursive Fonts", text: "Choose Great Vibes (Executive), Dancing Script (Penmanship), Caveat, or Sacramento." },
            { pin: "②", title: "Draw Canvas", text: "Freehand signing pad for mouse or touch stylus on tablets." },
            { pin: "③", title: "Initials Studio", text: "Generates compact initials stamp for multi-page contract margins." },
            { pin: "④", title: "Finish & Seal", text: "Burns vector stamps directly into PDF content stream with SHA-256 seal." },
          ],
        },
      ],
    },
    {
      id: "journey-lifecycle-void",
      num: "05",
      title: "Document Lifecycle, Remind & Void Journey",
      badge: "Management",
      color: "border-purple-500",
      desc: "Management flow: Monitoring progress ➔ Triggering email reminders ➔ Voiding envelopes with mandatory reason modal.",
      steps: [
        {
          title: "Step 1: Document Table & Status HUD",
          url: "/dashboard",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "Monitor real-time progress of all outgoing and incoming contract envelopes.",
          callouts: [
            { pin: "①", title: "Signer Progress", text: "Shows executed signers vs. waiting signers (e.g. 1/2 Signed)." },
            { pin: "②", title: "Send Reminder", text: "Sends immediate nudge notification email to pending signers." },
            { pin: "③", title: "Download Sealed PDF", text: "Download tamper-evident PDF with all stamps burned." },
            { pin: "④", title: "Download Audit Certificate", text: "Forensic Certificate of Completion with IP logs and timestamps." },
          ],
        },
        {
          title: "Step 2: Void / Cancel Envelope Modal",
          url: "/dashboard",
          screenshot: "/guide_screenshots/04_dashboard.png",
          actionDescription: "Cancel an in-progress envelope and permanently disable all outstanding signing links.",
          callouts: [
            { pin: "①", title: "Click 'Void Document'", text: "Opens danger confirmation modal." },
            { pin: "②", title: "Mandatory Reason Input", text: "Enter mandatory business reason for voiding (recorded in immutable audit log)." },
            { pin: "③", title: "Confirm Cancellation", text: "Envelope status transitions to '🔴 VOIDED' and signers are notified." },
          ],
        },
      ],
    },
    {
      id: "journey-bulk-send",
      num: "06",
      title: "Bulk Send & CSV Mailmerge Journey",
      badge: "Batch Dispatch",
      color: "border-pink-500",
      desc: "Mass dispatch flow: Select base template ➔ Upload CSV ➔ Map headers to fields ➔ Dispatch 50+ envelopes.",
      steps: [
        {
          title: "Step 1: Bulk CSV Mapping & Batch Dispatch",
          url: "/templates/bulk",
          screenshot: "/guide_screenshots/07_bulk_send.png",
          actionDescription: "Generate and dispatch personalized envelopes to dozens of recipients in 1 click.",
          callouts: [
            { pin: "①", title: "Select Base Template", text: "Choose standard contract template with pre-positioned fields." },
            { pin: "②", title: "Upload CSV File", text: "Upload spreadsheet containing recipient names, emails, and custom variables." },
            { pin: "③", title: "Column Mapping Matrix", text: "Map CSV headers (employee_name, salary) to document text fields." },
            { pin: "④", title: "Batch Dispatch Button", text: "Dispatches 50+ unique personalized envelopes simultaneously." },
          ],
        },
      ],
    },
    {
      id: "journey-signature-eraser",
      num: "07",
      title: "AI Signature Background Eraser Studio",
      badge: "Studio Utility",
      color: "border-orange-500",
      desc: "Studio flow: Upload raw paper photo ➔ Adjust luminance threshold ➔ Save 100% transparent vector stamp.",
      steps: [
        {
          title: "Step 1: Background Removal & Sensitivity Slider",
          url: "/signature-remover",
          screenshot: "/guide_screenshots/08_signature_remover.png",
          actionDescription: "Strips paper shadows and yellowish lighting from camera photos of physical signatures.",
          callouts: [
            { pin: "①", title: "Upload Signature Photo", text: "Drop camera phone photo or scan of signature (.png, .jpg)." },
            { pin: "②", title: "Luminance Slider", text: "Adjust sensitivity (0.8x to 2.5x) to eliminate shadows while preserving pen strokes." },
            { pin: "③", title: "Before / After Canvas", text: "Real-time side-by-side preview with transparent checkered background." },
            { pin: "④", title: "Save to Profile", text: "Click 'Save as Default Signature' for 1-click execution in contracts." },
          ],
        },
      ],
    },
    {
      id: "journey-public-verify",
      num: "08",
      title: "Public Cryptographic Verification Journey",
      badge: "Compliance Vault",
      color: "border-teal-500",
      desc: "Audit flow: Upload signed PDF or enter hash ➔ Instant court-admissible certificate & tamper verification.",
      steps: [
        {
          title: "Step 1: Public Document Verification Portal",
          url: "/verify",
          screenshot: "/guide_screenshots/10_verify.png",
          actionDescription: "Verify any Signaturly executed document for authenticity without requiring an account.",
          callouts: [
            { pin: "①", title: "PDF Upload Dropzone", text: "Drop signed PDF file to run client-side SHA-256 checksum calculation." },
            { pin: "②", title: "SHA-256 Hash Input", text: "Or paste 64-character hexadecimal certificate hash directly." },
            { pin: "③", title: "Run Verification", text: "Validates tamper status, signer IP addresses, and exact UTC timestamps." },
            { pin: "④", title: "Download Forensic Certificate", text: "Standalone court-admissible Certificate of Completion under IT Act / US ESIGN." },
          ],
        },
      ],
    },
  ];

  const currentJourney = journeys.find((j) => j.id === selectedJourney) || journeys[0];
  const currentStep = currentJourney.steps[activeStepIndex] || currentJourney.steps[0];

  return (
    <div className="min-h-screen bg-[#07080c] text-gray-100 font-sans selection:bg-yellow-400 selection:text-black">
      {/* Top Application Bar */}
      <header className="border-b-2 border-white/20 bg-[#12141d] sticky top-0 z-50 shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_#facc15]">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-black px-2 py-0.5 rounded border border-black">
                  Signaturly Live Guide
                </span>
                <span className="text-[11px] font-mono text-gray-400">/userguide</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  Complete Flow & Inner Editor Detailed
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-display font-black text-white uppercase tracking-tight">
                Complete End-to-End User Flow Manual
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#facc15] transition-all"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Journey Selector */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="bg-[#12141d] border-2 border-white/20 rounded-2xl p-3.5 shadow-[4px_4px_0px_0px_#000] sticky top-20 max-h-[85vh] overflow-y-auto space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400 block px-1 mb-1">
              Select Complete User Journey
            </span>

            {journeys.map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setSelectedJourney(j.id);
                  setActiveStepIndex(0);
                }}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all block ${
                  selectedJourney === j.id
                    ? "bg-red-600 text-white border-black shadow-[3px_3px_0px_0px_#facc15]"
                    : "bg-[#08090e] text-gray-400 hover:text-white border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                    FLOW {j.num}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase text-yellow-300">
                    {j.steps.length} Steps Sequence
                  </span>
                </div>
                <h4 className="text-xs font-black uppercase tracking-wide text-white leading-tight">
                  {j.title}
                </h4>
                <p className="text-[10px] text-gray-300 mt-1 line-clamp-2 leading-relaxed opacity-90">
                  {j.desc}
                </p>
              </button>
            ))}

            <div className="pt-3 border-t-2 border-white/10 mt-3 space-y-1 text-center">
              <span className="text-[9px] font-mono text-gray-500 uppercase font-bold block">
                Statutory Compliance
              </span>
              <div className="px-2 py-1 bg-[#08090e] rounded-lg border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                ✓ IT Act 2000 • 15 U.S.C. § 7001 • eIDAS
              </div>
            </div>
          </div>
        </aside>

        {/* Right Main Panel: Step Viewer */}
        <main className="lg:col-span-8 space-y-6">
          <div className="bg-[#12141d] border-2 border-white/20 rounded-3xl p-6 shadow-[6px_6px_0px_0px_#ef4444] space-y-6">
            {/* Journey Header */}
            <div className="flex items-center justify-between border-b-2 border-white/10 pb-4 flex-wrap gap-2">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-600 text-white rounded border border-black shadow">
                  Flow {currentJourney.num}
                </span>
                <h2 className="text-lg sm:text-xl font-display font-black uppercase text-white tracking-tight mt-1">
                  {currentJourney.title}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{currentJourney.desc}</p>
              </div>
              <span className="text-xs font-mono text-yellow-400 font-bold">
                Step {activeStepIndex + 1} of {currentJourney.steps.length}
              </span>
            </div>

            {/* Step Selector Horizontal Pills */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
              {currentJourney.steps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                    activeStepIndex === idx
                      ? "bg-yellow-400 text-black border-black shadow-[2px_2px_0px_0px_#ef4444]"
                      : "bg-[#08090e] text-gray-400 border-white/10 hover:text-white"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px] font-mono">
                    {idx + 1}
                  </span>
                  <span>{step.title.split(":")[0]}</span>
                </button>
              ))}
            </div>

            {/* Current Step View */}
            <div className="bg-[#08090e] border-2 border-white/20 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <h3 className="text-sm font-black text-white uppercase">{currentStep.title}</h3>
                  <span className="text-[10px] font-mono text-yellow-400">Live URL: {currentStep.url}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                  {currentStep.isInteractiveEditor ? "Interactive Editor Workbench" : "Actual Screenshot View"}
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                {currentStep.actionDescription}
              </p>

              {/* ========================================================================= */}
              {/* STEP 2 IN FLOW 3: FULL VISUAL PDF INNER EDITOR WORKBENCH */}
              {/* ========================================================================= */}
              {currentStep.isInteractiveEditor ? (
                <div className="bg-[#08090d] border-2 border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[480px]">
                  {/* Top Editor Navbar */}
                  <div className="bg-[#12141c] border-b border-white/10 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 select-none">
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
                        <p className="text-[9px] text-gray-400 font-mono">ID: doc-948a20e1 • SHA-256: e3b0c44298fc...</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow">
                        <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <span>Save Draft</span>
                      </button>

                      <button
                        onClick={() => setActiveStepIndex(2)}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-lg border border-black shadow-[2px_2px_0px_0px_#facc15] flex items-center gap-1.5"
                      >
                        <span>Send for Signature →</span>
                      </button>
                    </div>
                  </div>

                  {/* Editor Body: Left Palette + Center PDF Canvas + Right Inspector */}
                  <div className="flex flex-1 overflow-hidden relative">
                    {/* Left Sidebar Palette */}
                    {editorSidebarOpen && (
                      <aside className="w-60 bg-[#12141c] border-r border-white/10 p-3 space-y-3 shrink-0 flex flex-col justify-between select-none">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-white/10">
                            <h4 className="text-white font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              Field Tools
                            </h4>
                            <span className="text-[9px] font-mono text-gray-400">Click to Drop</span>
                          </div>

                          {/* Palette Items */}
                          <div className="space-y-1">
                            {[
                              { type: "signature", label: "Signature", desc: "Draw or cursive e-sign", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: "✍️" },
                              { type: "initials", label: "Initials", desc: "Compact initials stamp", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/30", icon: "🔤" },
                              { type: "text", label: "Text Field", desc: "Custom fillable text", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: "📝" },
                              { type: "date", label: "Date Field", desc: "Auto-fill date / calendar", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: "📅" },
                              { type: "checkbox", label: "Checkbox", desc: "Mandatory/optional check", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: "☑️" },
                            ].map((tool) => (
                              <button
                                key={tool.type}
                                onClick={() => addEditorField(tool.type)}
                                className="group w-full p-2 bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-yellow-400 rounded-xl text-left transition-all flex items-center justify-between shadow-sm"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border font-bold text-xs ${tool.bg} ${tool.color}`}>
                                    {tool.icon}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors">
                                      {tool.label}
                                    </p>
                                    <p className="text-[8px] text-gray-400">{tool.desc}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-gray-500 group-hover:text-white transition-colors">
                                  +
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Fields Counter */}
                        <div className="p-2 bg-[#090a0f] rounded-xl border border-white/10 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-gray-400">Placed Fields:</span>
                            <span className="text-yellow-400 font-mono">{editorFields.length}</span>
                          </div>
                          <div className="text-[8px] text-gray-500 font-mono">72 DPI Normalized Grid</div>
                        </div>
                      </aside>
                    )}

                    {/* Center PDF Canvas Viewport */}
                    <main className="flex-1 bg-[#08090d] p-3 flex flex-col items-center justify-start overflow-y-auto space-y-2">
                      {/* Controls toolbar */}
                      <div className="w-full max-w-lg bg-[#13151f] border border-white/10 px-3 py-1 rounded-xl flex items-center justify-between text-xs select-none">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditorPage((p) => Math.max(1, p - 1))}
                            className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-[10px] font-bold"
                          >
                            ‹ Prev
                          </button>
                          <span className="text-[10px] font-mono text-gray-300">
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
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
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
                        className="relative bg-white text-black w-full max-w-lg min-h-[300px] p-5 rounded-lg shadow-2xl border border-slate-300 cursor-crosshair select-none"
                      >
                        {/* Live Crosshair HUD */}
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/90 text-yellow-400 text-[9px] font-mono rounded border border-white/20 shadow z-10">
                          Crosshair: X:{crosshair.x}px • Y:{crosshair.y}px
                        </div>

                        {/* Contract Header */}
                        <div className="border-b-2 border-slate-200 pb-2 mb-3 text-center">
                          <h4 className="text-xs font-serif font-black uppercase text-slate-800 tracking-wider">
                            EXECUTIVE CONSULTING SERVICES AGREEMENT
                          </h4>
                          <p className="text-[8px] text-slate-500 font-mono">CONTRACT REF #2026-MSA-0091</p>
                        </div>

                        <p className="text-[9px] font-serif text-slate-600 leading-relaxed mb-2">
                          1. <strong>Scope of Services:</strong> The Contractor shall deliver professional advisory services.
                        </p>
                        <p className="text-[9px] font-serif text-slate-600 leading-relaxed mb-4">
                          2. <strong>Execution & Delivery:</strong> This instrument is executed with statutory electronic signatures.
                        </p>

                        {/* Placed Interactive Fields */}
                        <div className="space-y-2 pt-1">
                          {editorFields.map((f) => (
                            <div
                              key={f.id}
                              onClick={() => setActiveFieldId(f.id)}
                              className={`p-2 rounded-lg border-2 border-dashed bg-slate-50 flex items-center justify-between text-[10px] font-bold shadow-sm transition-all cursor-pointer ${
                                activeFieldId === f.id ? "ring-2 ring-yellow-400 scale-[1.01]" : ""
                              }`}
                              style={{ borderColor: f.color }}
                            >
                              <div className="flex items-center space-x-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                                <span style={{ color: f.color }}>{f.label} — <span className="text-slate-600 font-normal">{f.role}</span></span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeEditorField(f.id);
                                }}
                                className="text-red-500 hover:text-red-700 font-black text-xs ml-2 px-1"
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
              ) : (
                /* Actual Screenshot Frame */
                <div className="border-2 border-white/20 rounded-xl overflow-hidden shadow-2xl bg-black relative group">
                  <div className="bg-[#171926] px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="ml-2 text-gray-300">http://localhost:5173{currentStep.url}</span>
                    </div>
                    <span className="text-yellow-400 font-bold">LIVE CAPTURE</span>
                  </div>

                  <img
                    src={currentStep.screenshot}
                    alt={currentStep.title}
                    className="w-full h-auto object-cover max-h-[420px] rounded-b-lg opacity-95 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              )}

              {/* Biology-Diagram Style Callout Legend Box */}
              <div className="p-4 bg-[#12141d] border-2 border-white/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-black uppercase text-yellow-400 font-display flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Diagrammatic Element Labels & Actions
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">Biology-Style Leader Breakdown</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {currentStep.callouts.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[#08090e] border-l-4 border-yellow-400 rounded-r-xl space-y-1 font-mono text-xs"
                    >
                      <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
                        <span>───►</span>
                        <span className="w-4 h-4 rounded-full bg-yellow-400 text-black font-black text-[9px] flex items-center justify-center">
                          {c.pin}
                        </span>
                        <span className="text-white uppercase font-black">{c.title}</span>
                      </div>
                      <p className="text-[11px] text-gray-300 font-sans leading-relaxed pl-5">
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeStepIndex === 0}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase border transition-all ${
                    activeStepIndex === 0
                      ? "opacity-40 cursor-not-allowed bg-[#08090e] border-white/10 text-gray-500"
                      : "bg-[#171926] text-white border-white/20 hover:bg-white/10"
                  }`}
                >
                  ← Previous Step
                </button>

                <button
                  onClick={() => setActiveStepIndex((prev) => Math.min(currentJourney.steps.length - 1, prev + 1))}
                  disabled={activeStepIndex === currentJourney.steps.length - 1}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${
                    activeStepIndex === currentJourney.steps.length - 1
                      ? "opacity-40 cursor-not-allowed bg-[#08090e] border-white/10 text-gray-500"
                      : "bg-yellow-400 hover:bg-yellow-300 text-black border-black shadow-[2px_2px_0px_0px_#ef4444]"
                  }`}
                >
                  Next Step in Journey →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
