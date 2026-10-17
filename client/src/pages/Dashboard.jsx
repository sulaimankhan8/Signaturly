import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { fetchMyPdfsApi, deletePdfApi, fetchPdfAuditApi } from "../api/pdf.api";
import { remindRecipientApi, fetchDocumentDetailsApi } from "../api/send.api";
import { fetchUserSubscription } from "../api/billing.api";
import { UpgradeModal } from "../components/UpgradeModal";
import ConfirmModal from "../components/ConfirmModal";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import PlanNoticeBanner from "../features/dashboard/PlanNoticeBanner";
import DashboardToolbar from "../features/dashboard/DashboardToolbar";
import DocumentCard from "../features/dashboard/DocumentCard";
import RecipientStatusModal from "../features/dashboard/RecipientStatusModal";
import AuditTrailModal from "../features/dashboard/AuditTrailModal";


export default function Dashboard() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const accessToken = useSelector((state) => state.auth.accessToken);

  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [recipientsDoc, setRecipientsDoc] = useState(null);
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [isRecipientsLoading, setIsRecipientsLoading] = useState(false);
  const [remindingRecipientId, setRemindingRecipientId] = useState(null);
  const [subData, setSubData] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);
  const [isPlanBannerDismissed, setIsPlanBannerDismissed] = useState(() => {
    try {
      const userId = user?._id || user?.id || "guest";
      const plan = user?.subscription?.plan;
      if (plan && plan !== "free") {
        return localStorage.getItem(`dismissed_plan_banner_${userId}`) === plan;
      }
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const plan = subData?.subscription?.plan || user?.subscription?.plan;
      const userId = user?._id || user?.id || "guest";
      if (plan && plan !== "free") {
        const saved = localStorage.getItem(`dismissed_plan_banner_${userId}`);
        if (saved === plan) {
          setIsPlanBannerDismissed(true);
        } else {
          setIsPlanBannerDismissed(false);
        }
      } else {
        setIsPlanBannerDismissed(false);
      }
    } catch {
      setIsPlanBannerDismissed(false);
    }
  }, [subData, user]);

  const handleDismissPlanBanner = (currentPlan) => {
    try {
      const userId = user?._id || user?.id || "guest";
      localStorage.setItem(`dismissed_plan_banner_${userId}`, currentPlan);
      setIsPlanBannerDismissed(true);
      toast.success("Plan status banner dismissed");
    } catch (e) {
      setIsPlanBannerDismissed(true);
    }
  };

  const lastSyncTimeRef = useRef(new Date().toISOString());

  const loadDocuments = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [docs, sub] = await Promise.all([
        fetchMyPdfsApi().catch(() => []),
        fetchUserSubscription().catch(() => null),
      ]);
      setDocuments(docs || []);
      if (sub) setSubData(sub);
      lastSyncTimeRef.current = new Date().toISOString();
    } catch (err) {
      console.error("Failed to load user documents:", err);
      if (showSpinner) toast.error("Failed to load documents. Please try again.");
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  const syncDeltaUpdates = useCallback(async () => {
    try {
      const res = await API.get("/pdf/sync/updates", {
        params: { since: lastSyncTimeRef.current },
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      });

      if (res.status === 200 && res.data?.data?.documents) {
        setDocuments(res.data.data.documents);
        if (res.data.data.serverTime) {
          lastSyncTimeRef.current = res.data.data.serverTime;
        }
      }
    } catch (e) {
      // Background sync silent failure
    }
  }, []);

  // Smart Visibility Delta Sync (Zero-Idle-Cost on Google Cloud Run)
  useEffect(() => {
    loadDocuments(true);

    let syncInterval = null;

    const startSync = () => {
      syncDeltaUpdates();
      if (!syncInterval) {
        syncInterval = setInterval(syncDeltaUpdates, 15000);
      }
    };

    const stopSync = () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    };

    // Auto-pause when tab is hidden so Cloud Run can scale down to 0 ($0.00 cost)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopSync();
      } else {
        startSync();
      }
    };

    const handleFocus = () => {
      startSync();
    };

    if (!document.hidden) {
      startSync();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      stopSync();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadDocuments, syncDeltaUpdates]);

  const handleVoid = (id, title) => {
    setConfirmModalConfig({
      title: "Legally Void Agreement",
      message: `Are you sure you want to legally VOID and cancel "${title}"? All recipient signing links will be revoked immediately and a cancellation notice will be logged in the audit trail.`,
      confirmText: "Void Document",
      cancelText: "Keep Active",
      type: "danger",
      onConfirm: async () => {
        try {
          setDeletingId(id);
          await API.post(`/send/${id}/void`);
          toast.success("Document legally voided and revoked");
          setDocuments((prev) =>
            prev.map((doc) => (doc._id === id || doc.id === id ? { ...doc, status: "voided" } : doc))
          );
        } catch (err) {
          console.error("Void document error:", err);
          toast.error(err.response?.data?.message || "Failed to void document");
        } finally {
          setDeletingId(null);
          setConfirmModalConfig(null);
        }
      },
    });
  };

  const handleDelete = (id, title) => {
    setConfirmModalConfig({
      title: "Permanently Delete Document",
      message: `Are you sure you want to permanently delete "${title}"? The source PDF file will be purged from storage and removed from your dashboard.`,
      confirmText: "Delete Permanently",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          setDeletingId(id);
          await deletePdfApi(id);
          setDocuments((prev) => prev.filter((doc) => doc._id !== id && doc.id !== id));
          toast.success("Document purged from workspace");
        } catch (err) {
          console.error("Delete document error:", err);
          toast.error(err.response?.data?.message || "Failed to delete document");
        } finally {
          setDeletingId(null);
          setConfirmModalConfig(null);
        }
      },
    });
  };

  const handleOpenAudit = async (id) => {
    try {
      setIsAuditLoading(true);
      setIsAuditModalOpen(true);
      const data = await fetchPdfAuditApi(id);
      setSelectedAudit(data);
    } catch (err) {
      console.error("Audit trail fetch error:", err);
      toast.error("Failed to fetch audit trail");
      setIsAuditModalOpen(false);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleOpenRecipients = async (id) => {
    try {
      setIsRecipientsLoading(true);
      setIsRecipientsModalOpen(true);
      const data = await fetchDocumentDetailsApi(id);
      setRecipientsDoc(data);
    } catch (err) {
      console.error("Fetch document details error:", err);
      toast.error("Failed to load signers list");
      setIsRecipientsModalOpen(false);
    } finally {
      setIsRecipientsLoading(false);
    }
  };

  const handleSendReminder = async (recipientId) => {
    try {
      setRemindingRecipientId(recipientId);
      await remindRecipientApi(recipientId);
      toast.success("Reminder email dispatched to signer!");
      if (recipientsDoc?._id) {
        const updated = await fetchDocumentDetailsApi(recipientsDoc._id);
        setRecipientsDoc(updated);
      }
    } catch (err) {
      console.error("Reminder send error:", err);
      toast.error(err.response?.data?.message || "Failed to dispatch reminder");
    } finally {
      setRemindingRecipientId(null);
    }
  };

  const [isCertDownloading, setIsCertDownloading] = useState(false);
  const handleDownloadCertificate = async (pdfId, originalName = "Document") => {
    try {
      setIsCertDownloading(true);
      toast.loading("Generating certified audit PDF...", { id: "audit-cert" });
      const res = await API.get(`/pdf/${pdfId}/audit-certificate`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Audit-Certificate-${originalName.replace(/\.pdf$/i, "")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Audit certificate downloaded successfully!", { id: "audit-cert" });
    } catch (err) {
      console.error("Failed to download audit certificate:", err);
      toast.error(err.response?.data?.message || "Failed to download audit certificate", { id: "audit-cert" });
    } finally {
      setIsCertDownloading(false);
    }
  };


  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.originalFileName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "signed") return doc.status === "signed";
      if (statusFilter === "pending") return doc.status === "pending" || doc.status === "partially_signed";
      if (statusFilter === "draft") return doc.status === "draft" || doc.status === "uploaded";
      if (statusFilter === "declined") return doc.status === "declined" || doc.status === "voided";

      return true;
    });
  }, [documents, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = documents.length;
    const signed = documents.filter((d) => d.status === "signed").length;
    const pending = documents.filter((d) => d.status === "pending" || d.status === "partially_signed").length;
    const drafts = documents.filter((d) => d.status === "draft" || d.status === "uploaded").length;
    return { total, signed, pending, drafts };
  }, [documents]);




  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5 uppercase">
              Document Vault
            </h1>
            <p className="text-gray-300 text-xs mt-0.5 font-medium">
              Welcome back, <span className="text-yellow-400 font-black">{user?.name || user?.email}</span>. Manage agreements, track signers, and execute e-signatures.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                loadDocuments();
                toast.success("Document vault updated!");
              }}
              disabled={isLoading}
              className="inline-flex items-center justify-center p-2.5 bg-[#13151f] hover:bg-white/10 text-white font-bold rounded-xl border-2 border-white/20 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] transition-all text-xs"
              title="Refresh Document List"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin text-yellow-400" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={() => navigate("/upload")}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider rounded-xl shadow-[3px_3px_0px_0px_#facc15] hover:shadow-[4px_4px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all border-2 border-black text-xs"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Upload Document
            </button>
          </div>
        </div>

        {/* Dynamic Quota, Past Due, & Upgrade Banner */}
        <PlanNoticeBanner
          isLoading={isLoading}
          subData={subData}
          user={user}
          isPlanBannerDismissed={isPlanBannerDismissed}
          handleDismissPlanBanner={handleDismissPlanBanner}
          navigate={navigate}
        />

        {/* Stats Cards & Filter Toolbar */}
        <DashboardToolbar
          stats={stats}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        {/* Document Gallery Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-white/20 border-t-yellow-400 rounded-full animate-spin mb-4" />
            <p className="text-gray-300 text-xs font-bold uppercase tracking-wider">Fetching documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-20 bg-[#13151f] rounded-3xl border-2 border-white/20 p-8 shadow-[6px_6px_0px_0px_#000]">
            <div className="w-16 h-16 bg-red-600 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-[3px_3px_0px_0px_#facc15]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-white uppercase mb-1">No documents found</h3>
            <p className="text-gray-300 text-xs max-w-md mx-auto mb-6 font-medium">
              {searchQuery
                ? "No documents matched your search term."
                : "You haven't uploaded any documents yet. Get started by uploading a PDF!"}
            </p>
            <button
              onClick={() => navigate("/upload")}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#facc15] hover:shadow-[4px_4px_0px_0px_#fff] transition-all"
            >
              Upload PDF →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc._id || doc.id}
                doc={doc}
                navigate={navigate}
                handleOpenRecipients={handleOpenRecipients}
                handleOpenAudit={handleOpenAudit}
                handleVoid={handleVoid}
                handleDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        )}

      </main>

      {/* Signers & Reminder Modal */}
      <RecipientStatusModal
        isOpen={isRecipientsModalOpen}
        onClose={() => setIsRecipientsModalOpen(false)}
        isLoading={isRecipientsLoading}
        recipientsDoc={recipientsDoc}
        remindingRecipientId={remindingRecipientId}
        onSendReminder={handleSendReminder}
        onVoid={handleVoid}
      />

      {/* Audit Trail Modal */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        isLoading={isAuditLoading}
        selectedAudit={selectedAudit}
        isCertDownloading={isCertDownloading}
        onDownloadCertificate={handleDownloadCertificate}
      />

      {/* In-Dashboard Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason="Upgrade your workspace for more documents each month, more template packs and bulk send."
        onUpgraded={() => loadDocuments(false)}
      />

      {/* Action Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmModalConfig}
        title={confirmModalConfig?.title || "Confirm Action"}
        message={confirmModalConfig?.message || "Are you sure you want to proceed?"}
        confirmText={confirmModalConfig?.confirmText || "Confirm"}
        cancelText={confirmModalConfig?.cancelText || "Cancel"}
        type={confirmModalConfig?.type || "danger"}
        onConfirm={confirmModalConfig?.onConfirm}
        onCancel={() => setConfirmModalConfig(null)}
      />
    </div>
  );
}
