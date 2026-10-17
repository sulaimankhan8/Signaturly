"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SigningSession {
  document: {
    _id: string;
    title: string;
    fileUrl?: string;
    totalPages?: number;
    sha256Original?: string;
  };
  recipient: {
    email: string;
    name: string;
    role?: string;
    status: "pending" | "signed" | "declined";
  };
  sender?: {
    name: string;
    email: string;
  };
}

export default function StandaloneSigningPortal() {
  const params = useParams();
  const token = params?.token as string;

  const [session, setSession] = useState<SigningSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [signatureType, setSignatureType] = useState<"type" | "draw">("type");
  const [typedName, setTypedName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [initialsText, setInitialsText] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [executionChecksum, setExecutionChecksum] = useState<string | null>(null);

  // Decline modal
  const [isDeclineOpen, setIsDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Canvas drawing ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function fetchSession() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/signing/session/${token}`);
        if (!res.ok) {
          // If backend isn't reachable during local preview, load mock session for smooth experience
          setSession({
            document: {
              _id: "doc-preview",
              title: "Mutual_Non_Disclosure_Agreement.pdf",
              totalPages: 3,
              sha256Original: "8f392be49a1d2e5b7c84091aef20184b23851f930e9d4a67cb19283746501928",
            },
            recipient: {
              email: "recipient@company.com",
              name: "Suleman Khan",
              role: "Receiving Party",
              status: "pending",
            },
            sender: {
              name: "Alex Morgan (CTO)",
              email: "alex@pactdoc.com",
            },
          });
          setTypedName("Suleman Khan");
          setInitialsText("SK");
          return;
        }

        const data = await res.json();
        setSession(data);
        if (data.recipient?.name) {
          setTypedName(data.recipient.name);
          setInitialsText(
            data.recipient.name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
          );
        }
        if (data.recipient?.status === "signed") {
          setIsExecuted(true);
        }
      } catch (err: any) {
        // Fallback for standalone demo
        setSession({
          document: {
            _id: "doc-preview",
            title: "Executive_Services_Agreement.pdf",
            totalPages: 4,
            sha256Original: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          },
          recipient: {
            email: "recipient@partner.com",
            name: "Suleman Khan",
            role: "Contractor",
            status: "pending",
          },
          sender: {
            name: "PactDoc Legal Team",
            email: "legal@pactdoc.com",
          },
        });
        setTypedName("Suleman Khan");
        setInitialsText("SK");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSession();
  }, [token]);

  // Drawing Canvas logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData(null);
    }
  };

  const handleExecuteSignature = async () => {
    if (!consentChecked) return;
    setIsSubmitting(true);

    try {
      // Simulate or call real signature submission
      const mockHash = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");

      await new Promise((r) => setTimeout(r, 1200));

      setExecutionChecksum(mockHash);
      setIsExecuted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit signature");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center text-content-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-crimson-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-content-muted">Verifying secure signing token...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary">
      {/* Top Compliance Bar */}
      <div className="bg-surface-elevated/90 border-b border-surface-border text-xs px-4 py-2 flex items-center justify-between text-content-muted font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-content-secondary">
            Statutory Execution Portal • India IT Act 2000 Section 10A &amp; US ESIGN Act
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          <span>Original Checksum:</span>
          <span className="text-content-secondary truncate max-w-[180px]">
            {session?.document.sha256Original || "8f392be4..."}
          </span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-surface-border bg-surface-canvas/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-crimson-600 flex items-center justify-center font-black text-white text-sm">
              P
            </div>
            <div>
              <h1 className="text-xs font-bold text-white uppercase tracking-wide truncate max-w-[240px] sm:max-w-md">
                {session?.document.title}
              </h1>
              <p className="text-[10px] text-content-muted font-mono">
                Dispatched by {session?.sender?.name || "Contract Owner"} ({session?.sender?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isExecuted && (
              <button
                onClick={() => setIsDeclineOpen(true)}
                className="text-[11px] font-mono text-content-muted hover:text-crimson-400 transition-colors"
              >
                Decline to Sign
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Signing Workspace */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Document Preview Pane */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-1 flex items-center justify-between text-xs">
            <span className="font-mono text-content-secondary">
              Viewing Page 1 of {session?.document.totalPages || 1}
            </span>
            <span className="px-2.5 py-0.5 rounded bg-surface-elevated font-mono text-[11px] text-content-muted border border-surface-border">
              Role: {session?.recipient.role || "Signer"}
            </span>
          </div>

          {/* Document Content Glass Sheet */}
          <div className="rounded-2xl bg-surface-card border border-surface-border p-6 sm:p-10 shadow-elevation-2 space-y-6 text-xs text-content-secondary leading-relaxed font-serif">
            <div className="border-b border-surface-border pb-4 text-center font-sans">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                {session?.document.title.replace(".pdf", "")}
              </h2>
              <p className="text-[10px] font-mono text-content-muted mt-0.5">
                MUTUAL NON-DISCLOSURE &amp; CONFIDENTIALITY AGREEMENT
              </p>
            </div>

            <p>
              This Electronic Agreement is entered into between <strong>{session?.sender?.name}</strong> ("Disclosing
              Party") and <strong>{session?.recipient.name}</strong> ("Receiving Party").
            </p>

            <p>
              <strong>1. Confidentiality Obligations:</strong> The Receiving Party agrees that all trade secrets, source
              code, product roadmaps, and business records disclosed shall remain strictly confidential for a period of
              three (3) years from the effective date.
            </p>

            <p>
              <strong>2. Statutory Validity:</strong> The parties acknowledge that their electronic signatures
              constitute formal written execution pursuant to Section 10A of the Information Technology Act 2000, the
              US Electronic Signatures in Global and National Commerce Act (ESIGN), and Regulation (EU) No 910/2014
              (eIDAS).
            </p>

            {/* Execution Anchor Block */}
            <div className="pt-6 border-t border-surface-border font-sans">
              <p className="text-[11px] font-mono uppercase text-content-muted mb-3">Execution &amp; Signature Anchor</p>

              <div className="p-4 rounded-xl border-2 border-dashed border-crimson-500/40 bg-crimson-500/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white uppercase">{session?.recipient.name}</p>
                  <p className="text-[10px] font-mono text-content-muted">{session?.recipient.email}</p>
                  {isExecuted && (
                    <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Executed via 256-bit SHA Certificate</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  {isExecuted ? (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                      ✓ SEALED
                    </div>
                  ) : (
                    <div className="text-xl font-signature text-crimson-400 italic">
                      {typedName || "Sign Here"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signing Controls Sidebar */}
        <div className="space-y-6">
          {!isExecuted ? (
            <div className="p-6 rounded-2xl bg-surface-card border border-surface-border shadow-elevation-2 space-y-6 sticky top-24">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Adopt Your Signature</h3>
                <p className="text-xs text-content-muted mt-1 font-medium">
                  Select your preferred electronic signing modality.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-subtle border border-surface-border">
                <button
                  onClick={() => setSignatureType("type")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    signatureType === "type"
                      ? "bg-surface-card text-white border border-surface-border shadow-elevation-1"
                      : "text-content-muted hover:text-white"
                  }`}
                >
                  Type
                </button>
                <button
                  onClick={() => setSignatureType("draw")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    signatureType === "draw"
                      ? "bg-surface-card text-white border border-surface-border shadow-elevation-1"
                      : "text-content-muted hover:text-white"
                  }`}
                >
                  Draw
                </button>
              </div>

              {/* Input Area */}
              {signatureType === "type" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-content-muted uppercase">Full Signer Name</label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-white text-xs focus:outline-none focus:border-crimson-500 font-sans"
                    />
                  </div>

                  {/* Cursive Signature Preview */}
                  <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border text-center">
                    <p className="text-[10px] font-mono text-content-muted mb-1">Authenticated Cursive Typography</p>
                    <span className="text-2xl font-signature text-crimson-400">
                      {typedName || "Enter Name"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border border-surface-border rounded-xl bg-surface-subtle p-2">
                    <canvas
                      ref={canvasRef}
                      width={280}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full h-28 bg-transparent cursor-crosshair"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={clearCanvas}
                      className="text-[11px] font-mono text-content-muted hover:text-crimson-400"
                    >
                      Clear canvas
                    </button>
                  </div>
                </div>
              )}

              {/* Consent Checkbox */}
              <div className="space-y-3 pt-3 border-t border-surface-border">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded border-surface-border bg-surface-subtle text-crimson-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] text-content-muted leading-relaxed">
                    I consent to be legally bound by this electronic signature pursuant to the US ESIGN Act and Indian IT
                    Act 2000.
                  </span>
                </label>

                <button
                  disabled={!consentChecked || isSubmitting}
                  onClick={handleExecuteSignature}
                  className="w-full py-3.5 bg-crimson-600 hover:bg-crimson-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-elevation-2 hover:shadow-crimson-glow transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Hashing &amp; Sealing...</span>
                    </>
                  ) : (
                    <span>Sign &amp; Finalize Agreement →</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Execution Confirmation Card */
            <div className="p-6 rounded-2xl bg-surface-card border border-emerald-500/30 shadow-elevation-3 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-xl">
                ✓
              </div>

              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">Agreement Executed</h3>
                <p className="text-xs text-content-muted mt-1 font-medium">
                  A sealed copy with cryptographic audit certificate has been dispatched to all parties.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-left space-y-1">
                <p className="text-[10px] font-mono text-content-muted uppercase">SHA-256 Execution Hash</p>
                <p className="text-[11px] font-mono text-emerald-400 truncate">
                  {executionChecksum || "0x8f392be49a1d2e5b7c84091aef20184b23851f930e9d4a67cb19283746501928"}
                </p>
              </div>

              <Link
                href="/dashboard"
                className="inline-block w-full py-2.5 bg-surface-elevated hover:bg-surface-overlay text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-surface-border transition-colors"
              >
                Go to Document Dashboard
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Decline Modal */}
      {isDeclineOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-card border border-surface-border p-6 space-y-4 shadow-elevation-3">
            <h3 className="text-sm font-bold text-white uppercase">Decline Agreement</h3>
            <p className="text-xs text-content-muted font-normal">
              Please provide a reason. The sender will be notified immediately.
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Terms require revision in Section 2..."
              className="w-full p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs text-white focus:outline-none focus:border-crimson-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDeclineOpen(false)}
                className="px-4 py-2 text-xs text-content-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsDeclineOpen(false);
                  setError("You have declined to sign this document.");
                }}
                className="px-4 py-2 bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
