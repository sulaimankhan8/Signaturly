import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { api, PASSWORD, makePdfBuffer, signatureField, flushEvents } from "../helpers.js";
import { setPlan } from "../templates/fixtures.js";
import { discoverRoutes, mounts, routeFiles, keyOf } from "./routes.js";
import { roleCan, ROLES } from "../../src/services/authorize.service.js";
import { syncCatalogue } from "../../src/services/templateCatalogue.service.js";
import { User } from "../../src/models/User.model.js";
import { Workspace, Invitation } from "../../src/models/Workspace.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Template } from "../../src/models/Template.model.js";
import { ContactList, BulkBatch } from "../../src/models/ContactList.model.js";
import { ApiKey } from "../../src/models/ApiKey.model.js";
import { Webhook } from "../../src/models/Webhook.model.js";
import { WebhookDelivery } from "../../src/services/webhookDelivery.service.js";
import { sha256Hex } from "../../src/utils/tokens.js";

/**
 * Plan task P5-03: who can reach what.
 *
 * Every route the API serves is listed here with what protects it. The list of routes comes
 * from the route files (see routes.js), so a route added later fails this suite until someone
 * says how it is protected.
 *
 * Routes that act on something belonging to a workspace are then called five times: by someone
 * outside the team, and by its viewer, member, admin and owner. What each should get follows
 * from the role table in services/authorize.service.js, not from a second table kept here.
 */

// ---------- the world: one team, one outsider ----------

let counter = 0;
const unique = (prefix) => `${prefix}-${Date.now()}-${(counter += 1)}`;
const oid = () => new mongoose.Types.ObjectId().toString();

const person = async (name) => {
  const email = `${unique(name)}@example.test`;
  const user = await User.create({ name, email, password: PASSWORD, emailVerified: true });
  return { user, id: user._id.toString(), email, auth: { Authorization: `Bearer ${user.generateAccessToken()}` } };
};

const unlimited = async (userId) => {
  await setPlan(userId, "enterprise");
  await Subscription.updateOne({ userId }, { monthlyQuota: 999999 });
};

