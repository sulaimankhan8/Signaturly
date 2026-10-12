import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";
import { adminApi, errorText } from "../api/admin.api.js";
import { day, plural } from "../lib/format.js";
import { JSON_FIELDS, HINT_LEVELS, toForm, jsonProblem, formatJson, fieldOfProblem } from "../lib/templates.js";
import { Badge, Button, Card, Field, Input, PageHeader, Select } from "../components/ui/basics.jsx";
import Dialog, { ConfirmDialog } from "../components/ui/Dialog.jsx";

/**
 * Guided templates: every template with its versions. A published version's wording never
 * changes; a change is drafted as the next version, read as a PDF, then published. The parts
 * of a template that hold structure (signers, questions, text) are edited as JSON.
 */

const STATUS_TONE = { draft: "amber", published: "green", retired: "neutral" };

const LIST_FILTERS = [
  ["", "Any state"],
  ["published", "In use"],
  ["draft", "With a draft waiting"],
  ["unpublished", "Not published"],
  ["unreviewed", "In use, not reviewed"],
];

const matchesFilter = (item, filter) => {
  const current = item.versions.find((v) => v.status === "published");
  if (filter === "published") return Boolean(current);
  if (filter === "draft") return item.versions.some((v) => v.status === "draft");
  if (filter === "unpublished") return !current;
  if (filter === "unreviewed") return Boolean(current) && !current.reviewer;
  return true;
};

const textareaClass = "w-full rounded-lg bg-surface-panel border-2 border-edge px-3 py-2 font-mono text-xs leading-relaxed text-ink transition-shadow focus:border-ink focus:shadow-hard-sm focus:outline-none disabled:opacity-60";

