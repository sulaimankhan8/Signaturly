import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/admin.api";

/**
 * Guided templates: every template with its versions. A published version's wording never
 * changes; a change is drafted as the next version, read as a PDF, then published. The parts
 * of a template that hold structure (signers, questions, text) are edited as JSON.
 */

const JSON_FIELDS = [
  ["roles", "Signers", "Who signs, and which question holds each one's name."],
  ["questions", "Questions", "What the sender is asked. A question's id is what the text refers to in {{double braces}}."],
  ["body", "Text", "The document, block by block: title, paragraph, clause, list, table, signatures."],
  ["stateNotes", "State notes", "Short notes shown to the sender for a state."],
];

const HINT_LEVELS = [
  ["esign_ok", "Ordinary e-signature is usual"],
  ["stamp_duty", "Stamp duty applies"],
  ["aadhaar_advised", "Aadhaar eSign advised"],
  ["check", "Check before relying on it"],
];

const STATUS_STYLE = {
  draft: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  published: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  retired: "bg-white/10 text-gray-400 border-white/20",
};

const inputClass =
  "w-full px-3 py-2 bg-[#07080c] border border-white/15 rounded-lg text-white text-xs focus:outline-none focus:border-red-500 disabled:opacity-60";
const buttonClass = "px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer";

const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

const toForm = (version) => ({
  title: version.title || "",
  summary: version.summary || "",
  pack: version.pack || "",
  industry: version.industry || "",
  hintLevel: version.signatureHint?.level || "check",
  hintText: version.signatureHint?.text || "",
  ...Object.fromEntries(JSON_FIELDS.map(([field]) => [field, JSON.stringify(version[field] || [], null, 2)])),
});

