import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import DocumentCanvas from "../components/editor/DocumentCanvas";
import SignerField from "../components/editor/SignerField";
import { outstandingRequired, problemWithValue, sortForReading, typeOf, isRequired, isFilled, labelOf } from "../components/editor/fieldTypes";
import SignatureStudio from "../components/signature/SignatureStudio";
import { LIGHT } from "../components/signature/lightTheme";
import { fetchSigningSessionApi, submitPublicSignatureApi, declinePublicSigningApi, startEsignApi, completeEsignApi } from "../api/signing.api";
import { OtpVerificationModal } from "../components/OtpVerificationModal";
import { SIGNING_LANGUAGES } from "../i18n";
import BrandGlyph from "../components/BrandGlyph";

// The widest a page is drawn. On a phone the page takes the width of the screen instead.
const MAX_PAGE_WIDTH = 820;

// Read once, when the page opens:
//   embed  the session a customer's website opened this page with, to show it inside its own page
//   esign  set when the signer comes back from the Aadhaar eSign provider
const QUERY = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
const EMBED_SESSION = QUERY.get("embed") || "";
const RETURNING_ESIGN = QUERY.get("esign") || "";
const IS_FRAMED = typeof window !== "undefined" && window.self !== window.top;

// The website showing this page in a frame, where the browser tells us
const framingOrigin = () => {
  try {
    if (window.location.ancestorOrigins?.length) return window.location.ancestorOrigins[0];
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
};

// Server messages may start with a code for the page to act on; the signer is shown the words
const wordsOf = (message) => String(message || "").replace(/^[A-Z_]+:\s*/, "");

const IMAGE_KINDS = ["signature", "initials", "stamp"];

/**
 * The page a signer opens from their invitation.
 *
 * The whole document scrolls as one; the signer's own fields are on it, yellow while still
 * needed. "Start" and "Next" take them from one required field to the next, optional ones never
 * stand in the way of finishing, and every field can be reached and filled with the keyboard.
 * A signature made here lasts for this visit only; nothing is stored on the signer's device.
 */
export default function SigningPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();

  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [fields, setFields] = useState([]);
  const [images, setImages] = useState({ signature: "", initials: "", stamp: "" });
  const [currentId, setCurrentId] = useState(null);
  const [studio, setStudio] = useState(null);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [sessionVersion, setSessionVersion] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [languageChosen, setLanguageChosen] = useState(false);
  const canvasRef = useRef(null);
  // The return from the eSign provider is handled once, however often the page re-renders
  const esignReturnHandled = useRef(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSigningSessionApi(token, EMBED_SESSION);
        setSession(data);

        // Start in the language the sender chose for this signer, unless they have switched it themselves
        if (!languageChosen && data.recipient.language) i18n.changeLanguage(data.recipient.language);

        // The session holds this signer's own fields only
        setFields(sortForReading(data.document.fields || []));

        if (!data.recipient.authType || data.recipient.authType === "none" || data.recipient.authVerified) setIsOtpVerified(true);
        if (data.recipient.status === "signed") setIsCompleted(true);
        if (data.recipient.status === "declined") setIsDeclined(true);
      } catch (err) {
        setError(err.response?.data?.message || t("error.load"));
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
    // Reloaded after identity verification and after signing, so the page shows what the server now allows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionVersion]);

  // Back from the Aadhaar eSign provider: ask the server what happened and show the result
  useEffect(() => {
    if (!RETURNING_ESIGN || !session || esignReturnHandled.current) return;
    esignReturnHandled.current = true;
    if (session.recipient?.status === "signed") return;

    (async () => {
      const toastId = toast.loading(t("esign.confirming"));
      try {
        setIsSubmitting(true);
        await completeEsignApi(token, RETURNING_ESIGN);
        toast.success(t("toast.signed"), { id: toastId });
        setIsCompleted(true);
      } catch (err) {
        toast.error(wordsOf(err.response?.data?.message) || t("esign.failed"), { id: toastId, duration: 8000 });
      } finally {
        setIsSubmitting(false);
        setSessionVersion((v) => v + 1);
      }
    })();
  }, [session, token, t]);

  // Screen readers and the browser's own text shaping follow the page language
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const recipient = session?.recipient;

  // What fills each field as it will be signed: the adopted images, and the signer's own name and email
  const shownFields = useMemo(
    () => fields.map((f) => (typeOf(f).image ? { ...f, signatureUrl: images[f.type] || "", value: images[f.type] || "" } : f)),
    [fields, images]
  );
  const outstanding = useMemo(() => outstandingRequired(shownFields), [shownFields]);
  const requiredCount = useMemo(() => shownFields.filter(isRequired).length, [shownFields]);
  const allFilled = outstanding.length === 0;
  const kinds = useMemo(() => IMAGE_KINDS.filter((kind) => fields.some((f) => f.type === kind)), [fields]);

  const words = useMemo(
    () => ({
      sign: t("field.sign"),
      initial: t("field.initial"),
      stamp: t("field.stamp"),
      required: t("field.required"),
      choose: t("field.choose"),
      dateSigned: t("field.dateSigned"),
      change: t("field.change"),
      enterText: t("field.enterText"),
      labelOf: (field) => field.label || t(`fieldType.${field.type}`, labelOf(field)),
    }),
    [t]
  );

  const autoValueOf = useCallback(
    (field) => (field.type === "name" ? recipient?.name || "" : field.type === "email" ? recipient?.email || "" : ""),
    [recipient?.name, recipient?.email]
  );

  const changeField = useCallback((field, patch) => {
    setFields((all) =>
      all.map((f) => {
        if (f.id === field.id) return { ...f, ...patch };
        // Picking one option of a radio group lets go of the others
        if (field.type === "radio" && patch.checked && f.type === "radio" && (f.groupId || f.id) === (field.groupId || field.id)) {
          return { ...f, checked: false, value: false };
        }
        return f;
      })
    );
  }, []);

  const openStudio = useCallback((field) => setStudio(field.type), []);

  const adopt = (kind, dataUrl) => {
    setImages((all) => ({ ...all, [kind]: dataUrl }));
    if (dataUrl) {
      toast.success(kind === "initials" ? t("toast.initialsApplied") : kind === "stamp" ? t("toast.stampApplied") : t("toast.signatureApplied"));
      setStudio(null);
    }
  };

  // Takes the signer to a field: scrolled into the middle of the screen and ready to fill in
  const goTo = (field) => {
    setCurrentId(field.id);
    const element = canvasRef.current?.scrollToField(field.id);
    requestAnimationFrame(() => element?.querySelector("input, select, button")?.focus({ preventScroll: true }));
  };

  const next = () => {
    if (allFilled) {
      toast.success(t("toast.allFilled"));
      return;
    }
    // The next required field after the one last pointed at, in reading order
    const order = shownFields.map((f) => f.id);
    const from = currentId ? order.indexOf(currentId) : -1;
    const target = outstanding.find((f) => order.indexOf(f.id) > from) || outstanding[0];
    goTo(target);
    toast(t("toast.focused", { type: words.labelOf(target), page: target.page }), { id: "next-field" });
  };

  const submit = async () => {
    if (!consent) {
      toast.error(t("consent.required"));
      document.getElementById("electronic-consent-checkbox")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!allFilled) {
      const first = outstanding[0];
      if (typeOf(first).image) {
        toast.error(first.type === "initials" ? t("toast.needInitials") : t("toast.needSignature"));
        setStudio(first.type);
      } else {
        toast.error(t("toast.completeField", { type: words.labelOf(first), page: first.page }));
      }
      goTo(first);
      return;
    }
    const invalid = shownFields.find((f) => problemWithValue(f));
    if (invalid) {
      toast.error(t("toast.invalidValue", { type: words.labelOf(invalid), page: invalid.page }));
      goTo(invalid);
      return;
    }

    const toastId = toast.loading(t("toast.working"));
    try {
      setIsSubmitting(true);
      const payload = shownFields.map((f) => ({ id: f.id, value: f.value, checked: f.checked, signatureUrl: f.signatureUrl }));

      // With Aadhaar eSign the signer goes to the provider now; the signature is applied when they return
      if (session?.esign?.required) {
        const started = await startEsignApi(token, { fields: payload, consent, consentVersion: session?.consentVersion });
        window.location.assign(started.redirectUrl);
        return;
      }

      await submitPublicSignatureApi(token, payload, consent, session?.consentVersion);
      toast.success(t("toast.signed"), { id: toastId });
      setIsCompleted(true);
      // Fetch the session again so the download link points at the signed copy
      setSessionVersion((v) => v + 1);
    } catch (err) {
      toast.error(wordsOf(err.response?.data?.message) || t("toast.signFailed"), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const decline = async () => {
    if (!declineReason.trim()) {
      toast.error(t("toast.declineReason"));
      return;
    }
    try {
      setIsSubmitting(true);
      await declinePublicSigningApi(token, declineReason);
      toast.success(t("toast.declined"));
      setDeclineOpen(false);
      setIsDeclined(true);
    } catch {
      toast.error(t("toast.declineFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- the screens before and after signing ----

  if (isLoading && !session) {
    return (
      <div className={`min-h-screen ${LIGHT.page} flex items-center justify-center`}>
        <Toaster position="top-center" />
        <div className="text-center space-y-3" role="status">
          <div className="w-12 h-12 border-4 border-black/10 border-t-red-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-gray-700">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || isDeclined) {
    return (
      <Notice tone={isDeclined ? "neutral" : "error"} title={isDeclined ? t("declined.title") : t("error.title")}>
        <p className="text-sm text-gray-700 leading-relaxed">{isDeclined ? t("declined.body") : error}</p>
        <p className="pt-3 border-t-2 border-black/10 text-xs text-gray-600">{t("error.hint")}</p>
      </Notice>
    );
  }

  // A signing page appears inside another website only when that website opened it with a
  // session made for it through the API. Anything else may be a page trying to trick the
  // signer into clicking, so nothing of the document is shown.
  if (IS_FRAMED && (!session?.embed?.origin || (framingOrigin() && framingOrigin() !== session.embed.origin))) {
    return (
      <Notice title={t("embed.refusedTitle")} testId="frame-refused">
        <p className="text-sm text-gray-700 leading-relaxed">{t("embed.refusedBody")}</p>
        <a href={window.location.pathname} target="_blank" rel="noopener noreferrer" className={`${LIGHT.primary} w-full`}>
          {t("embed.open")}
        </a>
      </Notice>
    );
  }

  if (isCompleted) {
    const downloadUrl = `${import.meta.env.VITE_API_BASE_URL}${session?.document.pdfUrl}`;
    const signedAt = new Date(session?.recipient.signedAt || Date.now());
    return (
      <Notice tone="success" title={t("completed.title")}>
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong className="text-black">{t("completed.thanks", { name: session?.recipient.name })}</strong> {t("completed.body")}
        </p>
        <div className="bg-[#f3efe6] p-4 rounded-xl border-2 border-black text-left space-y-1">
          <p className="text-[11px] uppercase font-black tracking-wider text-gray-600">{t("completed.label")}</p>
          <p className="text-sm font-bold text-black break-words">{session?.document.originalFileName}</p>
          <p className="text-xs text-emerald-800 font-bold">{t("completed.signedAt", { time: signedAt.toLocaleString(i18n.language === "hi" ? "hi-IN" : "en-IN") })}</p>
        </div>
        <a href={downloadUrl} download target="_blank" rel="noopener noreferrer" className={`${LIGHT.success} w-full`}>
          {t("completed.download")}
        </a>
        {/* Documents sent from a Free account carry this line and an invitation */}
        {session?.branding?.badge && (
          <div className="pt-4 border-t-2 border-black/10 text-xs text-gray-600 space-y-1" data-testid="signed-with-badge">
            <p className="inline-flex items-center gap-1.5 font-bold text-gray-700">
              <span className="w-5 h-5 grid place-items-center rounded-md bg-red-600 border border-black text-white" aria-hidden="true">
                <BrandGlyph className="w-4 h-4" />
              </span>
              {t("completed.badge")}
            </p>
            <p>
              {t("completed.invite")}{" "}
              <a href="/register" className="text-red-700 font-bold underline">
                {t("completed.inviteLink")}
              </a>
            </p>
          </div>
        )}
      </Notice>
    );
  }

  // The identity check the sender asked for comes before the document
  if (!isOtpVerified && recipient?.authType && recipient.authType !== "none") {
    return (
      <OtpVerificationModal
        token={token}
        recipientEmail={recipient.email || recipient.phone}
        documentTitle={session?.document?.originalFileName}
        authType={recipient.authType}
        onVerified={() => setSessionVersion((v) => v + 1)}
      />
    );
  }

  // ---- signing ----

  const pdfUrl = `${import.meta.env.VITE_API_BASE_URL}${session?.document.pdfUrl}`;
  const brandColor = session?.branding?.primaryColor || "#dc2626";
  const done = requiredCount - outstanding.length;
  const totalPages = session?.document.pageCount || 1;
  const started = Boolean(currentId) || done > 0;

  const signButton = (extra = "") => (
    <button type="button" onClick={submit} disabled={isSubmitting} className={`${LIGHT.primary} ${extra}`}>
      {isSubmitting ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>{t("actions.signing")}</span>
        </>
      ) : (
        <span>{t("actions.sign")}</span>
      )}
    </button>
  );

  return (
    <div className={`min-h-screen ${LIGHT.page} font-sans flex flex-col`}>
      <Toaster position="top-center" />
      <a href="#document" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:bg-yellow-300 focus:px-3 focus:py-2 focus:rounded-lg focus:border-2 focus:border-black focus:font-black">
        {t("nav.skip")}
      </a>

      {/* Header */}
      <header className="bg-white border-b-2 border-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {session?.branding?.logoUrl ? (
              <img src={session.branding.logoUrl} alt={session.branding.companyName || ""} className="h-9 max-w-[7rem] shrink-0 object-contain" data-testid="brand-logo" />
            ) : (
              <span className="w-9 h-9 shrink-0 rounded-xl border-2 border-black flex items-center justify-center text-white" style={{ background: brandColor }} aria-hidden="true">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              {session?.branding?.companyName && (
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-600 truncate" data-testid="brand-name">
                  {t("header.sentBy", { name: session.branding.companyName })}
                </p>
              )}
              <h1 className="text-sm font-black text-black truncate">{session?.document.originalFileName}</h1>
              <p className="text-[11px] text-gray-600 truncate">
                {t("header.signingAs")} <strong className="text-black">{recipient?.name}</strong> ({recipient?.email || recipient?.phone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a href={pdfUrl} download target="_blank" rel="noopener noreferrer" className={`${LIGHT.secondary} hidden md:inline-flex`} title={t("header.downloadReviewHint")}>
              {t("header.downloadReview")}
            </a>
            <button type="button" onClick={() => setDeclineOpen(true)} className={LIGHT.secondary}>
              {t("actions.decline")}
            </button>
            {/* On a phone the sign button sits in the bar at the bottom of the screen, within thumb reach */}
            <span className="hidden lg:inline-flex">{signButton()}</span>
          </div>
        </div>
        {/* How much is done */}
        <div className="h-1.5 bg-black/10" aria-hidden="true">
          <div className="h-full transition-all" style={{ width: `${requiredCount ? (done / requiredCount) * 100 : 100}%`, background: brandColor }} />
        </div>
      </header>

      {/* A document made with a test API key: it can be tried out but it is not a real agreement */}
      {session?.test && (
        <div className="bg-amber-200 border-b-2 border-black px-3 sm:px-6 py-2 text-xs font-bold text-amber-950 text-center" data-testid="test-banner">
          {t("test.banner")}
        </div>
      )}

      {/* What signing with Aadhaar eSign involves, before the signer agrees to anything */}
      {session?.esign?.required && (
        <div className="bg-sky-100 border-b-2 border-black px-3 sm:px-6 py-3 text-xs text-sky-950" data-testid="esign-notice">
          <div className="max-w-7xl mx-auto space-y-1">
            <p className="font-black">{t("esign.title")}</p>
            <p>{t("esign.steps")}</p>
            <p>{t("esign.privacy")}</p>
            <p className="text-sky-900/80">{t("esign.noPhone")}</p>
            {session.esign.standIn && <p className="font-black text-amber-800">{t("esign.standIn")}</p>}
            {!session.esign.available && <p className="font-black text-red-700">{t("esign.unavailable")}</p>}
            {session.esign.status === "failed" && <p className="font-black text-amber-800">{t("esign.failed")}</p>}
          </div>
        </div>
      )}

      {/* Consent to sign electronically, and the language of this page */}
      <div className="bg-white border-b-2 border-black px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none text-gray-900">
            <input
              type="checkbox"
              id="electronic-consent-checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5 mt-0.5 sm:mt-0 shrink-0 accent-red-600 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-bold leading-snug">{t("consent.text")}</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-gray-700 shrink-0 self-end sm:self-auto sm:ml-3">
            <span>{t("header.language")}</span>
            <select
              value={i18n.language}
              onChange={(e) => {
                setLanguageChosen(true);
                i18n.changeLanguage(e.target.value);
              }}
              className="bg-white border-2 border-black rounded-lg px-2 min-h-[36px] text-xs font-bold text-black"
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

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        {/* Desktop: progress, signature and the list of fields */}
        <aside className="w-80 shrink-0 hidden lg:block sticky top-[76px] self-start max-h-[calc(100vh-76px)] overflow-y-auto p-5 space-y-5" aria-label={t("sidebar.fieldsTitle", { count: fields.length })}>
          {session?.document?.message && (
            <section className={`${LIGHT.panel} p-4`}>
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1">{t("sidebar.message")}</p>
              <p className="text-sm text-gray-900 whitespace-pre-line break-words">{session.document.message}</p>
            </section>
          )}

          {kinds.length > 0 && (
            <section className={`${LIGHT.panel} p-4 space-y-3`}>
              <h2 className="text-xs font-black uppercase tracking-wider text-black">{t("sidebar.studioTitle")}</h2>
              <p className="text-xs text-gray-600">{t("sidebar.studioHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setStudio(kind)}
                    className="min-h-[64px] rounded-xl border-2 border-black bg-white hover:bg-yellow-50 flex items-center justify-center p-1.5 shadow-[2px_2px_0px_0px_#000]"
                  >
                    {images[kind] ? (
                      <img src={images[kind]} alt={t(`sig.kind.${kind}`)} className="max-h-10 max-w-full object-contain" />
                    ) : (
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-700">+ {t(`sig.kind.${kind}`)}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={`${LIGHT.panel} p-4 space-y-2`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-black">{t("sidebar.fieldsTitle", { count: fields.length })}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-300 border-2 border-black font-black">{t("sidebar.remaining", { count: outstanding.length })}</span>
            </div>
            <p className="text-[11px] text-gray-600">{t("sidebar.fieldsHint")}</p>
            <ul className="space-y-1.5 pt-1">
              {shownFields.map((f, index) => {
                const filled = typeOf(f).image ? Boolean(images[f.type]) : isFilled(f);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => goTo(f)}
                      className={`w-full p-2 rounded-lg text-xs border-2 flex items-center justify-between gap-2 text-left ${
                        currentId === f.id ? "border-black bg-yellow-100" : "border-transparent hover:bg-black/5"
                      }`}
                    >
                      <span className="font-bold text-gray-900 truncate">{t("sidebar.fieldRow", { number: index + 1, type: words.labelOf(f), page: f.page })}</span>
                      <span className={`text-[10px] font-black uppercase shrink-0 ${filled ? "text-emerald-700" : isRequired(f) ? "text-red-700" : "text-gray-500"}`}>
                        {filled ? t("sidebar.filled") : isRequired(f) ? t("sidebar.pending") : t("sidebar.optional")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        {/* The document */}
        <main id="document" className="flex-1 min-w-0 flex flex-col pb-28 lg:pb-10" tabIndex={-1}>
          <div className="sticky top-[76px] z-30 flex items-center justify-center lg:justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-2 bg-white border-2 border-black rounded-xl px-1.5 py-1 shadow-[2px_2px_0px_0px_#000]">
              <button
                type="button"
                onClick={() => canvasRef.current?.scrollToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                aria-label={t("pager.previous")}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30 font-black"
              >
                ‹
              </button>
              <span className="text-xs font-black tabular-nums text-black px-1" aria-live="polite">
                {t("pager.page", { current: currentPage, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => canvasRef.current?.scrollToPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                aria-label={t("pager.next")}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-black/5 disabled:opacity-30 font-black"
              >
                ›
              </button>
            </div>
          </div>

          <DocumentCanvas
            ref={canvasRef}
            fileUrl={pdfUrl}
            maxFitWidth={MAX_PAGE_WIDTH}
            scrollMode="page"
            onCurrentPageChange={setCurrentPage}
            pageClassName="border-2 border-black shadow-[4px_4px_0px_0px_#000]"
            renderOverlay={(page, size) =>
              shownFields
                .filter((f) => f.page === page)
                .map((field) => (
                  <SignerField
                    key={field.id}
                    field={field}
                    pageWidth={size.width}
                    pageHeight={size.height}
                    image={typeOf(field).image ? images[field.type] : null}
                    autoValue={autoValueOf(field)}
                    current={field.id === currentId}
                    words={words}
                    onActivate={openStudio}
                    onChange={changeField}
                  />
                ))
            }
          />
        </main>
      </div>

      {/* Start / next field on a wide screen */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-30">
        {!allFilled ? (
          <button type="button" onClick={next} className={`${LIGHT.primary} shadow-[4px_4px_0px_0px_#000] rounded-full px-6`}>
            {started ? t("nav.next", { count: outstanding.length }) : t("nav.start")}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={isSubmitting} className={`${LIGHT.success} shadow-[4px_4px_0px_0px_#000] rounded-full px-6`}>
            {t("nav.finish")}
          </button>
        )}
      </div>

      {/* Action bar on a phone or tablet: always on screen, within thumb reach */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t-2 border-black px-3 pt-2.5"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        data-testid="mobile-action-bar"
      >
        <div className="flex items-stretch gap-2 max-w-xl mx-auto">
          {kinds.length > 0 && (
            <button type="button" onClick={() => setStudio(kinds[0])} className={`${LIGHT.secondary} min-h-[48px]`}>
              {t("sidebar.openStudio")}
            </button>
          )}
          {!allFilled ? (
            <button type="button" onClick={next} className={`${LIGHT.primary} flex-1 min-h-[48px] text-sm`}>
              {started ? t("nav.next", { count: outstanding.length }) : t("nav.start")}
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            signButton("flex-1 min-h-[48px] text-sm")
          )}
        </div>
      </div>

      {declineOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div role="dialog" aria-modal="true" aria-labelledby="decline-title" className="bg-white border-2 border-black rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
            <h2 id="decline-title" className="text-lg font-black uppercase tracking-tight">
              {t("declineModal.title")}
            </h2>
            <p className="text-sm text-gray-700">{t("declineModal.prompt")}</p>
            <textarea
              rows={4}
              required
              autoFocus
              aria-label={t("declineModal.prompt")}
              placeholder={t("declineModal.placeholder")}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className={`${LIGHT.input} py-2 min-h-[110px]`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeclineOpen(false)} className={LIGHT.secondary}>
                {t("actions.cancel")}
              </button>
              <button type="button" onClick={decline} disabled={isSubmitting} className={LIGHT.primary}>
                {t("actions.confirmDecline")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SignatureStudio
        open={Boolean(studio)}
        onClose={() => setStudio(null)}
        kinds={kinds.length ? kinds : ["signature"]}
        kind={studio || kinds[0] || "signature"}
        current={images}
        onAdopt={adopt}
        signerName={recipient?.name || ""}
      />
    </div>
  );
}

/** A screen with one message: signed, declined, an error, or a refused frame */
function Notice({ title, tone = "neutral", testId, children }) {
  const accent = tone === "success" ? "bg-emerald-400" : tone === "error" ? "bg-red-500" : "bg-yellow-300";
  return (
    <div className={`min-h-screen ${LIGHT.page} flex items-center justify-center p-4`} data-testid={testId}>
      <Toaster position="top-center" />
      <div className={`${LIGHT.panel} p-6 sm:p-8 max-w-md w-full text-center space-y-5`} role="main">
        <span className={`w-14 h-14 mx-auto rounded-2xl border-2 border-black flex items-center justify-center ${accent}`} aria-hidden="true">
          {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
        </span>
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">{title}</h2>
        {children}
      </div>
    </div>
  );
}
