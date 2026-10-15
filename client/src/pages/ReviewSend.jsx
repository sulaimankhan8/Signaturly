import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import DocumentCanvas from "../components/editor/DocumentCanvas";
import SignerField from "../components/editor/SignerField";
import { FIELD_TYPES, isRequired } from "../components/editor/fieldTypes";
import { UpgradeModal } from "../components/UpgradeModal";
import { useAutosave, saveStatusText } from "../components/editor/useAutosave";
import { BTN, PANEL, INPUT, LABEL, EYEBROW, ICONS } from "../components/billing/theme";
import { fetchDocumentForEditingApi, saveDraftApi } from "../api/pdf.api";
import { fetchUserSubscription } from "../api/billing.api";
import { sendDocumentApi } from "../api/send.api";
import { forgetPasscodes, passcodeFor, rememberPasscode, sendProblems, sendSteps } from "../utils/sendFlow";

const ROLE_WORDS = { signer: "Signs", approver: "Approves", viewer: "Gets a copy" };
const AUTH_WORDS = { none: "The link only", otp: "One-time code", passcode: "Passcode" };

const PREVIEW_WORDS = {
  sign: "Sign",
  initial: "Initial",
  stamp: "Add stamp",
  required: "required",
  choose: "Choose",
  dateSigned: "Date signed",
  change: "change",
  enterText: "Type here",
};

const tomorrow = () => {
  const day = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
};

/**
 * Step 3 of sending: check who gets what, write the email, choose reminders and a deadline,
 * see the document as each signer will, and send.
 */
