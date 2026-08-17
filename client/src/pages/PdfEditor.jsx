import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import PdfViewer from "../components/PdfViewer";
import FieldPalette from "../components/FieldPalette";
import DraggableField from "../components/DraggableField";
import SignatureManager from "../components/SignatureManager";
import API from "../api/axios";
import { useSelector } from "react-redux";

export default function PdfEditor() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [fields, setFields] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });
  const [signatureUrl, setSignatureUrl] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  const accessToken = useSelector((state) => state.auth.accessToken);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    if (!accessToken) {
      navigate("/login");
      return;
    }

    const fetchPdf = async () => {
      try {
        const res = await API.get(`/pdf/${pdfId}`);
        const data = res.data.data;
        const url = `${import.meta.env.VITE_API_BASE_URL}${data.url}`;
        setPdfUrl(url);
        setDocTitle(data.originalFileName || "Document");
        setTotalPages(data.pageCount || 1);
      } catch (error) {
        console.error("Error fetching PDF:", error);
        toast.error("Failed to load document. Please try again.");
      }
    };

    fetchPdf();
  }, [pdfId, accessToken, navigate]);

  const handlePageRender = ({ width, height }) => {
    setPageDims({ width, height });
  };

  const addField = (type) => {
    const newFieldId = crypto.randomUUID();
    const newField = {
      id: newFieldId,
      type,
      page: currentPage,
      xPercent: 0.2,
      yPercent: 0.2,
      widthPercent: type === "radio" || type === "checkbox" ? 0.05 : (type === "signature" ? 0.3 : 0.25),
      heightPercent: type === "radio" || type === "checkbox" ? 0.04 : (type === "signature" ? 0.12 : 0.06),
      value: type === "date" ? new Date().toLocaleDateString() : "",
      checked: false,
      signatureUrl: type === "signature" ? signatureUrl : "",
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newFieldId);
    toast.success(`Added ${type} field`);
  };

  const updateField = (updatedField) => {
    setFields((all) => all.map((x) => (x.id === updatedField.id ? updatedField : x)));
  };

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    toast.success("Field removed");
  };

  const signPdf = async () => {
    let toastId = null;
    try {
      setIsSigning(true);

      const hasEmptyTextFields = fields.some((f) => f.type === "text" && !f.value?.trim());
      if (hasEmptyTextFields) {
        toast.error("Please fill in all text fields before signing.");
        setIsSigning(false);
        return;
      }

      const hasSignatureFields = fields.some((f) => f.type === "signature");
      const hasMissingSignature = fields.some(
        (f) => f.type === "signature" && (!f.signatureUrl && !signatureUrl)
      );

      if (hasSignatureFields && hasMissingSignature) {
        toast.error("Please draw, type, or upload a signature asset before signing.");
        setIsSigning(false);
        return;
      }

      const fieldsWithSignature = fields.map((f) =>
        f.type === "signature" ? { ...f, signatureUrl: f.signatureUrl || signatureUrl } : f
      );

      toastId = toast.loading("Embedding e-signatures & generating PDF...");
      const response = await API.post("/pdf/sign", { pdfId, fields: fieldsWithSignature });

      if (toastId) toast.dismiss(toastId);
      toast.success("PDF signed and saved successfully!");

      const url = `${import.meta.env.VITE_API_BASE_URL}${response.data.data.signedPdfUrl}`;
      window.open(url, "_blank", "noopener,noreferrer");

      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (error) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error signing PDF:", error);
      toast.error(error.response?.data?.message || "Error signing PDF. Please try again.");
    } finally {
      setIsSigning(false);
    }
  };

  if (!pdfUrl) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4 animate-pulse shadow-lg shadow-red-900/40">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Loading PDF Document</h2>
          <p className="text-gray-400 text-xs">Please wait while we load your document...</p>
          <div className="mt-6 flex justify-center">
            <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
          </div>
        </div>
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
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Return to Gallery"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Gallery</span>
            </button>

            <div className="h-6 w-px bg-white/10" />

            <div>
              <h1 className="text-sm sm:text-base font-bold text-white max-w-[150px] sm:max-w-md truncate" title={docTitle}>
                {docTitle}
              </h1>
              <p className="text-[10px] text-gray-400 font-mono">ID: {pdfId?.slice(-8)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => navigate(`/send/${pdfId}`)}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Send document to multiple recipients"
            >
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Send for Signature</span>
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
              title="Toggle Toolbox Sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 overflow-hidden bg-[#12141c] border-r border-white/10 z-30`}>
          <div className="p-5 h-full overflow-y-auto space-y-6">
            {/* Field Palette */}
            <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 shadow-lg">
              <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Field Tools
              </h3>
              <FieldPalette onAdd={addField} />
            </div>

            {/* Signature Studio Asset Manager */}
            <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 shadow-lg">
              <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Signature Studio
              </h3>
              <SignatureManager
                defaultSignatureUrl={signatureUrl}
                onUploaded={(url) => {
                  setSignatureUrl(url);
                  setFields((prev) =>
                    prev.map((f) =>
                      f.type === "signature" || f.type === "initials"
                        ? { ...f, signatureUrl: url }
                        : f
                    )
                  );
                }}
              />
            </div>

            {/* Fields Summary */}
            <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 shadow-lg">
              <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Fields
                </span>
                <span className="text-red-400 font-mono text-xs">{fields.length}</span>
              </h3>
              {fields.length === 0 ? (
                <p className="text-xs text-gray-500">No fields added yet. Select a tool above.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {fields.map((f, idx) => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedFieldId === f.id
                          ? "bg-red-950/60 text-red-300 border border-red-800/60 font-bold"
                          : "bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      <span className="capitalize font-semibold">#{idx + 1} {f.type}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(f.id);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sign & Save CTA */}
            <button
              onClick={signPdf}
              disabled={isSigning}
              className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-lg shadow-red-950/50 flex items-center justify-center space-x-2 border border-red-500/30"
            >
              {isSigning ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Sign & Save PDF</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Page Controls Toolbar */}
          <div className="bg-[#12141c] border-b border-white/10 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-xs font-mono font-bold text-white bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Click tool to place. Drag or select field to edit.</span>
            </div>
          </div>

          {/* PDF Viewer Canvas Area */}
          <div
            className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-[#08090d] select-none"
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