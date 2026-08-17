import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchMyTemplatesApi,
  fetchPrebuiltTemplatesApi,
  importPrebuiltTemplateApi,
  deleteTemplateApi,
  createTemplateApi,
} from "../api/template.api";
import Navbar from "../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

export default function Templates() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("my"); // "my" or "library"
  const [templates, setTemplates] = useState([]);
  const [prebuiltTemplates, setPrebuiltTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [importingId, setImportingId] = useState(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [roles, setRoles] = useState([
    { id: "role-1", name: "Signer 1", color: "#3b82f6", signingOrder: 1 },
  ]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [myData, prebuiltData] = await Promise.all([
        fetchMyTemplatesApi(),
        fetchPrebuiltTemplatesApi().catch(() => []),
      ]);
      setTemplates(myData || []);
      setPrebuiltTemplates(prebuiltData || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      await deleteTemplateApi(id);
      setTemplates((prev) => prev.filter((t) => (t._id !== id && t.id !== id)));
      toast.success("Template deleted");
    } catch (err) {
      console.error("Delete template error:", err);
      toast.error("Failed to delete template");
    }
  };

  const handleImportPrebuilt = async (prebuiltId, autoUse = false) => {
    try {
      setImportingId(prebuiltId);
      const imported = await importPrebuiltTemplateApi(prebuiltId);
      setTemplates((prev) => [imported, ...prev]);

      if (autoUse) {
        toast.success("Template imported! Opening dispatch wizard...");
        navigate(`/templates/use/${imported._id || imported.id}`);
      } else {
        toast.success("Template added to Your Templates!");
        setActiveTab("my");
      }
    } catch (err) {
      console.error("Import template error:", err);
      toast.error(err.response?.data?.message || "Failed to import template");
    } finally {
      setImportingId(null);
    }
  };

  const addRole = () => {
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#ef4444"];
    const nextIdx = roles.length % colors.length;
    setRoles((prev) => [
      ...prev,
      {
        id: `role-${Date.now()}`,
        name: `Signer ${prev.length + 1}`,
        color: colors[nextIdx],
        signingOrder: prev.length + 1,
      },
    ]);
  };

  const updateRole = (id, newName) => {
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: newName } : r))
    );
  };

  const removeRole = (id) => {
    if (roles.length <= 1) {
      toast.error("Template requires at least one role");
      return;
    }
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!templateFile) {
      toast.error("Please upload a source PDF for this template");
      return;
    }
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    try {
      setIsCreating(true);
      const formData = new FormData();
      formData.append("pdf", templateFile);
      formData.append("name", templateName.trim());
      formData.append("description", templateDesc.trim());
      formData.append("roles", JSON.stringify(roles));
      formData.append("fields", JSON.stringify([]));

      const created = await createTemplateApi(formData);
      toast.success("Template created! Now place your default form fields.");
      setIsCreateModalOpen(false);
      navigate(`/templates/edit/${created._id || created.id}`);
    } catch (err) {
      console.error("Create template error:", err);
      toast.error(err.response?.data?.message || "Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredMy = templates.filter((t) =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPrebuilt = prebuiltTemplates.filter((t) =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white">
              Document Templates
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Create custom reusable agreements or choose from our vetted contract library.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/templates/bulk")}
              className="inline-flex items-center justify-center px-4 py-3 bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 hover:text-white font-bold rounded-xl shadow-lg border border-purple-800/40 text-xs transition-all hover:scale-105 active:scale-95"
            >
              <span className="mr-1.5">⚡</span>
              Bulk Send (CSV)
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 text-xs transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Create Custom Template
            </button>
          </div>
        </div>


        {/* Tab & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12141c] p-4 rounded-2xl border border-white/10 shadow-lg">
          {/* Tabs */}
          <div className="flex bg-[#08090d] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "my"
                  ? "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-md border border-red-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>My Templates</span>
              <span className="px-1.5 py-0.2 bg-black/40 rounded text-[10px] font-mono">
                {templates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("library")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "library"
                  ? "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-md border border-red-500/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>Prebuilt Library</span>
              <span className="px-1.5 py-0.2 bg-red-950/80 text-red-300 border border-red-800/50 rounded text-[10px] font-mono">
                {prebuiltTemplates.length} Pro
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md w-full">
            <input
              type="text"
              placeholder="Search templates by title or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#08090d] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-xs font-medium"
            />
            <svg
              className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Tab 1: User's Templates */}
        {activeTab === "my" && (
          <div>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
              </div>
            ) : filteredMy.length === 0 ? (
              <div className="text-center py-16 bg-[#12141c] rounded-3xl border border-white/10 p-8 shadow-2xl space-y-5">
                <div className="w-16 h-16 bg-red-950/60 border border-red-800/40 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white">No custom templates yet</h3>
                  <p className="text-gray-400 text-xs max-w-md mx-auto mt-1">
                    Get started by choosing from our 5 prebuilt legal agreements, or upload your own contract!
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveTab("library")}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-800 text-white text-xs font-bold rounded-xl shadow-lg transition-all hover:scale-105"
                  >
                    Browse Prebuilt Library (5 Contracts) →
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 transition-all"
                  >
                    Upload Custom PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMy.map((t) => {
                  const templateId = t._id || t.id;
                  return (
                    <div
                      key={templateId}
                      className="bg-[#12141c] border border-white/10 hover:border-red-600/50 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-2xl hover:shadow-red-950/40 group space-y-5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-red-950/60 border border-red-800/40 text-red-400 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner">
                            TPL
                          </div>
                          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-gray-300">
                            {t.usageCount || 0} Uses
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                            {t.name}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 mt-1 min-h-[32px]">
                            {t.description || "No description provided."}
                          </p>
                        </div>

                        {/* Roles Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(t.roles || []).map((r, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${r.color}20`,
                                borderColor: `${r.color}60`,
                                color: r.color,
                              }}
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                        <button
                          onClick={() => navigate(`/templates/use/${templateId}`)}
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold text-xs rounded-xl shadow-md shadow-red-950/50 border border-red-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Use Template</span>
                        </button>

                        <button
                          onClick={() => navigate(`/templates/bulk?templateId=${templateId}`)}
                          className="p-2.5 bg-purple-950/40 hover:bg-purple-900/70 text-purple-300 hover:text-white rounded-xl text-xs font-bold border border-purple-800/30 transition-colors"
                          title="Bulk Send (CSV)"
                        >
                          <span>⚡</span>
                        </button>

                        <button
                          onClick={() => navigate(`/templates/edit/${templateId}`)}
                          className="p-2.5 bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 transition-colors"
                          title="Edit Template Layout & Fields"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>


                        <button
                          onClick={() => handleDelete(templateId, t.name)}
                          className="p-2.5 bg-red-950/50 hover:bg-red-900/80 text-red-300 hover:text-white rounded-xl text-xs font-bold border border-red-800/40 transition-colors"
                          title="Delete Template"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Prebuilt Templates Library */}
        {activeTab === "library" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-red-950/60 to-[#12141c] border border-red-800/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div>
                <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
                  Vetted Standard Contracts
                </span>
                <h2 className="text-xl font-display font-extrabold text-white mt-0.5">
                  Ready-to-Use Legal Templates
                </h2>
                <p className="text-gray-300 text-xs mt-1 max-w-xl">
                  Each template comes with pre-configured signer roles, signature anchors, and date fields. Click <strong>"Use Now"</strong> to instantly dispatch.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrebuilt.map((tpl) => {
                const isImporting = importingId === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    className="bg-[#12141c] border border-white/10 hover:border-red-600/50 rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-2xl hover:shadow-red-950/40 group space-y-6"
                  >
                    <div className="space-y-4">
                      {/* Category & Badge */}
                      <div className="flex items-start justify-between">
                        <span className="px-2.5 py-1 bg-red-950/70 text-red-300 border border-red-800/50 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          {tpl.pageCount} Page
                        </span>
                      </div>

                      {/* Title & Desc */}
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-gray-400 line-clamp-3 mt-1.5 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      {/* Roles */}
                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Included Signer Roles:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {tpl.roles.map((r, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{
                                backgroundColor: `${r.color}20`,
                                borderColor: `${r.color}60`,
                                color: r.color,
                              }}
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-4 border-t border-white/10 space-y-2">
                      <button
                        onClick={() => handleImportPrebuilt(tpl.id, true)}
                        disabled={isImporting}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-red-950/50 border border-red-500/30 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>{isImporting ? "Preparing Template..." : "Use Now (Fast Fill)"}</span>
                      </button>

                      <button
                        onClick={() => handleImportPrebuilt(tpl.id, false)}
                        disabled={isImporting}
                        className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy to My Templates</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Create Custom Template Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#12141c] border border-white/10 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-xl font-display font-bold text-white">Create Custom Template</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-5">
              {/* PDF Upload */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-2">
                  1. Source PDF Document
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setTemplateFile(e.target.files[0])}
                  className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                />
              </div>

              {/* Template Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-2">
                  2. Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Non-Disclosure Agreement (NDA)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-300 mb-2">
                  3. Description / Use Case
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Mutual confidentiality agreement for contractors and partners."
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Template Roles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-gray-300">
                    4. Signer Roles (Placeholders)
                  </label>
                  <button
                    type="button"
                    onClick={addRole}
                    className="text-xs text-red-400 hover:text-red-300 font-bold"
                  >
                    + Add Role
                  </button>
                </div>

                <div className="space-y-2">
                  {roles.map((r, idx) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-md text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: r.color }}
                      >
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={r.name}
                        onChange={(e) => updateRole(r.id, e.target.value)}
                        placeholder="e.g. Client, Manager, Landlord"
                        className="flex-1 px-3 py-2 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
                      />
                      {roles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRole(r.id)}
                          className="text-gray-500 hover:text-red-400 p-1 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30"
                >
                  {isCreating ? "Uploading Template..." : "Save & Place Fields →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
