import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, getAdminBaseUrl } from "../api/admin.api.js";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    const adminToken = localStorage.getItem("signaturly_admin_token");

    if (!adminToken) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [statsRes, docsRes, logsRes] = await Promise.all([
        adminApi.get("/admin/stats"),
        adminApi.get("/admin/documents"),
        adminApi.get("/admin/audit-logs"),
      ]);

      setStats(statsRes.data.systemMetrics);
      setDocuments(docsRes.data.documents || []);
      setAuditLogs(logsRes.data.logs || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("signaturly_admin_token");
        navigate("/login");
        return;
      }
      setError(err.response?.data?.error || "Failed to load admin dashboard. Ensure you have Superadmin privileges.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("signaturly_admin_token");
    navigate("/login");
  };

  const handleDownloadBsaCert = (docId) => {
    const adminToken = localStorage.getItem("signaturly_admin_token");
    const baseUrl = getAdminBaseUrl();
    window.open(`${baseUrl}/admin/documents/${docId}/bsa-certificate?token=${adminToken}`, "_blank");
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "#9ca3af", marginTop: "18px", fontSize: "13px", fontWeight: "500" }}>
          Authenticating Superadmin Session & Loading Governance Ledger...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIconCircle}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 style={{ color: "#f87171", margin: "14px 0 0 0", fontSize: "20px", fontWeight: "700" }}>Superadmin Access Denied</h2>
        <p style={{ color: "#9ca3af", marginTop: "8px", maxWidth: "450px", fontSize: "13px", lineHeight: "1.5" }}>{error}</p>
        <button onClick={() => navigate("/login")} style={styles.loginBtn}>
          Return to Admin Login Portal →
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top Governance Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div style={styles.badge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            GOVERNANCE & COMPLIANCE ENGINE
          </div>
          <h1 style={styles.title}>Superadmin Dashboard</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="http://localhost:5173/verify"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "7px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "10px",
              color: "#f87171",
              fontSize: "12px",
              fontWeight: "700",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verify Ledger Portal ↗
          </a>

          <div style={styles.statusChip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" style={{ marginRight: 6 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Zero-Knowledge Session Active
          </div>

          <button onClick={handleAdminLogout} style={styles.logoutBtn}>
            Logout Admin
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardLabel}>Registered Users</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={styles.cardVal}>{stats.totalUsers}</div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardLabel}>Total Agreements</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={styles.cardVal}>{stats.totalDocuments}</div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardLabel}>Executed (Signed)</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div style={{ ...styles.cardVal, color: "#34d399" }}>{stats.executedDocuments}</div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardLabel}>Immutable Audit Events</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div style={{ ...styles.cardVal, color: "#fca5a5" }}>{stats.totalAuditEvents}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("overview")}
          style={activeTab === "overview" ? styles.activeTab : styles.tab}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          System Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          style={activeTab === "audit" ? styles.activeTab : styles.tab}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Cryptographic Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: System Documents Directory */}
      {activeTab === "overview" && (
        <div style={styles.tableCard}>
          <h3 style={styles.tableTitle}>Document Governance Directory</h3>
          <p style={styles.tableSubtitle}>
            Zero-Knowledge Policy: Admins can inspect execution state and issue Section 63 BSA evidence certificates, but cannot alter document content.
          </p>
          <div className="overflow-x-auto">
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Document Title</th>
                  <th style={styles.th}>Owner</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created Date</th>
                  <th style={styles.th}>Actions / Evidence</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc._id} style={styles.tr}>
                    <td style={styles.td}>
                      <strong style={{ color: "#ffffff" }}>{doc.originalFileName}</strong>
                      <div style={styles.subText}>ID: {doc._id}</div>
                    </td>
                    <td style={styles.td}>{doc.userId?.name || doc.userId?.email || "Unknown"}</td>
                    <td style={styles.td}>
                      <span style={doc.status === "signed" ? styles.statusSigned : styles.statusPending}>
                        {doc.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td style={styles.td}>
                      <button onClick={() => handleDownloadBsaCert(doc._id)} style={styles.certBtn}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export Sec 63 BSA Cert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Immutable Audit Chain */}
      {activeTab === "audit" && (
        <div style={styles.tableCard}>
          <h3 style={styles.tableTitle}>Immutable Audit Chain Ledger</h3>
          <p style={styles.tableSubtitle}>
            SHA-256 Merkle block hashes linked sequentially across all document lifecycle events.
          </p>
          <div className="overflow-x-auto">
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Event</th>
                  <th style={styles.th}>Actor</th>
                  <th style={styles.th}>IP Address</th>
                  <th style={styles.th}>SHA-256 Event Hash</th>
                  <th style={styles.th}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log._id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.eventBadge}>{log.event?.toUpperCase()}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ color: "#ffffff", fontWeight: "600" }}>{log.actorName || "System"}</div>
                      <div style={styles.subText}>{log.actorEmail}</div>
                    </td>
                    <td style={styles.td}>{log.ipAddress}</td>
                    <td style={styles.td}>
                      <div style={styles.monoHash}>{log.eventHash}</div>
                      <div style={styles.subText}>Prev: {log.previousEventHash?.substring(0, 16)}...</div>
                    </td>
                    <td style={styles.td}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#080a0f",
    color: "#e5e7eb",
    padding: "45px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    backgroundColor: "#080a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(239, 68, 68, 0.2)",
    borderTopColor: "#ef4444",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorContainer: {
    minHeight: "100vh",
    backgroundColor: "#080a0f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  errorIconCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtn: {
    marginTop: "20px",
    padding: "12px 24px",
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
  },
  logoutBtn: {
    padding: "8px 16px",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    color: "#d1d5db",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10.5px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#ef4444",
  },
  title: {
    fontSize: "30px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "6px 0 0 0",
    letterSpacing: "-0.5px",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    color: "#34d399",
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#111420",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "22px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  cardVal: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#ffffff",
    marginTop: "8px",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 20px",
    backgroundColor: "#111420",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#9ca3af",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.2s ease",
  },
  activeTab: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 20px",
    backgroundColor: "#991b1b",
    border: "1px solid #dc2626",
    borderRadius: "10px",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13px",
    boxShadow: "0 4px 15px rgba(220, 38, 38, 0.35)",
  },
  tableCard: {
    backgroundColor: "#111420",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "18px",
    padding: "26px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
  },
  tableTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#ffffff",
    fontWeight: "700",
  },
  tableSubtitle: {
    fontSize: "12.5px",
    color: "#9ca3af",
    margin: "4px 0 22px 0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  thRow: {
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    color: "#9ca3af",
    fontSize: "10.5px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: "700",
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  td: {
    padding: "14px",
  },
  subText: {
    fontSize: "10px",
    color: "#6b7280",
    marginTop: "2px",
  },
  statusSigned: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    color: "#34d399",
    padding: "4px 9px",
    borderRadius: "6px",
    fontSize: "10.5px",
    fontWeight: "700",
  },
  statusPending: {
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    border: "1px solid rgba(251, 191, 36, 0.2)",
    color: "#fbbf24",
    padding: "4px 9px",
    borderRadius: "6px",
    fontSize: "10.5px",
    fontWeight: "700",
  },
  certBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 13px",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "11.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  eventBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: "4px 8px",
    borderRadius: "6px",
    color: "#d1d5db",
    fontWeight: "700",
    fontSize: "10.5px",
  },
  monoHash: {
    fontFamily: "monospace",
    fontSize: "11px",
    color: "#f87171",
  },
};
