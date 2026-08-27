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
        <div style={styles.badge}>🛡️ PUBLIC DOCUMENT VERIFICATION PORTAL</div>
        <h1 style={styles.title}>Verify Document Integrity</h1>
        <p style={styles.subtitle}>
          Upload an executed PDF agreement or paste its SHA-256 cryptographic hash to test its legal authenticity against the Signaturly Pro immutable ledger.
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
              {file ? `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : "📁 Click or drag PDF contract here to verify"}
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
            {loading ? "Computing SHA-256 Digest & Ledger Lookup..." : "🔍 Verify Document Authenticity"}
          </button>
        </form>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {result && (
          <div style={styles.resultContainer}>
            <div style={result.isAuthentic ? styles.successHeader : styles.failureHeader}>
              <div style={{ fontSize: "28px", marginRight: "12px" }}>
                {result.isAuthentic ? "✅" : "⚠️"}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>
                  {result.isAuthentic ? "Document Authenticity Verified" : "Document Verification Failed / Tampered"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.8 }}>
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
              <div style={{ marginTop: "20px" }}>
                <h4 style={styles.sectionHeader}>Authenticated Signers Attribution</h4>
                <div style={styles.signersList}>
                  {result.signers.map((s, i) => (
                    <div key={i} style={styles.signerCard}>
                      <div>
                        <strong style={{ color: "#fff" }}>{s.name}</strong> ({s.email})
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                        IP: {s.ipAddress} | Auth: {s.authMethod} | Status: {s.status?.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.legalFooter}>
              {result.legalStanding}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#08090d",
    color: "#e5e7eb",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    textAlign: "center",
    maxWidth: "700px",
    margin: "0 auto 30px auto",
  },
  badge: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    padding: "6px 14px",
    borderRadius: "20px",
    display: "inline-block",
    marginBottom: "12px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "0 0 10px 0",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#9ca3af",
    lineHeight: "1.6",
  },
  card: {
    maxWidth: "750px",
    margin: "0 auto",
    backgroundColor: "#12141c",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
  },
  dropzone: {
    border: "2px dashed rgba(239, 68, 68, 0.4)",
    borderRadius: "14px",
    padding: "30px",
    textAlign: "center",
    backgroundColor: "rgba(239, 68, 68, 0.02)",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  fileInput: {
    display: "none",
  },
  fileLabel: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#fca5a5",
    cursor: "pointer",
  },
  divider: {
    textAlign: "center",
    margin: "20px 0",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: "6px",
  },
  textInput: {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "#08090d",
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
    marginTop: "20px",
    padding: "14px",
    background: "linear-gradient(135deg, #dc2626, #991b1b)",
    border: "none",
    borderRadius: "12px",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(220, 38, 38, 0.4)",
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
    marginTop: "30px",
    paddingTop: "24px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  successHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: "12px",
    padding: "16px 20px",
    color: "#34d399",
  },
  failureHeader: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "12px",
    padding: "16px 20px",
    color: "#f87171",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "20px",
  },
  metaItem: {
    backgroundColor: "#08090d",
    padding: "12px",
    borderRadius: "8px",
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
    fontSize: "13px",
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    margin: "0 0 10px 0",
  },
  signersList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  signerCard: {
    backgroundColor: "#08090d",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.06)",
    fontSize: "13px",
  },
  legalFooter: {
    marginTop: "20px",
    padding: "12px",
    backgroundColor: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "#9ca3af",
    lineHeight: "1.4",
    textAlign: "center",
  },
};