export default function Templates() {
  const [params, setParams] = useSearchParams();
  const key = params.get("key");
  const language = params.get("language") || "en";
  const versionId = params.get("version");

  const [catalogue, setCatalogue] = useState(null);
  const [loaded, setLoaded] = useState(null); // the version last fetched, in full
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", text, problems? }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { url, pages }
  const [review, setReview] = useState({ name: "", date: "" });
  const [creating, setCreating] = useState(null); // new-template form, or null
  const [confirm, setConfirm] = useState(null); // { title, body, confirmText, tone, run }
  const [jsonErrors, setJsonErrors] = useState({});
  const [list, setList] = useState({ search: "", pack: "", filter: "" });
  // Set while this page moves itself after saving, so its own move is not questioned
  const moving = useRef(false);

  const template = catalogue?.templates.find((t) => t.key === key && t.language === language);
  const wantedId = template ? String(template.versions.find((v) => String(v.id) === versionId)?.id || template.versions[0].id) : null;
  // The version on screen: the one fetched, while it is still the one the address names
  const version = loaded && String(loaded._id) === wantedId ? loaded : null;

  const saved = useMemo(() => (version ? toForm(version) : null), [version]);
  const isDraft = version?.status === "draft";
  const dirty = Boolean(isDraft && form && saved && JSON.stringify(form) !== JSON.stringify(saved));
  const hasDraft = template?.versions.some((v) => v.status === "draft");

  // Unsaved edits are not lost by clicking elsewhere: another template, another screen, or closing the tab
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !moving.current && `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fail = (err, fallback) => {
    const problems = Array.isArray(err.response?.data?.errors) ? err.response.data.errors.filter((p) => typeof p === "string") : [];
    setNotice({ kind: "error", text: errorText(err, fallback), problems });
  };

  const loadList = async () => {
    const { data } = await adminApi.get("/admin/templates");
    setCatalogue(data.data);
    return data.data;
  };

  const closePreview = () =>
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });

  const show = (doc) => {
    setLoaded(doc);
    setForm(doc ? toForm(doc) : null);
    setReview({ name: doc?.reviewer?.name || "", date: doc?.reviewer?.date ? String(doc.reviewer.date).slice(0, 10) : "" });
    setJsonErrors({});
    closePreview();
  };

  // Moves to a template and version. `null` goes back to no template chosen.
  // `own` marks a move this page makes itself after an action, which is never questioned.
  const goTo = (target, { own = false } = {}) => {
    moving.current = own;
    setParams(target ? { key: target.key, language: target.language, ...(target.version ? { version: String(target.version) } : {}) } : {});
    setTimeout(() => {
      moving.current = false;
    }, 0);
  };

  // Once, when the page opens
  useEffect(() => {
    let current = true;
    adminApi
      .get("/admin/templates")
      .then(({ data }) => current && setCatalogue(data.data))
      .catch((err) => current && fail(err, "The templates could not be loaded."));
    return () => {
      current = false;
    };
  }, []);

  // The address says which version is on screen. Whenever the version held is not the one
  // the address names, that one is fetched; an answer for any other version is dropped, so
  // a slow reply for a template just left cannot replace the one just opened.
  const wanted = useRef(null);
  useEffect(() => {
    wanted.current = wantedId;
  });
  const loadedId = loaded ? String(loaded._id) : null;
  useEffect(() => {
    if (!catalogue || !wantedId || loadedId === wantedId) return undefined;

    let current = true;
    adminApi
      .get(`/admin/templates/versions/${wantedId}`)
      .then(({ data }) => current && wanted.current === String(data.data._id) && show(data.data))
      .catch((err) => current && fail(err, "That version could not be opened."));
    return () => {
      current = false;
    };
    // `show` only sets state; it is made afresh on every render and is not a reason to fetch again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, wantedId, loadedId]);

  /**
   * Runs an action, refreshes the list, and shows the version the server sent back.
   * `then` names where to go instead, for actions that leave nothing to show (deleting a draft).
   */
  const act = async (action, done, then) => {
    try {
      setBusy(true);
      setNotice(null);
      const result = await action();
      await loadList();
      const doc = result?.data?.data;
      if (then !== undefined) {
        goTo(then, { own: true });
      } else if (doc?._id) {
        show(doc);
        goTo({ key: doc.key, language: doc.language, version: doc._id }, { own: true });
      }
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
    const errors = Object.fromEntries(JSON_FIELDS.map(([field]) => [field, jsonProblem(form[field])]).filter(([, problem]) => problem));
    setJsonErrors(errors);
    const firstBad = JSON_FIELDS.find(([field]) => errors[field]);
    if (firstBad) {
      setNotice({ kind: "error", text: `${firstBad[1]} is not valid JSON. ${errors[firstBad[0]]}` });
      return null;
    }
    return {
      title: form.title,
      summary: form.summary,
      pack: form.pack,
      industry: form.industry,
      signatureHint: { level: form.hintLevel, text: form.hintText },
      ...Object.fromEntries(JSON_FIELDS.map(([field]) => [field, JSON.parse(form[field])])),
    };
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
    } catch {
      setNotice({ kind: "error", text: "The preview could not be made. Save the draft first and fix any problems listed." });
    } finally {
      setBusy(false);
    }
  };

  const ask = (question) => setConfirm(question);
  const answerYes = async () => {
    const run = confirm.run;
    setConfirm(null);
    await run();
  };

  const publish = () =>
    ask({
      title: `Publish version ${version.version}?`,
      body: `New documents made from "${version.title}" will use this wording from now on. Documents already sent keep the version they were made with. Once published, the wording cannot be edited; a change is a new version.`,
      confirmText: "Publish now",
      run: () => act(() => adminApi.post(`/admin/templates/versions/${version._id}/publish`), `Version ${version.version} is published and now used for new documents.`),
    });

  const retire = () =>
    ask({
      title: `Retire version ${version.version}?`,
      body: "It will no longer be used for new documents. The published version before it, if there is one, is used again; otherwise senders are no longer offered this template. Documents already sent are not affected.",
      confirmText: "Retire version",
      tone: "danger",
      run: () => act(() => adminApi.post(`/admin/templates/versions/${version._id}/retire`), `Version ${version.version} is retired.`),
    });

  const removeDraft = () =>
    ask({
      title: `Delete the draft of version ${version.version}?`,
      body: "The draft and everything written in it are removed. This cannot be undone.",
      confirmText: "Delete the draft",
      tone: "danger",
      run: () => {
        const remaining = template.versions.find((v) => String(v.id) !== String(version._id));
        return act(() => adminApi.delete(`/admin/templates/versions/${version._id}`), "Draft deleted.", remaining ? { key: version.key, language: version.language, version: remaining.id } : null);
      },
    });

  const removeReview = () =>
    ask({
      title: "Remove the review?",
      body: `Version ${version.version} will be shown to senders as not reviewed, and where unreviewed templates are not offered it will stop being offered.`,
      confirmText: "Remove the review",
      tone: "danger",
      run: () => act(() => adminApi.put(`/admin/templates/versions/${version._id}/review`, { name: "" }), "Review removed."),
    });

  const createTemplate = async (event) => {
    event.preventDefault();
    const result = await act(() => adminApi.post("/admin/templates", creating), "Template created as a draft. Edit it, then publish.");
    if (result) setCreating(null);
  };

  const rebuildPages = async () => {
    try {
      setBusy(true);
      const res = await adminApi.post("/admin/templates/rebuild");
      setNotice({ kind: res.data.data.configured ? "ok" : "error", text: res.data.data.configured ? `${res.data.message}. The public pages are up to date a few minutes after that.` : "No deploy hook is set on the server (CLIENT_DEPLOY_HOOK_URL), so the public pages are rebuilt only when the client is next deployed." });
    } catch (err) {
      fail(err, "The rebuild could not be asked for.");
    } finally {
      setBusy(false);
    }
  };

  const shown = (catalogue?.templates || []).filter((item) => {
    const text = list.search.trim().toLowerCase();
    return (!text || item.title.toLowerCase().includes(text) || item.key.includes(text)) && (!list.pack || item.pack === list.pack) && matchesFilter(item, list.filter);
  });

  // Problems the server found, under the field each is about
  const problemsFor = (field) => (notice?.problems || []).filter((problem) => fieldOfProblem(problem) === field);

  return (
    <>
      <PageHeader
        title="Templates"
        note="Guided templates and their versions."
        actions={
          <>
            <Button onClick={rebuildPages} disabled={busy} title="Asks the host to rebuild the public template pages now">
              Rebuild public pages
            </Button>
            <Button variant="primary" onClick={() => setCreating({ key: "", language: "en", pack: catalogue?.packs[0]?.id || "starter", title: "" })} disabled={!catalogue}>
              New template
            </Button>
          </>
        }
      />

      {notice && (
        <div role="status" className={`notice ${notice.kind === "ok" ? "notice-green" : "notice-red"}`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)] gap-6 items-start">
        {/* Every template */}
        <div className="panel">
          <div className="p-3 space-y-2 border-b-2 border-edge">
            <Input type="search" aria-label="Search templates" placeholder="Search by title or key" value={list.search} onChange={(e) => setList({ ...list, search: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select aria-label="Pack" value={list.pack} onChange={(e) => setList({ ...list, pack: e.target.value })}>
                <option value="">All packs</option>
                {catalogue?.packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="State" value={list.filter} onChange={(e) => setList({ ...list, filter: e.target.value })}>
                {LIST_FILTERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <nav className="p-2 space-y-1 max-h-[70vh] overflow-y-auto" aria-label="Templates">
            {!catalogue && <p className="text-sm text-ink-muted p-2">Loading…</p>}
            {catalogue && shown.length === 0 && <p className="text-sm text-ink-muted p-2">No template matches.</p>}
            {shown.map((item) => {
              const active = item.key === key && item.language === language;
              const draft = item.versions.some((v) => v.status === "draft");
              const current = item.versions.find((v) => v.status === "published");
              return (
                <button
                  key={`${item.key}:${item.language}`}
                  type="button"
                  onClick={() => goTo({ key: item.key, language: item.language })}
                  aria-current={active ? "true" : undefined}
                  className={`w-full text-left px-3 py-2 rounded-lg border-2 ${active ? "bg-white/10 border-ink shadow-hard-sm" : "border-transparent hover:bg-white/5 hover:border-edge"}`}
                >
                  <span className="block text-sm font-bold text-ink">{item.title}</span>
                  <span className="block text-xs text-ink-muted font-mono">
                    {item.key} · {item.language} · {item.packName}
                  </span>
                  <span className="block text-xs mt-0.5">
                    <span className={current ? "text-emerald-300" : "text-ink-muted"}>{current ? `v${current.version} in use` : "not published"}</span>
                    {current && !current.reviewer && <span className="text-amber-300"> · not reviewed</span>}
                    {draft && <span className="text-amber-300"> · draft waiting</span>}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* The chosen template */}
        {!template || !version || !form ? (
          <p className="text-sm text-ink-muted p-6">{wantedId ? "Loading…" : key && catalogue && !template ? "That template was not found." : "Choose a template to see its versions."}</p>
        ) : (
          <section className="space-y-5 min-w-0" aria-label="Template details">
            <div className="flex flex-wrap items-center gap-2">
              {template.versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => goTo({ key: template.key, language: template.language, version: v.id })}
                  aria-current={String(v.id) === String(version._id) ? "true" : undefined}
                  className={`px-3 py-1 rounded-lg border-2 text-xs font-bold ${String(v.id) === String(version._id) ? "bg-ink border-black text-surface-page shadow-hard-sm" : "border-edge text-ink-muted hover:text-ink hover:border-ink"}`}
                >
                  Version {v.version} · {v.status} · {plural(v.documents, "document")}
                </button>
              ))}
            </div>

            <div className={preview ? "grid grid-cols-1 2xl:grid-cols-2 gap-5 items-start" : ""}>
              <Card>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm text-ink-muted">
                      <strong className="font-medium text-ink">
                        {version.key} · version {version.version}
                      </strong>{" "}
                      <Badge tone={STATUS_TONE[version.status]}>{version.status}</Badge>{" "}
                      {isDraft
                        ? "Draft: not offered to senders until it is published."
                        : version.status === "published"
                        ? "Published: its wording cannot be changed. Start a new version to change it."
                        : "Retired: no longer used for new documents."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={showPreview} disabled={busy}>
                        Make preview
                      </Button>
                      {isDraft && (
                        <>
                          <Button size="sm" variant={dirty ? "primary" : "secondary"} onClick={saveDraft} disabled={busy}>
                            Save draft{dirty && <span className="sr-only"> (there are unsaved changes)</span>}
                          </Button>
                          <Button size="sm" onClick={publish} disabled={busy || dirty} title={dirty ? "Save the draft first" : ""}>
                            Publish
                          </Button>
                          <Button size="sm" onClick={removeDraft} disabled={busy}>
                            Delete draft
                          </Button>
                        </>
                      )}
                      {!isDraft && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => act(() => adminApi.post("/admin/templates/versions", { key: version.key, language: version.language, from: version.version }), "New draft started. Edit it, then publish.")}
                          disabled={busy || hasDraft}
                          title={hasDraft ? "Publish or delete the existing draft first" : ""}
                        >
                          Start new version from this
                        </Button>
                      )}
                      {version.status === "published" && (
                        <Button size="sm" onClick={retire} disabled={busy}>
                          Retire
                        </Button>
                      )}
                    </div>
                  </div>

                  {dirty && <p className="text-xs text-amber-300">There are unsaved changes. The preview and Publish use the draft as it was last saved.</p>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Title" error={problemsFor("title").join("; ")}>
                      <Input disabled={!isDraft} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </Field>
                    <Field label="Pack" error={problemsFor("pack").join("; ")}>
                      <Select disabled={!isDraft} value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })}>
                        {catalogue.packs.map((pack) => (
                          <option key={pack.id} value={pack.id}>
                            {pack.name} ({pack.tier} and above)
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Summary" className="md:col-span-2">
                      <Input disabled={!isDraft} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                    </Field>
                    <Field label="Signature hint">
                      <Select disabled={!isDraft} value={form.hintLevel} onChange={(e) => setForm({ ...form, hintLevel: e.target.value })}>
                        {HINT_LEVELS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Hint shown to the sender">
                      <Input disabled={!isDraft} value={form.hintText} onChange={(e) => setForm({ ...form, hintText: e.target.value })} />
                    </Field>
                  </div>

                  {JSON_FIELDS.map(([field, label, help]) => {
                    const problems = [jsonErrors[field], ...problemsFor(field)].filter(Boolean);
                    return (
                      <div key={field} className="text-sm">
                        <div className="flex flex-wrap items-end justify-between gap-2 mb-1.5">
                          <p className="text-ink-muted" id={`${field}-help`}>
                            <strong className="font-medium text-ink">{label}</strong> · {help}
                          </p>
                          {isDraft && (
                            <Button size="sm" variant="quiet" onClick={() => setForm({ ...form, [field]: formatJson(form[field]) })} aria-label={`Tidy the layout of ${label}`}>
                              Tidy layout
                            </Button>
                          )}
                        </div>
                        <textarea
                          aria-label={label}
                          aria-describedby={`${field}-help${problems.length ? ` ${field}-problems` : ""}`}
                          aria-invalid={problems.length > 0 || undefined}
                          className={`${textareaClass} ${problems.length ? "border-red-500" : ""}`}
                          rows={field === "body" ? 20 : 8}
                          spellCheck={false}
                          disabled={!isDraft}
                          value={form[field]}
                          onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                          onBlur={() => setJsonErrors((old) => ({ ...old, [field]: jsonProblem(form[field]) }))}
                        />
                        {problems.length > 0 && (
                          <ul id={`${field}-problems`} className="mt-1.5 space-y-0.5 text-xs text-red-300">
                            {problems.map((problem) => (
                              <li key={problem}>{problem}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {preview && (
                <Card
                  title="Preview"
                  note={`${plural(preview.pages, "page")}, as last saved, with no answers filled in.`}
                  actions={
                    <>
                      <a href={preview.url} target="_blank" rel="noreferrer" className="text-sm text-ink underline underline-offset-2">
                        Open preview ({plural(preview.pages, "page")})
                      </a>
                      <Button size="sm" variant="quiet" onClick={closePreview}>
                        Close preview
                      </Button>
                    </>
                  }
                  className="2xl:sticky 2xl:top-6"
                  flush
                >
                  <iframe src={preview.url} title="Preview of the template as a PDF" className="hidden md:block w-full h-[75vh] rounded-b-xl bg-white" />
                  <p className="md:hidden p-5 text-sm text-ink-muted">Open the preview to read it on this screen.</p>
                </Card>
              )}
            </div>

            {/* The lawyer's review of this exact wording */}
            {version.status !== "retired" && (
              <Card title={`Lawyer's review of version ${version.version}`}>
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">
                    {version.reviewer
                      ? `Reviewed by ${version.reviewer.name} on ${day(version.reviewer.date)}.`
                      : "Not reviewed. Senders are told so, and in production an unreviewed template is not offered at all."}{" "}
                    A review covers this version only.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Reviewer's name">
                      <Input value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} />
                    </Field>
                    <Field label="Date of review">
                      <Input type="date" value={review.date} onChange={(e) => setReview({ ...review, date: e.target.value })} />
                    </Field>
                    <Button variant="primary" onClick={() => act(() => adminApi.put(`/admin/templates/versions/${version._id}/review`, review), "Review recorded.")} disabled={busy || dirty || !review.name.trim() || !review.date}>
                      Record review
                    </Button>
                    {version.reviewer && (
                      <Button onClick={removeReview} disabled={busy || dirty}>
                        Remove review
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {version.history?.length > 0 && (
              <Card title="History of this version">
                <ul className="text-sm text-ink-muted space-y-1">
                  {version.history.map((entry, index) => (
                    <li key={index}>
                      {day(entry.at)} · {entry.action}
                      {entry.note ? ` (${entry.note})` : ""} · {entry.byEmail}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        )}
      </div>

      <Dialog
        open={Boolean(creating)}
        title="New template"
        onClose={() => setCreating(null)}
        busy={busy}
        footer={
          <>
            <Button onClick={() => setCreating(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="new-template" busy={busy}>
              Create draft
            </Button>
          </>
        }
      >
        {creating && (
          <form id="new-template" onSubmit={createTemplate} className="space-y-4">
            <Field label="Key" help="Lower-case letters, digits and hyphens. Used in links, and never changed afterwards.">
              <Input required data-autofocus value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value })} placeholder="visitor-declaration" />
            </Field>
            <Field label="Title">
              <Input required value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pack">
                <Select value={creating.pack} onChange={(e) => setCreating({ ...creating, pack: e.target.value })}>
                  {catalogue?.packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Language">
                <Select value={creating.language} onChange={(e) => setCreating({ ...creating, language: e.target.value })}>
                  {catalogue?.languages.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title} confirmText={confirm?.confirmText} tone={confirm?.tone} onCancel={() => setConfirm(null)} onConfirm={answerYes}>
        {confirm?.body}
      </ConfirmDialog>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        confirmText="Leave, and lose the changes"
        cancelText="Stay"
        tone="danger"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        The draft of version {version?.version} has changes that are not saved.
      </ConfirmDialog>
    </>
  );
}
