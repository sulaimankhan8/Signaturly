import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, getAdminBaseUrl } from "../api/admin.api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";

// Helper function to compute smooth SVG cubic bezier path
function getSmoothSplinePath(points, height, padding) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 1} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Core Data States
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // UI States
  const [activeSection, setActiveSection] = useState("overview"); // 'overview' | 'users' | 'documents' | 'audits' | 'governance'
  const [timeRange, setTimeRange] = useState("7d"); // '7d' | '14d' | '30d'
  const [activeMetric, setActiveMetric] = useState("envelopesSigned"); // 'envelopesSigned' | 'envelopesCreated' | 'signups' | 'paidSubscribers'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userPlanFilter, setUserPlanFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");

  // User Documents Inspector Drawer/Modal
  const [inspectingUserDocs, setInspectingUserDocs] = useState(null);
  const [loadingUserDocs, setLoadingUserDocs] = useState(false);

  // Manage Plan Override Modal
  const [editingUserPlan, setEditingUserPlan] = useState(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState("pro_monthly");
  const [customQuota, setCustomQuota] = useState("");
  const [planDurationDays, setPlanDurationDays] = useState("30");
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [actionErrorMsg, setActionErrorMsg] = useState("");

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    type: "danger",
    onConfirm: null,
  });

  const fetchAdminData = async (range = timeRange) => {
    const adminToken = localStorage.getItem("signaturly_admin_token");
    if (!adminToken) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, usersRes, docsRes, logsRes] = await Promise.all([
        adminApi.get(`/admin/analytics?range=${range}`),
        adminApi.get("/admin/users"),
        adminApi.get("/admin/documents"),
        adminApi.get("/admin/audit-logs"),
      ]);

      setAnalytics(analyticsRes.data.data);
      setUsers(usersRes.data.users || []);
      setDocuments(docsRes.data.documents || []);
      setAuditLogs(logsRes.data.logs || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("signaturly_admin_token");
        navigate("/login");
        return;
      }
      setError(err.response?.data?.error || "Failed to load admin telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData(timeRange);
  }, [timeRange]);

  const handleAdminLogout = () => {
    localStorage.removeItem("signaturly_admin_token");
    navigate("/login");
  };

  const handleDownloadBsaCert = (docId) => {
    const adminToken = localStorage.getItem("signaturly_admin_token");
    const baseUrl = getAdminBaseUrl();
    window.open(`${baseUrl}/admin/documents/${docId}/bsa-certificate?token=${adminToken}`, "_blank");
  };

  // Inspect User Documents
  const handleOpenUserDocs = async (user) => {
    try {
      setLoadingUserDocs(true);
      setInspectingUserDocs({ user, docs: [] });
      const res = await adminApi.get(`/admin/users/${user.id}/documents`);
      setInspectingUserDocs({ user: res.data.user, docs: res.data.documents || [] });
    } catch (err) {
      setActionErrorMsg("Failed to load user documents: " + (err.response?.data?.error || err.message));
      setTimeout(() => setActionErrorMsg(""), 4000);
    } finally {
      setLoadingUserDocs(false);
    }
  };

  // Open Manage Tier Modal
  const handleOpenEditPlan = (user) => {
    setEditingUserPlan(user);
    setSelectedPlanTier(user.plan === "free" ? "pro_monthly" : user.plan);
    setCustomQuota(user.monthlyQuota ? String(user.monthlyQuota) : "15");
    setPlanDurationDays("30");
  };

  // Save Plan Modification
  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!editingUserPlan) return;

    try {
      setIsUpdatingPlan(true);
      const res = await adminApi.patch(`/admin/users/${editingUserPlan.id}/plan`, {
        plan: selectedPlanTier,
        customQuota: customQuota ? parseInt(customQuota, 10) : undefined,
        durationDays: selectedPlanTier !== "lifetime" && selectedPlanTier !== "free" ? parseInt(planDurationDays, 10) : undefined,
      });

      setActionSuccessMsg(res.data.message || `Plan updated to ${selectedPlanTier.toUpperCase()}`);
      setEditingUserPlan(null);
      setTimeout(() => setActionSuccessMsg(""), 4000);
      fetchAdminData(timeRange);
    } catch (err) {
      setActionErrorMsg("Failed to update user plan: " + (err.response?.data?.error || err.message));
      setTimeout(() => setActionErrorMsg(""), 4000);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Reset User Quota
  const handleResetQuota = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Envelope Quota",
      message: `Are you sure you want to reset monthly document quota usage for ${userName} back to 0?`,
      confirmText: "Reset Quota",
      type: "warning",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await adminApi.post(`/admin/users/${userId}/reset-quota`);
          setActionSuccessMsg(`Reset monthly envelope usage for ${userName} to 0.`);
          setTimeout(() => setActionSuccessMsg(""), 4000);
          fetchAdminData(timeRange);
        } catch (err) {
          setActionErrorMsg("Failed to reset quota: " + (err.response?.data?.error || err.message));
          setTimeout(() => setActionErrorMsg(""), 4000);
        }
      },
    });
  };

  // Graph Data Calculations
  const dailyStats = analytics?.dailyStats || [];
  const { chartPoints, linePath, areaPath, maxVal, yTicks } = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) {
      return { chartPoints: [], linePath: "", areaPath: "", maxVal: 10, yTicks: [0, 5, 10] };
    }

    const width = 760;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };

    const rawValues = dailyStats.map((d) => d[activeMetric] || 0);
    const calculatedMax = Math.max(...rawValues, 4);
    const niceMax = Math.ceil(calculatedMax / 4) * 4;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const points = dailyStats.map((d, index) => {
      const x = padding.left + (index / (dailyStats.length - 1 || 1)) * plotWidth;
      const val = d[activeMetric] || 0;
      const y = padding.top + plotHeight - (val / niceMax) * plotHeight;
      return { x, y, value: val, date: d.date };
    });

    const line = getSmoothSplinePath(points, height, padding);
    const area = points.length > 0
      ? `${line} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`
      : "";

    const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];

    return { chartPoints: points, linePath: line, areaPath: area, maxVal: niceMax, yTicks: ticks };
  }, [dailyStats, activeMetric]);

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = userPlanFilter === "all" || u.plan === userPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const filteredDocs = documents.filter((d) => {
    if (docFilter === "all") return true;
    if (docFilter === "signed") return d.status === "signed";
    if (docFilter === "pending") return d.status === "pending" || d.status === "partially_signed";
    if (docFilter === "draft") return d.status === "draft";
    return true;
  });

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-[#090a10] text-white flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-xs font-mono tracking-wider uppercase">
          Authenticating Superadmin &amp; Syncing Real-Time Ledger...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#090a10] text-white flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-red-950/80 text-red-400 rounded-2xl border border-red-500/40 flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-white">Superadmin Access Restricted</h2>
        <p className="text-xs text-gray-400 max-w-md">{error}</p>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
        >
          Return to Admin Login Portal →
        </button>
      </div>
    );
  }

  const { financials = {}, subscribers = {}, documents: docStats = {}, enterprise = {}, systemHealth = {} } = analytics || {};

  const metricColors = {
    envelopesSigned: { stroke: "#10b981", fill: "url(#grad-emerald)", label: "Signed Contracts", badge: "text-emerald-400 bg-emerald-950/80" },
    envelopesCreated: { stroke: "#f59e0b", fill: "url(#grad-amber)", label: "Envelopes Created", badge: "text-amber-400 bg-amber-950/80" },
    signups: { stroke: "#3b82f6", fill: "url(#grad-blue)", label: "New User Signups", badge: "text-blue-400 bg-blue-950/80" },
    paidSubscribers: { stroke: "#a855f7", fill: "url(#grad-purple)", label: "Paid Upgrades", badge: "text-purple-400 bg-purple-950/80" },
  };

  const currentMetricConfig = metricColors[activeMetric] || metricColors.envelopesSigned;

  return (
    <div className="min-h-screen bg-[#090a10] text-gray-100 flex font-sans selection:bg-red-600 selection:text-white antialiased">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ========================================================================= */}
      {/* 1. FIXED DARK MODERN SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-[#0d0f17] border-r border-white/10 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand & Superadmin Badge */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black border-2 border-black shadow-[2px_2px_0px_0px_#fff]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-base font-black text-white tracking-tight block">
                  Signatur<span className="text-red-500">ly</span> PRO
                </span>
                <span className="text-[9px] font-mono font-black uppercase text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800 inline-block mt-0.5">
                  SUPERADMIN CONSOLE
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 flex-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 px-3 py-1 block">
              Core Management
            </span>

            {[
              {
                id: "overview",
                label: "Executive Analytics",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
              {
                id: "users",
                label: "Users & Subscriptions",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
                count: users.length,
              },
              {
                id: "documents",
                label: "Document Vault",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                count: documents.length,
              },
              {
                id: "audits",
                label: "Audit Ledger",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                count: auditLogs.length,
              },
              {
                id: "governance",
                label: "System Governance",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
            ].map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-950/60 font-black"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive ? "bg-black/40 text-white" : "bg-white/10 text-gray-400"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Real-time System Status Footer Widget */}
          <div className="p-4 border-t border-white/10 bg-[#07080c] space-y-3">
            <div className="space-y-1 text-[10px] font-mono text-gray-400">
              <div className="flex items-center justify-between">
                <span>Database:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Storage Mode:</span>
                <span className="text-blue-400">Append-Only WORM</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Uptime:</span>
                <span className="text-gray-300">{Math.floor((systemHealth.uptimeSeconds || 0) / 60)} min</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <div className="text-[11px] font-bold text-gray-300 truncate max-w-[120px]">
                admin@signaturly.pro
              </div>
              <button
                onClick={handleAdminLogout}
                className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
                title="Logout from superadmin"
              >
                <span>Logout</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE / CONTENT AREA */}
      {/* ========================================================================= */}
      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-[#090a10]/95 backdrop-blur-md border-b border-white/10 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
              {activeSection === "overview" && "Executive Telemetry & Real-Time Curves"}
              {activeSection === "users" && "Subscriber & User Management Directory"}
              {activeSection === "documents" && "Global Document Repository & Legal Ledger"}
              {activeSection === "audits" && "Cryptographic SHA-256 Audit Trail"}
              {activeSection === "governance" && "Platform Governance & Statutory Standards"}
            </h1>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              India IT Act 2000 Sec 10A &bull; BSA 2023 Sec 63 &bull; eIDAS Verified
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAdminData(timeRange)}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow"
            >
              <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sync Live Data</span>
            </button>
          </div>
        </header>

        {/* Action Success Toast Banner */}
        {actionSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-8 py-2.5 text-xs font-bold text-emerald-300 animate-in fade-in">
            ✓ {actionSuccessMsg}
          </div>
        )}
        {/* Action Error Toast Banner */}
        {actionErrorMsg && (
          <div className="bg-red-950/90 border-b border-red-500/50 px-8 py-2.5 text-xs font-bold text-red-300 animate-in fade-in">
            ✕ {actionErrorMsg}
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 p-8 space-y-8 max-w-7xl w-full">
          {/* ========================================================================= */}
          {/* SECTION 1: EXECUTIVE ANALYTICS & TIME-SERIES CURVES */}
          {/* ========================================================================= */}
          {activeSection === "overview" && (
            <div className="space-y-8">
              {/* 4 Financial & Velocity Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Metric 1: MRR */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
                      Monthly Recurring
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      ${financials.mrr || 0}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {subscribers.proMonthly || 0} Pro + {subscribers.enterprise || 0} Enterprise Active
                    </span>
                  </div>
                </div>

                {/* Metric 2: LTD Revenue */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-purple-400 bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-800">
                      Lifetime Deal Revenue
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      ${financials.ltdRevenue || 0}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {subscribers.lifetime || 0} Lifetime licenses ($69 one-time)
                    </span>
                  </div>
                </div>

                {/* Metric 3: Total Gross & Paid Subs */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-yellow-400 bg-yellow-950/80 px-2.5 py-0.5 rounded-full border border-yellow-800">
                      Paid Subscribers
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {financials.totalPaidSubscribers || 0} <span className="text-xs text-gray-400 font-normal">/ {subscribers.total || 0}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {financials.conversionRate || 0}% Conversion &bull; ARPU: ${financials.arpu || 0}
                    </span>
                  </div>
                </div>

                {/* Metric 4: 24h Velocity */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-800">
                      24-Hour Velocity
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      +{subscribers.newUsers24h || 0} <span className="text-xs text-blue-400 font-normal">Users</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      +{docStats.signedDocs24h || 0} Signed &bull; +{subscribers.newPaid24h || 0} Paid Today
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Smooth SVG Spline Area Graph */}
              <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white uppercase">
                        Platform Performance Curves
                      </h3>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-white/10 ${currentMetricConfig.badge}`}>
                        {currentMetricConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Smooth real-time spline interpolation calculated from live MongoDB database events.
                    </p>
                  </div>

                  {/* Graph Controls: Metric Selectors & Time Range */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Metric Selector Buttons */}
                    <div className="bg-[#07080c] p-1 rounded-xl border border-white/10 flex items-center gap-1">
                      {[
                        { id: "envelopesSigned", label: "Signed Documents" },
                        { id: "envelopesCreated", label: "Dispatched" },
                        { id: "signups", label: "Signups" },
                        { id: "paidSubscribers", label: "Paid Upgrades" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setActiveMetric(m.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeMetric === m.id
                              ? "bg-white/15 text-white font-black shadow"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Time Range Selector */}
                    <div className="bg-[#07080c] p-1 rounded-xl border border-white/10 flex items-center gap-1">
                      {["7d", "14d", "30d"].map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                            timeRange === r
                              ? "bg-red-600 text-white font-black"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SVG Graph Viewport */}
                <div className="relative w-full overflow-hidden pt-2">
                  <svg
                    viewBox="0 0 760 220"
                    className="w-full h-64 overflow-visible"
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <defs>
                      <linearGradient id="grad-emerald" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="grad-amber" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="grad-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="grad-purple" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Dashed Grid Lines & Y-Axis Numbers */}
                    {yTicks.map((val, idx) => {
                      const yPos = 25 + (220 - 25 - 35) - (val / (maxVal || 1)) * (220 - 25 - 35);
                      return (
                        <g key={idx}>
                          <line
                            x1="45"
                            y1={yPos}
                            x2="730"
                            y2={yPos}
                            stroke="#ffffff"
                            strokeOpacity="0.07"
                            strokeDasharray="4 4"
                          />
                          <text
                            x="38"
                            y={yPos + 3}
                            textAnchor="end"
                            fill="#6b7280"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {Math.round(val)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Filled Area under Curve */}
                    {areaPath && (
                      <path d={areaPath} fill={currentMetricConfig.fill} />
                    )}

                    {/* Smooth Spline Stroke */}
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke={currentMetricConfig.stroke}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Coordinate Markers & Hover Targets */}
                    {chartPoints.map((pt, idx) => {
                      const isHovered = hoveredPoint?.index === idx;
                      return (
                        <g key={idx} className="cursor-pointer">
                          {/* X-Axis Date Label */}
                          <text
                            x={pt.x}
                            y="210"
                            textAnchor="middle"
                            fill="#6b7280"
                            fontSize="9"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {pt.date}
                          </text>

                          {/* Invisible hover hitbox */}
                          <rect
                            x={pt.x - 15}
                            y="15"
                            width="30"
                            height="180"
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({ ...pt, index: idx })}
                          />

                          {/* Marker Dot */}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 6 : 3.5}
                            fill={isHovered ? "#ffffff" : currentMetricConfig.stroke}
                            stroke={currentMetricConfig.stroke}
                            strokeWidth="2"
                            className="transition-all duration-150"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Dynamic Hover Tooltip Card */}
                  {hoveredPoint && (
                    <div
                      style={{
                        left: `${(hoveredPoint.x / 760) * 100}%`,
                        top: `${Math.max(10, hoveredPoint.y - 45)}px`,
                        transform: "translateX(-50%)",
                      }}
                      className="absolute pointer-events-none bg-[#07080c] border border-white/20 px-3 py-1.5 rounded-xl shadow-2xl z-30 text-center animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="text-[10px] font-mono text-gray-400">{hoveredPoint.date}</div>
                      <div className="text-xs font-black text-white font-mono">
                        {hoveredPoint.value} {currentMetricConfig.label}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom 2 Cards: Plan Distributions & Enterprise Capacity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Plan Distribution Breakdown */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Subscription Tier Distribution
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-gray-400">Free Starter ($0)</span>
                        <span className="text-white font-mono">{subscribers.free || 0} users</span>
                      </div>
                      <div className="w-full bg-[#07080c] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-neutral-600 h-full transition-all duration-300"
                          style={{ width: `${subscribers.total > 0 ? ((subscribers.free || 0) / subscribers.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-yellow-400">Pro Creator ($5.99/mo)</span>
                        <span className="text-white font-mono">{subscribers.proMonthly || 0} users</span>
                      </div>
                      <div className="w-full bg-[#07080c] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-yellow-400 h-full transition-all duration-300"
                          style={{ width: `${subscribers.total > 0 ? ((subscribers.proMonthly || 0) / subscribers.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-purple-400">Lifetime Pass ($69 LTD)</span>
                        <span className="text-white font-mono">{subscribers.lifetime || 0} users</span>
                      </div>
                      <div className="w-full bg-[#07080c] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full transition-all duration-300"
                          style={{ width: `${subscribers.total > 0 ? ((subscribers.lifetime || 0) / subscribers.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-blue-400">Enterprise ($14.99/seat)</span>
                        <span className="text-white font-mono">{subscribers.enterprise || 0} organizations</span>
                      </div>
                      <div className="w-full bg-[#07080c] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${subscribers.total > 0 ? ((subscribers.enterprise || 0) / subscribers.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Capacity & Security */}
                <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Infrastructure &amp; Enterprise Capacity
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#07080c] p-4 rounded-2xl border border-white/10">
                      <span className="text-gray-400 block text-[10px] uppercase font-mono">Total Contracts</span>
                      <span className="text-2xl font-black text-white font-mono mt-1 block">{docStats.total || 0}</span>
                    </div>

                    <div className="bg-[#07080c] p-4 rounded-2xl border border-white/10">
                      <span className="text-emerald-400 block text-[10px] uppercase font-mono">Executed &amp; Sealed</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{docStats.executed || 0}</span>
                    </div>

                    <div className="bg-[#07080c] p-4 rounded-2xl border border-white/10">
                      <span className="text-blue-400 block text-[10px] uppercase font-mono">Workspaces Active</span>
                      <span className="text-2xl font-black text-white font-mono mt-1 block">{enterprise.totalWorkspaces || 0}</span>
                    </div>

                    <div className="bg-[#07080c] p-4 rounded-2xl border border-white/10">
                      <span className="text-amber-400 block text-[10px] uppercase font-mono">Developer API Keys</span>
                      <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{enterprise.totalApiKeys || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: USERS & SUBSCRIBERS DIRECTORY */}
          {/* ========================================================================= */}
          {activeSection === "users" && (
            <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase">User &amp; Subscriber Ledger</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Modify tiers, grant lifetime passes, and inspect user agreements.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="px-3.5 py-2 bg-[#07080c] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 w-56"
                  />

                  <select
                    value={userPlanFilter}
                    onChange={(e) => setUserPlanFilter(e.target.value)}
                    className="px-3 py-2 bg-[#07080c] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free Starter</option>
                    <option value="pro_monthly">Pro Creator (Monthly)</option>
                    <option value="pro_annual">Pro Creator (Annual)</option>
                    <option value="lifetime">Lifetime Pass (LTD)</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Active Plan</th>
                      <th className="py-3 px-4">Quota Status</th>
                      <th className="py-3 px-4">Contracts</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-gray-500">
                          No users found matching search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const getPlanBadge = (plan) => {
                          if (plan === "lifetime") return "bg-purple-950/80 text-purple-300 border-purple-800";
                          if (plan === "pro_monthly" || plan === "pro_annual") return "bg-yellow-950/80 text-yellow-300 border-yellow-800";
                          if (plan === "enterprise") return "bg-blue-950/80 text-blue-300 border-blue-800";
                          return "bg-neutral-800 text-neutral-300 border-neutral-700";
                        };

                        return (
                          <tr key={u.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">{u.name}</div>
                              <div className="text-[11px] text-gray-400 font-mono">{u.email}</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${getPlanBadge(u.plan)}`}>
                                {u.plan.replace("_", " ")}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              {u.isUnlimited ? (
                                <span className="text-emerald-400 font-bold">Unlimited ∞</span>
                              ) : (
                                <span className={u.usedThisMonth >= u.monthlyQuota ? "text-red-400 font-bold" : "text-gray-300"}>
                                  {u.usedThisMonth} / {u.monthlyQuota} Used
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              <span className="text-white font-bold">{u.totalDocuments}</span>
                              <span className="text-gray-500"> ({u.signedDocuments} signed)</span>
                            </td>

                            <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>

                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleOpenUserDocs(u)}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                </svg>
                                <span>View Docs</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditPlan(u)}
                                className="px-2.5 py-1 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black rounded-lg font-black text-[11px] transition-all cursor-pointer shadow inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span>Edit Plan</span>
                              </button>

                              {!u.isUnlimited && (
                                <button
                                  type="button"
                                  onClick={() => handleResetQuota(u.id, u.name)}
                                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg text-[10px] font-mono transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Reset</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: ALL DOCUMENTS OVERSIGHT */}
          {/* ========================================================================= */}
          {activeSection === "documents" && (
            <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase">System-Wide Document Vault</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Metadata oversight and Section 63 BSA Court Evidence Certificate generation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {["all", "signed", "pending", "draft"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setDocFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        docFilter === f ? "bg-red-600 text-white" : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Signers</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {filteredDocs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-gray-500">
                          No documents found matching this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredDocs.map((doc) => {
                        const isSigned = doc.status === "signed";
                        return (
                          <tr key={doc._id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-white max-w-xs truncate">
                              {doc.originalFileName || "Untitled Contract.pdf"}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-white font-medium">{doc.userId?.name || "User"}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{doc.userId?.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                  isSigned
                                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                                    : "bg-yellow-950/80 text-yellow-300 border-yellow-700"
                                }`}
                              >
                                {doc.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-gray-300">
                              {doc.recipients?.length || 0} signers
                            </td>
                            <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDownloadBsaCert(doc._id)}
                                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Sec 63 BSA PDF</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 4: AUDIT LEDGER */}
          {/* ========================================================================= */}
          {activeSection === "audits" && (
            <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white uppercase">Immutable Append-Only Audit Trail</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Chronological cryptographic ledger of all document interactions and SHA-256 seal records.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 text-[10px] uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Event Action</th>
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Actor / IP</th>
                      <th className="py-3 px-4">Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-xs text-gray-300">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-gray-400 text-[11px]">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {log.action || log.eventType || "AUDIT_EVENT"}
                        </td>
                        <td className="py-3 px-4 text-gray-300 max-w-xs truncate">
                          {log.pdfId?.originalFileName || log.pdfId || "—"}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-[11px]">
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[9px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                            SHA256_VERIFIED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 5: PLATFORM GOVERNANCE & HEALTH */}
          {/* ========================================================================= */}
          {activeSection === "governance" && (
            <div className="bg-[#11131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white uppercase">Platform Governance &amp; Statutory Compliance</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Technical compliance configuration, statutory adherence status, and runtime environment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="bg-[#07080c] p-5 rounded-2xl border border-white/10 space-y-3">
                  <h4 className="font-bold text-white uppercase text-[11px] text-red-400">Statutory Legal Framework</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Section 10A Information Technology Act 2000</strong>: Electronic contract validity</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Section 63 Bharatiya Sakshya Adhiniyam 2023</strong>: Electronic record admissibility</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>US ESIGN Act &amp; EU eIDAS</strong>: Cross-border electronic signature recognition</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-[#07080c] p-5 rounded-2xl border border-white/10 space-y-3">
                  <h4 className="font-bold text-white uppercase text-[11px] text-emerald-400">Cryptographic Seal Pipeline</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>SHA-256 Merkle Chain</strong>: Immutability proof computed for every signed payload</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>WORM Storage Mode</strong>: Write-Once-Read-Many audit logs in MongoDB</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Dual OTP Authentication</strong>: 6-digit email OTPs verified with 5-minute TTL</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: Inspect User Documents */}
      {/* ======================================================== */}
      {inspectingUserDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#11131f] border-2 border-white/20 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white uppercase">User Contracts Vault</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing agreements owned by <strong className="text-white">{inspectingUserDocs.user?.name}</strong> ({inspectingUserDocs.user?.email})
                </p>
              </div>
              <button
                onClick={() => setInspectingUserDocs(null)}
                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/5 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingUserDocs ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading user agreements...</div>
              ) : inspectingUserDocs.docs.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  This user has not created or uploaded any signature envelopes yet.
                </div>
              ) : (
                inspectingUserDocs.docs.map((d) => (
                  <div key={d._id} className="bg-[#07080c] p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-white text-xs">{d.originalFileName || "Untitled Contract.pdf"}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Status: <span className="text-yellow-400 uppercase">{d.status}</span> &bull; {d.recipients?.length || 0} signers &bull; {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadBsaCert(d._id)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>BSA Certificate</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: Superadmin Plan Tier & Custom Quota Modifier */}
      {/* ======================================================== */}
      {editingUserPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#11131f] border-2 border-yellow-500/50 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-yellow-400 bg-yellow-950 px-2.5 py-0.5 rounded-full border border-yellow-800">
                  Superadmin Plan Override
                </span>
                <h3 className="text-base font-black text-white mt-1 uppercase">
                  Modify Tier: {editingUserPlan.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingUserPlan(null)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-300 uppercase tracking-wider text-[10px] mb-1.5">
                  Select Subscription Tier
                </label>
                <select
                  value={selectedPlanTier}
                  onChange={(e) => setSelectedPlanTier(e.target.value)}
                  className="w-full p-3 bg-[#07080c] border border-white/20 rounded-xl text-white font-bold focus:outline-none focus:border-yellow-400 cursor-pointer"
                >
                  <option value="free">Free Starter ($0 — 15 envelopes/mo)</option>
                  <option value="pro_monthly">Pro Creator Monthly ($5.99/mo)</option>
                  <option value="pro_annual">Pro Creator Annual ($49/yr)</option>
                  <option value="lifetime">Lifetime Pass ($69 LTD — Unlimited Forever)</option>
                  <option value="enterprise">Enterprise ($14.99/seat — Workspaces &amp; APIs)</option>
                </select>
              </div>

              {selectedPlanTier !== "lifetime" && selectedPlanTier !== "free" && (
                <div>
                  <label className="block font-bold text-gray-300 uppercase tracking-wider text-[10px] mb-1.5">
                    Plan Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={planDurationDays}
                    onChange={(e) => setPlanDurationDays(e.target.value)}
                    className="w-full p-3 bg-[#07080c] border border-white/20 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-400"
                    placeholder="30"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-300 uppercase tracking-wider text-[10px] mb-1.5">
                  Custom Monthly Envelope Quota
                </label>
                <input
                  type="number"
                  min="1"
                  value={customQuota}
                  onChange={(e) => setCustomQuota(e.target.value)}
                  className="w-full p-3 bg-[#07080c] border border-white/20 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. 50"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUserPlan(null)}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-gray-300 font-bold hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPlan}
                  className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-black font-black uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {isUpdatingPlan ? "Saving..." : "Apply Plan Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
