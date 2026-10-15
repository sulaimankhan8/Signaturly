import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import { fetchDocumentForEditingApi, saveDraftApi } from "../api/pdf.api";
import { fetchUserProfileApi } from "../api/user.api";
import { fetchEsignAvailabilityForSenderApi, fetchRecentRecipientsApi } from "../api/send.api";
import { useAutosave, saveStatusText } from "../components/editor/useAutosave";
import { BTN, PANEL, INPUT, LABEL, EYEBROW, ICONS } from "../components/billing/theme";
import { newRecipient, passcodeFor, rememberPasscode, sendSteps } from "../utils/sendFlow";
import { RECIPIENT_PALETTE } from "../utils/constants";

/**
 * Step 1 of sending: who receives the document, in what order, how they are reached and how
 * they prove who they are. Saved as a draft as the sender types.
 */
export default function SendDocument() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useCurrentUser();

  const [doc, setDoc] = useState(null);
  const [kept, setKept] = useState({ mode: "send", fields: [], settings: {} });
  const [recipients, setRecipients] = useState([]);
  const [signingOrder, setSigningOrder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // The list was made here rather than read from the draft, so it still needs saving
  const [madeHere, setMadeHere] = useState(false);
  const [esign, setEsign] = useState({ available: false, pricePaise: 0 });
  const [passcodes, setPasscodes] = useState({});
  // People sent to before, offered as the sender types a name or address
  const [recent, setRecent] = useState([]);

  const me = useMemo(() => ({ name: user?.name || "", email: (user?.email || "").toLowerCase() }), [user?.name, user?.email]);
  const includesMe = recipients.some((r) => r.email.trim().toLowerCase() === me.email && me.email);

  useEffect(() => {
    let current = true;
    fetchEsignAvailabilityForSenderApi().then((value) => current && value && setEsign(value)).catch(() => {});
    fetchRecentRecipientsApi().then((people) => current && setRecent(people)).catch(() => {});

    // "Me & others" from the upload page, or fields the sender placed for themselves first.
    // Opened from a link or after a reload, the sender's own name is fetched with the document.
    const wantsMe = params.get("me") === "1" || params.get("from") === "self";
    Promise.all([fetchDocumentForEditingApi(pdfId), wantsMe && !me.email ? fetchUserProfileApi().catch(() => null) : null])
      .then(([data, profile]) => {
        if (!current) return;
        const self = me.email ? me : { name: profile?.name || "", email: (profile?.email || "").toLowerCase() };
        if (data.sent) {
          toast.error("This document has already been sent.");
          navigate("/dashboard");
          return;
        }
        setDoc(data);
        const draft = data.draft || {};
        setKept({ fields: draft.fields || [], settings: draft.settings || {} });
        setSigningOrder(Boolean(draft.settings?.signingOrder));

        let list = draft.recipients?.length ? draft.recipients : [];
        const fromDraft = list.length;
        if (wantsMe && self.email && !list.some((r) => (r.email || "").toLowerCase() === self.email)) {
          list = [newRecipient(0, { name: self.name, email: self.email, isSender: true }), ...list];
        }
        if (list.length === 0) list = [newRecipient(0)];
        setMadeHere(list.length !== fromDraft);
        setRecipients(list.map((r, i) => ({ ...newRecipient(i), ...r })));
        setPasscodes(Object.fromEntries(list.map((r) => [r.id, passcodeFor(pdfId, r.id)])));
        setLoaded(true);
      })
      .catch((error) => {
        if (error.response?.status === 401) navigate("/login");
        else toast.error("The document could not be opened. Please try again.");
      });

    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfId]);

  const save = useCallback((value) => saveDraftApi(pdfId, value), [pdfId]);
  const draft = useMemo(
    () => ({ mode: "send", fields: kept.fields, recipients, settings: { ...kept.settings, signingOrder } }),
    [kept, recipients, signingOrder]
  );
  const autosave = useAutosave(save, draft, { enabled: loaded, unsavedOnLoad: madeHere });

  const update = (id, changes) => setRecipients((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const suggest = (id, key, value) => {
    const match = recent.find((p) => (key === "name" ? p.name === value : (p.email || "").toLowerCase() === value.trim().toLowerCase()));
    setRecipients((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [key]: value };
        if (match) {
          if (!r.name.trim() || key === "name") next.name = match.name;
          if (!r.email.trim() || key === "email") next.email = match.email || r.email;
          if (!(r.phone || "").trim() && match.phone) next.phone = match.phone;
        }
        return next;
      })
    );
  };

  const add = (extra = {}) => setRecipients((list) => [...list, newRecipient(list.length, extra)]);

  const remove = (id) => {
    if (recipients.length <= 1) {
      toast.error("At least one recipient is needed.");
      return;
    }
    const placed = kept.fields.filter((f) => f.recipientId === id).length;
    if (placed > 0 && !window.confirm(`Remove this recipient and the ${placed} field${placed === 1 ? "" : "s"} placed for them?`)) return;
    setRecipients((list) => list.filter((r) => r.id !== id));
    setKept((k) => ({ ...k, fields: k.fields.filter((f) => f.recipientId !== id) }));
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= recipients.length) return;
    setRecipients((list) => {
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const next = async () => {
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const label = r.name.trim() || `Recipient ${i + 1}`;
      if (!r.name.trim()) {
        toast.error(`Enter a name for recipient ${i + 1}.`);
        return;
      }
      const byPhone = r.channel === "sms" || r.channel === "whatsapp";
      if (byPhone && !(r.phone || "").trim()) {
        toast.error(`Enter a mobile number for ${label}.`);
        return;
      }
      if (!byPhone && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
        toast.error(`Enter a valid email address for ${label}.`);
        return;
      }
      if (r.authType === "passcode" && (passcodes[r.id] || "").trim().length < 4) {
        toast.error(`Set a passcode of at least 4 characters for ${label}.`);
        return;
      }
    }
    if (!recipients.some((r) => r.role !== "viewer")) {
      toast.error("Someone needs to sign or approve the document.");
      return;
    }
    for (const r of recipients) rememberPasscode(pdfId, r.id, r.authType === "passcode" ? passcodes[r.id] : "");
    try {
      await autosave.flush();
    } catch {
      toast.error("Your changes could not be saved. Check your connection and try again.");
      return;
    }
    navigate(`/assign/${pdfId}`);
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  const steps = sendSteps(pdfId, (to) => autosave.flush().catch(() => {}).then(() => navigate(to)), 1, { canReview: false });

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100 font-sans">
      <Toaster position="top-right" />
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
                    className={`px-2.5 py-1.5 rounded-lg border-2 ${step.active ? "bg-yellow-400 text-black border-black" : "border-white/10 text-gray-400"}`}
                  >
                    {index + 1}. {step.label}
                  </button>
                </li>
              ))}
            </ol>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">Who receives it</h1>
            <p className="text-gray-400 text-xs mt-1 truncate">
              {doc.originalFileName} · {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
              <span className="ml-2 text-gray-500" role="status">
                {saveStatusText(autosave.status)}
              </span>
            </p>
          </div>
          <button type="button" onClick={next} className={BTN.primary}>
            Next: Place Form Fields
            <ICONS.arrow className="w-4 h-4" />
          </button>
        </div>

        <section className={`${PANEL} p-5 sm:p-6 space-y-5`} aria-labelledby="recipients-heading">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="recipients-heading" className="text-base font-black uppercase tracking-tight text-white">
                Recipients
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">Signers sign; approvers approve without a signature; viewers get a copy.</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-[#090a0f] border-2 border-white/20 rounded-xl px-3 min-h-[44px]">
              <input type="checkbox" checked={signingOrder} onChange={(e) => setSigningOrder(e.target.checked)} className="w-4 h-4 accent-red-600" />
              <span className="text-xs font-black uppercase tracking-wider text-white">Sign in this order</span>
            </label>
          </div>

          <ol className="space-y-4">
            {recipients.map((r, index) => {
              const byPhone = r.channel === "sms" || r.channel === "whatsapp";
              const isMe = me.email && r.email.trim().toLowerCase() === me.email;
              return (
                <li key={r.id} className="bg-[#090a0f] border-2 border-white/15 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#000]" style={{ borderLeftColor: r.color, borderLeftWidth: 6 }}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg border-2 border-black text-black font-black text-xs flex items-center justify-center" style={{ background: r.color }}>
                        {signingOrder ? index + 1 : "•"}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {r.name.trim() || `Recipient ${index + 1}`}
                        {isMe && <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-400 text-black text-[10px]">You</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {signingOrder && (
                        <>
                          <button type="button" className={BTN.small} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${r.name || "recipient"} earlier`}>
                            ↑
                          </button>
                          <button type="button" className={BTN.small} disabled={index === recipients.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${r.name || "recipient"} later`}>
                            ↓
                          </button>
                        </>
                      )}
                      {recipients.length > 1 && (
                        <button type="button" className={`${BTN.small} hover:bg-red-600`} onClick={() => remove(r.id)} aria-label={`Remove ${r.name || "recipient"}`}>
                          <ICONS.close className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL} htmlFor={`name-${r.id}`}>
                        Name
                      </label>
                      <input id={`name-${r.id}`} className={INPUT} placeholder="e.g. John Doe" autoComplete="off" list="recent-names" value={r.name} onChange={(e) => suggest(r.id, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`email-${r.id}`}>
                        Email {byPhone ? "(optional)" : ""}
                      </label>
                      <input id={`email-${r.id}`} type="email" className={INPUT} placeholder="john@company.com" autoComplete="off" list="recent-emails" value={r.email} onChange={(e) => suggest(r.id, "email", e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`phone-${r.id}`}>
                        Mobile {byPhone ? "" : "(optional)"}
                      </label>
                      <input id={`phone-${r.id}`} type="tel" inputMode="tel" className={INPUT} placeholder="+91 98765 43210" value={r.phone || ""} onChange={(e) => update(r.id, { phone: e.target.value })} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`role-${r.id}`}>
                        Role
                      </label>
                      <select id={`role-${r.id}`} className={INPUT} value={r.role} onChange={(e) => update(r.id, { role: e.target.value })}>
                        <option value="signer">Signer</option>
                        <option value="approver">Approver</option>
                        <option value="viewer">Viewer (gets a copy)</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`channel-${r.id}`}>
                        Send by
                      </label>
                      <select id={`channel-${r.id}`} className={INPUT} value={r.channel || "email"} onChange={(e) => update(r.id, { channel: e.target.value })}>
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`language-${r.id}`}>
                        Their language
                      </label>
                      <select id={`language-${r.id}`} className={INPUT} value={r.language || "en"} onChange={(e) => update(r.id, { language: e.target.value })}>
                        <option value="en">English</option>
                        <option value="hi">हिन्दी</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`auth-${r.id}`}>
                        Identity check
                      </label>
                      <select id={`auth-${r.id}`} className={INPUT} value={r.authType || "none"} onChange={(e) => update(r.id, { authType: e.target.value })}>
                        <option value="none">The link only</option>
                        <option value="otp">One-time code</option>
                        <option value="passcode">A passcode you give them</option>
                      </select>
                    </div>
                    {r.authType === "passcode" && (
                      <div>
                        <label className={LABEL} htmlFor={`passcode-${r.id}`}>
                          Passcode
                        </label>
                        <input
                          id={`passcode-${r.id}`}
                          type="password"
                          autoComplete="new-password"
                          className={INPUT}
                          placeholder="At least 4 characters"
                          value={passcodes[r.id] || ""}
                          onChange={(e) => setPasscodes((all) => ({ ...all, [r.id]: e.target.value }))}
                        />
                        <p className="text-[11px] text-gray-500 mt-1">Tell them separately. It is not saved with the draft.</p>
                      </div>
                    )}
                    {esign.available && r.role === "signer" && (
                      <div>
                        <label className={LABEL} htmlFor={`esign-${r.id}`}>
                          Signs with
                        </label>
                        <select
                          id={`esign-${r.id}`}
                          className={INPUT}
                          value={r.signatureType || "electronic"}
                          onChange={(e) => update(r.id, { signatureType: e.target.value })}
                          title="Aadhaar eSign signers sign last, one at a time, and each signature is paid for from the wallet"
                        >
                          <option value="electronic">Drawn or typed signature</option>
                          <option value="aadhaar">Aadhaar eSign (₹{(esign.pricePaise / 100).toFixed(0)} from wallet)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <datalist id="recent-names">
            {recent.map((p) => (
              <option key={`n-${p.email || p.phone}`} value={p.name}>
                {p.email || p.phone}
              </option>
            ))}
          </datalist>
          <datalist id="recent-emails">
            {recent.filter((p) => p.email).map((p) => (
              <option key={`e-${p.email}`} value={p.email}>
                {p.name}
              </option>
            ))}
          </datalist>

          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => add()} className={`${BTN.secondary} flex-1`}>
              <ICONS.plus className="w-4 h-4" /> Add a recipient
            </button>
            {!includesMe && me.email && (
              <button type="button" onClick={() => add({ name: me.name, email: me.email, isSender: true, color: RECIPIENT_PALETTE[recipients.length % RECIPIENT_PALETTE.length].color })} className={`${BTN.yellow} flex-1`}>
                <ICONS.plus className="w-4 h-4" /> Add me
              </button>
            )}
          </div>
        </section>

        <div className="flex justify-between gap-3">
          <button type="button" onClick={() => autosave.flush().catch(() => {}).then(() => navigate("/dashboard"))} className={BTN.ghost}>
            <ICONS.back className="w-4 h-4" /> Documents
          </button>
          <button type="button" onClick={next} className={BTN.primary}>
            Continue to fields
            <ICONS.arrow className="w-4 h-4" />
          </button>
        </div>
        <p className={`${EYEBROW} text-gray-500 text-center`}>Email subject, message, reminders and the deadline are set on the review step.</p>
      </main>
    </div>
  );
}
