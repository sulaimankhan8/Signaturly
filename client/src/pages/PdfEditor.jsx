import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import toast, { Toaster } from "react-hot-toast";
import DocumentEditor from "../components/editor/DocumentEditor";
import { useFieldHistory } from "../components/editor/useFieldHistory";
import { useAutosave } from "../components/editor/useAutosave";
import { outstandingRequired, problemWithValue, labelOf, typeOf } from "../components/editor/fieldTypes";
import { UI } from "../components/editor/icons";
import SignatureStudio from "../components/signature/SignatureStudio";
import { useSavedSignature } from "../components/signature/useSavedSignature";
import { fetchDocumentForEditingApi, saveDraftApi, signPdfApi } from "../api/pdf.api";
import { formatFieldDate } from "../utils/fieldDate";

/**
 * Signing your own document: place your signature, initials, name, date, text and ticks, then
 * sign. Work is saved as you go. A document you prepared for others can be signed by you
 * instead, and the other way round.
 */
export default function PdfEditor() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const history = useFieldHistory([]);
  const { fields, resetFields } = history;
  const [doc, setDoc] = useState(null);
  const [kept, setKept] = useState({ recipients: [], settings: {} });
  const [sendNotice, setSendNotice] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [studio, setStudio] = useState(null);
  const [signing, setSigning] = useState(false);

  const saved = useSavedSignature();
  const images = useMemo(() => ({ signature: saved.signature, initials: saved.initials }), [saved.signature, saved.initials]);
  const autoValues = useMemo(() => ({ name: user?.name || "", email: user?.email || "" }), [user?.name, user?.email]);

  useEffect(() => {
    let current = true;
    fetchDocumentForEditingApi(pdfId)
      .then((data) => {
        if (!current) return;
        if (data.sent) {
          toast.error("This document has been sent for signature and can no longer be edited.");
          navigate("/dashboard");
          return;
        }
        setDoc({ ...data, url: `${import.meta.env.VITE_API_BASE_URL}${data.url}` });
        const draft = data.draft;
        if (draft) {
          resetFields(draft.fields || []);
          setKept({ recipients: draft.recipients || [], settings: draft.settings || {} });
          if (draft.mode === "send" && (draft.recipients || []).length > 0) setSendNotice(draft.recipients.length);
        }
        setLoaded(true);
      })
      .catch((error) => {
        if (error.response?.status === 401) navigate("/login");
        else toast.error("The document could not be opened. Please try again.");
      });
    return () => {
      current = false;
    };
  }, [pdfId, navigate, resetFields]);

  const save = useCallback((value) => saveDraftApi(pdfId, value), [pdfId]);
  const draft = useMemo(() => ({ mode: "self", fields, recipients: kept.recipients, settings: kept.settings }), [fields, kept]);
  const autosave = useAutosave(save, draft, { enabled: loaded });

  const leave = async (to) => {
    try {
      await autosave.flush();
    } catch {
      // The tab will ask before closing if it is still unsaved
    }
    navigate(to);
  };

  const adopt = async (kind, dataUrl) => {
    setStudio(null);
    try {
      await saved.save(kind, dataUrl);
    } catch {
      toast.error("Your signature is used on this document but could not be saved to your account.");
    }
  };

  // The owner's own fields as they will be stamped: their signature, name, email and dates in place
  const filledFields = () =>
    fields.map((field) => {
      if (typeOf(field).image) return { ...field, signatureUrl: images[field.type] || "", value: images[field.type] || "" };
      if (field.type === "name") return { ...field, value: autoValues.name };
      if (field.type === "email") return { ...field, value: autoValues.email };
      if (field.type === "date") return { ...field, value: field.value || formatFieldDate() };
      return field;
    });

  const sign = async () => {
    if (signing) return;
    if (fields.length === 0) {
      toast.error("Add at least one field, such as your signature, before signing.");
      return;
    }

    const filled = filledFields();
    const missing = outstandingRequired(filled);
    if (missing.length > 0) {
      const first = missing[0];
      if (typeOf(first).image) {
        toast.error(first.type === "initials" ? "Add your initials first." : "Add your signature first.");
        setStudio(first.type);
      } else {
        toast.error(`Fill in "${labelOf(first)}" on page ${first.page}.`);
        document.getElementById(`field-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const invalid = filled.find((f) => problemWithValue(f));
    if (invalid) {
      toast.error(`${labelOf(invalid)}: ${problemWithValue(invalid)}`);
      return;
    }

    setSigning(true);
    const toastId = toast.loading("Signing and sealing your document…");
    try {
      await autosave.flush().catch(() => {});
      await signPdfApi({ pdfId, fields: filled });
      toast.success("Signed. Your copy is ready to download from your documents.", { id: toastId });
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "The document could not be signed. Please try again.", { id: toastId });
    } finally {
      setSigning(false);
    }
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label="Opening the document" />
      </div>
    );
  }

  const signaturePanel = (
    <section aria-labelledby="mine-heading" className="space-y-2">
      <h2 id="mine-heading" className="text-[11px] font-black uppercase tracking-wider text-gray-300">
        Your signature
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["signature", "Signature"],
          ["initials", "Initials"],
        ].map(([kind, words]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setStudio(kind)}
            className="min-h-[72px] rounded-xl border-2 border-white/15 hover:border-yellow-400 bg-white flex flex-col items-center justify-center p-1.5 shadow-[2px_2px_0px_0px_#000]"
            aria-label={images[kind] ? `Change your ${words.toLowerCase()}` : `Create your ${words.toLowerCase()}`}
          >
            {images[kind] ? (
              <img src={images[kind]} alt="" className="max-h-10 max-w-full object-contain" />
            ) : (
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">{saved.loading ? "…" : `+ ${words}`}</span>
            )}
            <span className="text-[10px] font-black uppercase text-gray-500 mt-1">{images[kind] ? "Change" : ""}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">Saved to your account, so it is ready next time on any device.</p>
    </section>
  );

  return (
    <>
      <Toaster position="top-right" />
      <DocumentEditor
        mode="self"
        fileUrl={doc.url}
        title={doc.originalFileName || "Document"}
        subtitle="Sign it yourself"
        history={history}
        saveStatus={autosave.status}
        autoValues={autoValues}
        signatureImages={images}
        onRequestSignature={(kind) => setStudio(kind === "initials" ? "initials" : "signature")}
        sidebarTop={signaturePanel}
        onBack={() => leave("/dashboard")}
        backLabel="Documents"
        notice={
          sendNotice > 0 && (
            <div className="px-4 py-2 bg-yellow-400 text-black text-xs font-bold flex flex-wrap items-center gap-3 border-t-2 border-black">
              <span>
                You were preparing this to send to {sendNotice} {sendNotice === 1 ? "person" : "people"}.
              </span>
              <button type="button" onClick={() => leave(`/assign/${pdfId}`)} className="underline font-black uppercase tracking-wider">
                Continue sending
              </button>
              <button type="button" onClick={() => setSendNotice(0)} className="ml-auto font-black uppercase tracking-wider" aria-label="Keep signing it myself">
                Sign it myself
              </button>
            </div>
          )
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => leave(`/send/${pdfId}?from=self`)}
            className="hidden sm:inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border-2 border-white/20 bg-[#1e2235] hover:bg-[#282d47] text-white text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]"
          >
            <UI.send className="w-4 h-4" />
            Send to others
          </button>
        }
        primaryAction={{ label: "Sign & finish", busyLabel: "Signing…", onClick: sign, busy: signing, icon: <UI.check className="w-4 h-4" /> }}
      />
      <SignatureStudio
        open={Boolean(studio)}
        onClose={() => setStudio(null)}
        kinds={["signature", "initials"]}
        kind={studio || "signature"}
        current={images}
        onAdopt={adopt}
        signerName={user?.name || ""}
      />
    </>
  );
}