export default function ReviewSend() {
  const { pdfId } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [fields, setFields] = useState([]);
  const [settings, setSettings] = useState({ emailSubject: "", message: "", reminderCadence: "none", expiresAt: "", signingOrder: false });
  const [passcodes, setPasscodes] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [upgrade, setUpgrade] = useState("");
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const [signNow, setSignNow] = useState(null);

  const paid = Boolean(subscription?.entitlements?.tier && subscription.entitlements.tier !== "free");

  useEffect(() => {
    let current = true;
    fetchUserSubscription()
      .then((sub) => current && setSubscription(sub))
      .catch(() => {});
    fetchDocumentForEditingApi(pdfId)
      .then((data) => {
        if (!current) return;
        if (data.sent) {
          toast.error("This document has already been sent.");
          navigate("/dashboard");
          return;
        }
        const draft = data.draft || {};
        const problems = sendProblems(draft.recipients || [], draft.fields || []);
        if (problems.length > 0) {
          toast.error(problems[0]);
          navigate((draft.recipients || []).length ? `/assign/${pdfId}` : `/send/${pdfId}`, { replace: true });
          return;
        }
        setDoc({ ...data, url: `${import.meta.env.VITE_API_BASE_URL}${data.url}` });
        setRecipients(draft.recipients);
        setFields(draft.fields);
        setSettings((s) => ({ ...s, ...(draft.settings || {}) }));
        setPasscodes(Object.fromEntries(draft.recipients.map((r) => [r.id, passcodeFor(pdfId, r.id)])));
        setLoaded(true);
      })
      .catch((error) => {
        if (error.response?.status === 401) navigate("/login");
        else toast.error("The document could not be opened. Please try again.");
      });
    return () => {
      current = false;
    };
  }, [pdfId, navigate]);

  const save = useCallback((value) => saveDraftApi(pdfId, value), [pdfId]);
  const draft = useMemo(() => ({ mode: "send", fields, recipients, settings }), [fields, recipients, settings]);
  const autosave = useAutosave(save, draft, { enabled: loaded });

  const change = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const go = async (to) => {
    await autosave.flush().catch(() => {});
    navigate(to);
  };

  const send = async () => {
    const problems = sendProblems(recipients, fields);
    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }
    const needsPasscode = recipients.find((r) => r.authType === "passcode" && (passcodes[r.id] || "").trim().length < 4);
    if (needsPasscode) {
      toast.error(`Set the passcode for ${needsPasscode.name}.`);
      document.getElementById(`passcode-${needsPasscode.id}`)?.focus();
      return;
    }
    if (!paid && (settings.emailSubject.trim() || settings.reminderCadence !== "none")) {
      setUpgrade("Your own email subject and automatic reminders are on the Pro plan.");
      return;
    }

    setSending(true);
    const toastId = toast.loading("Sending the document and the invitations…");
    try {
      await autosave.flush().catch(() => {});
      const result = await sendDocumentApi(pdfId, {
        recipients: recipients.map((r, index) => ({
          ...r,
          passcode: r.authType === "passcode" ? passcodes[r.id] : undefined,
          signingOrder: index + 1,
        })),
        fields,
        emailSubject: settings.emailSubject.trim(),
        message: settings.message,
        reminderCadence: settings.reminderCadence,
        expiresAt: settings.expiresAt || null,
        signingOrder: Boolean(settings.signingOrder),
      });
      forgetPasscodes(pdfId);
      toast.success("Sent. Everyone who needs to act has been told.", { id: toastId });
      if (result?.signNowToken) setSignNow(result.signNowToken);
      else navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message?.replace(/^[A-Z_]+:\s*/, "") || "The document could not be sent. Please try again.", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  const steps = sendSteps(pdfId, go, 3);
  const summaryOf = (recipient) => {
    const theirs = fields.filter((f) => f.recipientId === recipient.id);
    const counts = new Map();
    for (const f of theirs) counts.set(f.type, (counts.get(f.type) || 0) + 1);
    return { theirs, counts, required: theirs.filter(isRequired).length };
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <ol className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider mb-3" aria-label="Steps">
              {steps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-1">
                  {index > 0 && <span className="w-4 h-0.5 bg-white/20" aria-hidden="true" />}
                  <button
                    type="button"
                    disabled={!step.onClick}
                    onClick={step.onClick}
                    aria-current={step.active ? "step" : undefined}
                    className={`px-2.5 py-1.5 rounded-lg border-2 ${step.active ? "bg-yellow-400 text-black border-black" : "border-white/20 text-white hover:bg-white/10"}`}
                  >
                    {index + 1}. {step.label}
                  </button>
                </li>
              ))}
            </ol>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Review and send</h1>
            <p className="text-gray-400 text-xs mt-1 truncate">
              {doc.originalFileName} · {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"} · {fields.length} field{fields.length === 1 ? "" : "s"}
              <span className="ml-2 text-gray-500" role="status">
                {saveStatusText(autosave.status)}
              </span>
            </p>
          </div>
          <button type="button" onClick={send} disabled={sending} className={BTN.primary}>
            <ICONS.send className="w-4 h-4" />
            {sending ? "Sending…" : "Send for Signing"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Who gets what */}
          <section className={`${PANEL} p-5 sm:p-6 space-y-4 lg:col-span-3`} aria-labelledby="who-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="who-heading" className="text-base font-black uppercase tracking-tight text-white">
                {settings.signingOrder ? "In this order" : "All at once"}
              </h2>
              <button type="button" onClick={() => go(`/send/${pdfId}`)} className={BTN.small}>
                Change
              </button>
            </div>
            <ol className="space-y-3">
              {recipients.map((r, index) => {
                const { counts, required } = summaryOf(r);
                return (
                  <li key={r.id} className="bg-[#090a0f] border-2 border-white/15 rounded-2xl p-4" style={{ borderLeftColor: r.color, borderLeftWidth: 6 }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">
                          {settings.signingOrder ? `${index + 1}. ` : ""}
                          {r.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {r.channel === "email" ? r.email : `${r.phone} by ${r.channel === "sms" ? "SMS" : "WhatsApp"}`} · {ROLE_WORDS[r.role]} · {AUTH_WORDS[r.authType || "none"]}
                          {r.language === "hi" ? " · हिन्दी" : ""}
                        </p>
                      </div>
                      {r.role !== "viewer" && (
                        <button type="button" onClick={() => setPreviewing(r)} className={BTN.small}>
                          <ICONS.doc className="w-3.5 h-3.5" /> See it as {r.name.split(" ")[0] || "them"}
                        </button>
                      )}
                    </div>
                    {r.role !== "viewer" && (
                      <p className="mt-2 text-[11px] text-gray-300">
                        {[...counts].map(([type, count]) => `${count} ${FIELD_TYPES[type]?.label.toLowerCase() || type}`).join(", ") || "No fields"}
                        {required > 0 ? ` · ${required} required` : ""}
                      </p>
                    )}
                    {r.authType === "passcode" && (
                      <div className="mt-3 max-w-xs">
                        <label className={LABEL} htmlFor={`passcode-${r.id}`}>
                          Passcode for {r.name}
                        </label>
                        <input
                          id={`passcode-${r.id}`}
                          type="password"
                          autoComplete="new-password"
                          className={INPUT}
                          value={passcodes[r.id] || ""}
                          onChange={(e) => {
                            setPasscodes((all) => ({ ...all, [r.id]: e.target.value }));
                            rememberPasscode(pdfId, r.id, e.target.value);
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <button type="button" onClick={() => go(`/assign/${pdfId}`)} className={`${BTN.secondary} w-full`}>
              <ICONS.back className="w-4 h-4" /> Back to the fields
            </button>
          </section>

          {/* The email, reminders and deadline */}
          <section className={`${PANEL} p-5 sm:p-6 space-y-4 lg:col-span-2`} aria-labelledby="email-heading">
            <h2 id="email-heading" className="text-base font-black uppercase tracking-tight text-white">
              The invitation
            </h2>

            <div>
              <label className={`${LABEL} flex items-center justify-between`} htmlFor="subject">
                <span>Email subject</span>
                {!paid && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400 text-black">Pro</span>}
              </label>
              <input
                id="subject"
                className={INPUT}
                maxLength={200}
                disabled={!paid}
                placeholder={paid ? `Please sign: ${doc.originalFileName}` : "Our standard subject is used"}
                value={settings.emailSubject || ""}
                onChange={(e) => change({ emailSubject: e.target.value })}
              />
              {!paid && (
                <button type="button" className="mt-1 text-[11px] font-bold text-yellow-400 underline" onClick={() => setUpgrade("Write your own email subject on the Pro plan.")}>
                  Use your own subject
                </button>
              )}
            </div>

            <div>
              <label className={LABEL} htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                maxLength={2000}
                className={`${INPUT} py-2 min-h-[110px]`}
                placeholder="Please review and sign at your earliest convenience."
                value={settings.message || ""}
                onChange={(e) => change({ message: e.target.value })}
              />
            </div>

            <div>
              <label className={`${LABEL} flex items-center justify-between`} htmlFor="reminders">
                <span>Automatic reminders</span>
                {!paid && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400 text-black">Pro</span>}
              </label>
              <select
                id="reminders"
                className={INPUT}
                value={settings.reminderCadence || "none"}
                onChange={(e) => {
                  if (!paid && e.target.value !== "none") {
                    setUpgrade("Automatic reminders are on the Pro plan.");
                    return;
                  }
                  change({ reminderCadence: e.target.value });
                }}
              >
                <option value="none">None (remind by hand from your documents)</option>
                <option value="daily">Every day until signed</option>
                <option value="3days">Every 3 days</option>
                <option value="5days">Every 5 days</option>
              </select>
            </div>

            <div>
              <label className={LABEL} htmlFor="deadline">
                Deadline (optional)
              </label>
              <input id="deadline" type="date" min={tomorrow()} className={INPUT} value={settings.expiresAt || ""} onChange={(e) => change({ expiresAt: e.target.value })} />
              <p className="text-[11px] text-gray-500 mt-1">After this day the link stops working.</p>
            </div>

            <button type="button" onClick={send} disabled={sending} className={`${BTN.primary} w-full`}>
              <ICONS.send className="w-4 h-4" />
              {sending ? "Sending…" : "Send now"}
            </button>
            <p className={`${EYEBROW} text-gray-500`}>Sending uses one document from this month&apos;s allowance.</p>
          </section>
        </div>
      </main>

      {previewing && <SignerPreview doc={doc} recipient={previewing} fields={fields.filter((f) => f.recipientId === previewing.id)} onClose={() => setPreviewing(null)} />}

      {signNow && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="sign-now-title" className={`${PANEL} max-w-md w-full p-6 space-y-4`}>
            <h2 id="sign-now-title" className="text-lg font-black uppercase text-white">
              Sent. It is your turn to sign.
            </h2>
            <p className="text-sm text-gray-300">You are one of the signers. Sign now, or later from the email we sent you.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className={`${BTN.primary} flex-1`} onClick={() => navigate(`/sign/${signNow}`)} autoFocus>
                Sign now
              </button>
              <button type="button" className={`${BTN.secondary} flex-1`} onClick={() => navigate("/dashboard")}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={Boolean(upgrade)}
        onClose={() => setUpgrade("")}
        reason={upgrade}
        onUpgraded={() => {
          fetchUserSubscription().then(setSubscription).catch(() => {});
          setUpgrade("");
        }}
      />
    </div>
  );
}

/** The document as one recipient will see it, without being able to fill it in */
function SignerPreview({ doc, recipient, fields, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const autoValue = (field) => (field.type === "name" ? recipient.name : field.type === "email" ? recipient.email : "");

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-stretch sm:items-center justify-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="bg-[#f3efe6] border-2 border-black sm:rounded-2xl w-full max-w-4xl h-full sm:h-[88vh] flex flex-col overflow-hidden shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-black bg-white">
          <h2 id="preview-title" className="text-sm font-black uppercase tracking-tight text-black truncate">
            What {recipient.name} will see
          </h2>
          <button type="button" onClick={onClose} className="min-h-[40px] px-3 rounded-lg border-2 border-black bg-white text-black text-xs font-black uppercase" autoFocus>
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 flex">
          <DocumentCanvas
            fileUrl={doc.url}
            maxFitWidth={820}
            scrollMode="self"
            pageClassName="border-2 border-black shadow-[4px_4px_0px_0px_#000]"
            renderOverlay={(page, size) =>
              fields
                .filter((f) => f.page === page)
                .map((field) => (
                  <SignerField key={field.id} field={field} pageWidth={size.width} pageHeight={size.height} autoValue={autoValue(field)} preview words={PREVIEW_WORDS} />
                ))
            }
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
