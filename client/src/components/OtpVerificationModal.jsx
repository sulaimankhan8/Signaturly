import React, { useState } from "react";
import axios from "axios";

export function OtpVerificationModal({ token, recipientEmail, documentTitle, onVerified }) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);

  const handleSendCode = async () => {
    try {
      setLoading(true);
      setError(null);
      await axios.post("/api/sign/otp/send", { token });
      setSentMessage(`Verification code sent to ${recipientEmail}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.post("/api/sign/otp/verify", { token, otp: otp.trim() });
      if (res.data.success) {
        onVerified();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed. Check your code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        {/* Header Badge */}
        <div style={styles.headerBadge}>
          <svg style={styles.badgeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>PRE-SIGN IDENTITY AUTHENTICATION</span>
        </div>

        <h2 style={styles.title}>Identity Verification Required</h2>
        <p style={styles.subtitle}>
          To enforce non-repudiation and legal compliance under Section 10A of the IT Act, verify your email before opening{" "}
          <strong style={{ color: "#ffffff" }}>{documentTitle || "this document"}</strong>.
        </p>

        {sentMessage && (
          <div style={styles.successBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8, flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{sentMessage}</span>
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} style={{ width: "100%", marginTop: "18px" }}>
          <label style={styles.label}>Recipient Email</label>
          <div style={styles.inputWrapper}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={styles.inputIcon}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <input type="text" value={recipientEmail || ""} disabled style={styles.disabledInput} />
          </div>

          <label style={styles.label}>6-Digit Security Code</label>
          <input
            type="text"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            style={styles.otpInput}
            autoFocus
          />

          <div style={styles.btnRow}>
            <button type="button" onClick={handleSendCode} disabled={loading} style={styles.resendBtn}>
              {loading ? "Sending..." : "Request Code"}
            </button>
            <button type="submit" disabled={loading || otp.length !== 6} style={styles.verifyBtn}>
              {loading ? "Verifying..." : "Verify & Unlock Canvas"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 6 }}>
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>

        <div style={styles.legalNotice}>
          Statutory Compliance Notice: Excludes non-SES documents (Wills, Power of Attorney, Trust Deeds, Real Estate Deeds).
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(6, 8, 14, 0.88)",
    backdropFilter: "blur(14px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modalCard: {
    backgroundColor: "#111420",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "20px",
    padding: "36px",
    maxWidth: "460px",
    width: "100%",
    boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(239, 68, 68, 0.12)",
    color: "#e5e7eb",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#f87171",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    padding: "5px 12px",
    borderRadius: "20px",
    marginBottom: "16px",
  },
  badgeIcon: {
    width: "12px",
    height: "12px",
    color: "#f87171",
  },
  title: {
    fontSize: "23px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 8px 0",
    letterSpacing: "-0.4px",
  },
  subtitle: {
    fontSize: "13px",
    color: "#9ca3af",
    lineHeight: "1.55",
    margin: 0,
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#9ca3af",
    marginTop: "18px",
    marginBottom: "6px",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
  },
  disabledInput: {
    width: "100%",
    padding: "12px 14px 12px 40px",
    backgroundColor: "#090b12",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#9ca3af",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  otpInput: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#090b12",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "12px",
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "800",
    letterSpacing: "8px",
    textAlign: "center",
    outline: "none",
    boxShadow: "0 0 20px rgba(239, 68, 68, 0.12)",
    boxSizing: "border-box",
  },
  btnRow: {
    display: "flex",
    gap: "10px",
    marginTop: "22px",
  },
  resendBtn: {
    flex: 1,
    padding: "13px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#d1d5db",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    transition: "background-color 0.2s ease",
  },
  verifyBtn: {
    flex: 2,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13.5px",
    boxShadow: "0 4px 18px rgba(220, 38, 38, 0.45)",
    transition: "opacity 0.2s ease",
  },
  successBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    color: "#34d399",
    padding: "12px 14px",
    borderRadius: "10px",
    fontSize: "12.5px",
    marginTop: "14px",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    color: "#f87171",
    padding: "12px 14px",
    borderRadius: "10px",
    fontSize: "12.5px",
    marginTop: "14px",
  },
  legalNotice: {
    marginTop: "22px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: "10px",
    color: "#6b7280",
    lineHeight: "1.45",
    textAlign: "center",
  },
};
