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
import { useTranslation } from "react-i18next";
import { SIGNING_LANGUAGES } from "../i18n";
import { formatFieldDate } from "../utils/fieldDate";

// The widest a page is drawn. On a phone the page takes the width of the screen instead.
const MAX_PAGE_WIDTH = 820;

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
  const [hasElectronicConsent, setHasElectronicConsent] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const { t, i18n } = useTranslation();
  const [languageChosen, setLanguageChosen] = useState(false);

  // Width available for the page, so it can be drawn to fit a phone screen
  const [viewerElement, setViewerElement] = useState(null);
  const [viewerWidth, setViewerWidth] = useState(0);

  const changeLanguage = (code) => {
    setLanguageChosen(true);
    i18n.changeLanguage(code);
  };

  const [activeSignatureUrl, setActiveSignatureUrl] = useState("");
  const [activeInitialsUrl, setActiveInitialsUrl] = useState("");

  const isFieldMine = useCallback((f) => {
    if (!session?.recipient) return false;
    const rId = session.recipient.id?.toString();
    const rEmail = session.recipient.email?.trim().toLowerCase();
    const rName = session.recipient.name?.trim().toLowerCase();

    return (
      (f.recipientId && f.recipientId.toString() === rId) ||
      (f.recipientEmail && f.recipientEmail.trim().toLowerCase() === rEmail) ||
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

        // Start in the language the sender chose for this signer, unless they have switched it themselves
        if (!languageChosen && data.recipient.language) {
          i18n.changeLanguage(data.recipient.language);
        }

        const storageKey = data.recipient.email || token;
        try {
          const savedSig = localStorage.getItem(`pactdoc_sig_${storageKey}`) || "";
          const savedInit = localStorage.getItem(`pactdoc_init_${storageKey}`) || "";
          setActiveSignatureUrl(savedSig);
          setActiveInitialsUrl(savedInit);
        } catch (e) {}

        const initialFields = (data.document.fields || []).map((f) => {
          const isMine =
            (f.recipientId && f.recipientId.toString() === data.recipient.id?.toString()) ||
            (f.recipientEmail && f.recipientEmail.trim().toLowerCase() === data.recipient.email?.trim().toLowerCase()) ||
            (f.recipientName && f.recipientName.trim().toLowerCase() === data.recipient.name?.trim().toLowerCase());

          // A date field takes the day of signing unless the signer picks another
          if (isMine && f.type === "date" && !f.value) {
            return { ...f, value: formatFieldDate() };
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
        if (data.recipient.status === "declined") {
          setIsDeclined(true);
        }
      } catch (err) {
        console.error("Error loading signing session:", err);
        setError(
          err.response?.data?.message || t("error.load")
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
    // Reloaded after identity verification and after signing, so the page shows what the server now allows
  }, [token, sessionVersion]);

  // Screen readers and the browser's own text shaping follow the page language
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    if (!viewerElement) return undefined;

    const measure = () => setViewerWidth(viewerElement.clientWidth);
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewerElement);
    return () => observer.disconnect();
  }, [viewerElement]);

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
    if (sigUrl) toast.success(t("toast.signatureApplied"));
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
    if (initUrl) toast.success(t("toast.initialsApplied"));
  };

  const handleFieldClick = (field) => {
    if (!isFieldMine(field)) return;

    if (field.type === "signature") {
      if (activeSignatureUrl && !field.signatureUrl) {
        updateField({ ...field, signatureUrl: activeSignatureUrl, value: activeSignatureUrl });
        toast.success(t("toast.signaturePlaced"));
      } else {
        setSignatureModalOpen(true);
      }
    } else if (field.type === "initials") {
      if (activeInitialsUrl && !field.signatureUrl) {
        updateField({ ...field, signatureUrl: activeInitialsUrl, value: activeInitialsUrl });
        toast.success(t("toast.initialsPlaced"));
      } else {
        setSignatureModalOpen(true);
      }
    }
  };

  const fieldTypeLabel = (type) => t(`fieldType.${type}`, type);

  const myFields = fields.filter(isFieldMine);
  const unfilledMyFields = myFields.filter((f) => {
    if (f.type === "signature" || f.type === "initials") {
      return !f.signatureUrl && !f.value && !activeSignatureUrl;
    }
    return !f.value;
  });

  const jumpToNextUnfilledField = () => {
    if (unfilledMyFields.length === 0) {
      toast.success(t("toast.allFilled"));
      return;
    }

    const nextField = unfilledMyFields[0];
    if (nextField.page !== currentPage) {
      setCurrentPage(nextField.page);
    }
    setSelectedFieldId(nextField.id);
    toast.success(t("toast.focused", { type: fieldTypeLabel(nextField.type), page: nextField.page }));
  };

  const handleSubmitSignature = async () => {
    // 0. Check affirmative electronic consent
    if (!hasElectronicConsent) {
      toast.error(t("consent.required"));
      document.getElementById("electronic-consent-checkbox")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 1. Check if required signatures or initials are missing
    const mySigFields = myFields.filter((f) => f.type === "signature");
    const myInitFields = myFields.filter((f) => f.type === "initials");

    if (mySigFields.length > 0 && !activeSignatureUrl && !mySigFields.some((f) => f.signatureUrl || f.value)) {
      toast.error(t("toast.needSignature"));
      setSignatureModalOpen(true);
      return;
    }

    if (myInitFields.length > 0 && !activeInitialsUrl && !myInitFields.some((f) => f.signatureUrl || f.value)) {
      toast.error(t("toast.needInitials"));
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
          return { ...f, value: f.value || formatFieldDate() };
        }
      }
      return f;
    });

    let toastId = null;
    try {
      setIsSubmitting(true);
      toastId = toast.loading(t("toast.working"));

      await submitPublicSignatureApi(token, filledFields, hasElectronicConsent, session?.consentVersion);

      if (toastId) toast.dismiss(toastId);
      toast.success(t("toast.signed"));
      setIsCompleted(true);
      // Fetch the session again so the download link points at the signed copy
      setSessionVersion((v) => v + 1);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      console.error("Error submitting signature:", err);
      toast.error(err.response?.data?.message || t("toast.signFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast.error(t("toast.declineReason"));
      return;
    }

    try {
      setIsSubmitting(true);
      await declinePublicSigningApi(token, declineReason);
      toast.success(t("toast.declined"));
      setDeclineModalOpen(false);
      setIsDeclined(true);
    } catch (err) {
      console.error("Decline error:", err);
      toast.error(t("toast.declineFailed"));
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
            {t("loading")}
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
            {isDeclined ? t("declined.title") : t("error.title")}
          </h2>
          <p className="text-sm sm:text-xs text-gray-400 leading-relaxed">
            {isDeclined
              ? t("declined.body")
              : error}
          </p>
          <div className="pt-3 border-t border-white/10 text-xs sm:text-[11px] text-gray-500">
            {t("error.hint")}
          </div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const executedDownloadUrl = `${import.meta.env.VITE_API_BASE_URL}${session?.document.pdfUrl}`;
    const signedAt = new Date(session?.recipient.signedAt || Date.now());

    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center p-4">
        <Toaster position="top-right" />
        <div className="bg-[#12141c] border border-emerald-800/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-white">
              {t("completed.title")}
            </h2>
            <p className="text-sm sm:text-xs text-gray-400 mt-2 leading-relaxed">
              <strong className="text-white">{t("completed.thanks", { name: session?.recipient.name })}</strong> {t("completed.body")}
            </p>
          </div>

          <div className="bg-[#08090d] p-4 rounded-xl border border-white/10 text-xs text-gray-300 text-left space-y-1">
            <p className="text-[10px] uppercase font-bold text-gray-500">{t("completed.label")}</p>
            <p className="text-white font-semibold break-words">{session?.document.originalFileName}</p>
            <p className="text-[11px] text-emerald-400 mt-1 font-mono">{t("completed.signedAt", { time: signedAt.toLocaleString(i18n.language === "hi" ? "hi-IN" : "en-IN") })}</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href={executedDownloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm sm:text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t("completed.download")}</span>
            </a>
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
        recipientEmail={session?.recipient?.email || session?.recipient?.phone}
        documentTitle={session?.document?.originalFileName}
        authType={session?.recipient?.authType}
        onVerified={() => setSessionVersion((v) => v + 1)}
      />
    );
  }

  const pdfUrl = `${import.meta.env.VITE_API_BASE_URL}${session?.document.pdfUrl}`;
  // 4 pixels are taken by the borders around the page
  const pageWidth = viewerWidth ? Math.max(240, Math.min(viewerWidth - 4, MAX_PAGE_WIDTH)) : undefined;
  const allFilled = unfilledMyFields.length === 0;

  const signButtonContent = isSubmitting ? (
    <>
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      <span>{t("actions.signing")}</span>
    </>
  ) : (
    <>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{t("actions.sign")}</span>
    </>
  );

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans flex flex-col selection:bg-red-600 selection:text-white">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-[#08090d]/90 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-red-600 to-red-950 rounded-xl flex items-center justify-center border border-red-500/30 shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">
                {session?.document.originalFileName}
              </h1>
              <p className="text-[11px] sm:text-[10px] text-gray-400 truncate">
                {t("header.signingAs")} <strong className="text-red-400">{session?.recipient.name}</strong> ({session?.recipient.email || session?.recipient.phone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href={pdfUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition-all"
              title={t("header.downloadReviewHint")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t("header.downloadReview")}</span>
            </a>

            <button
              onClick={() => setDeclineModalOpen(true)}
              className="px-3 py-2.5 sm:py-2 bg-white/5 hover:bg-red-950/40 text-gray-300 hover:text-red-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            >
              {t("actions.decline")}
            </button>

            {/* On a phone the sign button sits in the bar at the bottom of the screen, within thumb reach */}
            <button
              onClick={handleSubmitSignature}
              disabled={isSubmitting}
              className="hidden lg:flex px-6 py-2 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 border border-red-500/30 transition-all items-center gap-2"
            >
              {signButtonContent}
            </button>
          </div>
        </div>
      </header>

      {/* Consent to sign electronically, and the language of this page */}
      <div className="bg-[#12141c] border-b border-white/10 px-3 sm:px-6 py-2.5 sm:py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none text-gray-300 hover:text-white transition-colors">
            <input
              type="checkbox"
              id="electronic-consent-checkbox"
              checked={hasElectronicConsent}
              onChange={(e) => setHasElectronicConsent(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 mt-0.5 sm:mt-0 shrink-0 rounded border-gray-700 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900 bg-[#08090d] cursor-pointer"
            />
            <span className="text-xs leading-snug">
              {t("consent.text")}
            </span>
          </label>

          {/* The signer can read the page in their own language */}
          <label className="flex items-center gap-2 text-[11px] text-gray-400 shrink-0 self-end sm:self-auto sm:ml-3">
            <span>{t("header.language")}</span>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              aria-label={t("header.language")}
              className="bg-[#08090d] border border-white/10 rounded-lg px-2 py-1.5 sm:py-1 text-xs text-gray-200 focus:outline-none focus:border-red-500"
            >
              {SIGNING_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Main Signing Workspace */}
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 hidden lg:block sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-[#12141c] border-r border-white/10 p-5 space-y-6">
          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-3">
            <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
              {t("sidebar.studioTitle")}
            </h3>
            <p className="text-[11px] text-gray-400">
              {t("sidebar.studioHint")}
            </p>

            <SignatureManager
              signerName={session?.recipient?.name}
              storageKey={session?.recipient?.email || token}
              defaultSignatureUrl={activeSignatureUrl}
              defaultInitialsUrl={activeInitialsUrl}
              onUploaded={handleApplySignatureToAllMine}
              onInitialsUploaded={handleApplyInitialsToAllMine}
            />
          </div>

          <div className="bg-[#08090d] rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-display font-bold text-xs uppercase tracking-wider">
                {t("sidebar.fieldsTitle", { count: myFields.length })}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/40">
                {t("sidebar.remaining", { count: unfilledMyFields.length })}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              {t("sidebar.fieldsHint")}
            </p>

            <div className="space-y-1.5 pt-2">
              {myFields.map((f, idx) => (
                <div
                  key={f.id}
                  onClick={() => {
                    if (f.page !== currentPage) setCurrentPage(f.page);
                    handleFieldClick(f);
                  }}
                  className={`p-2 rounded-xl text-xs border flex items-center justify-between cursor-pointer transition-colors ${
                    selectedFieldId === f.id
                      ? "bg-red-950/40 border-red-500/50"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  <span className="font-semibold text-gray-200">
                    {t("sidebar.fieldRow", { number: idx + 1, type: fieldTypeLabel(f.type), page: f.page })}
                  </span>
                  <span className={`text-[10px] font-bold ${f.signatureUrl || f.value ? "text-emerald-400" : "text-amber-400"}`}>
                    {f.signatureUrl || f.value ? t("sidebar.filled") : t("sidebar.pending")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* PDF Viewer */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#08090d] relative">
          {/* Page Controls Toolbar */}
          <div className="bg-[#12141c] border-b border-white/10 px-3 sm:px-6 py-2 flex items-center justify-center lg:justify-start">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label={t("pager.previous")}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                ◀
              </button>

              <span className="text-xs font-mono font-bold text-white bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                {t("pager.page", { current: currentPage, total: totalPages })}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label={t("pager.next")}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30 transition-colors"
              >
                ▶
              </button>
            </div>
          </div>

          {/* The page. Room is left under it on a phone for the action bar. */}
          <div
            className="flex-1 p-2 sm:p-6 pb-28 lg:pb-6 select-none relative"
            onClick={() => setSelectedFieldId(null)}
          >
            <div ref={setViewerElement} className="w-full flex justify-center">
              <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden border border-white/10">
                <PdfViewer
                  fileUrl={pdfUrl}
                  pageNumber={currentPage}
                  onPageRender={handlePageRender}
                  width={pageWidth}
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
                          <div key={f.id}>
                            <DraggableField
                              field={f}
                              onActivate={() => handleFieldClick(f)}
                              pageWidth={pageDims.width}
                              pageHeight={pageDims.height}
                              isSelected={f.id === selectedFieldId}
                              onSelect={isMine ? setSelectedFieldId : () => {}}
                              onUpdate={isMine ? updateField : () => {}}
                              onRemove={() => {}}
                              signerColor={isMine ? session?.recipient.color : "#6b7280"}
                              signerName={isMine ? t("field.you") : (f.recipientName || f.roleName)}
                              locked
                            />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Next-field button on a wide screen */}
          <div className="hidden lg:block fixed bottom-6 right-6 z-30">
            {!allFilled ? (
              <button
                onClick={jumpToNextUnfilledField}
                className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-full shadow-2xl shadow-red-950 flex items-center gap-2 border border-red-400/40 animate-pulse transition-all"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span>{t("nav.next", { count: unfilledMyFields.length })}</span>
              </button>
            ) : (
              <button
                onClick={handleSubmitSignature}
                disabled={isSubmitting}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400/40 transition-all"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t("nav.finish")}</span>
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Action bar on a phone or tablet: always on screen, within thumb reach */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#12141c]/95 backdrop-blur-md border-t border-white/10 px-3 pt-2.5"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        data-testid="mobile-action-bar"
      >
        <div className="flex items-stretch gap-2 max-w-xl mx-auto">
          <button
            onClick={() => setSignatureModalOpen(true)}
            className="px-3 min-h-[48px] bg-white/5 active:bg-white/10 text-gray-200 border border-white/10 rounded-xl text-xs font-bold"
          >
            {t("sidebar.openStudio")}
          </button>

          {!allFilled ? (
            <button
              onClick={jumpToNextUnfilledField}
              className="flex-1 min-h-[48px] bg-red-600 active:bg-red-500 text-white font-bold text-sm rounded-xl border border-red-400/40 flex items-center justify-center gap-2"
            >
              <span>{t("nav.next", { count: unfilledMyFields.length })}</span>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmitSignature}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] bg-gradient-to-r from-red-600 to-red-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl border border-red-500/30 flex items-center justify-center gap-2"
            >
              {signButtonContent}
            </button>
          )}
        </div>
      </div>

      {/* Decline Modal */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-display font-bold text-white">{t("declineModal.title")}</h3>
            <p className="text-sm sm:text-xs text-gray-400">
              {t("declineModal.prompt")}
            </p>

            <textarea
              rows={4}
              required
              placeholder={t("declineModal.placeholder")}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="w-full p-3 bg-[#08090d] border border-white/10 rounded-xl text-white text-base sm:text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeclineModalOpen(false)}
                className="px-4 py-3 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold"
              >
                {t("actions.cancel")}
              </button>
              <button
                onClick={handleDecline}
                disabled={isSubmitting}
                className="px-5 py-3 sm:py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                {t("actions.confirmDecline")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature and initials, opened from the action bar or by tapping a field */}
      {signatureModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-[#12141c] border border-white/10 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-base font-display font-bold text-white">{t("sidebar.studioTitle")}</h3>
              <button
                onClick={() => setSignatureModalOpen(false)}
                aria-label={t("actions.close")}
                className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <SignatureManager
              signerName={session?.recipient?.name}
              storageKey={session?.recipient?.email || token}
              defaultSignatureUrl={activeSignatureUrl}
              defaultInitialsUrl={activeInitialsUrl}
              onUploaded={(url) => {
                handleApplySignatureToAllMine(url);
                if (url) setSignatureModalOpen(false);
              }}
              onInitialsUploaded={(url) => {
                handleApplyInitialsToAllMine(url);
                if (url) setSignatureModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
