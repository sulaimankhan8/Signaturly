import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import DocumentEditor from "../components/editor/DocumentEditor";
import { useFieldHistory } from "../components/editor/useFieldHistory";
import { useAutosave } from "../components/editor/useAutosave";
import { UI } from "../components/editor/icons";
import { fetchDocumentForEditingApi, saveDraftApi } from "../api/pdf.api";
import { sendProblems, sendSteps } from "../utils/sendFlow";

/**
 * Step 2 of sending: put each recipient's fields on the document. Pick whose fields you are
 * placing on the left; every field shows its owner's colour. Saved as you go.
 */
export default function AssignFields() {
  const { pdfId } = useParams();
  const navigate = useNavigate();

  const history = useFieldHistory([]);
  const { fields, resetFields } = history;
  const [doc, setDoc] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [settings, setSettings] = useState({});
  const [loaded, setLoaded] = useState(false);
  // Fields given to the first signer while opening still need saving
  const [reassigned, setReassigned] = useState(false);

  useEffect(() => {
    let current = true;
    fetchDocumentForEditingApi(pdfId)
      .then((data) => {
        if (!current) return;
        if (data.sent) {
          toast.error("This document has already been sent.");
          navigate("/dashboard");
          return;
        }
        const draft = data.draft || {};
        const people = draft.recipients || [];
        if (people.length === 0) {
          toast.error("Add the recipients first.");
          navigate(`/send/${pdfId}`, { replace: true });
          return;
        }

        // Fields placed before there were recipients (signing it yourself first) go to the first signer
        const first = people.find((r) => r.role !== "viewer") || people[0];
        let moved = 0;
        const placed = (draft.fields || []).map((field) => {
          const owner = people.find((r) => r.id === field.recipientId);
          if (owner && owner.role !== "viewer") return field;
          moved += 1;
          return { ...field, recipientId: first.id, recipientName: first.name, recipientEmail: first.email, recipientColor: first.color };
        });
        if (moved > 0) {
          toast(`${moved} field${moved === 1 ? " was" : "s were"} given to ${first.name || "the first signer"}. Change who fills each one in its settings.`, { duration: 6000 });
        }

        setDoc({ ...data, url: `${import.meta.env.VITE_API_BASE_URL}${data.url}` });
        setRecipients(people);
        setSettings(draft.settings || {});
        resetFields(placed);
        setReassigned(moved > 0);
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
  const draft = useMemo(() => ({ mode: "send", fields, recipients, settings }), [fields, recipients, settings]);
  const autosave = useAutosave(save, draft, { enabled: loaded, unsavedOnLoad: reassigned });

  const go = async (to) => {
    try {
      await autosave.flush();
    } catch {
      // The tab asks before closing while anything is unsaved
    }
    navigate(to);
  };

  const review = () => {
    const problems = sendProblems(recipients, fields);
    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }
    go(`/review/${pdfId}`);
  };

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Toaster position="top-right" />
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" role="status" aria-label="Opening the document" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <DocumentEditor
        mode="send"
        fileUrl={doc.url}
        title={doc.originalFileName || "Document"}
        subtitle={`Step 2 of 3 · ${fields.length} field${fields.length === 1 ? "" : "s"} placed`}
        steps={sendSteps(pdfId, go, 2)}
        participants={recipients}
        history={history}
        saveStatus={autosave.status}
        onBack={() => go(`/send/${pdfId}`)}
        backLabel="Recipients"
        primaryAction={{ label: "Next: Review", onClick: review, icon: <UI.next className="w-4 h-4" /> }}
      />
    </>
  );
}