const makeWorld = async () => {
  const [owner, admin, member, viewer, outsider] = await Promise.all(["owner", "admin", "member", "viewer", "outsider"].map(person));
  // Both pay for a plan with every feature, so a refusal is about who they are, never about the plan
  await unlimited(owner.id);
  await unlimited(outsider.id);

  const workspace = await Workspace.create({
    name: "Lakeview Society",
    ownerId: owner.id,
    members: [
      { userId: admin.id, role: "admin" },
      { userId: member.id, role: "member" },
      { userId: viewer.id, role: "viewer" },
    ],
  });
  const W = workspace._id.toString();
  const people = { owner, admin, member, viewer, outsider };
  // Everyone asks for the team's workspace, the outsider included: for them the header must change nothing
  const as = (role) => ({ ...people[role].auth, "X-Workspace-Id": W });

  const world = {
    W,
    people,
    as,
    // A document uploaded into the team by its owner
    doc: async () => {
      const res = await api().post("/api/pdf/upload").set(as("owner")).attach("pdf", await makePdfBuffer(), { filename: "agreement.pdf", contentType: "application/pdf" });
      if (res.status !== 201) throw new Error(`fixture upload failed: ${res.status} ${JSON.stringify(res.body)}`);
      return String(res.body.data.id);
    },
    // The same, sent to one signer
    sentDoc: async () => {
      const pdfId = await world.doc();
      const email = `${unique("signer")}@example.test`;
      const res = await api().post(`/api/send/${pdfId}`).set(as("owner")).send({ recipients: [{ name: "Asha Rao", email }], fields: [signatureField("sig-1", email)], message: "Please sign" });
      if (res.status !== 200) throw new Error(`fixture send failed: ${res.status} ${JSON.stringify(res.body)}`);
      await flushEvents();
      const recipient = await Recipient.findOne({ pdfId });
      return { pdfId, recipientId: recipient._id.toString() };
    },
    // A template saved in the team by its owner, with one signer
    template: async () => {
      const res = await api()
        .post("/api/templates")
        .set(as("owner"))
        .send({
          name: unique("Template"),
          sourcePdfId: await world.doc(),
          roles: [{ id: "role-1", name: "Signer", color: "#3b82f6" }],
          fields: [{ id: "f1", roleId: "role-1", roleName: "Signer", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.8, widthPercent: 0.25, heightPercent: 0.06 }],
        });
      if (res.status !== 201) throw new Error(`fixture template failed: ${res.status} ${JSON.stringify(res.body)}`);
      return String(res.body.data._id);
    },
    contactList: async () => String((await ContactList.create({ workspaceId: W, createdBy: owner.id, name: unique("List"), contacts: [{ name: "Asha Rao", email: `${unique("contact")}@example.test` }] }))._id),
    batch: async () =>
      String(
        (
          await BulkBatch.create({
            workspaceId: W,
            userId: owner.id,
            billingUserId: owner.id,
            templateId: await world.template(),
            templateName: "Template",
            rows: [{ index: 0, name: "Asha Rao", email: "asha@example.test", status: "sent" }],
          })
        )._id
      ),
    extraMember: async () => {
      const extra = await person("extra");
      await Workspace.updateOne({ _id: W }, { $push: { members: { userId: extra.id, role: "member" } } });
      return extra.id;
    },
    invitation: async () =>
      String((await Invitation.create({ workspaceId: W, email: `${unique("invited")}@example.test`, role: "member", tokenHash: sha256Hex(unique("token")), invitedBy: owner.id, expiresAt: new Date(Date.now() + 86400000) }))._id),
    apiKey: async () => {
      const { keyPrefix, keyHash } = ApiKey.generateKey("test");
      return String((await ApiKey.create({ userId: owner.id, workspaceId: W, name: unique("Key"), mode: "test", keyPrefix, keyHash }))._id);
    },
    // Switched off, so nothing in these tests ever tries to call it
    webhook: async () => String((await Webhook.create({ userId: owner.id, workspaceId: W, url: "https://93.184.216.34/hook", secret: "whsec_test", events: ["envelope.completed"], status: "disabled" }))._id),
    delivery: async () => {
      const webhookId = await world.webhook();
      return String((await WebhookDelivery.create({ webhookId, userId: owner.id, event: "envelope.completed", eventId: unique("event"), payload: {}, status: "failed" }))._id);
    },
  };
  return world;
};

const send = (request, headers) => {
  let call = api()[request.method.toLowerCase()](request.url);
  if (headers) call = call.set(headers);
  if (request.attach) return call.attach(...request.attach);
  if (request.attachMany) {
    for (const one of request.attachMany) call = call.attach(...one);
    return call;
  }
  return request.body === undefined ? call : call.send(request.body);
};

// ---------- how every route is protected ----------

// No sign-in: public pages, signing by link, sign-in itself, payment notices checked by signature
const OPEN = "open";
// Needs sign-in and only ever touches the caller's own account or their own drafts
const SELF = "self";
// The operator's admin session
const ADMIN = "admin";
// The scheduler's shared secret
const INTERNAL = "internal";
// An API key
const KEY = "key";

// Acts on one existing thing of a workspace: allowed from the lowest role the action needs
const on = (action, make, { ok = [200, 201, 202] } = {}) => ({ kind: "record", action, make, ok });
// Lists the things of the workspace the caller is working in
const lists = (make, action = "document.read") => ({ kind: "list", action, make });
// Makes something new in the workspace the caller is working in
const creates = (action, model, make) => ({ kind: "create", action, model, make });
// Only the person who made the document
const creatorOnly = (make) => ({ kind: "creator", make });

const pdfFile = async () => ["pdf", await makePdfBuffer(), { filename: "agreement.pdf", contentType: "application/pdf" }];
const signers = (email) => ({ recipients: [{ name: "Asha Rao", email }], fields: [signatureField("sig-1", email)], message: "Please sign" });

