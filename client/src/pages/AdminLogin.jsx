import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminSecret, setAdminSecret] = useState("signaturly-superadmin-secret");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !password || !adminSecret) {
      setError("Please fill in all fields including the Admin Security Key.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.post("/api/admin/login", {
        email: email.trim(),
        password,
        adminSecret: adminSecret.trim(),
      });

      if (res.data.adminToken) {
        localStorage.setItem("signaturly_admin_token", res.data.adminToken);
        axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.adminToken}`;
        navigate("/admin/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Admin authentication failed. Verify credentials and Admin Security Key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <div style={styles.headerBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          ISOLATED SUPERADMIN PORTAL
        </div>

        <h1 style={styles.title}>Governance Admin Login</h1>
        <p style={styles.subtitle}>
          Restricted access for system administrators and compliance auditors. Isolated authentication pipeline.
        </p>

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

        <form onSubmit={handleAdminLogin} style={{ width: "100%", marginTop: "20px" }}>
          <label style={styles.label}>Admin Account Email</label>
          <input
            type="email"
            placeholder="admin@signaturly.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
            autoFocus
          />

          <label style={styles.label}>Password</label>
          <input
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Admin Security Key</label>
          <input
            type="password"
            placeholder="Enter Admin Secret Key"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            style={{ ...styles.input, borderColor: "rgba(239, 68, 68, 0.4)" }}
            required
          />

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Authenticating Admin Session..." : "Authenticate & Open Governance Portal →"}
          </button>
        </form>

        <div style={styles.footerNote}>
          🔒 Zero-Knowledge Security Policy Active • Sessions are logged & cryptographically signed.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#07080d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  },
  loginCard: {
    backgroundColor: "#10121b",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "22px",
    padding: "40px",
    maxWidth: "460px",
    width: "100%",
    boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(239, 68, 68, 0.15)",
    color: "#e5e7eb",
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10.5px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    padding: "5px 12px",
    borderRadius: "20px",
    marginBottom: "16px",
  },
  title: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "0 0 8px 0",
    letterSpacing: "-0.5px",
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
    marginTop: "16px",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    backgroundColor: "#07080d",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%",
    marginTop: "24px",
    padding: "15px",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "14.5px",
    cursor: "pointer",
    boxShadow: "0 4px 22px rgba(220, 38, 38, 0.45)",
    transition: "opacity 0.2s ease",
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
    marginTop: "16px",
  },
  footerNote: {
    marginTop: "24px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: "10.5px",
    color: "#6b7280",
    lineHeight: "1.45",
    textAlign: "center",
  },
};