export default function AdminTemplates() {
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  const [selected, setSelected] = useState(null); // { key, language }
  const [version, setVersion] = useState(null); // the version being viewed, in full
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", text, problems? }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { url, pages }
  const [review, setReview] = useState({ name: "", date: "" });
  const [creating, setCreating] = useState(null); // new-template form, or null

  const fail = (err, fallback) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem("pactdoc_admin_token");
      navigate("/login");
      return;
    }
    const problems = Array.isArray(err.response?.data?.errors) ? err.response.data.errors.filter((p) => typeof p === "string") : [];
    setNotice({ kind: "error", text: err.response?.data?.message || err.response?.data?.error || fallback, problems });
  };

  const loadList = async () => {
    const { data } = await adminApi.get("/admin/templates");
    setCatalogue(data.data);
    return data.data;
  };

  const openVersion = async (id) => {
    const { data } = await adminApi.get(`/admin/templates/versions/${id}`);
    setVersion(data.data);
    setForm(toForm(data.data));
    setReview({ name: data.data.reviewer?.name || "", date: data.data.reviewer?.date ? String(data.data.reviewer.date).slice(0, 10) : "" });
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  };

  useEffect(() => {
    if (!localStorage.getItem("pactdoc_admin_token")) {
      navigate("/login");
      return;
    }
    loadList().catch((err) => fail(err, "The templates could not be loaded."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const template = catalogue?.templates.find((t) => selected && t.key === selected.key && t.language === selected.language);

  const selectTemplate = async (item) => {
    setSelected({ key: item.key, language: item.language });
    setNotice(null);
    try {
      await openVersion(item.versions[0].id);
    } catch (err) {
      fail(err, "The template could not be opened.");
    }
  };

  // Runs an action, then refreshes the list and the version on screen
  const act = async (action, done, openId) => {
    try {
      setBusy(true);
      setNotice(null);
      const result = await action();
      await loadList();
      const id = openId === null ? null : openId || result?.data?.data?._id || version?._id;
      if (id) await openVersion(id);
      setNotice({ kind: "ok", text: done });
      return result;
    } catch (err) {
      fail(err, "That did not work.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const readForm = () => {
    const changes = {
      title: form.title,
      summary: form.summary,
      pack: form.pack,
      industry: form.industry,
      signatureHint: { level: form.hintLevel, text: form.hintText },
    };
    for (const [field, label] of JSON_FIELDS) {
      try {
        changes[field] = JSON.parse(form[field]);
      } catch (err) {
        setNotice({ kind: "error", text: `${label} is not valid JSON: ${err.message}` });
        return null;
      }
    }
    return changes;
  };

  const saveDraft = () => {
    const changes = readForm();
    if (changes) act(() => adminApi.put(`/admin/templates/versions/${version._id}`, changes), "Draft saved.");
  };

  const showPreview = async () => {
    try {
      setBusy(true);
      setNotice(null);
      const res = await adminApi.post(`/admin/templates/versions/${version._id}/preview`, { answers: {} }, { responseType: "blob" });
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { url: URL.createObjectURL(res.data), pages: Number(res.headers["x-page-count"]) || 1 };
      });
    } catch (err) {
      setNotice({ kind: "error", text: "The preview could not be made. Save the draft first and fix any problems listed." });
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    const remaining = template.versions.find((v) => v.id !== version._id);
    await act(() => adminApi.delete(`/admin/templates/versions/${version._id}`), "Draft deleted.", remaining ? remaining.id : null);
    if (!remaining) {
      setSelected(null);
      setVersion(null);
    }
  };

  const createTemplate = async (event) => {
    event.preventDefault();
    const result = await act(() => adminApi.post("/admin/templates", creating), "Template created as a draft. Edit it, then publish.");
    if (result) {
      setSelected({ key: result.data.data.key, language: result.data.data.language });
      setCreating(null);
    }
  };

  const isDraft = version?.status === "draft";
  const hasDraft = template?.versions.some((v) => v.status === "draft");

  return (
    <div className="min-h-screen bg-[#0a0b10] text-gray-100 font-sans">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-xs text-gray-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-black">Templates</h1>
        </div>
        <button
          onClick={() => setCreating({ key: "", language: "en", pack: catalogue?.packs[0]?.id || "starter", title: "" })}
          className={`${buttonClass} bg-red-600 hover:bg-red-500 text-white`}
        >
          New template
        </button>
      </header>

      {notice && (
        <div
          role="status"
          className={`mx-6 mt-4 px-4 py-3 rounded-xl border text-xs ${
            notice.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          <p className="font-bold">{notice.text}</p>
          {notice.problems?.length > 0 && (
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {notice.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Every template */}
        <nav className="bg-[#12141c] border border-white/10 rounded-2xl p-3 space-y-1 max-h-[80vh] overflow-y-auto" aria-label="Templates">
          {!catalogue && <p className="text-xs text-gray-500 p-2">Loading...</p>}
          {catalogue?.templates.map((item) => {
            const active = selected && item.key === selected.key && item.language === selected.language;
            const draft = item.versions.some((v) => v.status === "draft");
            const current = item.versions.find((v) => v.status === "published");
            return (
              <button
                key={`${item.key}:${item.language}`}
                onClick={() => selectTemplate(item)}
                className={`w-full text-left px-3 py-2 rounded-xl border ${active ? "bg-red-950/40 border-red-500/50" : "border-transparent hover:bg-white/5"} cursor-pointer`}
              >
                <span className="block text-xs font-bold text-white">{item.title}</span>
                <span className="block text-[10px] text-gray-500 font-mono">
                  {item.key} · {item.language} · {item.packName}
                </span>
                <span className="block text-[10px] mt-0.5">
                  <span className={current ? "text-emerald-400" : "text-gray-500"}>{current ? `v${current.version} in use` : "not published"}</span>
                  {current && !current.reviewer && <span className="text-amber-400"> · not reviewed</span>}
                  {draft && <span className="text-amber-300"> · draft waiting</span>}
                </span>
              </button>
            );
          })}
        </nav>

        {/* The chosen template */}
        {!template || !version || !form ? (
          <p className="text-sm text-gray-500 p-6">Choose a template to see its versions.</p>
        ) : (
          <section className="space-y-5" aria-label="Template details">
            <div className="flex flex-wrap items-center gap-2">
              {template.versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openVersion(v.id).catch((err) => fail(err, "That version could not be opened."))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${STATUS_STYLE[v.status]} ${v.id === version._id ? "ring-2 ring-white/60" : ""}`}
                >
                  Version {v.version} · {v.status} · {v.documents} document{v.documents === 1 ? "" : "s"}
                </button>
              ))}
            </div>

            <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-300">
                  <strong className="text-white">
                    {version.key} · version {version.version}
                  </strong>{" "}
                  ·{" "}
                  {isDraft
                    ? "Draft: not offered to senders until it is published."
                    : version.status === "published"
                    ? "Published: its wording cannot be changed. Start a new version to change it."
                    : "Retired: no longer used for new documents."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={showPreview} disabled={busy} className={`${buttonClass} bg-white/10 hover:bg-white/20 text-white`}>
                    Make preview
                  </button>
                  {isDraft && (
                    <>
                      <button onClick={saveDraft} disabled={busy} className={`${buttonClass} bg-white/10 hover:bg-white/20 text-white`}>
                        Save draft
                      </button>
                      <button
                        onClick={() => act(() => adminApi.post(`/admin/templates/versions/${version._id}/publish`), `Version ${version.version} is published and now used for new documents.`)}
                        disabled={busy}
                        className={`${buttonClass} bg-emerald-600 hover:bg-emerald-500 text-white`}
                      >
                        Publish
                      </button>
                      <button onClick={removeDraft} disabled={busy} className={`${buttonClass} bg-red-950 hover:bg-red-900 text-red-300`}>
                        Delete draft
                      </button>
                    </>
                  )}
                  {!isDraft && (
                    <button
                      onClick={() =>
                        act(
                          () => adminApi.post("/admin/templates/versions", { key: version.key, language: version.language, from: version.version }),
                          "New draft started. Edit it, then publish."
                        )
                      }
                      disabled={busy || hasDraft}
                      title={hasDraft ? "Publish or delete the existing draft first" : ""}
                      className={`${buttonClass} bg-red-600 hover:bg-red-500 text-white`}
                    >
                      Start new version from this
                    </button>
                  )}
                  {version.status === "published" && (
                    <button
                      onClick={() => act(() => adminApi.post(`/admin/templates/versions/${version._id}/retire`), `Version ${version.version} is retired.`)}
                      disabled={busy}
                      className={`${buttonClass} bg-white/10 hover:bg-white/20 text-gray-200`}
                    >
                      Retire
                    </button>
                  )}
                </div>
              </div>

              {preview && (
                <a href={preview.url} target="_blank" rel="noreferrer" className="inline-block text-xs text-red-300 underline">
                  Open preview ({preview.pages} page{preview.pages === 1 ? "" : "s"})
                </a>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-[11px] text-gray-400 space-y-1">
                  <span>Title</span>
                  <input className={inputClass} disabled={!isDraft} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label className="text-[11px] text-gray-400 space-y-1">
                  <span>Pack</span>
                  <select className={inputClass} disabled={!isDraft} value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })}>
                    {catalogue.packs.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name} ({pack.tier} and above)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-gray-400 space-y-1 md:col-span-2">
                  <span>Summary</span>
                  <input className={inputClass} disabled={!isDraft} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                </label>
                <label className="text-[11px] text-gray-400 space-y-1">
                  <span>Signature hint</span>
                  <select className={inputClass} disabled={!isDraft} value={form.hintLevel} onChange={(e) => setForm({ ...form, hintLevel: e.target.value })}>
                    {HINT_LEVELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-gray-400 space-y-1">
                  <span>Hint shown to the sender</span>
                  <input className={inputClass} disabled={!isDraft} value={form.hintText} onChange={(e) => setForm({ ...form, hintText: e.target.value })} />
                </label>
              </div>

              {JSON_FIELDS.map(([field, label, help]) => (
                <label key={field} className="block text-[11px] text-gray-400 space-y-1">
                  <span>
                    <strong className="text-gray-200">{label}</strong> · {help}
                  </span>
                  <textarea
                    aria-label={label}
                    className={`${inputClass} font-mono leading-relaxed`}
                    rows={field === "body" ? 18 : 8}
                    spellCheck={false}
                    disabled={!isDraft}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                </label>
              ))}
            </div>

            {/* The lawyer's review of this exact wording */}
            {version.status !== "retired" && (
              <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white">Lawyer's review of version {version.version}</h2>
                <p className="text-xs text-gray-400">
                  {version.reviewer
                    ? `Reviewed by ${version.reviewer.name} on ${day(version.reviewer.date)}.`
                    : "Not reviewed. Senders are told so, and in production an unreviewed template is not offered at all."}{" "}
                  A review covers this version only.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[11px] text-gray-400 space-y-1">
                    <span>Reviewer's name</span>
                    <input className={inputClass} value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} />
                  </label>
                  <label className="text-[11px] text-gray-400 space-y-1">
                    <span>Date of review</span>
                    <input type="date" className={inputClass} value={review.date} onChange={(e) => setReview({ ...review, date: e.target.value })} />
                  </label>
                  <button
                    onClick={() => act(() => adminApi.put(`/admin/templates/versions/${version._id}/review`, review), "Review recorded.")}
                    disabled={busy || !review.name.trim() || !review.date}
                    className={`${buttonClass} bg-emerald-600 hover:bg-emerald-500 text-white`}
                  >
                    Record review
                  </button>
                  {version.reviewer && (
                    <button
                      onClick={() => act(() => adminApi.put(`/admin/templates/versions/${version._id}/review`, { name: "" }), "Review removed.")}
                      disabled={busy}
                      className={`${buttonClass} bg-white/10 hover:bg-white/20 text-gray-200`}
                    >
                      Remove review
                    </button>
                  )}
                </div>
              </div>
            )}

            {version.history?.length > 0 && (
              <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-white mb-2">History of this version</h2>
                <ul className="text-xs text-gray-400 space-y-1">
                  {version.history.map((entry, index) => (
                    <li key={index}>
                      {day(entry.at)} · {entry.action}
                      {entry.note ? ` (${entry.note})` : ""} · {entry.byEmail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <form onSubmit={createTemplate} className="bg-[#12141c] border border-white/15 rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="text-base font-bold text-white">New template</h2>
            <label className="block text-[11px] text-gray-400 space-y-1">
              <span>Key (lower-case letters, digits and hyphens; used in links)</span>
              <input required className={inputClass} value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value })} placeholder="visitor-declaration" />
            </label>
            <label className="block text-[11px] text-gray-400 space-y-1">
              <span>Title</span>
              <input required className={inputClass} value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] text-gray-400 space-y-1">
                <span>Pack</span>
                <select className={inputClass} value={creating.pack} onChange={(e) => setCreating({ ...creating, pack: e.target.value })}>
                  {catalogue?.packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-gray-400 space-y-1">
                <span>Language</span>
                <select className={inputClass} value={creating.language} onChange={(e) => setCreating({ ...creating, language: e.target.value })}>
                  {catalogue?.languages.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreating(null)} className={`${buttonClass} bg-white/10 text-white`}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className={`${buttonClass} bg-red-600 hover:bg-red-500 text-white`}>
                Create draft
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
