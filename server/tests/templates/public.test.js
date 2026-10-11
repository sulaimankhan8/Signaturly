import { describe, it, expect, beforeEach } from "vitest";
import { api } from "../helpers.js";
import { syncCatalogue } from "../../src/services/templateCatalogue.service.js";
import { TemplateDefinition } from "../../src/models/TemplateDefinition.model.js";
import { SEED_DEFINITIONS } from "../../src/templates/catalogue.js";
import { env } from "../../src/config/env.js";

const KEY = "rent-agreement-11-month";

beforeEach(async () => {
  env.templatesAllowUnreviewed = true;
  await syncCatalogue();
});

// Plan task P4-08: what the public template pages are built from.
describe("P4-08 the public list of templates", () => {
  it("can be read without signing in, and describes each template without giving away its wording", async () => {
    const res = await api().get("/api/public/templates");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=300");
    expect(res.body.data).toHaveLength(SEED_DEFINITIONS.length);

    const rent = res.body.data.find((t) => t.key === KEY);
    expect(rent).toMatchObject({
      title: "11-Month Rent Agreement (Basic)",
      packName: "Starter",
      requiredTier: "free",
      signers: ["Landlord", "Tenant"],
      reviewer: null,
      signatureHint: { level: "stamp_duty" },
    });
    expect(rent.questions).toContain("Monthly rent, in rupees");
    expect(rent.covers).toEqual(expect.arrayContaining(["Term", "Rent", "Security deposit"]));
    expect(rent.stateNotes.map((note) => note.state)).toContain("MH");

    // Headings and questions, but none of the clauses themselves
    const everything = JSON.stringify(res.body.data);
    expect(everything).not.toContain("interest-free security deposit");
    expect(everything).not.toContain("{{");
    expect(rent).not.toHaveProperty("body");
  });

  it("gives one template by its key, and nothing for a key that is not on offer", async () => {
    expect((await api().get(`/api/public/templates/${KEY}`)).body.data.title).toBe("11-Month Rent Agreement (Basic)");
    expect((await api().get("/api/public/templates/no-such-template")).status).toBe(404);
    expect((await api().get("/api/public/templates/..%2F..%2Fetc")).status).toBe(404);
  });

  it("shows only what senders are offered: no drafts, nothing retired, nothing unreviewed where that is not allowed", async () => {
    await TemplateDefinition.updateOne({ key: "consent-form" }, { status: "retired" });
    const v1 = await TemplateDefinition.findOne({ key: "mutual-nda" }).lean();
    const { _id, createdAt, updatedAt, ...copy } = v1;
    await TemplateDefinition.create({ ...copy, version: 2, status: "draft", title: "Draft NDA title" });

    const listed = (await api().get("/api/public/templates")).body.data;
    expect(listed.some((t) => t.key === "consent-form")).toBe(false);
    expect(listed.find((t) => t.key === "mutual-nda").title).toBe("Mutual Non-Disclosure Agreement");
    expect((await api().get("/api/public/templates/consent-form")).status).toBe(404);

    env.templatesAllowUnreviewed = false;
    expect((await api().get("/api/public/templates")).body.data).toEqual([]);
    expect((await api().get(`/api/public/templates/${KEY}`)).status).toBe(404);

    await TemplateDefinition.updateOne({ key: KEY }, { $set: { reviewer: { name: "Adv. N. Iyer", date: new Date("2026-10-01") } } });
    const reviewed = (await api().get("/api/public/templates")).body.data;
    expect(reviewed.map((t) => t.key)).toEqual([KEY]);
    expect(reviewed[0].reviewer.name).toBe("Adv. N. Iyer");
  });
});
