import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import FieldPalette from "../components/FieldPalette";
import DraggableField from "../components/DraggableField";
import SignatureUpload from "../components/SignatureUpload";
import API from "../api/axios";
import { useSelector } from "react-redux";

export default function PdfEditor() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fields, setFields] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });
  const [signatureUrl, setSignatureUrl] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const accessToken = useSelector((state) => state.auth.accessToken);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    if (!accessToken) {
      navigate("/login");
      return;
    }

    const fetchPdf = async () => {
      try {
        setIsLoading(true);
        const res = await API.get(`/pdf/${pdfId}`);
        const url = `${import.meta.env.VITE_API_BASE_URL}${res.data.data.url}`;
        setPdfUrl(url);
      } catch (error) {
        console.error("Error fetching PDF:", error);
        alert("Error loading PDF. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPdf();
  }, [pdfId, accessToken, navigate]);

  const handlePageRender = ({ width, height }) => {
    setPageDims({ width, height });
  };

  const addField = (type) => {
    const newField = {
      id: crypto.randomUUID(),
      type,
      page: currentPage,
      xPercent: 0.1,
      yPercent: 0.1,
      widthPercent: 0.2,
      heightPercent: 0.08,
      value: type === "date" ? new Date().toLocaleDateString() : "",
      checked: false,
      signatureUrl: "",
    };
    setFields((prev) => [...prev, newField]);
  };

  const updateField = (updatedField) => {
    setFields((all) => all.map((x) => (x.id === updatedField.id ? updatedField : x)));
  };
 const removeField = (id) => {
  setFields((prev) => prev.filter((f) => f.id !== id));
};

  const signPdf = async () => {
    try {
      setIsSigning(true);

      // Validate fields
      const hasEmptyTextFields = fields.some((f) => f.type === "text" && !f.value.trim());
      if (hasEmptyTextFields) {
        alert("Please fill in all text fields before signing.");
        setIsSigning(false);
        return;
      }

      const hasSignatureFields = fields.some((f) => f.type === "signature");
      const hasSignature = hasSignatureFields && signatureUrl;

      if (hasSignatureFields && !hasSignature) {
        alert("Please upload a signature before signing.");
        setIsSigning(false);
        return;
      }

      // Add signature URL to signature fields
      const fieldsWithSignature = fields.map((f) => (f.type === "signature" ? { ...f, signatureUrl } : f));

      const response = await API.post("/pdf/sign", { pdfId, fields: fieldsWithSignature });

      // Download the signed PDF
      const url = `${import.meta.env.VITE_API_BASE_URL}${response.data.data.signedPdfUrl}`;
      window.open(url, "_blank", "noopener,noreferrer");

      alert("PDF signed and downloaded successfully!");
    } catch (error) {
      console.error("Error signing PDF:", error);
      alert(error.response?.data?.message || "Error signing PDF. Please try again.");
    } finally {
      setIsSigning(false);
    }
  };

  if (!pdfUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-full mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Loading PDF</h2>
          <p className="text-gray-300">Please wait while we prepare your document...</p>
          <div className="mt-6 flex justify-center">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-black bg-opacity-20 backdrop-blur-sm border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Logo */}
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white">PDF Editor</h1>
              </div>
              
              {/* Document Info */}
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Document ID: {pdfId}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{user?.name || user?.email}</span>
              </div>
              
              {/* Toggle Sidebar */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-gray-300 hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Back Button */}
              <button
                onClick={() => navigate("/upload")}
                className="p-2 rounded-lg text-gray-300 hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 overflow-hidden bg-black bg-opacity-20 backdrop-blur-sm border-r border-gray-700`}>
          <div className="p-6 h-full overflow-y-auto">
            <div className="space-y-6">
              {/* Field Palette */}
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Field Tools
                </h3>
                <FieldPalette onAdd={addField} />
              </div>

              {/* Signature Upload */}
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Signature
                </h3>
                <SignatureUpload
                  onUploaded={(url) => {
                    setSignatureUrl(url);
                    setFields((prev) =>
                      prev.map((f) =>
                        f.type === "signature" && !f.signatureUrl
                          ? { ...f, signatureUrl: url }
                          : f
                      )
                    );
                  }}
                />
              </div>

              {/* Fields Summary */}
              <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Fields Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>Total Fields:</span>
                    <span className="font-medium">{fields.length}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Current Page:</span>
                    <span className="font-medium">{currentPage}</span>
                  </div>
                </div>
              </div>

              {/* Sign Button */}
              <button
                onClick={signPdf}
                disabled={isSigning}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {isSigning ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sign & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="flex flex-col h-full">
            {/* Page Navigation */}
            <div className="bg-black bg-opacity-20 backdrop-blur-sm border-b border-gray-700 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-lg text-gray-300 hover:bg-white hover:bg-opacity-10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-white font-medium">
                    Page {currentPage}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-2 rounded-lg text-gray-300 hover:bg-white hover:bg-opacity-10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Click on fields to edit. Drag to reposition.</span>
                </div>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-transparent">
              <div className="relative inline-block">
                <PdfViewer
                  fileUrl={pdfUrl}
                  pageNumber={currentPage}
                  onPageRender={handlePageRender}
                />
                
                {/* Overlay Layer for Fields */}
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: pageDims.width,
                    height: pageDims.height,
                  }}
                >
                  {fields
                    .filter((f) => f.page === currentPage)
                    .map((f) => (
                      <DraggableField
                        key={f.id}
                        field={f}
                        pageWidth={pageDims.width}
                        pageHeight={pageDims.height}
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