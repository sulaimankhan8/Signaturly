import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
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
    try {
      setLoading(true);
      setError(null);
      const [statsRes, docsRes, logsRes] = await Promise.all([
        axios.get("/api/admin/stats"),
        axios.get("/api/admin/documents"),
        axios.get("/api/admin/audit-logs"),
      ]);

      setStats(statsRes.data.systemMetrics);
      setDocuments(docsRes.data.documents || []);
      setAuditLogs(logsRes.data.logs || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load admin dashboard. Ensure you have Superadmin privileges.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBsaCert = (docId) => {
    window.open(`/api/admin/documents/${docId}/bsa-certificate`, "_blank");
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "#9ca3af", marginTop: "16px" }}>Authenticating Superadmin & Loading Governance Ledger...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>🚫</div>
        <h2 style={{ color: "#f87171", margin: 0 }}>Superadmin Access Denied</h2>
        <p style={{ color: "#9ca3af", marginTop: "8px", maxWidth: "450px" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top Governance Bar */}
      <div style={styles.topBar}>
        <div>
          <div style={styles.badge}>⚡ GOVERNANCE & COMPLIANCE ENGINE</div>
          <h1 style={styles.title}>Superadmin Dashboard</h1>
        </div>
        <div style={styles.statusChip}>
          🔒 Zero-Knowledge Immutability Active
        </div>
      </div>

      {/* Metric Cards */}
      {stats && (
        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Registered Users</div>
            <div style={styles.cardVal}>{stats.totalUsers}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Total Agreements</div>
            <div style={styles.cardVal}>{stats.totalDocuments}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Executed (Signed)</div>
            <div style={{ ...styles.cardVal, color: "#34d399" }}>{stats.executedDocuments}</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>Immutable Audit Events</div>
            <div style={{ ...styles.cardVal, color: "#fca5a5" }}>{stats.totalAuditEvents}</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={styles.tabRow}>
        <button
          onClick={() => setActiveTab("overview")}
          style={activeTab === "overview" ? styles.activeTab : styles.tab}
        >
          📁 System Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          style={activeTab === "audit" ? styles.activeTab : styles.tab}
        >
          📜 Cryptographic Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: System Documents Directory */}
      {activeTab === "overview" && (
        <div style={styles.tableCard}>
          <h3 style={styles.tableTitle}>Document Governance Directory</h3>
          <p style={styles.tableSubtitle}>
            Zero-Knowledge Policy: Admins can inspect execution state and issue Section 63 BSA evidence certificates, but cannot alter document content.
          </p>
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
                    <strong style={{ color: "#fff" }}>{doc.originalFileName}</strong>
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
                      ⚖️ Export Sec 63 BSA Cert
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Immutable Audit Chain */}
      {activeTab === "audit" && (
        <div style={styles.tableCard}>
          <h3 style={styles.tableTitle}>Immutable Audit Chain Ledger</h3>
          <p style={styles.tableSubtitle}>
            SHA-256 Merkle block hashes linked sequentially across all document lifecycle events.
          </p>
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
                    <div style={{ color: "#fff", fontWeight: "600" }}>{log.actorName || "System"}</div>
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
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#08090d",
    color: "#e5e7eb",
    padding: "40px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  loadingContainer: {
    minHeight: "100vh",
    backgroundColor: "#08090d",
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
    backgroundColor: "#08090d",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1px",
    color: "#ef4444",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#ffffff",
    margin: "4px 0 0 0",
  },
  statusChip: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    color: "#34d399",
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "20px",
    marginBottom: "30px",
  },
  card: {
    backgroundColor: "#12141c",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "14px",
    padding: "20px",
  },
  cardLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  cardVal: {
    fontSize: "30px",
    fontWeight: "800",
    color: "#ffffff",
    marginTop: "6px",
  },
  tabRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
  },
  tab: {
    padding: "12px 20px",
    backgroundColor: "#12141c",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color: "#9ca3af",
    fontWeight: "600",
    cursor: "pointer",
  },
  activeTab: {
    padding: "12px 20px",
    backgroundColor: "#991b1b",
    border: "1px solid #dc2626",
    borderRadius: "10px",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },
  tableCard: {
    backgroundColor: "#12141c",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "24px",
  },
  tableTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#fff",
  },
  tableSubtitle: {
    fontSize: "12px",
    color: "#9ca3af",
    margin: "4px 0 20px 0",
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
    padding: "12px",
    color: "#9ca3af",
    fontSize: "11px",
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  td: {
    padding: "14px 12px",
  },
  subText: {
    fontSize: "10px",
    color: "#6b7280",
  },
  statusSigned: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    color: "#34d399",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  statusPending: {
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    color: "#fbbf24",
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "700",
  },
  certBtn: {
    padding: "6px 12px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "6px",
    color: "#fca5a5",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
  },
  eventBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: "3px 8px",
    borderRadius: "4px",
    color: "#d1d5db",
    fontWeight: "700",
    fontSize: "11px",
  },
  monoHash: {
    fontFamily: "monospace",
    fontSize: "11px",
    color: "#f87171",
  },
};
