import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import {
  fetchContactListsApi,
  fetchContactListApi,
  createContactListApi,
  updateContactListApi,
  deleteContactListApi,
  fetchBulkBatchesApi,
  startBulkSendApi,
  fetchBulkBatchApi,
  retryBulkBatchApi,
} from "../api/contacts.api";
import { fetchMyTemplatesApi } from "../api/template.api";

/**
 * Saved lists of people, and sending one template to everyone on a list (plan task P5-07).
 * A bulk send carries on in the background: this page shows how far it has got, which rows
 * failed and why, and sends the failed ones again.
 */

const card = "bg-[#12141c] border border-white/10 rounded-2xl p-6";
const inputClass = "w-full px-3 py-2.5 bg-[#08090d] border border-white/15 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500";
const primary = "px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold";
const quiet = "px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 rounded-xl text-xs font-bold text-gray-200";
const messageOf = (err, fallback) => (err.response?.data?.message || fallback).replace(/^[A-Z_]+:\s*/, "");
const day = (value) => (value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

const EMPTY = { id: null, name: "", csv: "" };

export default function ContactLists() {
  const [lists, setLists] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [batches, setBatches] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [send, setSend] = useState({ templateId: "", listId: "", message: "" });
  const [busy, setBusy] = useState("");
  const timer = useRef(null);

  const loadBatches = useCallback(async () => {
    const found = await fetchBulkBatchesApi().catch(() => []);
    setBatches(found || []);
    return found || [];
  }, []);

  const load = useCallback(async () => {
    const [foundLists, foundTemplates] = await Promise.all([fetchContactListsApi().catch(() => []), fetchMyTemplatesApi().catch(() => [])]);
    setLists(foundLists || []);
    setTemplates(foundTemplates || []);
    await loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    load();
  }, [load]);

  // While any bulk send still has rows waiting, read its progress every few seconds
  useEffect(() => {
    const waiting = batches.filter((batch) => batch.pending > 0);
    if (waiting.length === 0) return undefined;
    timer.current = setTimeout(async () => {
      const fresh = await Promise.all(waiting.map((batch) => fetchBulkBatchApi(batch.id).catch(() => batch)));
      setBatches((current) => current.map((batch) => fresh.find((f) => String(f.id) === String(batch.id)) || batch));
    }, 4000);
    return () => clearTimeout(timer.current);
  }, [batches]);

  const openList = async (list) => {
    try {
      const full = await fetchContactListApi(list.id || list._id);
      const rows = (full.contacts || []).map((c) => [c.name, c.email, c.phone, c.label].map((v) => v || "").join(", ").replace(/(, )+$/, ""));
      setEditing({ id: full.id || full._id, name: full.name, csv: ["name, email, phone, label", ...rows].join("\n") });
    } catch (err) {
      toast.error(messageOf(err, "The list could not be opened"));
    }
  };

  const readFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) return toast.error("That file is too large. Keep it under 500 KB.");
    const reader = new FileReader();
    reader.onload = () => setEditing((current) => ({ ...current, csv: String(reader.result) }));
    reader.readAsText(file);
  };

  const saveList = async (event) => {
    event.preventDefault();
    setBusy("save");
    try {
      const body = { name: editing.name, csv: editing.csv };
      const saved = editing.id ? await updateContactListApi(editing.id, body) : await createContactListApi(body);
      const skipped = saved?.problems?.length || 0;
      toast.success(skipped ? `Saved. ${skipped} row${skipped === 1 ? " was" : "s were"} left out.` : "List saved");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(messageOf(err, "The list could not be saved"));
    } finally {
      setBusy("");
    }
  };

  const startSend = async (event) => {
    event.preventDefault();
    setBusy("send");
    try {
      const batch = await startBulkSendApi(send);
      const skipped = batch.skipped?.length || 0;
      toast.success(`Sending ${batch.total} documents${skipped ? `; ${skipped} left out` : ""}`);
      setSend({ ...send, message: "" });
      await loadBatches();
    } catch (err) {
      toast.error(messageOf(err, "The bulk send could not be started"));
    } finally {
      setBusy("");
    }
  };

  const retry = async (batch) => {
    setBusy(`retry:${batch.id}`);
    try {
      await retryBulkBatchApi(batch.id);
      await loadBatches();
    } catch (err) {
      toast.error(messageOf(err, "Those rows could not be sent again"));
    } finally {
      setBusy("");
    }
  };

  // Bulk send needs a template with exactly one signer
  const usable = templates.filter((template) => (template.roles || []).length === 1);

  return (
    <div className="min-h-screen bg-[#08090d] text-gray-100">
      <Toaster position="top-right" />
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Contact lists</h1>
            <p className="text-sm text-gray-400 mt-1">Keep the people you send to often, and send one template to a whole list.</p>
          </div>
          <button className={primary} onClick={() => setEditing({ ...EMPTY })} data-testid="new-list">
            New list
          </button>
        </header>

        {editing && (
          <form className={`${card} space-y-3`} onSubmit={saveList} data-testid="list-editor">
            <input className={inputClass} required maxLength={80} placeholder="List name, for example Tenants, Block A" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <textarea
              className={`${inputClass} font-mono`}
              rows={8}
              required
              placeholder={"name, email, phone, label\nAsha Rao, asha@example.com, 9876543210, Flat 12"}
              value={editing.csv}
              onChange={(e) => setEditing({ ...editing, csv: e.target.value })}
            />
            <p className="text-[11px] text-gray-500">The first line names the columns: name, and email or phone; label is optional. Then one person per line. Or choose a CSV file saved from a spreadsheet.</p>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} className="text-xs text-gray-300" />
              <button className={primary} disabled={busy === "save"}>
                Save list
              </button>
              <button type="button" className={quiet} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className={card} data-testid="contact-lists">
          {lists === null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-gray-400">No lists yet. Make one to send a template to many people at once.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {lists.map((list) => (
                <li key={list.id || list._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{list.name}</p>
                    <p className="text-xs text-gray-400">{list.count ?? list.contacts?.length ?? 0} people</p>
                  </div>
                  <div className="flex gap-2">
                    <button className={quiet} onClick={() => openList(list)}>
                      Edit
                    </button>
                    <button className={quiet} onClick={() => setDeleting(list)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form className={`${card} space-y-3`} onSubmit={startSend} data-testid="bulk-send">
          <h2 className="text-sm font-bold text-white">Send a template to a list</h2>
          {usable.length === 0 ? (
            <p className="text-xs text-gray-400">
              Bulk send uses one of your own templates that has exactly one signer.{" "}
              <Link to="/templates" className="text-red-400 hover:text-red-300 font-bold">
                Go to templates
              </Link>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select className={inputClass} required value={send.templateId} onChange={(e) => setSend({ ...send, templateId: e.target.value })}>
                  <option value="">Choose a template</option>
                  {usable.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <select className={inputClass} required value={send.listId} onChange={(e) => setSend({ ...send, listId: e.target.value })}>
                  <option value="">Choose a list</option>
                  {(lists || []).map((list) => (
                    <option key={list.id || list._id} value={list.id || list._id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea className={inputClass} rows={2} maxLength={2000} placeholder="A message for everyone (optional)" value={send.message} onChange={(e) => setSend({ ...send, message: e.target.value })} />
              <p className="text-[11px] text-gray-500">Each person gets their own copy to sign, and each copy counts as one document. People without an email address are left out.</p>
              <button className={primary} disabled={busy === "send"}>
                {busy === "send" ? "Starting…" : "Send to the list"}
              </button>
            </>
          )}
        </form>

        {batches.length > 0 && (
          <section className={card} data-testid="bulk-batches">
            <h2 className="text-sm font-bold text-white">Bulk sends</h2>
            <ul className="mt-3 space-y-4">
              {batches.map((batch) => {
                const done = batch.sent + batch.failed;
                return (
                  <li key={batch.id} className="border border-white/10 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-white">{batch.templateName}</p>
                      <p className="text-xs text-gray-400">{day(batch.createdAt)}</p>
                    </div>
                    <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={batch.total} aria-valuenow={done}>
                      <div className="h-full bg-emerald-500" style={{ width: `${batch.total ? (batch.sent / batch.total) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-300">
                      {batch.sent} of {batch.total} sent
                      {batch.pending > 0 && ` · ${batch.pending} waiting`}
                      {batch.failed > 0 && <span className="text-red-400"> · {batch.failed} failed</span>}
                    </p>
                    {batch.failed > 0 && (
                      <div className="mt-3">
                        <ul className="text-xs text-gray-400 space-y-1">
                          {batch.failures.slice(0, 10).map((failure) => (
                            <li key={failure.row}>
                              Row {failure.row}, {failure.name || failure.email}: {failure.error}
                            </li>
                          ))}
                          {batch.failures.length > 10 && <li>and {batch.failures.length - 10} more</li>}
                        </ul>
                        <button className={`${quiet} mt-3`} disabled={busy === `retry:${batch.id}` || batch.pending > 0} onClick={() => retry(batch)}>
                          Send the failed rows again
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      <ConfirmModal
        isOpen={Boolean(deleting)}
        title="Delete this list?"
        message={deleting ? `"${deleting.name}" will be removed. Documents already sent to the people on it are not affected.` : ""}
        confirmText="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const list = deleting;
          setDeleting(null);
          try {
            await deleteContactListApi(list.id || list._id);
            await load();
          } catch (err) {
            toast.error(messageOf(err, "The list could not be deleted"));
          }
        }}
      />
    </div>
  );
}
