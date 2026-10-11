import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, PASSWORD } from "../helpers.js";
import { pdfText } from "../render.js";
import { syncCatalogue } from "../../src/services/templateCatalogue.service.js";
import { TemplateDefinition } from "../../src/models/TemplateDefinition.model.js";
import { SEED_DEFINITIONS } from "../../src/templates/catalogue.js";
import { readFile } from "../../src/services/storage.service.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { env } from "../../src/config/env.js";

const KEY = "consent-form";

const answers = { consent_date: "2026-10-11", organisation: "Lakeview Clinic", person_name: "Asha Rao", subject: "Sharing my test reports with my family doctor." };
const signers = (email = "asha@example.test") => ({ person: { name: "Asha Rao", email } });

const binary = (request) =>
  request.buffer(true).parse((res, done) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  });

const asAdmin = async () => {
  const admin = await createUser({ role: "superadmin" });
  const login = await api().post("/api/admin/login").send({ email: admin.email, password: PASSWORD, adminSecret: env.adminSecret });
  return { ...admin, admin: { Authorization: `Bearer ${login.body.adminToken}` } };
};

const versionsOf = async (admin, key = KEY) =>
  (await api().get("/api/admin/templates").set(admin.admin)).body.data.templates.find((t) => t.key === key).versions;

const startVersion = async (admin, body = {}) => api().post("/api/admin/templates/versions").set(admin.admin).send({ key: KEY, language: "en", ...body });

const send = (user, email) => api().post(`/api/catalogue/${KEY}/send`).set(user.auth).send({ answers, signers: signers(email) });

beforeEach(async () => {
  env.templatesAllowUnreviewed = true;
  await syncCatalogue();
});

// Plan task P4-05: templates are created, versioned, published and retired without a deploy.
describe("P4-05 only admins manage templates", () => {
  it("refuses anyone without an admin session", async () => {
    const user = await createUser();
    expect((await api().get("/api/admin/templates")).status).toBe(401);
    // A sender's own login token is not an admin token
    expect((await api().get("/api/admin/templates").set(user.auth)).status).toBe(401);
    expect((await api().post("/api/admin/templates/versions").set(user.auth).send({ key: KEY })).status).toBe(401);
  });

  it("lists every template with its versions and how many documents each made", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    await send(user, "a@example.test");
    await send(user, "b@example.test");

    const { templates, packs, languages } = (await api().get("/api/admin/templates").set(admin.admin)).body.data;
    expect(templates).toHaveLength(SEED_DEFINITIONS.length);
    expect(packs.find((p) => p.id === "starter")).toMatchObject({ name: "Starter", tier: "free" });
    expect(languages).toContain("hi");

    const consent = templates.find((t) => t.key === KEY);
    expect(consent).toMatchObject({ language: "en", pack: "starter", currentVersion: 1 });
    expect(consent.versions).toEqual([expect.objectContaining({ version: 1, status: "published", documents: 2, reviewer: null, source: "seed" })]);
  });
});

