import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast, { Toaster } from "react-hot-toast";
import { fetchMyPdfsApi, deletePdfApi, fetchPdfAuditApi } from "../api/pdf.api";
import { remindRecipientApi, fetchDocumentDetailsApi } from "../api/send.api";
import Navbar from "../components/Navbar";


export default function Dashboard() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

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

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMyPdfsApi();
      setDocuments(data || []);
    } catch (err) {
      console.error("Failed to load user documents:", err);
      toast.error("Failed to load documents. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      setDeletingId(id);
      await deletePdfApi(id);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id && doc.id !== id));
      toast.success("Document deleted successfully");
    } catch (err) {
      console.error("Delete document error:", err);
      toast.error(err.response?.data?.message || "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
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

  const getStatusBadge = (status) => {
    switch (status) {
      case "signed":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-emerald-500 text-black shadow-[2px_2px_0px_0px_#fff]">
            Signed & Sealed
          </span>
        );
      case "pending":
      case "partially_signed":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#ef4444]">
            ⏳ In Progress
          </span>
        );
      case "declined":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-red-600 text-white shadow-[2px_2px_0px_0px_#fff]">
            ✕ Declined
          </span>
        );
      case "voided":
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-gray-800 text-gray-300 shadow-[2px_2px_0px_0px_#000]">
            Voided
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border-2 border-black bg-purple-500 text-white shadow-[2px_2px_0px_0px_#fff]">
            Draft
          </span>
        );
    }
  };


  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3 uppercase">
              Document Vault
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 font-medium">
              Welcome back, <span className="text-yellow-400 font-black">{user?.name || user?.email}</span>. Manage agreements, track signers, and execute e-signatures.
            </p>
          </div>

          <button
            onClick={() => navigate("/upload")}
            className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider rounded-xl shadow-[3px_3px_0px_0px_#facc15] hover:shadow-[4px_4px_0px_0px_#ffffff] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all border-2 border-black text-xs"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Upload Document
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-5 flex items-center space-x-4 shadow-[4px_4px_0px_0px_#ef4444]">
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-300">Total Documents</p>
              <p className="text-2xl font-black text-white font-mono mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-5 flex items-center space-x-4 shadow-[4px_4px_0px_0px_#3b82f6]">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-300">In Progress</p>
              <p className="text-2xl font-black text-blue-400 font-mono mt-0.5">{stats.pending}</p>
            </div>
          </div>

          <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-5 flex items-center space-x-4 shadow-[4px_4px_0px_0px_#22c55e]">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-300">Completed</p>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">{stats.signed}</p>
            </div>
          </div>

          <div className="bg-[#13151f] border-2 border-white/20 rounded-2xl p-5 flex items-center space-x-4 shadow-[4px_4px_0px_0px_#facc15]">
            <div className="w-12 h-12 rounded-xl bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-300">Drafts</p>
              <p className="text-2xl font-black text-yellow-400 font-mono mt-0.5">{stats.drafts}</p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#13151f] p-4 rounded-2xl border-2 border-white/20 shadow-[4px_4px_0px_0px_#000]">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#090a0f] border-2 border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 text-xs font-bold transition-colors"
            />
            <svg
              className="w-4 h-4 absolute left-3.5 top-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-[#090a0f] p-1.5 rounded-xl border-2 border-white/20 w-full md:w-auto overflow-x-auto gap-1">
            {[
              { id: "all", label: "All Docs" },
              { id: "pending", label: "In Progress" },
              { id: "signed", label: "Completed" },
              { id: "draft", label: "Drafts" },
              { id: "declined", label: "Declined/Void" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_#facc15]"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

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
            {filteredDocuments.map((doc) => {
              const docId = doc._id || doc.id;
              const isSigned = doc.status === "signed";
              const createdDate = new Date(doc.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={docId}
                  className="bg-[#13151f] border-2 border-white/20 hover:border-red-500 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#ef4444] group space-y-5"
                >
                  <div className="space-y-4">
                    {/* Top Row: PDF Icon & Status Badge */}
                    <div className="flex items-start justify-between">
                      <div className="px-3 py-1 bg-red-600 text-white border-2 border-black rounded-lg font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]">
                        PDF
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>

                    {/* Title & Metadata */}
                    <div>
                      <h3
                        className="text-base font-black text-white group-hover:text-yellow-400 transition-colors line-clamp-1"
                        title={doc.originalFileName}
                      >
                        {doc.originalFileName}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 font-mono">
                        <span>{doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}</span>
                        <span>•</span>
                        <span>{createdDate}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t-2 border-white/10 flex items-center justify-between gap-2">
                    {/* Direct Self-Sign or Editor */}
                    <button
                      onClick={() => navigate(`/editor/${docId}`)}
                      className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#facc15] hover:shadow-[3px_3px_0px_0px_#fff] border-2 border-black"
                      title="Self Sign Document"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Sign</span>
                    </button>

                    {/* Send for multi-signature */}
                    <button
                      onClick={() => navigate(`/send/${docId}`)}
                      className="py-2 px-3 bg-[#1e2235] hover:bg-[#282d47] text-white border-2 border-white/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff]"
                      title="Send to Multiple Recipients"
                    >
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send</span>
                    </button>

                    {/* Download Signed PDF */}
                    {isSigned && doc.signedUrl && (
                      <a
                        href={`${import.meta.env.VITE_API_BASE_URL}${doc.signedUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
                        title="Download Signed PDF"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    )}

                    {/* View Audit Trail */}
                    <button
                      onClick={() => handleOpenAudit(docId)}
                      className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
                      title="View Cryptographic Audit Trail"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </button>

                    {/* Track Signers & Remind */}
                    <button
                      onClick={() => handleOpenRecipients(docId)}
                      className="w-8 h-8 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all"
                      title="Track Signers & Send Reminders"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(docId, doc.originalFileName)}
                      disabled={deletingId === docId}
                      className="w-8 h-8 bg-red-950 hover:bg-red-800 text-red-400 hover:text-white rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#fff] flex items-center justify-center transition-all disabled:opacity-50"
                      title="Delete Document"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Signers & Reminder Modal */}
      {isRecipientsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <span className="text-purple-400">👥</span>
                Signer Roster & Real-Time Status
              </h3>
              <button
                onClick={() => setIsRecipientsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {isRecipientsLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-10 h-10 border-4 border-white/10 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : recipientsDoc ? (
              <div className="space-y-4 text-xs text-gray-300 max-h-[60vh] overflow-y-auto pr-1">
                <div className="bg-[#08090d] p-4 rounded-xl space-y-1 border border-white/10">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Document</p>
                  <p className="text-white font-semibold text-sm">{recipientsDoc.originalFileName}</p>
                </div>

                <div className="space-y-3">
                  {(recipientsDoc.recipients || []).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recipients assigned yet.</p>
                  ) : (
                    recipientsDoc.recipients.map((rec) => {
                      const isSigned = rec.status === "signed";
                      return (
                        <div
                          key={rec._id}
                          className="bg-[#08090d] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/10"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: rec.color || "#ef4444" }}
                              />
                              <span className="font-bold text-white text-sm">{rec.name}</span>
                              <span className="text-gray-400 text-xs">({rec.email})</span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3">
                              <span>Role: <strong className="text-gray-300">{rec.role || "Signer"}</strong></span>
                              <span>•</span>
                              <span>
                                Status:{" "}
                                <strong className={isSigned ? "text-emerald-400" : "text-amber-400"}>
                                  {rec.status?.toUpperCase()}
                                </strong>
                              </span>
                              {rec.lastRemindedAt && (
                                <>
                                  <span>•</span>
                                  <span>Reminded: {new Date(rec.lastRemindedAt).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {!isSigned && (
                            <button
                              disabled={remindingRecipientId === rec._id}
                              onClick={() => handleSendReminder(rec._id)}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
                            >
                              {remindingRecipientId === rec._id ? "Sending..." : "Send Reminder"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setIsRecipientsModalOpen(false)}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Audit Trail Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Cryptographic Audit Trail
              </h3>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {isAuditLoading ? (
              <div className="py-12 flex justify-center">
                <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
              </div>
            ) : selectedAudit ? (
              <div className="space-y-4 text-xs text-gray-300 max-h-[60vh] overflow-y-auto pr-1">
                <div className="bg-[#08090d] p-4 rounded-xl space-y-1 border border-white/10">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Document Title</p>
                  <p className="text-white font-semibold text-sm">{selectedAudit.pdf?.originalFileName}</p>
                </div>

                {selectedAudit.auditLogs?.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">No audit records logged yet.</p>
                ) : (
                  selectedAudit.auditLogs?.map((log, index) => (
                    <div key={log._id || index} className="bg-[#08090d] p-4 rounded-xl space-y-2.5 border border-white/10">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-red-400 capitalize">{log.event || "Signature"} Entry</span>
                        <span className="text-gray-400 font-mono text-[11px]">{new Date(log.signedAt || log.createdAt).toLocaleString()}</span>
                      </div>

                      {log.actorName && (
                        <p className="text-xs text-gray-300">
                          Actor: <strong className="text-white">{log.actorName}</strong> ({log.actorEmail})
                        </p>
                      )}

                      {log.description && (
                        <p className="text-xs text-gray-400 italic">"{log.description}"</p>
                      )}

                      {log.originalHash && (
                        <div>
                          <p className="text-[10px] text-gray-400 font-mono uppercase">Original Document Hash (SHA-256):</p>
                          <p className="text-xs font-mono bg-black/60 p-2 rounded-lg text-emerald-300 break-all border border-emerald-950">
                            {log.originalHash}
                          </p>
                        </div>
                      )}

                      {log.signedHash && (
                        <div>
                          <p className="text-[10px] text-gray-400 font-mono uppercase">Signed Document Hash (SHA-256):</p>
                          <p className="text-xs font-mono bg-black/60 p-2 rounded-lg text-red-400 break-all border border-red-950">
                            {log.signedHash}
                          </p>
                        </div>
                      )}

                      {log.ipAddress && (
                        <p className="text-[10px] font-mono text-gray-500">IP: {log.ipAddress}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-xs">No audit trail records found.</p>
            )}

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              {selectedAudit?.pdf?._id && (
                <a
                  href={`${import.meta.env.VITE_API_BASE_URL}/api/pdf/${selectedAudit.pdf._id}/audit-certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Audit Certificate (PDF)</span>
                </a>
              )}

              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
