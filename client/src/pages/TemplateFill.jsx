import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import PdfViewer from "../components/PdfViewer";
import { reviewLine } from "../components/CatalogueLibrary";
import {
  fetchCatalogueTemplateApi,
  previewCatalogueTemplateApi,
  saveCatalogueDraftApi,
  sendFromCatalogueApi,
} from "../api/catalogue.api";

const HINT_LABELS = {
  esign_ok: "Ordinary e-signature",
  stamp_duty: "Stamp duty applies",
  aadhaar_advised: "Aadhaar eSign advised",
  check: "Check before relying on it",
};

const SIGNER_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

// Today in the sender's own time zone, as YYYY-MM-DD
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const isEmpty = (value) => value === undefined || value === null || value === "";

// Same rule the server uses to decide whether a question applies
const applies = (condition, answers) => {
  if (!condition) return true;
  const value = answers[condition.question];
  if ("equals" in condition) return value === condition.equals;
  if ("notEquals" in condition) return value !== condition.notEquals;
  if ("answered" in condition) return !isEmpty(value) === Boolean(condition.answered);
  return true;
};

const inputClass =
  "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";

function QuestionInput({ question, value, onChange }) {
  const common = { id: `q-${question.id}`, value: value ?? "", onChange: (e) => onChange(e.target.value), className: inputClass };

  switch (question.type) {
    case "longtext":
      return <textarea {...common} rows={3} maxLength={question.maxLength || 2000} />;
    case "number":
    case "money":
      return <input {...common} type="text" inputMode="decimal" />;
    case "date":
      return <input {...common} type="date" />;
    case "email":
      return <input {...common} type="email" />;
    case "phone":
      return <input {...common} type="tel" />;
    case "select":
      return (
        <select {...common}>
          <option value="">Choose...</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <select {...common} value={value === true ? "true" : value === false ? "false" : ""} onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "true")}>
          <option value="">Choose...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    default:
      return <input {...common} type="text" maxLength={question.maxLength || 200} />;
  }
}

/**
 * Guided fill: the sender answers a template's questions, watches the document take shape,
 * names the signers and sends it (plan task P4-04).
 */
