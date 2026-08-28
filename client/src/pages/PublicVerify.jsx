import React, { useState } from "react";
import axios from "axios";

export default function PublicVerify() {
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!file && !hash.trim()) {
      setError("Please select a PDF file or paste a SHA-256 hash string.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("hash", hash.trim());
      }

      const res = await axios.post("/api/verify/document", formData, {
        headers: file ? { "Content-Type": "multipart/form-data" } : {},
      });

      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Document verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.badge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          PUBLIC DOCUMENT VERIFICATION PORTAL
        </div>
        <h1 style={styles.title}>Verify Document Integrity</h1>
        <p style={styles.subtitle}>
          Upload an executed PDF contract or paste its SHA-256 hash to test its legal authenticity against the Signaturly Pro immutable ledger.
        </p>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleVerify}>
          <div style={styles.dropzone}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              style={styles.fileInput}
              id="pdfUpload"
            />
            <label htmlFor="pdfUpload" style={styles.fileLabel}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" style={{ marginBottom: 10 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="12" y2="12" />
                <line x1="15" y1="15" x2="12" y2="12" />
              </svg>
              <div>{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : "Click or drag PDF contract here to verify"}</div>
            </label>
          </div>

          <div style={styles.divider}>OR</div>

          <label style={styles.label}>SHA-256 Cryptographic Digest String</label>
          <input
            type="text"
            placeholder="e.g. a3f8c8d9e2b10459a..."
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            style={styles.textInput}
          />

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {loading ? "Computing SHA-256 Digest & Ledger Lookup..." : "Verify Document Authenticity"}
          </button>
        </form>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {result && (
          <div style={styles.resultContainer}>
            <div style={result.isAuthentic ? styles.successHeader : styles.failureHeader}>
              <div style={styles.iconContainer}>
                {result.isAuthentic ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>
                  {result.isAuthentic ? "Document Authenticity Verified" : "Document Verification Failed / Tampered"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", opacity: 0.85 }}>
                  {result.isAuthentic
                    ? "The cryptographic hash matches an executed contract in our immutable ledger and the Merkle chain is intact."
                    : result.reason || "Hash mismatch or unrecognized document."}
                </p>
              </div>
            </div>

            {result.documentTitle && (
              <div style={styles.metaGrid}>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Document Title</span>
                  <span style={styles.metaVal}>{result.documentTitle}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Status</span>
                  <span style={styles.metaVal}>{result.status?.toUpperCase()}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Executed At</span>
                  <span style={styles.metaVal}>{result.executedAt ? new Date(result.executedAt).toLocaleString() : "N/A"}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>SHA-256 Executed Hash</span>
                  <span style={styles.hashVal}>{result.signedHash}</span>
                </div>
              </div>
            )}

            {result.signers && result.signers.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <h4 style={styles.sectionHeader}>Authenticated Signers Attribution</h4>
                <div style={styles.signersList}>
                  {result.signers.map((s, i) => (
                    <div key={i} style={styles.signerCard}>
                      <div style={{ fontWeight: "600", color: "#ffffff" }}>
                        {s.name} <span style={{ color: "#9ca3af", fontWeight: "normal" }}>({s.email})</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                        IP: {s.ipAddress} | Auth: {s.authMethod} | Status: {s.status?.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.legalFooter}>{result.legalStanding}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#080a0f",
    color: "#e5e7eb",
    padding: "50px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    textAlign: "center",
    maxWidth: "700px",
    margin: "0 auto 36px auto",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10.5px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    padding: "6px 14px",
    borderRadius: "20px",
    marginBottom: "14px",
  },
  title: {
    fontSize: "34px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "0 0 12px 0",
    letterSpacing: "-0.6px",
  },
  subtitle: {
    fontSize: "14.5px",
    color: "#9ca3af",
    lineHeight: "1.6",
    margin: 0,
  },
  card: {
    maxWidth: "750px",
    margin: "0 auto",
    backgroundColor: "#111420",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "22px",
    padding: "36px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
  },
  dropzone: {
    border: "2px dashed rgba(239, 68, 68, 0.35)",
    borderRadius: "16px",
    padding: "36px 20px",
    textAlign: "center",
    backgroundColor: "rgba(239, 68, 68, 0.02)",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  fileInput: {
    display: "none",
  },
  fileLabel: {
    fontSize: "14.5px",
    fontWeight: "600",
    color: "#fca5a5",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  divider: {
    textAlign: "center",
    margin: "24px 0",
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "#9ca3af",
    marginBottom: "8px",
  },
  textInput: {
    width: "100%",
    padding: "13px 16px",
    backgroundColor: "#080a0f",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    color: "#ffffff",
    fontSize: "13px",
    fontFamily: "monospace",
    outline: "none",
    boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%",
    marginTop: "24px",
    padding: "15px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 22px rgba(220, 38, 38, 0.45)",
    transition: "opacity 0.2s ease",
  },
  errorBanner: {
    marginTop: "20px",
    padding: "14px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "10px",
    color: "#f87171",
    fontSize: "13px",
  },
  resultContainer: {
    marginTop: "32px",
    paddingTop: "28px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  iconContainer: {
    marginRight: "14px",
    display: "flex",
    alignItems: "center",
  },
  successHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "14px",
    padding: "18px 22px",
    color: "#34d399",
  },
  failureHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "14px",
    padding: "18px 22px",
    color: "#f87171",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "22px",
  },
  metaItem: {
    backgroundColor: "#080a0f",
    padding: "14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  metaLabel: {
    display: "block",
    fontSize: "10px",
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  metaVal: {
    fontSize: "13px",
    color: "#ffffff",
    fontWeight: "600",
    marginTop: "4px",
    display: "block",
  },
  hashVal: {
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#f87171",
    wordBreak: "break-all",
    marginTop: "4px",
    display: "block",
  },
  sectionHeader: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: "0 0 12px 0",
  },
  signersList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  signerCard: {
    backgroundColor: "#080a0f",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.06)",
    fontSize: "13px",
  },
  legalFooter: {
    marginTop: "24px",
    padding: "14px",
    backgroundColor: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#9ca3af",
    lineHeight: "1.45",
    textAlign: "center",
  },
};
