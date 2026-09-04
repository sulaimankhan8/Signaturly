import React, { useState, useEffect } from "react";
import API from "../api/axios";

export function OtpVerificationModal({
  token,
  recipientEmail,
  documentTitle,
  authType = "otp",
  onVerified,
}) {
  const isPasscode = authType === "passcode";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      setLoading(true);
      setError(null);
      await API.post("/sign/otp/send", { token });
      setSentMessage(`Verification code sent to ${recipientEmail}`);
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(isPasscode ? "Please enter the document access passcode." : "Please enter the 6-digit verification code.");
      return;
    }

    if (!isPasscode && code.trim().length !== 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isPasscode) {
        const res = await API.post("/sign/otp/verify-passcode", { token, passcode: code.trim() });
        if (res.data?.success || res.status === 200) {
          onVerified();
        }
      } else {
        const res = await API.post("/sign/otp/verify", { token, otp: code.trim() });
        if (res.data?.success || res.status === 200) {
          onVerified();
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (isPasscode ? "Invalid access passcode. Please check with the sender." : "Verification failed. Check your code.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 selection:bg-red-600 selection:text-white">
      <div className="bg-[#111420] border border-red-500/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-gray-200 font-sans">
        
        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full uppercase">
          <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{isPasscode ? "Passcode Protected Document" : "Pre-Sign 2FA Authentication"}</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
            {isPasscode ? "Enter Access Passcode" : "Identity Verification Required"}
          </h2>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {isPasscode
              ? `The sender has protected "${documentTitle || "this document"}" with a private access code.`
              : `To comply with digital signature verification standards, verify your email before opening "${documentTitle || "this document"}".`}
          </p>
        </div>

        {sentMessage && (
          <div className="flex items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-2.5 rounded-xl text-xs">
            <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{sentMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-xl text-xs">
            <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
              Signer Email
            </label>
            <input
              type="text"
              value={recipientEmail || ""}
              disabled
              className="w-full px-3.5 py-2.5 bg-[#090b12] border border-white/10 rounded-xl text-gray-400 text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
              {isPasscode ? "Document Passcode" : "6-Digit Verification Code"}
            </label>
            {isPasscode ? (
              <input
                type="password"
                placeholder="Enter passcode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-[#090b12] border border-white/20 focus:border-red-500 rounded-xl text-white text-sm outline-none transition-colors"
              />
            ) : (
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="w-full px-4 py-3 bg-[#090b12] border border-red-500/40 focus:border-red-500 rounded-xl text-white text-2xl font-bold tracking-[8px] text-center outline-none shadow-lg shadow-red-950/20"
              />
            )}
          </div>

          <div className="flex gap-2.5 pt-2">
            {!isPasscode && (
              <button
                type="button"
                onClick={handleSendCode}
                disabled={loading || countdown > 0}
                className="flex-1 py-3 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 rounded-xl text-xs font-semibold transition-colors"
              >
                {loading
                  ? "Sending..."
                  : countdown > 0
                  ? `Resend (${countdown}s)`
                  : "Request Code"}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || (!isPasscode && code.length !== 6) || (isPasscode && !code.trim())}
              className={`${
                isPasscode ? "w-full" : "flex-[2]"
              } py-3 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all flex items-center justify-center gap-1.5`}
            >
              <span>{loading ? "Verifying..." : "Verify & Unlock Canvas"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-white/5 text-[10px] text-gray-500 text-center">
          Statutory Compliance Notice: Cryptographic verification log is timestamped and recorded in the audit trail.
        </div>
      </div>
    </div>
  );
}