describe("P4-05 a change is a new version, and versions do not disturb sent documents", () => {
  it("drafts the next version from the current one, edits it, and offers it only once published", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    const before = await send(user, "before@example.test");

    const started = await startVersion(admin);
    expect(started.status).toBe(201);
    const draft = started.body.data;
    expect(draft).toMatchObject({ key: KEY, version: 2, status: "draft", source: "admin", reviewer: null });
    expect(draft.body).toEqual((await TemplateDefinition.findOne({ key: KEY, version: 1 }).lean()).body);

    // One draft at a time
    expect((await startVersion(admin)).status).toBe(409);

    const edited = await api()
      .put(`/api/admin/templates/versions/${draft._id}`)
      .set(admin.admin)
      .send({ title: "Consent Form (2026)", body: draft.body.map((b) => (b.type === "title" ? { ...b, text: "Record of Consent" } : b)) });
    expect(edited.status).toBe(200);
    expect(edited.body.data.title).toBe("Consent Form (2026)");

    // The draft can be read as a PDF before anyone else sees it
    const preview = await binary(api().post(`/api/admin/templates/versions/${draft._id}/preview`).set(admin.admin).send({ answers }));
    expect(preview.status).toBe(200);
    expect((await pdfText(preview.body))[0]).toContain("Record of Consent");

    // Senders still get version 1
    const duringDraft = await send(user, "during@example.test");
    expect(duringDraft.body.data.template.version).toBe(1);

    const published = await api().post(`/api/admin/templates/versions/${draft._id}/publish`).set(admin.admin);
    expect(published.body.data.status).toBe("published");

    const after = await send(user, "after@example.test");
    expect(after.body.data.template.version).toBe(2);
    expect((await api().get(`/api/catalogue/${KEY}`).set(user.auth)).body.data).toMatchObject({ version: 2, title: "Consent Form (2026)" });

    // The document sent before the change still carries the old wording and the old version
    const [older, newer] = await Promise.all([Pdf.findById(before.body.data.pdfId), Pdf.findById(after.body.data.pdfId)]);
    expect(older.template.version).toBe(1);
    expect((await pdfText(await readFile(older.storagePath)))[0]).toContain("Consent Form");
    expect((await pdfText(await readFile(older.storagePath)))[0]).not.toContain("Record of Consent");
    expect((await pdfText(await readFile(newer.storagePath)))[0]).toContain("Record of Consent");

    expect((await versionsOf(admin)).map((v) => [v.version, v.status, v.documents])).toEqual([
      [2, "published", 1],
      [1, "published", 2],
    ]);
  });

  it("does not let a published version be edited or deleted", async () => {
    const admin = await asAdmin();
    const [v1] = await versionsOf(admin);

    const edit = await api().put(`/api/admin/templates/versions/${v1.id}`).set(admin.admin).send({ title: "Changed" });
    expect(edit.status).toBe(409);
    expect((await api().delete(`/api/admin/templates/versions/${v1.id}`).set(admin.admin)).status).toBe(409);
    expect((await TemplateDefinition.findById(v1.id)).title).toBe("Consent Form");
  });

  it("refuses to save or publish a draft with a broken placeholder, and says what is wrong", async () => {
    const admin = await asAdmin();
    const draft = (await startVersion(admin)).body.data;

    const broken = await api()
      .put(`/api/admin/templates/versions/${draft._id}`)
      .set(admin.admin)
      .send({ body: [{ type: "paragraph", text: "I, {{persn_name}}, agree." }, { type: "signatures" }] });

    expect(broken.status).toBe(400);
    expect(broken.body.errors.join(" ")).toContain("{{persn_name}}");
    // Nothing was saved
    expect((await TemplateDefinition.findById(draft._id)).body).toEqual(draft.body);
  });

  it("goes back to the version before when one is retired", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    const draft = (await startVersion(admin)).body.data;
    await api().post(`/api/admin/templates/versions/${draft._id}/publish`).set(admin.admin);
    expect((await send(user, "one@example.test")).body.data.template.version).toBe(2);

    const retired = await api().post(`/api/admin/templates/versions/${draft._id}/retire`).set(admin.admin);
    expect(retired.body.data.status).toBe("retired");
    expect((await send(user, "two@example.test")).body.data.template.version).toBe(1);

    // A retired version stays retired; a fresh version is drafted from it instead
    expect((await api().post(`/api/admin/templates/versions/${draft._id}/publish`).set(admin.admin)).status).toBe(409);
    const next = await startVersion(admin, { from: 2 });
    expect(next.body.data.version).toBe(3);
  });

  it("deletes a draft that is not wanted", async () => {
    const admin = await asAdmin();
    const draft = (await startVersion(admin)).body.data;
    expect((await api().delete(`/api/admin/templates/versions/${draft._id}`).set(admin.admin)).status).toBe(200);
    expect((await versionsOf(admin)).map((v) => v.version)).toEqual([1]);
  });

  it("keeps a history of who did what to a version", async () => {
    const admin = await asAdmin();
    const draft = (await startVersion(admin)).body.data;
    await api().put(`/api/admin/templates/versions/${draft._id}`).set(admin.admin).send({ summary: "Updated summary" });
    await api().post(`/api/admin/templates/versions/${draft._id}/publish`).set(admin.admin);

    const { history } = (await api().get(`/api/admin/templates/versions/${draft._id}`).set(admin.admin)).body.data;
    expect(history.map((entry) => entry.action)).toEqual(["created", "edited", "published"]);
    expect(history.every((entry) => entry.byEmail === admin.email)).toBe(true);
    expect(history[0].note).toBe("copied from version 1");
  });
});