const PROTECTION = {
  "GET /api/health": OPEN,

  // ----- sign-in and the account -----
  "POST /api/auth/register": OPEN,
  "POST /api/auth/login": OPEN,
  "POST /api/auth/logout": OPEN,
  "POST /api/auth/refresh-token": OPEN,
  "POST /api/auth/verify-email": OPEN,
  "POST /api/auth/forgot-password": OPEN,
  "POST /api/auth/reset-password": OPEN,
  "GET /api/auth/me": SELF,
  "POST /api/auth/accept-terms": SELF,
  "POST /api/auth/resend-verification": SELF,
  "GET /api/auth/2fa": SELF,
  "POST /api/auth/2fa/begin": SELF,
  "POST /api/auth/2fa/confirm": SELF,
  "POST /api/auth/2fa/disable": SELF,
  "POST /api/auth/sso/start": OPEN,
  "GET /api/auth/sso/callback": OPEN,
  "GET /api/user/profile": SELF,
  "PUT /api/user/profile": SELF,
  "PUT /api/user/password": SELF,
  "GET /api/user/export": SELF,
  "GET /api/user/signature": SELF,
  "PUT /api/user/signature": SELF,
  "DELETE /api/user/signature": SELF,
  "POST /api/user/delete-account": SELF,
  "GET /api/billing/subscription": SELF,
  "POST /api/billing/checkout": SELF,
  "POST /api/billing/portal": SELF,
  "GET /api/billing/wallet": SELF,
  "GET /api/billing/profile": SELF,
  "PUT /api/billing/profile": SELF,
  "GET /api/billing/invoices": SELF,
  "GET /api/billing/invoices/:id/pdf": SELF,
  "POST /api/billing/dev-upgrade": SELF,
  "POST /api/billing/dev-pay": SELF,

  // ----- single sign-on settings: the owner alone -----
  "GET /api/auth/sso/settings/:workspaceId": on("billing.manage", async (w) => ({ method: "GET", url: `/api/auth/sso/settings/${w.W}` })),
  "PUT /api/auth/sso/settings/:workspaceId": on("billing.manage", async (w) => ({ method: "PUT", url: `/api/auth/sso/settings/${w.W}`, body: {} })),
  "POST /api/auth/sso/settings/:workspaceId/verify-domains": on("billing.manage", async (w) => ({ method: "POST", url: `/api/auth/sso/settings/${w.W}/verify-domains` })),

  // ----- documents -----
  "GET /api/pdf/sync/updates": lists(async (w) => ({ url: "/api/pdf/sync/updates", needle: await w.doc() })),
  "GET /api/pdf/my-documents": lists(async (w) => ({ url: "/api/pdf/my-documents", needle: await w.doc() })),
  "POST /api/pdf/upload": creates("document.create", Pdf, async () => ({ method: "POST", url: "/api/pdf/upload", attach: await pdfFile() })),
  "POST /api/pdf/upload-joined": creates("document.create", Pdf, async () => ({
    method: "POST",
    url: "/api/pdf/upload-joined",
    attachMany: [
      ["pdfs", await makePdfBuffer(), { filename: "offer.pdf", contentType: "application/pdf" }],
      ["pdfs", await makePdfBuffer(), { filename: "policy.pdf", contentType: "application/pdf" }],
    ],
  })),
  "DELETE /api/pdf/:id": on("document.delete", async (w) => ({ method: "DELETE", url: `/api/pdf/${await w.doc()}` })),
  "GET /api/pdf/:id/audit": on("document.read", async (w) => ({ method: "GET", url: `/api/pdf/${await w.doc()}/audit` })),
  "GET /api/pdf/:id/audit-certificate": on("document.read", async (w) => ({ method: "GET", url: `/api/pdf/${await w.doc()}/audit-certificate` })),
  "GET /api/pdf/:id": on("document.read", async (w) => ({ method: "GET", url: `/api/pdf/${await w.doc()}` })),
  "PUT /api/pdf/:id/draft": on("document.send", async (w) => ({ method: "PUT", url: `/api/pdf/${await w.doc()}/draft`, body: { mode: "send", fields: [], recipients: [] } })),
  "POST /api/pdf/sign": creatorOnly(async (w) => ({ method: "POST", url: "/api/pdf/sign", body: { pdfId: await w.doc(), fields: [] } })),
  "POST /api/send/:pdfId": on("document.send", async (w) => ({ method: "POST", url: `/api/send/${await w.doc()}`, body: signers(`${unique("s")}@example.test`) })),
  "GET /api/send/recent-recipients": SELF,
  "GET /api/send/:pdfId": on("document.read", async (w) => ({ method: "GET", url: `/api/send/${await w.doc()}` })),
  "POST /api/send/:pdfId/void": on("document.void", async (w) => ({ method: "POST", url: `/api/send/${(await w.sentDoc()).pdfId}/void` })),
  "POST /api/send/recipients/:recipientId/remind": on("document.remind", async (w) => ({ method: "POST", url: `/api/send/recipients/${(await w.sentDoc()).recipientId}/remind`, body: {} })),
  "PATCH /api/send/recipients/:recipientId/email": on("document.remind", async (w) => ({ method: "PATCH", url: `/api/send/recipients/${(await w.sentDoc()).recipientId}/email`, body: { email: `${unique("moved")}@example.test` } })),
  "POST /api/esign/recipients/:recipientId/use-ordinary-signing": on("document.send", async (w) => ({ method: "POST", url: `/api/esign/recipients/${(await w.sentDoc()).recipientId}/use-ordinary-signing` })),

  // ----- signing by link -----
  "GET /api/signing/:token": OPEN,
  "POST /api/signing/:token/sign": OPEN,
  "POST /api/signing/:token/decline": OPEN,
  "POST /api/sign/otp/send": OPEN,
  "POST /api/sign/otp/verify": OPEN,
  "POST /api/sign/otp/verify-passcode": OPEN,
  "POST /api/verify/document": OPEN,
  "GET /api/esign/availability": OPEN,
  "POST /api/esign/callback/:provider": OPEN,
  "POST /api/esign/stand-in/:transactionId": OPEN,
  "POST /api/esign/:token/start": OPEN,
  "POST /api/esign/:token/complete": OPEN,

  // ----- saved templates -----
  "GET /api/templates": lists(async (w) => ({ url: "/api/templates", needle: await w.template() }), "template.read"),
  "GET /api/templates/:id": on("template.read", async (w) => ({ method: "GET", url: `/api/templates/${await w.template()}` })),
  "POST /api/templates": creates("template.manage", Template, async (w) => ({
    method: "POST",
    url: "/api/templates",
    body: { name: unique("Mine"), sourcePdfId: await w.doc(), roles: [{ id: "role-1", name: "Signer" }], fields: [] },
  })),
  "PUT /api/templates/:id": on("template.manage", async (w) => ({ method: "PUT", url: `/api/templates/${await w.template()}`, body: { name: "Renamed" } })),
  "DELETE /api/templates/:id": on("template.manage", async (w) => ({ method: "DELETE", url: `/api/templates/${await w.template()}` })),
  "POST /api/templates/:id/use": on("template.use", async (w) => ({
    method: "POST",
    url: `/api/templates/${await w.template()}/use`,
    body: { roleSignersMap: { "role-1": { name: "Asha Rao", email: `${unique("s")}@example.test` } } },
  })),
  "POST /api/bulk/send": on("document.send", async (w) => ({
    method: "POST",
    url: "/api/bulk/send",
    body: { templateId: await w.template(), recipients: [{ name: "Asha Rao", email: `${unique("s")}@example.test` }] },
  })),

  // ----- the ready-made catalogue: the same for everyone, drafts are the caller's own -----
  "GET /api/catalogue": SELF,
  "GET /api/catalogue/entitlements": SELF,
  "GET /api/catalogue/:key": SELF,
  "POST /api/catalogue/:key/preview": SELF,
  "PUT /api/catalogue/:key/draft": SELF,
  "DELETE /api/catalogue/:key/draft": SELF,
  "POST /api/catalogue/:key/send": creates("document.send", Pdf, async () => ({
    method: "POST",
    url: "/api/catalogue/consent-form/send",
    body: {
      answers: { consent_date: "2026-10-11", organisation: "Lakeview Clinic", person_name: "Asha Rao", subject: "Sharing my test reports with my family doctor." },
      signers: { person: { name: "Asha Rao", email: `${unique("s")}@example.test` } },
    },
  })),
  "GET /api/public/templates": OPEN,
  "GET /api/public/templates/:key": OPEN,
  "GET /api/public/plans": OPEN,

  // ----- contact lists and bulk sends -----
  "GET /api/contacts/lists": lists(async (w) => ({ url: "/api/contacts/lists", needle: await w.contactList() }), "contacts.read"),
  "POST /api/contacts/lists": creates("contacts.write", ContactList, async () => ({ method: "POST", url: "/api/contacts/lists", body: { name: unique("New list"), rows: [{ name: "Asha Rao", email: `${unique("c")}@example.test` }] } })),
  "GET /api/contacts/lists/:id": on("contacts.read", async (w) => ({ method: "GET", url: `/api/contacts/lists/${await w.contactList()}` })),
  "PUT /api/contacts/lists/:id": on("contacts.write", async (w) => ({ method: "PUT", url: `/api/contacts/lists/${await w.contactList()}`, body: { name: unique("Renamed"), rows: [{ name: "Ravi Kumar", email: `${unique("c")}@example.test` }] } })),
  "DELETE /api/contacts/lists/:id": on("contacts.write", async (w) => ({ method: "DELETE", url: `/api/contacts/lists/${await w.contactList()}` })),
  "GET /api/contacts/bulk": lists(async (w) => ({ url: "/api/contacts/bulk", needle: await w.batch() })),
  "POST /api/contacts/bulk": on("document.send", async (w) => ({ method: "POST", url: "/api/contacts/bulk", body: { templateId: await w.template(), listId: await w.contactList() } })),
  "GET /api/contacts/bulk/:id": on("document.read", async (w) => ({ method: "GET", url: `/api/contacts/bulk/${await w.batch()}` })),
  "POST /api/contacts/bulk/:id/retry": on("document.send", async (w) => ({ method: "POST", url: `/api/contacts/bulk/${await w.batch()}/retry` })),

  // ----- workspaces -----
  "GET /api/workspaces": SELF,
  "POST /api/workspaces": SELF,
  "GET /api/workspaces/invitations/:token": OPEN,
  "POST /api/workspaces/invitations/:token/accept": SELF,
  "GET /api/workspaces/:id": on("activity.read", async (w) => ({ method: "GET", url: `/api/workspaces/${w.W}` })),
  "GET /api/workspaces/:id/activity": on("activity.read", async (w) => ({ method: "GET", url: `/api/workspaces/${w.W}/activity` })),
  "PATCH /api/workspaces/:id": on("branding.manage", async (w) => ({ method: "PATCH", url: `/api/workspaces/${w.W}`, body: { name: "Lakeview Society" } })),
  "PATCH /api/workspaces/:id/branding": on("branding.manage", async (w) => ({ method: "PATCH", url: `/api/workspaces/${w.W}/branding`, body: { companyName: "Lakeview" } })),
  "PUT /api/workspaces/:id/branding": on("branding.manage", async (w) => ({ method: "PUT", url: `/api/workspaces/${w.W}/branding`, body: { companyName: "Lakeview" } })),
  "POST /api/workspaces/:id/members": on("member.manage", async (w) => ({ method: "POST", url: `/api/workspaces/${w.W}/members`, body: { email: `${unique("new")}@example.test`, role: "member" } })),
  "POST /api/workspaces/:id/invitations": on("member.manage", async (w) => ({ method: "POST", url: `/api/workspaces/${w.W}/invitations`, body: { email: `${unique("new")}@example.test`, role: "member" } })),
  "DELETE /api/workspaces/:id/invitations/:invitationId": on("member.manage", async (w) => ({ method: "DELETE", url: `/api/workspaces/${w.W}/invitations/${await w.invitation()}` })),
  "PATCH /api/workspaces/:id/members/:memberId": on("member.manage", async (w) => ({ method: "PATCH", url: `/api/workspaces/${w.W}/members/${await w.extraMember()}`, body: { role: "viewer" } })),
  "DELETE /api/workspaces/:id/members/:memberId": on("member.manage", async (w) => ({ method: "DELETE", url: `/api/workspaces/${w.W}/members/${await w.extraMember()}` })),

  // ----- developer settings -----
  "GET /api/developer/keys": lists(async (w) => ({ url: "/api/developer/keys", needle: await w.apiKey() }), "developer.manage"),
  "POST /api/developer/keys": creates("developer.manage", ApiKey, async () => ({ method: "POST", url: "/api/developer/keys", body: { name: unique("Key"), mode: "test" } })),
  "DELETE /api/developer/keys/:id": on("developer.manage", async (w) => ({ method: "DELETE", url: `/api/developer/keys/${await w.apiKey()}` })),
  "GET /api/developer/webhooks": lists(async (w) => ({ url: "/api/developer/webhooks", needle: await w.webhook() }), "developer.manage"),
  "POST /api/developer/webhooks": creates("developer.manage", Webhook, async () => ({ method: "POST", url: "/api/developer/webhooks", body: { url: "https://93.184.216.34/hooks/pactdoc", events: ["envelope.completed"] } })),
  "DELETE /api/developer/webhooks/:id": on("developer.manage", async (w) => ({ method: "DELETE", url: `/api/developer/webhooks/${await w.webhook()}` })),
  "GET /api/developer/webhooks/:id/deliveries": on("developer.manage", async (w) => ({ method: "GET", url: `/api/developer/webhooks/${await w.webhook()}/deliveries` })),
  "POST /api/developer/webhooks/deliveries/:deliveryId/replay": on("developer.manage", async (w) => ({ method: "POST", url: `/api/developer/webhooks/deliveries/${await w.delivery()}/replay` })),

  // ----- the public API: every route needs a key (its own tests cover what a key may do) -----
  ...Object.fromEntries(
    discoverRoutes()
      .filter((route) => route.path.startsWith("/api/v1/"))
      .map((route) => [keyOf(route), KEY])
  ),

  // ----- the operator -----
  "POST /api/admin/login": OPEN,
  ...Object.fromEntries(
    discoverRoutes()
      .filter((route) => route.path.startsWith("/api/admin/") && route.path !== "/api/admin/login")
      .map((route) => [keyOf(route), ADMIN])
  ),
  ...Object.fromEntries(
    discoverRoutes()
      .filter((route) => route.path.startsWith("/api/internal/"))
      .map((route) => [keyOf(route), INTERNAL])
  ),
  "POST /api/webhooks/stripe": OPEN,
  "POST /api/webhooks/razorpay": OPEN,
};

