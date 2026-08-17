import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import FieldPalette from "../components/FieldPalette";
import DraggableField from "../components/DraggableField";
import { fetchTemplateDetailsApi, updateTemplateApi } from "../api/template.api";
import toast, { Toaster } from "react-hot-toast";

export default function TemplateEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState([]);
  const [roles, setRoles] = useState([]);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const data = await fetchTemplateDetailsApi(templateId);
        setTemplate(data);
        setTotalPages(data.pageCount || 1);
        setRoles(data.roles || []);
        setActiveRoleId(data.roles?.[0]?.id || null);
        setFields(data.fields || []);

        const url = `${import.meta.env.VITE_API_BASE_URL}${data.pdfUrl}`;
        setPdfUrl(url);
      } catch (err) {
        console.error("Error loading template details:", err);
        toast.error("Failed to load template layout");
        navigate("/templates");
      }
    };
    loadTemplate();
  }, [templateId, navigate]);

  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];

  const handlePageRender = ({ width, height }) => {
    setPageDims({ width, height });
  };

  const addField = (type) => {
    if (!activeRole) {
      toast.error("Please select a template role first");
      return;
    }

    const newFieldId = crypto.randomUUID();
    const newField = {
      id: newFieldId,
      roleId: activeRole.id,
      roleName: activeRole.name,
      roleColor: activeRole.color,
      type,
      page: currentPage,
      xPercent: 0.2,
      yPercent: 0.2,
      widthPercent:
        type === "radio" || type === "checkbox"
          ? 0.05
          : type === "signature" || type === "initials"
          ? 0.3
          : 0.25,
      heightPercent:
        type === "radio" || type === "checkbox"
          ? 0.04
          : type === "signature" || type === "initials"
          ? 0.12
          : 0.06,
      value: "",
      checked: false,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newFieldId);
    toast.success(`Placed ${type} field for ${activeRole.name}`);
  };

  const updateField = (updatedField) => {
    setFields((all) =>
      all.map((x) => (x.id === updatedField.id ? updatedField : x))
    );
  };

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    toast.success("Field removed");
  };

  const handleSaveTemplate = async () => {
    try {
      setIsSaving(true);
      await updateTemplateApi(templateId, {
        fields,
        roles,
      });
      toast.success("Template layout & fields saved successfully!");
    } catch (err) {
      console.error("Save template error:", err);
      toast.error("Failed to save template layout");
    } finally {
      setIsSaving(false);
    }
  };

  if (!pdfUrl) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans flex flex-col selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-[#08090d]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={() => navigate("/templates")}
              className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Templates Gallery</span>
            </button>

            <div className="h-6 w-px bg-white/10" />

            <div>
              <h1 className="text-sm sm:text-base font-bold text-white max-w-[150px] sm:max-w-md truncate">
                {template?.name}
              </h1>
              <p className="text-[10px] text-gray-400">
                Template Editor • {fields.length} predefined fields
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/templates/use/${templateId}`)}
              className="px-4 py-2 bg-white/5 hover:bg-white/15 text-gray-200 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all"
            >
              Use Template Now
            </button>

            <button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all flex items-center gap-2"
            >
              {isSaving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbox Sidebar */}
        <aside className="w-80 overflow-y-auto bg-[#12141c] border-r border-white/10 p-5 space-y-6 z-30">
          {/* Roles Selector */}
          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
              Template Roles
            </h3>

            <div className="space-y-1.5">
              {roles.map((r) => {
                const isActive = r.id === activeRoleId;
                const roleFieldsCount = fields.filter((f) => f.roleId === r.id).length;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRoleId(r.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isActive
                        ? "bg-white/10 shadow-md font-bold"
                        : "bg-white/5 hover:bg-white/10 opacity-70"
                    }`}
                    style={{
                      borderColor: isActive ? r.color : "rgba(255,255,255,0.08)",
                      borderLeftWidth: "4px",
                      borderLeftColor: r.color,
                    }}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div
                        className="w-5 h-5 rounded-md text-white font-bold text-[10px] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: r.color }}
                      >
                        #{r.signingOrder || 1}
                      </div>
                      <p className="text-xs text-white truncate">{r.name}</p>
                    </div>

                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono text-white font-bold"
                      style={{ backgroundColor: `${r.color}30` }}
                    >
                      {roleFieldsCount} fields
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Field Tools for Active Role */}
          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
                Field Tools
              </h3>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${activeRole?.color}25`,
                  color: activeRole?.color,
                }}
              >
                For {activeRole?.name}
              </span>
            </div>

            <FieldPalette onAdd={addField} activeColor={activeRole?.color} />
          </div>

          {/* Fields Summary */}
          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-300">
              <span>Placed Template Fields</span>
              <span className="font-mono text-red-400">{fields.length}</span>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {fields.map((f, idx) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    selectedFieldId === f.id
                      ? "bg-white/15 border font-bold"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                  style={{
                    borderColor: f.roleColor,
                    borderLeftWidth: "3px",
                  }}
                >
                  <span className="text-gray-300 capitalize text-[11px] truncate">
                    #{idx + 1} {f.type} ({f.roleName})
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                    className="text-gray-500 hover:text-red-400 text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#08090d]">
          {/* Page Controls Toolbar */}
          <div className="bg-[#12141c] border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                ◀
              </button>

              <span className="text-xs font-mono font-bold text-white bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                ▶
              </button>
            </div>

            <div className="text-[11px] text-gray-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeRole?.color }} />
              <span>Placing fields assigned to placeholder: <strong className="text-white">{activeRole?.name}</strong></span>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center select-none"
            onClick={() => setSelectedFieldId(null)}
          >
            <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-white/10">
              <PdfViewer
                fileUrl={pdfUrl}
                pageNumber={currentPage}
                onPageRender={handlePageRender}
              />

              <div
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width: pageDims.width,
                  height: pageDims.height,
                }}
              >
                <div className="w-full h-full relative pointer-events-auto">
                  {fields
                    .filter((f) => f.page === currentPage)
                    .map((f) => (
                      <DraggableField
                        key={f.id}
                        field={f}
                        pageWidth={pageDims.width}
                        pageHeight={pageDims.height}
                        isSelected={f.id === selectedFieldId}
                        onSelect={setSelectedFieldId}
                        onUpdate={updateField}
                        onRemove={removeField}
                        signerColor={f.roleColor}
                        signerName={f.roleName}
                      />
                    ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