describe("P4-05 recording a lawyer's review", () => {
  it("makes a template available where unreviewed templates are not allowed", async () => {
    const admin = await asAdmin();
    const user = await createUser();
    env.templatesAllowUnreviewed = false;
    expect((await api().get("/api/catalogue").set(user.auth)).body.data.templates).toEqual([]);

    const [v1] = await versionsOf(admin);
    const reviewed = await api().put(`/api/admin/templates/versions/${v1.id}/review`).set(admin.admin).send({ name: "Adv. N. Iyer", date: "2026-10-01" });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.reviewer.name).toBe("Adv. N. Iyer");

    const offered = (await api().get("/api/catalogue").set(user.auth)).body.data.templates;
    expect(offered.map((t) => t.key)).toEqual([KEY]);
    expect(offered[0].reviewer.name).toBe("Adv. N. Iyer");

    // Removing the record hides it again
    await api().put(`/api/admin/templates/versions/${v1.id}/review`).set(admin.admin).send({ name: "" });
    expect((await api().get("/api/catalogue").set(user.auth)).body.data.templates).toEqual([]);
  });

  it("does not carry a review over to a new version, whose wording may differ", async () => {
    const admin = await asAdmin();
    const [v1] = await versionsOf(admin);
    await api().put(`/api/admin/templates/versions/${v1.id}/review`).set(admin.admin).send({ name: "Adv. N. Iyer", date: "2026-10-01" });

    expect((await startVersion(admin)).body.data.reviewer).toBeNull();
  });

  it("needs a real date that is not in the future", async () => {
    const admin = await asAdmin();
    const [v1] = await versionsOf(admin);
    const review = (body) => api().put(`/api/admin/templates/versions/${v1.id}/review`).set(admin.admin).send(body);

    expect((await review({ name: "Adv. N. Iyer", date: "not a date" })).status).toBe(400);
    expect((await review({ name: "Adv. N. Iyer", date: "2031-01-01" })).status).toBe(400);
  });
});

describe("P4-05 a brand-new template", () => {
  const fresh = {
    key: "visitor-declaration",
    language: "en",
    pack: "starter",
    title: "Visitor Declaration",
    summary: "A visitor confirms they have read the site rules.",
    roles: [{ id: "visitor", name: "Visitor", nameFrom: "visitor_name" }],
    questions: [
      { id: "visitor_name", label: "Visitor's full name", type: "text", required: true },
      { id: "site", label: "Name of the site", type: "text", required: true },
    ],
    body: [
      { type: "title", text: "Visitor Declaration" },
      { type: "paragraph", text: "I, **{{visitor_name}}**, have read and will follow the rules of {{site}}." },
      { type: "signatures" },
    ],
  };

  it("starts as a draft, is offered once published, and can be sent", async () => {
    const admin = await asAdmin();
    const user = await createUser();

    const created = await api().post("/api/admin/templates").set(admin.admin).send(fresh);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ key: "visitor-declaration", version: 1, status: "draft" });
    expect((await api().get("/api/catalogue/visitor-declaration").set(user.auth)).status).toBe(404);

    await api().post(`/api/admin/templates/versions/${created.body.data._id}/publish`).set(admin.admin);
    expect((await api().get("/api/catalogue/visitor-declaration").set(user.auth)).status).toBe(200);

    const sent = await api()
      .post("/api/catalogue/visitor-declaration/send")
      .set(user.auth)
      .send({ answers: { visitor_name: "Asha Rao", site: "Kothrud Works" }, signers: { visitor: { name: "Asha Rao", email: "asha@example.test" } } });
    expect(sent.status).toBe(200);
    expect(sent.body.data.template).toMatchObject({ key: "visitor-declaration", version: 1 });
  });

  it("refuses a key already in use, an unknown pack, and an unsupported language", async () => {
    const admin = await asAdmin();
    const create = (body) => api().post("/api/admin/templates").set(admin.admin).send({ ...fresh, ...body });

    expect((await create({ key: KEY })).status).toBe(409);
    const badPack = await create({ pack: "no-such-pack" });
    expect(badPack.status).toBe(400);
    expect(badPack.body.errors.join(" ")).toContain("no-such-pack");
    expect((await create({ language: "xx" })).status).toBe(400);
    expect((await create({ key: "Bad Key!" })).status).toBe(400);
  });
});