const ALL = discoverRoutes();
const DENIED = [403, 404];
const TEAM = ["viewer", "member", "admin", "owner"];

describe("P5-03 every route is accounted for", () => {
  it("finds the routes of every route file", () => {
    const mounted = new Set(mounts().map((mount) => mount.file));
    expect(routeFiles().filter((file) => !mounted.has(file))).toEqual([]);
    for (const file of routeFiles()) {
      expect(ALL.some((route) => route.file === file), `${file} yielded no routes`).toBe(true);
    }
    // Each role name used below is one the permission helper knows
    expect(TEAM.every((role) => ROLES.includes(role))).toBe(true);
  });

  it("says how each one is protected", () => {
    const listed = new Set(Object.keys(PROTECTION));
    expect(ALL.map(keyOf).filter((key) => !listed.has(key)), "routes with no entry in PROTECTION").toEqual([]);
    // And nothing is listed that no longer exists
    const real = new Set(ALL.map(keyOf));
    expect([...listed].filter((key) => !real.has(key)), "entries for routes that no longer exist").toEqual([]);
  });

  it("refuses every protected route to someone who has not signed in", async () => {
    const problems = [];
    for (const route of ALL) {
      const protection = PROTECTION[keyOf(route)];
      if (protection === OPEN) continue;
      const url = route.path.replace(/:\w+/g, oid());
      const res = await api()[route.method.toLowerCase()](url).send({});
      const expected = protection === INTERNAL ? [403] : [401];
      if (!expected.includes(res.status)) problems.push(`${keyOf(route)} answered ${res.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("refuses the operator's routes to an ordinary signed-in user", async () => {
    const user = await person("ordinary");
    const problems = [];
    for (const route of ALL.filter((r) => PROTECTION[keyOf(r)] === ADMIN)) {
      const res = await api()[route.method.toLowerCase()](route.path.replace(/:\w+/g, oid())).set(user.auth).send({});
      if (![401, 403].includes(res.status)) problems.push(`${keyOf(route)} answered ${res.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("refuses the public API to a signed-in user without a key", async () => {
    const user = await person("ordinary");
    const problems = [];
    for (const route of ALL.filter((r) => PROTECTION[keyOf(r)] === KEY)) {
      const res = await api()[route.method.toLowerCase()](route.path.replace(/:\w+/g, oid())).set(user.auth).send({});
      if (res.status !== 401) problems.push(`${keyOf(route)} answered ${res.status}`);
    }
    expect(problems).toEqual([]);
  });
});

describe("P5-03 a team's things, called by an outsider and by each role", () => {
  const scoped = ALL.filter((route) => typeof PROTECTION[keyOf(route)] === "object");

  it.each(scoped.map((route) => [keyOf(route), PROTECTION[keyOf(route)]]))("%s", async (_name, rule) => {
    const world = await makeWorld();
    if (rule.make.toString().includes("/api/catalogue/")) await syncCatalogue();
    const problems = [];
    const note = (role, res, expected) => problems.push(`${role}: got ${res.status}, expected ${expected}${res.body?.message ? ` (${res.body.message})` : ""}`);

    if (rule.kind === "record") {
      for (const role of ["outsider", ...TEAM]) {
        const res = await send(await rule.make(world), world.as(role));
        const allowed = role !== "outsider" && roleCan(role, rule.action);
        if (allowed && !rule.ok.includes(res.status)) note(role, res, `one of ${rule.ok.join(", ")}`);
        if (!allowed && !DENIED.includes(res.status)) note(role, res, "403 or 404");
      }
    }

    if (rule.kind === "creator") {
      for (const role of ["outsider", ...TEAM]) {
        const res = await send(await rule.make(world), world.as(role));
        // The fixture document is the owner's
        if (role === "owner" && [401, 403, 404].includes(res.status)) note(role, res, "to be let through");
        if (role !== "owner" && !DENIED.includes(res.status)) note(role, res, "403 or 404");
      }
    }

    if (rule.kind === "list") {
      for (const role of ["outsider", ...TEAM]) {
        const { url, needle } = await rule.make(world);
        const res = await api().get(url).set(world.as(role));
        const seen = JSON.stringify(res.body).includes(needle);
        const allowed = role !== "outsider" && roleCan(role, rule.action);
        if (allowed && !(res.status === 200 && seen)) note(role, res, "200 with the team's item in the list");
        // Whatever the answer, the team's item must not be in it
        if (!allowed && seen) note(role, res, "an answer without the team's item");
        if (!allowed && role !== "outsider" && !DENIED.includes(res.status)) note(role, res, "403 or 404");
      }
    }

    if (rule.kind === "create") {
      const inTeam = () => rule.model.countDocuments({ workspaceId: world.W });
      for (const role of ["outsider", ...TEAM]) {
        const request = await rule.make(world);
        const before = await inTeam();
        const res = await send(request, world.as(role));
        const added = (await inTeam()) - before;
        const allowed = role !== "outsider" && roleCan(role, rule.action);
        if (allowed && !([200, 201, 202].includes(res.status) && added === 1)) note(role, res, `to add one to the team (added ${added})`);
        // An outsider may well make one of their own; what matters is that the team gained nothing
        if (!allowed && added !== 0) note(role, res, `to add nothing to the team (added ${added})`);
        if (!allowed && role !== "outsider" && !DENIED.includes(res.status)) note(role, res, "403 or 404");
      }
    }

    expect(problems).toEqual([]);
  });
});
