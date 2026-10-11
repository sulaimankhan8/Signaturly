import { describe, it, expect, beforeEach } from "vitest";
import { api, createUser, signAs, flushEvents, reloadPdf, emailsTo } from "../helpers.js";
import { pdfText } from "../render.js";
import { setPlan } from "./fixtures.js";
import { syncCatalogue } from "../../src/services/templateCatalogue.service.js";
import { TemplateDefinition, TemplateDraft } from "../../src/models/TemplateDefinition.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { SEED_DEFINITIONS, PACKS } from "../../src/templates/catalogue.js";
import { inspectSeal } from "../../src/services/pdfSeal.service.js";
import { readFile } from "../../src/services/storage.service.js";
import { env } from "../../src/config/env.js";

const KEY = "rent-agreement-11-month";

const answers = {
  agreement_date: "2026-10-11",
  landlord_name: "Ramesh Kumar Sharma",
  landlord_address: "14 MG Road, Pune 411001",
  tenant_name: "Asha Rao",
  tenant_address: "22 Lake View, Bengaluru 560001",
  property_address: "Flat 302, Shree Ganesh Apartments, Kothrud, Pune 411038",
  state: "MH",
  city: "Pune",
  start_date: "2026-11-01",
  rent: 18500,
  rent_day: 5,
  deposit: 55000,
  maintenance_by: "tenant",
  notice_months: 1,
};

const signers = {
  landlord: { name: "Ramesh Kumar Sharma", email: "ramesh@example.test" },
  tenant: { name: "Asha Rao", email: "asha@example.test", language: "hi" },
};

const binary = (request) =>
  request.buffer(true).parse((res, done) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  });

beforeEach(async () => {
  env.templatesAllowUnreviewed = true;
  await syncCatalogue();
});

