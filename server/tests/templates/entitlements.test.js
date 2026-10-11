import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { api, createUser, makePdfBuffer } from "../helpers.js";
import { setPlan } from "./fixtures.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { PACKS } from "../../src/templates/catalogue.js";
import {
  PLAN_TIER,
  FEATURE_NAMES,
  can,
  canUsePack,
  limitOf,
  effectivePlan,
  tierOf,
  describeEntitlements,
  upgradeMessage,
} from "../../src/services/entitlements.service.js";

const active = (plan) => ({ plan, status: plan === "free" ? "free" : "active", currentPeriodEnd: new Date(Date.now() + 86400000) });

// Plan task P4-06: one table decides what each plan can do.
describe("P4-06 what each plan includes", () => {
  //               plan            own templates  bulk   api    workspaces  bulk limit
  const EXPECTED = [
    ["free", false, false, false, false, 0],
    ["pro_monthly", true, true, false, false, 25],
    ["pro_annual", true, true, false, false, 25],
    ["lifetime", true, true, false, false, 25],
    ["business_monthly", true, true, false, true, 500],
    ["enterprise", true, true, true, true, 5000],
  ];

  it.each(EXPECTED)("%s", (plan, ownTemplates, bulkSend, apiAccess, workspaces, bulkSendMax) => {
    const subscription = active(plan);
    expect(can(subscription, "templates.own")).toBe(ownTemplates);
    expect(can(subscription, "bulkSend")).toBe(bulkSend);
    expect(can(subscription, "api")).toBe(apiAccess);
    expect(can(subscription, "workspaces")).toBe(workspaces);
    expect(limitOf(subscription, "bulkSendMax")).toBe(bulkSendMax);
  });

  it("covers every plan an account can be on, and every feature", () => {
    const plans = Subscription.schema.path("plan").enumValues;
    expect(Object.keys(PLAN_TIER).sort()).toEqual([...plans].sort());
    expect(EXPECTED.map(([plan]) => plan).sort()).toEqual([...plans].sort());
    expect(FEATURE_NAMES.sort()).toEqual(["api", "bulkSend", "templates.own", "workspaces"]);
  });

  it("opens each pack to its own tier and every tier above", () => {
    const tiers = { free: "free", pro: "pro_monthly", enterprise: "enterprise" };
    for (const [pack, { tier }] of Object.entries(PACKS)) {
      expect(canUsePack(active("enterprise"), pack), pack).toBe(true);
      expect(canUsePack(active("pro_monthly"), pack), pack).toBe(tier !== "enterprise");
      expect(canUsePack(active("free"), pack), pack).toBe(tier === "free");
      expect(canUsePack(active(tiers[tier]), pack), pack).toBe(true);
    }
    expect(canUsePack(active("enterprise"), "no-such-pack")).toBe(false);
  });

  it("treats a paid plan that has lapsed as free, and one in its grace period as paid", () => {
    const past = new Date(Date.now() - 86400000);
    expect(effectivePlan({ plan: "pro_monthly", status: "canceled", currentPeriodEnd: past })).toBe("free");
    expect(effectivePlan({ plan: "pro_monthly", status: "expired", currentPeriodEnd: past })).toBe("free");
    expect(effectivePlan({ plan: "pro_monthly", status: "past_due", currentPeriodEnd: past })).toBe("pro_monthly");
    expect(effectivePlan({ plan: "lifetime", status: "active", currentPeriodEnd: null })).toBe("lifetime");
    expect(effectivePlan(null)).toBe("free");
    expect(tierOf({ plan: "something-else", status: "active" })).toBe("free");
  });

  it("refuses to answer for a feature or limit that does not exist", () => {
    expect(() => can(active("free"), "teleport")).toThrow();
    expect(() => limitOf(active("free"), "teleports")).toThrow();
  });

  it("describes an account's entitlements in one object", () => {
    expect(describeEntitlements(active("free"))).toMatchObject({ plan: "free", tier: "free", packs: ["starter"], limits: { bulkSendMax: 0 } });
    expect(describeEntitlements(active("lifetime")).packs).toEqual(expect.arrayContaining(["starter", "general", "rentals"]));
    expect(upgradeMessage("api")).toMatch(/^UPGRADE_REQUIRED: .*Enterprise/);
  });
});

describe("P4-06 routes ask the table, and never name plans themselves", () => {
  it("has no plan name in any route or middleware file", () => {
    const folders = ["routes", "middlewares"].map((name) => path.resolve(import.meta.dirname, "../../src", name));
    const offenders = [];
    for (const folder of folders) {
      for (const file of fs.readdirSync(folder)) {
        // The admin panel sets and counts plans by name: that is its job
        if (file === "admin.routes.js") continue;
        const source = fs.readFileSync(path.join(folder, file), "utf8");
        if (/["'](pro_monthly|pro_annual|lifetime|enterprise)["']|requireTier/.test(source)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gates saving own templates, bulk send, API keys and workspaces by plan", async () => {
    const user = await createUser();
    const pdf = await makePdfBuffer();

    const attempts = () => [
      api().post("/api/templates").set(user.auth).field("name", "Mine").attach("pdf", pdf, { filename: "a.pdf", contentType: "application/pdf" }),
      api().post("/api/bulk/send").set(user.auth).send({ templateId: "000000000000000000000000", recipients: [] }),
      api().post("/api/developer/keys").set(user.auth).send({ name: "key" }),
      api().post("/api/workspaces").set(user.auth).send({ name: "Team" }),
    ];

    for (const res of await Promise.all(attempts())) {
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/^UPGRADE_REQUIRED/);
    }

    await setPlan(user.id, "pro_monthly");
    const [template, bulk, key, workspace] = await Promise.all(attempts());
    expect(template.status).toBe(201);
    expect(bulk.status).not.toBe(403);
    expect(key.status).toBe(403);
    expect(workspace.status).toBe(403);

    await setPlan(user.id, "enterprise");
    const [, , keyNow, workspaceNow] = await Promise.all(attempts());
    expect(keyNow.status).not.toBe(403);
    expect(workspaceNow.status).not.toBe(403);
  });

  it("limits how many people one bulk send reaches, by plan", async () => {
    const user = await createUser();
    await setPlan(user.id, "pro_monthly");
    const recipients = Array.from({ length: 26 }, (_, i) => ({ name: `Person ${i}`, email: `p${i}@example.test` }));

    const res = await api().post("/api/bulk/send").set(user.auth).send({ templateId: "000000000000000000000000", recipients });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("at most 25");
  });
});