export default function TemplateFill() {
  const { key } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [signers, setSigners] = useState({});
  const [step, setStep] = useState("answers"); // "answers" | "signers"
  const [showMissing, setShowMissing] = useState(false);

  const [previewUrl, setPreviewUrl] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [unanswered, setUnanswered] = useState([]);
  const [previewing, setPreviewing] = useState(false);

  const [draftState, setDraftState] = useState(""); // "", "saving", "saved"
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");

  const [previewBox, setPreviewBox] = useState(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const today = useMemo(localToday, []);
  const touched = useRef(false);

  // ---------- load ----------
  useEffect(() => {
    let cancelled = false;
    fetchCatalogueTemplateApi(key)
      .then((data) => {
        if (cancelled) return;
        setTemplate(data);

        // A saved draft wins; otherwise the template's own starting values
        const starting = {};
        for (const question of data.questions) {
          if (question.default !== undefined) starting[question.id] = question.default === "today" ? today : question.default;
        }
        setAnswers({ ...starting, ...(data.draft?.answers || {}) });
        setSigners(data.draft?.signers || {});
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.data?.message || "This template could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [key, today]);

  // ---------- preview, a moment after the sender stops typing ----------
  useEffect(() => {
    if (!template || template.locked) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setPreviewing(true);
        const result = await previewCatalogueTemplateApi(key, answers, today, controller.signal);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(result.blob);
        });
        setPageCount(result.pageCount);
        setPreviewPage((page) => Math.min(page, result.pageCount));
        setUnanswered(result.unanswered);
      } catch (err) {
        if (err.name !== "CanceledError" && err.code !== "ERR_CANCELED") console.error("Preview failed:", err);
      } finally {
        setPreviewing(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [template, key, answers, today]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- save the draft as the sender goes ----------
  // The newest answers, and whether they are still waiting to be saved, for saving on the way out
  const latest = useRef({ answers, signers, unsaved: false });
  latest.current.answers = answers;
  latest.current.signers = signers;

  useEffect(() => {
    if (!template || template.locked || !touched.current) return undefined;
    setDraftState("saving");
    latest.current.unsaved = true;
    const timer = setTimeout(() => {
      latest.current.unsaved = false;
      saveCatalogueDraftApi(key, answers, signers)
        .then(() => setDraftState("saved"))
        .catch(() => setDraftState(""));
    }, 1500);
    return () => clearTimeout(timer);
  }, [template, key, answers, signers]);

  // Leaving the page before the pause has passed must not lose what was typed
  useEffect(
    () => () => {
      if (latest.current.unsaved) saveCatalogueDraftApi(key, latest.current.answers, latest.current.signers).catch(() => {});
    },
    [key]
  );

  useEffect(() => {
    if (!previewBox) return undefined;
    const measure = () => setPreviewWidth(previewBox.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(previewBox);
    return () => observer.disconnect();
  }, [previewBox]);

  const setAnswer = (id, value) => {
    touched.current = true;
    setAnswers((all) => ({ ...all, [id]: value }));
    // The flag under a question goes as soon as it is edited; the next check puts it back if it is still wrong
    setUnanswered((ids) => ids.filter((questionId) => questionId !== id));
  };

  const setSigner = (roleId, patch) => {
    touched.current = true;
    setSigners((all) => ({ ...all, [roleId]: { language: "en", ...all[roleId], ...patch } }));
  };

  const visibleQuestions = (template?.questions || []).filter((question) => applies(question.showIf, answers));
  const [isChecking, setIsChecking] = useState(false);

  const goToSigners = async () => {
    // Ask the server about the answers as they stand now, not as they stood at the last preview
    let stillUnanswered;
    try {
      setIsChecking(true);
      stillUnanswered = (await previewCatalogueTemplateApi(key, answers, today)).unanswered;
    } catch (err) {
      toast.error("Your answers could not be checked. Please try again.");
      return;
    } finally {
      setIsChecking(false);
    }
    setUnanswered(stillUnanswered);

    const missing = visibleQuestions.filter((question) => stillUnanswered.includes(question.id));
    if (missing.length > 0) {
      setShowMissing(true);
      toast.error(`${missing.length} question${missing.length === 1 ? "" : "s"} still need${missing.length === 1 ? "s" : ""} an answer`);
      document.getElementById(`q-${missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Start each signer off with the name already given in the answers
    setSigners((all) => {
      const next = { ...all };
      for (const role of template.roles) {
        next[role.id] = { language: "en", email: "", ...next[role.id], name: next[role.id]?.name || answers[role.nameFrom] || "" };
      }
      return next;
    });
    setStep("signers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const send = async () => {
    for (const role of template.roles) {
      const signer = signers[role.id] || {};
      if (!signer.name?.trim() || !signer.email?.trim()) {
        toast.error(`Enter a name and an email address for the ${role.name}`);
        return;
      }
    }

    try {
      setIsSending(true);
      await sendFromCatalogueApi(key, { answers, signers, message, today, signingOrder: template.roles.length > 1 });
      toast.success("Sent for signature.");
      navigate("/dashboard");
    } catch (err) {
      // Nothing was sent, so keep the work: the sender may need to buy documents and come back
      latest.current.unsaved = false;
      saveCatalogueDraftApi(key, answers, signers).catch(() => {});

      const errors = err.response?.data?.errors;
      if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
        setStep("answers");
        setShowMissing(true);
        setUnanswered(Object.keys(errors));
      }
      toast.error(err.response?.data?.message || "The document could not be sent.");
    } finally {
      setIsSending(false);
    }
  };

  // ---------- screens ----------
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#08090d] text-gray-100">
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-bold text-white">Template not available</h1>
          <p className="text-sm text-gray-400">{loadError}</p>
          <Link to="/templates" className="inline-block px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold">
            Back to templates
          </Link>
        </main>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (template.locked) {
    return (
      <div className="min-h-screen bg-[#08090d] text-gray-100">
        <Navbar />
        <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-bold text-white">{template.title}</h1>
          <p className="text-sm text-gray-400">
            The {template.packName} templates are part of the {template.requiredTier} plan and above.
          </p>
          <Link to="/billing/plans" className="inline-block px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold">
            See plans
          </Link>
        </main>
      </div>
    );
  }

  const chosenState = answers.state;
  const stateNotes = template.stateNotes.filter((note) => !chosenState || note.state === chosenState);

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link to="/templates" className="text-xs text-gray-400 hover:text-white">
              ← Templates
            </Link>
            <h1 className="text-2xl font-black text-white mt-1">{template.title}</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">{template.summary}</p>
          </div>
          <div className="text-xs text-gray-500" aria-live="polite">
            {draftState === "saving" ? "Saving draft..." : draftState === "saved" ? "Draft saved" : template.draft ? "Draft restored" : ""}
          </div>
        </div>

        {/* What the sender should know before relying on this document */}
        <section className="bg-[#12141c] border border-white/10 rounded-2xl p-4 space-y-2 text-xs" data-testid="template-notes">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/30 font-bold">
              {HINT_LABELS[template.signatureHint?.level] || HINT_LABELS.check}
            </span>
            <span className={template.reviewer ? "text-emerald-400" : "text-amber-400"}>{reviewLine(template.reviewer)}</span>
          </div>
          {template.signatureHint?.text && <p className="text-gray-300 leading-relaxed">{template.signatureHint.text}</p>}
          {stateNotes.map((note) => (
            <p key={note.state} className="text-gray-300 leading-relaxed" data-testid={`state-note-${note.state}`}>
              <strong className="text-white">{note.name}:</strong> {note.note}
            </p>
          ))}
          <p className="text-gray-500">This is a starting draft, not legal advice. Read the whole document before you send it.</p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: questions, then signers */}
          <section className="bg-[#12141c] border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={`px-2.5 py-1 rounded-lg ${step === "answers" ? "bg-red-600 text-white" : "bg-white/10 text-gray-300"}`}>1. Your answers</span>
              <span className={`px-2.5 py-1 rounded-lg ${step === "signers" ? "bg-red-600 text-white" : "bg-white/10 text-gray-300"}`}>2. Who signs</span>
            </div>

            {step === "answers" ? (
              <>
                {visibleQuestions.map((question) => {
                  const flagged = showMissing && unanswered.includes(question.id);
                  return (
                    <div key={question.id}>
                      <label htmlFor={`q-${question.id}`} className="block text-xs font-semibold text-gray-200 mb-1.5">
                        {question.label}
                        {!question.required && <span className="text-gray-500 font-normal"> (optional)</span>}
                      </label>
                      <QuestionInput question={question} value={answers[question.id]} onChange={(value) => setAnswer(question.id, value)} />
                      {question.help && <p className="text-[11px] text-gray-500 mt-1">{question.help}</p>}
                      {flagged && (
                        <p className="text-[11px] text-red-400 mt-1" role="alert">
                          {isEmpty(answers[question.id]) ? "This is needed" : "Check this answer"}
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={goToSigners}
                  disabled={isChecking}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold"
                >
                  Next: who signs
                </button>
              </>
            ) : (
              <>
                {template.roles.map((role) => {
                  const signer = signers[role.id] || {};
                  return (
                    <fieldset key={role.id} className="space-y-2 border border-white/10 rounded-xl p-4" data-testid={`signer-${role.id}`}>
                      <legend className="px-1 text-xs font-bold text-white">{role.name}</legend>
                      <input
                        aria-label={`${role.name}: name`}
                        placeholder="Full name"
                        value={signer.name || ""}
                        onChange={(e) => setSigner(role.id, { name: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        aria-label={`${role.name}: email`}
                        type="email"
                        placeholder="Email address"
                        value={signer.email || ""}
                        onChange={(e) => setSigner(role.id, { email: e.target.value })}
                        className={inputClass}
                      />
                      <select
                        aria-label={`${role.name}: language`}
                        value={signer.language || "en"}
                        onChange={(e) => setSigner(role.id, { language: e.target.value })}
                        className={inputClass}
                      >
                        {SIGNER_LANGUAGES.map((language) => (
                          <option key={language.code} value={language.code}>
                            Signing page and emails in {language.label}
                          </option>
                        ))}
                      </select>
                    </fieldset>
                  );
                })}

                <div>
                  <label htmlFor="send-message" className="block text-xs font-semibold text-gray-200 mb-1.5">
                    Message to the signers <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <textarea id="send-message" rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep("answers")} className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold">
                    Back
                  </button>
                  <button
                    onClick={send}
                    disabled={isSending}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold"
                  >
                    {isSending ? "Sending..." : "Send for signature"}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Right: the document as it stands */}
          <section className="bg-[#12141c] border border-white/10 rounded-2xl p-4 space-y-3 lg:sticky lg:top-20">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Preview{previewing ? " (updating...)" : ""}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                  disabled={previewPage <= 1}
                  aria-label="Previous page"
                  className="w-8 h-8 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  ◀
                </button>
                <span className="font-mono text-gray-300">
                  Page {previewPage} / {pageCount}
                </span>
                <button
                  onClick={() => setPreviewPage((page) => Math.min(pageCount, page + 1))}
                  disabled={previewPage >= pageCount}
                  aria-label="Next page"
                  className="w-8 h-8 rounded-lg text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  ▶
                </button>
              </div>
            </div>

            <div ref={setPreviewBox} className="w-full flex justify-center min-h-[320px]" data-testid="template-preview">
              {previewUrl && previewWidth > 0 && (
                <PdfViewer fileUrl={previewUrl} pageNumber={previewPage} onPageRender={() => {}} width={Math.min(previewWidth - 4, 640)} />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
