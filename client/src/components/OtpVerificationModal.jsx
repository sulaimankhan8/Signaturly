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
      setError("Please enter the full 6-digit code.");
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
        <div style={styles.headerBadge}>🔐 PRE-SIGN IDENTITY AUTHENTICATION</div>
        <h2 style={styles.title}>Identity Verification Required</h2>
        <p style={styles.subtitle}>
          To protect document integrity under Section 10A of the IT Act, please verify your email identity before reviewing{" "}
          <strong style={{ color: "#fff" }}>{documentTitle || "this document"}</strong>.
        </p>

        {sentMessage && <div style={styles.successBox}>{sentMessage}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleVerify} style={{ width: "100%", marginTop: "16px" }}>
          <label style={styles.label}>Recipient Email</label>
          <input type="text" value={recipientEmail || ""} disabled style={styles.disabledInput} />

          <label style={styles.label}>Enter 6-Digit Verification Code</label>
          <input
            type="text"
            maxLength={6}
            placeholder="e.g. 849201"
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
              {loading ? "Verifying..." : "Verify & Unlock Canvas →"}
            </button>
          </div>
        </form>

        <div style={styles.legalNotice}>
          Statutory Compliance Notice: Excludes statutory non-SES documents (Wills, Power of Attorney, Trust Deeds, Real Estate Deeds).
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(5, 6, 10, 0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modalCard: {
    backgroundColor: "#12151e",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "18px",
    padding: "32px",
    maxWidth: "460px",
    width: "100%",
    boxShadow: "0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(239,68,68,0.15)",
    color: "#e5e7eb",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  headerBadge: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#f87171",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block",
    marginBottom: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "13px",
    color: "#9ca3af",
    lineHeight: "1.5",
    margin: 0,
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginTop: "16px",
    marginBottom: "6px",
  },
  disabledInput: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#090a0f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    color: "#9ca3af",
    fontSize: "14px",
    outline: "none",
  },
  otpInput: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#090a0f",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "800",
    letterSpacing: "8px",
    textAlign: "center",
    outline: "none",
    boxShadow: "0 0 15px rgba(239, 68, 68, 0.1)",
  },
  btnRow: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
  },
  resendBtn: {
    flex: 1,
    padding: "12px",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    color: "#d1d5db",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
  },
  verifyBtn: {
    flex: 2,
    padding: "12px",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    border: "none",
    borderRadius: "10px",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    boxShadow: "0 4px 15px rgba(220, 38, 38, 0.4)",
  },
  successBox: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    color: "#34d399",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "12px",
    marginTop: "12px",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#f87171",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "12px",
    marginTop: "12px",
  },
  legalNotice: {
    marginTop: "20px",
    paddingTop: "14px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: "10px",
    color: "#6b7280",
    lineHeight: "1.4",
    textAlign: "center",
  },
};
