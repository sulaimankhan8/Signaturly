import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import PdfViewer from "../components/PdfViewer";
import DraggableField from "../components/DraggableField";
import SignatureManager from "../components/SignatureManager";
import {
  fetchSigningSessionApi,
  submitPublicSignatureApi,
  declinePublicSigningApi,
} from "../api/signing.api";
import toast, { Toaster } from "react-hot-toast";
import { OtpVerificationModal } from "../components/OtpVerificationModal";

export default function SigningPage() {
  const { token } = useParams();

  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageDims, setPageDims] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const [activeSignatureUrl, setActiveSignatureUrl] = useState(
    localStorage.getItem("signaturly_default_signature") || ""
  );
  const [activeInitialsUrl, setActiveInitialsUrl] = useState(
    localStorage.getItem("signaturly_default_initials") || ""
  );


  const isFieldMine = useCallback((f) => {
    if (!session?.recipient) return false;
    const rId = session.recipient.id?.toString();
    const rEmail = session.recipient.email?.trim().toLowerCase();
    const rName = session.recipient.name?.trim().toLowerCase();

    return (
      (f.recipientId && f.recipientId.toString() === rId) ||
      (f.recipientEmail && f.recipientEmail.trim().toLowerCase() === rEmail) ||
      (f.roleId && (session.recipient.role === f.roleId || session.recipient.role === f.roleName)) ||
      (f.recipientName && f.recipientName.trim().toLowerCase() === rName)
    );
  }, [session]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSigningSessionApi(token);
        setSession(data);
        setTotalPages(data.document.pageCount || 1);

        const initialFields = (data.document.fields || []).map((f) => {
          const isMine =
            (f.recipientId && f.recipientId.toString() === data.recipient.id?.toString()) ||
            (f.recipientEmail && f.recipientEmail.trim().toLowerCase() === data.recipient.email?.trim().toLowerCase()) ||
            (f.recipientName && f.recipientName.trim().toLowerCase() === data.recipient.name?.trim().toLowerCase());

          // Pre-populate date for this signer if empty
          if (isMine && f.type === "date" && !f.value) {
            return { ...f, value: new Date().toLocaleDateString() };
          }
          return f;
        });

        setFields(initialFields);

        if (!data.recipient.authType || data.recipient.authType === "none" || data.recipient.authVerified) {
          setIsOtpVerified(true);
        }

        if (data.recipient.status === "signed") {
          setIsCompleted(true);
        }
      } catch (err) {
        console.error("Error loading signing session:", err);
        setError(
          err.response?.data?.message ||
            "Unable to load signing session. The link may be expired or invalid."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [token]);

  const handlePageRender = ({ width, height }) => {
    setPageDims({ width, height });
  };

  const updateField = (updatedField) => {
    setFields((all) =>
      all.map((x) => (x.id === updatedField.id ? updatedField : x))
    );
  };

  const handleApplySignatureToAllMine = (sigUrl) => {
    setActiveSignatureUrl(sigUrl);
    setFields((prev) =>
      prev.map((f) => {
        if (isFieldMine(f) && f.type === "signature") {
          return { ...f, signatureUrl: sigUrl, value: sigUrl };
        }
        return f;
      })
    );
    toast.success("Signature applied!");
  };

  const handleApplyInitialsToAllMine = (initUrl) => {
    setActiveInitialsUrl(initUrl);
    setFields((prev) =>
      prev.map((f) => {
        if (isFieldMine(f) && f.type === "initials") {
          return { ...f, signatureUrl: initUrl, value: initUrl };
        }
        return f;
      })
    );
    toast.success("Initials applied!");
  };

  const handleFieldClick = (field) => {
    if (!isFieldMine(field)) {
      toast("This field is assigned to another signer");
      return;
    }

    if (field.type === "signature") {
      if (activeSignatureUrl && !field.signatureUrl) {
        updateField({ ...field, signatureUrl: activeSignatureUrl, value: activeSignatureUrl });
        toast.success("Signature placed!");
      } else {
        setSignatureModalOpen(true);
      }
    } else if (field.type === "initials") {
      if (activeInitialsUrl && !field.signatureUrl) {
        updateField({ ...field, signatureUrl: activeInitialsUrl, value: activeInitialsUrl });
        toast.success("Initials placed!");
      } else {
        setSignatureModalOpen(true);
      }
    }
  };

  const myFields = fields.filter(isFieldMine);

  const handleSubmitSignature = async () => {
    // 1. Check if required signatures or initials are missing
    const mySigFields = myFields.filter((f) => f.type === "signature");
    const myInitFields = myFields.filter((f) => f.type === "initials");

    if (mySigFields.length > 0 && !activeSignatureUrl && !mySigFields.some((f) => f.signatureUrl || f.value)) {
      toast.error("Please place your signature before completing.");
      setSignatureModalOpen(true);
      return;
    }

    if (myInitFields.length > 0 && !activeInitialsUrl && !myInitFields.some((f) => f.signatureUrl || f.value)) {
      toast.error("Please provide your initials mark before completing.");
      setSignatureModalOpen(true);
      return;
    }

    // 2. Prepare payload with all completed fields for this signer
    const filledFields = fields.map((f) => {
      if (isFieldMine(f)) {
        if (f.type === "signature") {
          const finalSig = f.signatureUrl || f.value || activeSignatureUrl;
          return { ...f, signatureUrl: finalSig, value: finalSig };
        }
        if (f.type === "initials") {
          const finalInit = f.signatureUrl || f.value || activeInitialsUrl || activeSignatureUrl;
          return { ...f, signatureUrl: finalInit, value: finalInit };
        }
        if (f.type === "date") {
          return { ...f, value: f.value || new Date().toLocaleDateString() };
        }
      }
      return f;
    });

    let toastId = null;
    try {
      setIsSubmitting(true);
      toastId = toast.loading("Cryptographically sealing your signature into the document...");

      await submitPublicSignatureApi(token, filledFields);

      if (toastId) toast.dismiss(toastId);
      toast.success("Document legally signed and executed!");
      setIsCompleted(true);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error submitting signature:", err);
      toast.error(err.response?.data?.message || "Failed to submit signature");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }

    try {
      setIsSubmitting(true);
      await declinePublicSigningApi(token, declineReason);
      toast.success("Decline notice dispatched to sender");
      setDeclineModalOpen(false);
      setIsDeclined(true);
    } catch (err) {
      console.error("Decline error:", err);
      toast.error("Failed to decline document");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-white/10 border-t-red-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-xs font-semibold">
            Loading secure legal signing vault session...
          </p>
        </div>
      </div>
    );
  }

  if (error || isDeclined) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-[#12141c] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/40 text-red-400 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-white">
            {isDeclined ? "Document Declined" : "Access Restricted"}
          </h2>
          <p className="text-xs text-gray-400">
            {isDeclined
              ? "You have declined to sign this document. The sender has been notified."
              : error}
          </p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-[#12141c] border border-emerald-800/40 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-white">
              Legally Signed & Executed!
            </h2>
            <p className="text-xs text-gray-400 mt-2">
              Thank you, <strong className="text-white">{session?.recipient.name}</strong>. Your electronic signature is cryptographically bound to this document under Section 10A of the Indian IT Act 2000 & US ESIGN standards.
            </p>
          </div>

          <div className="bg-[#08090d] p-4 rounded-xl border border-white/10 text-xs text-gray-300 text-left space-y-1">
            <p className="text-[10px] uppercase font-bold text-gray-500">Executed Agreement</p>
            <p className="text-white font-semibold">{session?.document.originalFileName}</p>
            <p className="text-[11px] text-emerald-400 mt-1 font-mono">Sealed at {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  }

  // Pre-Canvas Authentication Safeguard (OTP or Passcode)
  if (!isOtpVerified && session?.recipient?.authType && session?.recipient?.authType !== "none") {
    return (
      <OtpVerificationModal
        token={token}
        recipientEmail={session?.recipient?.email}
        documentTitle={session?.document?.originalFileName}
        authType={session?.recipient?.authType}
        onVerified={() => setIsOtpVerified(true)}
      />
    );
  }


  const pdfUrl = `${import.meta.env.VITE_API_BASE_URL}${session?.document.pdfUrl}`;

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans flex flex-col selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-[#08090d]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-950 rounded-xl flex items-center justify-center border border-red-500/30 shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {session?.document.originalFileName}
              </h1>
              <p className="text-[10px] text-gray-400">
                Signing as: <strong className="text-red-400">{session?.recipient.name}</strong> ({session?.recipient.email})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setDeclineModalOpen(true)}
              className="px-3 py-2 bg-white/5 hover:bg-red-950/40 text-gray-300 hover:text-red-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            >
              Decline
            </button>

            <button
              onClick={handleSubmitSignature}
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sealing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Agree & Sign Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Signing Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 hidden lg:block overflow-y-auto bg-[#12141c] border-r border-white/10 p-5 space-y-6">
          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
              Signature & Initials Studio
            </h3>
            <p className="text-[11px] text-gray-400">
              Create your verified e-signature or initials to seal required fields.
            </p>

            <SignatureManager
              signerName={session?.recipient.name}
              defaultSignatureUrl={activeSignatureUrl}
              defaultInitialsUrl={activeInitialsUrl}
              onUploaded={handleApplySignatureToAllMine}
              onInitialsUploaded={handleApplyInitialsToAllMine}
            />
          </div>

          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-2">
            <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
              Your Required Fields ({myFields.length})
            </h3>
            <p className="text-[10px] text-gray-400">
              Click directly on the contract fields to sign or fill text.
            </p>

            <div className="space-y-1.5 pt-2">
              {myFields.map((f, idx) => (
                <div
                  key={f.id}
                  onClick={() => handleFieldClick(f)}
                  className="p-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="capitalize font-semibold text-gray-200">
                    #{idx + 1} {f.type} (Page {f.page})
                  </span>
                  <span className={`text-[10px] font-bold ${f.signatureUrl || f.value ? "text-emerald-400" : "text-amber-400"}`}>
                    {f.signatureUrl || f.value ? "Filled" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* PDF Viewer */}
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

            <button
              onClick={() => setSignatureModalOpen(true)}
              className="lg:hidden px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold"
            >
              Sign / Initials Studio
            </button>
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
                    .map((f) => {
                      const isMine = isFieldMine(f);

                      return (
                        <div
                          key={f.id}
                          onClick={() => handleFieldClick(f)}
                          className="cursor-pointer"
                        >
                          <DraggableField
                            field={f}
                            pageWidth={pageDims.width}
                            pageHeight={pageDims.height}
                            isSelected={f.id === selectedFieldId}
                            onSelect={isMine ? setSelectedFieldId : () => {}}
                            onUpdate={isMine ? updateField : () => {}}
                            onRemove={() => {}}
                            signerColor={isMine ? session?.recipient.color : "#6b7280"}
                            signerName={isMine ? "You" : (f.recipientName || f.roleName)}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Decline Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-display font-bold text-white">Decline to Sign</h3>
            <p className="text-xs text-gray-400">
              Please specify the reason why you are declining to execute this agreement.
            </p>

            <textarea
              rows={4}
              required
              placeholder="e.g. Terms require amendment..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Capture Modal */}
      {signatureModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-base font-display font-bold text-white">Signature & Initials Studio</h3>
              <button onClick={() => setSignatureModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <SignatureManager
              signerName={session?.recipient.name}
              defaultSignatureUrl={activeSignatureUrl}
              defaultInitialsUrl={activeInitialsUrl}
              onUploaded={(url) => {
                handleApplySignatureToAllMine(url);
                setSignatureModalOpen(false);
              }}
              onInitialsUploaded={(url) => {
                handleApplyInitialsToAllMine(url);
                setSignatureModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