describe("P4-01 the catalogue is copied into the database, repeatably", () => {
  it("adds nothing the second time and never overwrites a stored version", async () => {
    const count = await TemplateDefinition.countDocuments();
    expect(count).toBe(SEED_DEFINITIONS.length);

    // Someone edits a stored version (from the admin panel, say)
    await TemplateDefinition.updateOne({ key: KEY, version: 1 }, { $set: { title: "Edited title" } });

    expect(await syncCatalogue()).toEqual({ inserted: 0, total: SEED_DEFINITIONS.length });
    expect(await TemplateDefinition.countDocuments()).toBe(count);
    expect((await TemplateDefinition.findOne({ key: KEY, version: 1 })).title).toBe("Edited title");
  });

  it("loads every template of the old prebuilt list through the new model", async () => {
    const user = await createUser();
    await setPlan(user.id, "pro_monthly");

    const converted = await TemplateDefinition.find({ legacyId: { $exists: true } });
    expect(converted).toHaveLength(13);

    for (const definition of converted) {
      const detail = await api().get(`/api/catalogue/${definition.key}`).set(user.auth);
      expect(detail.status, definition.key).toBe(200);
      expect(detail.body.data.questions.length).toBeGreaterThan(0);

      const preview = await binary(api().post(`/api/catalogue/${definition.key}/preview`).set(user.auth).send({ answers: {} }));
      expect(preview.status, definition.key).toBe(200);
      expect(preview.body.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});

describe("P4-06 the catalogue shows what a plan can use", () => {
  it("opens the Starter pack to a free account and shows the rest as locked", async () => {
    const user = await createUser();
    const res = await api().get("/api/catalogue").set(user.auth);
    expect(res.status).toBe(200);

    const { templates, packs } = res.body.data;
    expect(templates).toHaveLength(SEED_DEFINITIONS.length);
    expect(templates.filter((t) => !t.locked).map((t) => t.pack)).toEqual(Array(8).fill("starter"));
    // Everything outside Starter needs a paid plan, and says which
    const locked = templates.filter((t) => t.locked);
    expect(locked.every((t) => t.pack !== "starter" && t.requiredTier === PACKS[t.pack].tier)).toBe(true);
    expect(new Set(locked.map((t) => t.requiredTier))).toEqual(new Set(["pro", "enterprise"]));
    // Unlocked templates are listed first
    expect(templates.findIndex((t) => t.locked)).toBe(8);
    expect(packs.find((p) => p.id === "starter")).toMatchObject({ locked: false, count: 8 });
    expect(packs.find((p) => p.id === "lending")).toMatchObject({ locked: true, requiredTier: "enterprise", count: 8 });
    // A pack whose content is not written yet is still listed, so its place in the plans is fixed
    expect(packs.find((p) => p.id === "education")).toMatchObject({ locked: true, requiredTier: "pro", count: 0 });

    // The wording itself is not handed out in the listing or the detail
    expect(JSON.stringify(res.body.data)).not.toContain("interest-free security deposit");
    const detail = await api().get(`/api/catalogue/${KEY}`).set(user.auth);
    expect(detail.body.data).not.toHaveProperty("body");
    expect(detail.body.data.reviewer).toBeNull();
  });

  it("refuses a locked template's preview and send, and allows them after an upgrade", async () => {
    const user = await createUser();
    const preview = () => api().post("/api/catalogue/general-nda/preview").set(user.auth).send({ answers: {} });

    const refused = await preview();
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/^UPGRADE_REQUIRED: The General business templates/);
    expect((await api().post("/api/catalogue/general-nda/send").set(user.auth).send({ answers: {}, signers: {} })).status).toBe(403);

    await setPlan(user.id, "lifetime");
    expect((await preview()).status).toBe(200);
  });

  it("reports the account's entitlements", async () => {
    const user = await createUser();
    const res = await api().get("/api/catalogue/entitlements").set(user.auth);
    expect(res.body.data).toMatchObject({ plan: "free", tier: "free", packs: ["starter"] });
  });

  it("needs a signed-in account", async () => {
    expect((await api().get("/api/catalogue")).status).toBe(401);
    expect((await api().post(`/api/catalogue/${KEY}/preview`).send({ answers })).status).toBe(401);
  });

  it("hides templates no lawyer has reviewed when unreviewed templates are not allowed", async () => {
    const user = await createUser();
    env.templatesAllowUnreviewed = false;

    expect((await api().get("/api/catalogue").set(user.auth)).body.data.templates).toEqual([]);
    expect((await api().get(`/api/catalogue/${KEY}`).set(user.auth)).status).toBe(404);
    expect((await api().post(`/api/catalogue/${KEY}/send`).set(user.auth).send({ answers, signers })).status).toBe(404);

    // Once a reviewer is recorded, that template is offered
    await TemplateDefinition.updateOne({ key: KEY }, { $set: { reviewer: { name: "Adv. N. Iyer", date: new Date("2026-10-01") } } });
    const listed = (await api().get("/api/catalogue").set(user.auth)).body.data.templates;
    expect(listed.map((t) => t.key)).toEqual([KEY]);
    expect(listed[0].reviewer.name).toBe("Adv. N. Iyer");
  });
});

describe("P4-04 answering, previewing and saving a draft", () => {
  it("gives the questions, the signers, the signature hint and the state notes", async () => {
    const user = await createUser();
    const { data } = (await api().get(`/api/catalogue/${KEY}`).set(user.auth)).body;

    expect(data.questions.map((q) => q.id)).toEqual(expect.arrayContaining(["landlord_name", "rent", "state"]));
    expect(data.roles.map((r) => [r.id, r.nameFrom])).toEqual([["landlord", "landlord_name"], ["tenant", "tenant_name"]]);
    // Plan task P4-07: the rent agreement carries its stamping note
    expect(data.signatureHint.level).toBe("stamp_duty");
    expect(data.signatureHint.text).toContain("Stamp duty");
    expect(data.stateNotes.find((note) => note.state === "MH").note).toContain("registered");
  });

  it("previews a half-filled template and says what is still unanswered", async () => {
    const user = await createUser();
    const res = await binary(
      api().post(`/api/catalogue/${KEY}/preview`).set(user.auth).send({ answers: { landlord_name: "Ramesh Kumar Sharma", rent: "abc" }, today: "2026-10-11" })
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(Number(res.headers["x-page-count"])).toBeGreaterThanOrEqual(1);
    const unanswered = res.headers["x-unanswered"].split(",");
    expect(unanswered).toEqual(expect.arrayContaining(["tenant_name", "rent", "start_date"]));
    expect(unanswered).not.toContain("landlord_name");
    expect(unanswered).not.toContain("agreement_date"); // defaults to the sender's date

    const text = (await pdfText(res.body)).join(" ");
    expect(text).toContain("Ramesh Kumar Sharma");
    expect(text).toContain("11 October 2026");
    expect(text).toContain("____________");
  });

  it("previews a complete template with nothing unanswered", async () => {
    const user = await createUser();
    const res = await binary(api().post(`/api/catalogue/${KEY}/preview`).set(user.auth).send({ answers }));
    expect(res.headers["x-unanswered"]).toBe("");
  });

  it("saves one draft per template and gives it back", async () => {
    const user = await createUser();
    const other = await createUser();

    const saved = await api()
      .put(`/api/catalogue/${KEY}/draft`)
      .set(user.auth)
      .send({ answers: { landlord_name: "  Ramesh  ", rent: "18,500", unknown: "x" }, signers: { tenant: { name: "Asha", email: "ASHA@Example.test" }, stranger: { name: "x" } } });
    expect(saved.status).toBe(200);

    await api().put(`/api/catalogue/${KEY}/draft`).set(user.auth).send({ answers: { landlord_name: "Ramesh Kumar Sharma" }, signers: {} });
    expect(await TemplateDraft.countDocuments({ userId: user.id })).toBe(1);

    await api().put(`/api/catalogue/${KEY}/draft`).set(user.auth).send({ answers: { landlord_name: "Ramesh", rent: "18,500", unknown: "x" }, signers: { tenant: { name: "Asha", email: "ASHA@Example.test" }, stranger: { name: "x" } } });
    const mine = (await api().get(`/api/catalogue/${KEY}`).set(user.auth)).body.data.draft;
    expect(mine.answers).toEqual({ landlord_name: "Ramesh", rent: 18500 });
    expect(mine.signers).toEqual({ tenant: expect.objectContaining({ name: "Asha", email: "asha@example.test" }) });

    // A draft belongs to the sender who saved it
    expect((await api().get(`/api/catalogue/${KEY}`).set(other.auth)).body.data.draft).toBeNull();

    await api().delete(`/api/catalogue/${KEY}/draft`).set(user.auth);
    expect((await api().get(`/api/catalogue/${KEY}`).set(user.auth)).body.data.draft).toBeNull();
  });
});

describe("P4-04 a template becomes a document and is signed", () => {
  const send = (user, body = {}) => api().post(`/api/catalogue/${KEY}/send`).set(user.auth).send({ answers, signers, ...body });

  it("sends to the template's signers, each with their own fields, and seals once both have signed", async () => {
    const user = await createUser();
    await api().put(`/api/catalogue/${KEY}/draft`).set(user.auth).send({ answers, signers });

    const res = await send(user);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ recipientsCount: 2, template: { key: KEY, version: 1, language: "en" } });
    await flushEvents();

    const pdf = await reloadPdf(res.body.data.pdfId);
    expect(pdf.template.toObject()).toEqual({ key: KEY, version: 1, language: "en" });
    expect(pdf.originalFileName).toBe("11-Month Rent Agreement (Basic).pdf");
    expect(pdf.pageCount).toBe(2);

    const recipients = await Recipient.find({ pdfId: pdf._id }).sort({ signingOrder: 1 });
    expect(recipients.map((r) => [r.name, r.email, r.language])).toEqual([
      ["Ramesh Kumar Sharma", "ramesh@example.test", "en"],
      ["Asha Rao", "asha@example.test", "hi"],
    ]);

    // Each signer owns exactly their own signature and date
    for (const [recipient, role] of [[recipients[0], "landlord"], [recipients[1], "tenant"]]) {
      const mine = pdf.fields.filter((f) => f.recipientId === recipient._id.toString());
      expect(mine.map((f) => f.id).sort()).toEqual([`${role}-date`, `${role}-signature`]);
    }

    // The tenant was invited in Hindi; the draft is gone; the document counted against the plan
    expect(emailsTo("asha@example.test")[0].subject).toContain("हस्ताक्षर का अनुरोध");
    expect(await TemplateDraft.countDocuments({ userId: user.id })).toBe(0);
    expect((await Subscription.findOne({ userId: user.id })).usedThisMonth).toBe(1);

    // The stored document carries the answers
    const text = (await pdfText(await readFile(pdf.storagePath))).join(" ");
    expect(text).toContain("Rs. 18,500 (Rupees Eighteen Thousand Five Hundred only)");

    // Both sign; the document completes and is sealed
    expect((await signAs(recipients[0].token, ["landlord-signature"])).status).toBe(200);
    expect((await signAs(recipients[1].token, ["tenant-signature"])).status).toBe(200);
    await flushEvents();

    const done = await reloadPdf(pdf._id);
    expect(done.status).toBe("signed");
    expect(inspectSeal(await readFile(done.sealedKey))).toMatchObject({ present: true, intact: true });
  });

  it("refuses missing or wrong answers, says which, and does not count a document", async () => {
    const user = await createUser();
    const res = await send(user, { answers: { ...answers, rent: -5, tenant_name: "" } });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(["rent", "tenant_name"]));
    expect(await Pdf.countDocuments({ userId: user.id })).toBe(0);
    expect((await Subscription.findOne({ userId: user.id })).usedThisMonth).toBe(0);
  });

  it("needs every signer, each at a different address", async () => {
    const user = await createUser();

    const missing = await send(user, { signers: { landlord: signers.landlord } });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain("Tenant");

    const shared = await send(user, { signers: { landlord: signers.landlord, tenant: { name: "Asha Rao", email: "RAMESH@example.test" } } });
    expect(shared.status).toBe(400);
    expect(shared.body.message).toContain("own email address");

    expect(await Pdf.countDocuments({ userId: user.id })).toBe(0);
    expect(await Recipient.countDocuments()).toBe(0);
    expect((await Subscription.findOne({ userId: user.id })).usedThisMonth).toBe(0);
  });

  it("needs a confirmed email address to send", async () => {
    const user = await createUser({ verified: false });
    expect((await send(user)).status).toBe(403);
  });

  it("counts against the free plan's monthly allowance", async () => {
    const user = await createUser();
    await Subscription.updateOne({ userId: user.id }, { monthlyQuota: 1 }, { upsert: true });
    await api().get("/api/catalogue").set(user.auth); // creates the subscription if it was not there
    await Subscription.updateOne({ userId: user.id }, { monthlyQuota: 1, usedThisMonth: 0 });

    expect((await send(user)).status).toBe(200);
    const second = await send(user, { signers: { landlord: { name: "A", email: "a@example.test" }, tenant: { name: "B", email: "b@example.test" } } });
    expect(second.status).toBe(403);
    expect(second.body.message).toContain("quota");
  });

  // Plan task P4-05: a published version is used for new documents; old documents keep theirs
  it("uses a newly published version for new documents and leaves earlier documents on theirs", async () => {
    const user = await createUser();
    const first = await send(user);
    expect(first.body.data.template.version).toBe(1);

    const v1 = await TemplateDefinition.findOne({ key: KEY, version: 1 }).lean();
    const { _id, createdAt, updatedAt, ...copy } = v1;
    await TemplateDefinition.create({
      ...copy,
      version: 2,
      source: "admin",
      body: copy.body.map((block) => (block.type === "title" ? { ...block, text: "Residential Rent Agreement" } : block)),
    });

    const second = await send(user, { signers: { landlord: { name: "A", email: "a@example.test" }, tenant: { name: "B", email: "b@example.test" } } });
    expect(second.body.data.template.version).toBe(2);

    const [older, newer] = await Promise.all([reloadPdf(first.body.data.pdfId), reloadPdf(second.body.data.pdfId)]);
    expect(older.template.version).toBe(1);
    expect((await pdfText(await readFile(older.storagePath)))[0]).not.toContain("Residential Rent Agreement");
    expect((await pdfText(await readFile(newer.storagePath)))[0]).toContain("Residential Rent Agreement");

    // A retired version is no longer offered; the one before it is used again
    await TemplateDefinition.updateOne({ key: KEY, version: 2 }, { status: "retired" });
    const third = await send(user, { signers: { landlord: { name: "C", email: "c@example.test" }, tenant: { name: "D", email: "d@example.test" } } });
    expect(third.body.data.template.version).toBe(1);
  });
});
