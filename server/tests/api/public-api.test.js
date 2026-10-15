import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import dns from "dns/promises";
import { api, createUser, uploadPdf, makePdfBuffer, signatureField, flushEvents, emailsTo, signAs, PNG_DATA_URL } from "../helpers.js";
import { setPlan } from "../templates/fixtures.js";
import { pdfText } from "../render.js";
import { env } from "../../src/config/env.js";
import { User } from "../../src/models/User.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Job } from "../../src/models/Job.model.js";
import { Workspace } from "../../src/models/Workspace.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { ApiKey } from "../../src/models/ApiKey.model.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { EsignTransaction } from "../../src/models/EsignTransaction.model.js";
import { WebhookDelivery, isPrivateAddress, signPayload } from "../../src/services/webhookDelivery.service.js";
import { processRetention } from "../../src/services/retention.service.js";
import { readFile, fileExists } from "../../src/services/storage.service.js";
import { originalKeyOf } from "../../src/services/documentFiles.service.js";
import { runDueJobs } from "../../src/jobs/queue.js";
import { esignProvider } from "../../src/services/esign/esign.service.js";

// Phase 6: the public API, webhooks, test mode, embedded signing, Enterprise settings, and the
// Aadhaar eSign scaffolding (which is postponed and off unless a provider is named).

// A public address, written as a number so nothing here ever looks a name up
const RECEIVER = "https://93.184.216.34";

const subOf = (userId) => Subscription.findOne({ userId });
const bearer = (key) => ({ Authorization: `Bearer ${key}` });
const file = async () => ["file", await makePdfBuffer(), { filename: "agreement.pdf", contentType: "application/pdf" }];
const signersFor = (email) => ({ recipients: [{ name: "Asha Rao", email }], fields: [signatureField("sig-1", email)] });

// An account on a plan with the API, with 100 documents a month
const developer = async () => {
  const account = await createUser();
  await setPlan(account.id, "enterprise");
  await Subscription.updateOne({ userId: account.id }, { monthlyQuota: 100 });
  return account;
};

const newKey = async (account, { mode = "live", permissions, headers } = {}) => {
  const res = await api().post("/api/developer/keys").set(headers || account.auth).send({ name: "Billing system", mode, permissions });
  if (res.status !== 201) throw new Error(`could not create a key: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.secretKey;
};

const teamFor = async (owner, extra = {}) => {
  const workspace = await Workspace.create({ name: "Lakeview Society", ownerId: owner.id, members: [], ...extra });
  return { workspaceId: String(workspace._id), headers: { ...owner.auth, "X-Workspace-Id": String(workspace._id) } };
};

const settleJobs = async (rounds = 1) => {
  for (let i = 0; i < rounds; i++) {
    await flushEvents();
    await Job.updateMany({ status: "pending" }, { $set: { runAfter: new Date(Date.now() - 1000) } });
    await runDueJobs();
  }
  await flushEvents();
};

afterEach(() => {
  vi.restoreAllMocks();
  env.esignProvider = "";
  env.isProd = false;
});

describe("P6-09 API keys", () => {
  it("is shown once, stored only as a hash, and says which kind it is", async () => {
    const account = await developer();
    const live = await newKey(account);
    const test = await newKey(account, { mode: "test" });
    expect(live).toMatch(/^pd_live_[a-f0-9]{6}_[a-f0-9]{48}$/);
    expect(test).toMatch(/^pd_test_/);

    expect(JSON.stringify(await ApiKey.find({}).lean())).not.toContain(live.slice(-40));
    const listed = await api().get("/api/developer/keys").set(account.auth);
    expect(listed.body.data).toHaveLength(2);
    expect(JSON.stringify(listed.body)).not.toContain(live.slice(-40));

    const me = await api().get("/api/v1/me").set(bearer(test));
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ mode: "test", scopes: ["documents:read", "documents:write"] });
  });

  it("cannot be created on a plan without the API, or with a scope that does not exist", async () => {
    const free = await createUser();
    expect((await api().post("/api/developer/keys").set(free.auth).send({ name: "Mine" })).status).toBe(403);
    const account = await developer();
    expect((await api().post("/api/developer/keys").set(account.auth).send({ name: "Mine", permissions: ["everything"] })).status).toBe(400);
  });

  it("refuses a key that is wrong, revoked, or missing the scope a route needs", async () => {
    const account = await developer();
    const key = await newKey(account, { permissions: ["documents:read"] });

    expect((await api().get("/api/v1/me")).status).toBe(401);
    expect((await api().get("/api/v1/me").set(bearer("pd_live_000000_" + "0".repeat(48)))).status).toBe(401);
    expect((await api().get("/api/v1/me").set(bearer(key.replace("pd_live", "pd_test")))).status).toBe(401);
    // A sign-in token is not an API key
    expect((await api().get("/api/v1/me").set(account.auth)).status).toBe(401);

    expect((await api().get("/api/v1/documents").set(bearer(key))).status).toBe(200);
    const upload = await api().post("/api/v1/documents").set(bearer(key)).attach(...(await file()));
    expect(upload.status).toBe(403);
    expect((await api().get("/api/v1/webhooks").set(bearer(key))).status).toBe(403);

    const id = (await ApiKey.findOne({ userId: account.id }))._id;
    expect((await api().delete(`/api/developer/keys/${id}`).set(account.auth)).status).toBe(200);
    expect((await api().get("/api/v1/me").set(bearer(key))).status).toBe(401);
  });

  it("stops working when the plan no longer includes the API", async () => {
    const account = await developer();
    const key = await newKey(account);
    await setPlan(account.id, "pro_monthly");
    const res = await api().get("/api/v1/me").set(bearer(key));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/^UPGRADE_REQUIRED/);
  });

  it("limits each key to its own number of requests a minute", async () => {
    const account = await developer();
    const key = await newKey(account);
    const other = await newKey(account);
    await ApiKey.updateOne({ keyHash: crypto.createHash("sha256").update(key).digest("hex") }, { rateLimitPerMinute: 3 });

    const answers = [];
    for (let i = 0; i < 5; i++) answers.push(await api().get("/api/v1/me").set(bearer(key)));
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 429, 429]);
    expect(answers[2].headers["x-ratelimit-remaining"]).toBe("0");
    expect(answers[3].headers["retry-after"]).toBe("60");
    // Another key of the same account is not slowed by it
    expect((await api().get("/api/v1/me").set(bearer(other))).status).toBe(200);
  });

  it("works only in its own workspace, and only while its maker belongs there", async () => {
    const owner = await developer();
    const { workspaceId, headers } = await teamFor(owner);
    const member = await createUser();
    await Workspace.updateOne({ _id: workspaceId }, { $push: { members: { userId: member.id, role: "admin" } } });
    const memberKey = await newKey(member, { headers: { ...member.auth, "X-Workspace-Id": workspaceId } });

    const teamDoc = await api().post("/api/pdf/upload").set(headers).attach("pdf", await makePdfBuffer(), { filename: "t.pdf", contentType: "application/pdf" });
    const ownDoc = await uploadPdf(member);

    expect((await api().get(`/api/v1/documents/${teamDoc.body.data.id}`).set(bearer(memberKey))).status).toBe(200);
    // The member's own documents are another workspace, even though the member made the key
    expect((await api().get(`/api/v1/documents/${ownDoc.id}`).set(bearer(memberKey))).status).toBe(404);
    expect(JSON.stringify((await api().get("/api/v1/documents").set(bearer(memberKey))).body)).not.toContain(ownDoc.id);

    await Workspace.updateOne({ _id: workspaceId }, { $pull: { members: { userId: member.id } } });
    expect((await api().get("/api/v1/me").set(bearer(memberKey))).status).toBe(401);
  });

  it("stops working in a team that requires two-step sign-in while its maker has not switched it on", async () => {
    const owner = await developer();
    const { workspaceId } = await teamFor(owner);
    const admin = await createUser();
    await Workspace.updateOne({ _id: workspaceId }, { $push: { members: { userId: admin.id, role: "admin" } } });
    const asAdmin = { ...admin.auth, "X-Workspace-Id": workspaceId };
    const key = await newKey(admin, { headers: asAdmin });
    expect((await api().get("/api/v1/me").set(bearer(key))).status).toBe(200);

    await Workspace.updateOne({ _id: workspaceId }, { "policy.requireTwoFactor": true });
    const refused = await api().get("/api/v1/me").set(bearer(key));
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/^TWO_FACTOR_REQUIRED/);
    // Nor can another key be made, by a session the rule shuts out
    expect((await api().post("/api/developer/keys").set(asAdmin).send({ name: "Another" })).status).toBe(403);

    await User.updateOne({ _id: admin.id }, { "twoFactor.enabled": true });
    expect((await api().get("/api/v1/me").set(bearer(key))).status).toBe(200);
  });

  it("cannot be made in such a team by someone who signed in through single sign-on alone", async () => {
    const owner = await developer();
    const { workspaceId } = await teamFor(owner, { policy: { requireTwoFactor: true } });
    const admin = await createUser();
    await Workspace.updateOne({ _id: workspaceId }, { $push: { members: { userId: admin.id, role: "admin" } } });
    // Single sign-on lets the session in, but a key is not a sign-in
    await User.updateOne({ _id: admin.id }, { ssoSessionWorkspaceId: workspaceId });
    const res = await api().post("/api/developer/keys").set({ ...admin.auth, "X-Workspace-Id": workspaceId }).send({ name: "Billing system" });
    expect(res.status).toBe(400);
    expect(await ApiKey.countDocuments({ userId: admin.id })).toBe(0);
  });
});

describe("P6-10 sending a document through the API", () => {
  it("uploads, sends, reports status, lists, gives a download link, and voids", async () => {
    const account = await developer();
    const key = await newKey(account);

    const upload = await api().post("/api/v1/documents").set(bearer(key)).attach(...(await file()));
    expect(upload.status).toBe(201);
    expect(upload.body.data).toMatchObject({ title: "agreement.pdf", status: "draft", pageCount: 1, test: false });
    const id = upload.body.data.id;

    const sent = await api().post(`/api/v1/documents/${id}/send`).set(bearer(key)).send({ ...signersFor("asha@example.test"), message: "Please sign" });
    expect(sent.status).toBe(200);
    expect(sent.body.data.status).toBe("pending");
    expect(sent.body.data.recipients[0]).toMatchObject({ name: "Asha Rao", email: "asha@example.test", status: "sent" });
    // A live document's signing link goes to the signer by email and is not handed to the caller
    expect(sent.body.data.recipients[0]).not.toHaveProperty("signingUrl");
    await flushEvents();
    expect(emailsTo("asha@example.test")).toHaveLength(1);
    expect((await subOf(account.id)).usedThisMonth).toBe(1);

    // Sending it again is refused, and not counted
    expect((await api().post(`/api/v1/documents/${id}/send`).set(bearer(key)).send(signersFor("asha@example.test"))).status).toBe(409);
    expect((await subOf(account.id)).usedThisMonth).toBe(1);

    const listed = await api().get("/api/v1/documents?status=pending&limit=1").set(bearer(key));
    expect(listed.body).toMatchObject({ hasMore: false, nextCursor: null });
    expect(listed.body.data.map((d) => d.id)).toEqual([id]);

    const link = await api().get(`/api/v1/documents/${id}/download`).set(bearer(key));
    expect(link.body.data).toMatchObject({ signed: false });
    expect(link.body.data.url).toBeTruthy();

    const voided = await api().post(`/api/v1/documents/${id}/void`).set(bearer(key));
    expect(voided.body.data.status).toBe("voided");
  });

  it("pages through documents with a cursor", async () => {
    const account = await developer();
    const key = await newKey(account);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await api().post("/api/v1/documents").set(bearer(key)).attach(...(await file()))).body.data.id);

    const first = await api().get("/api/v1/documents?limit=2").set(bearer(key));
    expect(first.body.data.map((d) => d.id)).toEqual([ids[2], ids[1]]);
    expect(first.body.hasMore).toBe(true);
    const second = await api().get(`/api/v1/documents?limit=2&cursor=${first.body.nextCursor}`).set(bearer(key));
    expect(second.body.data.map((d) => d.id)).toEqual([ids[0]]);
    expect(second.body.hasMore).toBe(false);
  });
});

describe("P6-13 test mode", () => {
  it("marks the document, counts nothing, emails nobody, and hands back the signing link", async () => {
    const account = await developer();
    const key = await newKey(account, { mode: "test" });

    const upload = await api().post("/api/v1/documents").set(bearer(key)).attach(...(await file()));
    expect(upload.body.data.test).toBe(true);
    const stored = await Pdf.findById(upload.body.data.id);
    expect((await pdfText(await readFile(originalKeyOf(stored)))).join(" ")).toContain("TEST DOCUMENT");

    const sent = await api().post(`/api/v1/documents/${upload.body.data.id}/send`).set(bearer(key)).send(signersFor("nobody@example.test"));
    expect(sent.status).toBe(200);
    await flushEvents();
    expect(emailsTo("nobody@example.test")).toHaveLength(0);
    expect((await subOf(account.id)).usedThisMonth).toBe(0);

    const url = sent.body.data.recipients[0].signingUrl;
    expect(url).toMatch(/\/sign\/[a-f0-9]{64}$/);
    const session = await api().get(`/api/signing/${url.split("/sign/")[1]}`);
    expect(session.body.data.test).toBe(true);

    // The signer can finish it, and still nobody is emailed
    expect((await signAs(url.split("/sign/")[1], ["sig-1"])).status).toBe(200);
    await flushEvents();
    expect(emailsTo("nobody@example.test")).toHaveLength(0);
    expect((await Pdf.findById(upload.body.data.id)).status).toBe("signed");
  });

  it("keeps test and live documents out of each other's sight", async () => {
    const account = await developer();
    const live = await newKey(account);
    const test = await newKey(account, { mode: "test" });
    const liveDoc = (await api().post("/api/v1/documents").set(bearer(live)).attach(...(await file()))).body.data.id;
    const testDoc = (await api().post("/api/v1/documents").set(bearer(test)).attach(...(await file()))).body.data.id;

    expect((await api().get(`/api/v1/documents/${testDoc}`).set(bearer(live))).status).toBe(404);
    expect((await api().get(`/api/v1/documents/${liveDoc}`).set(bearer(test))).status).toBe(404);
    expect((await api().post(`/api/v1/documents/${liveDoc}/send`).set(bearer(test)).send(signersFor("x@example.test"))).status).toBe(404);
    expect((await api().get("/api/v1/documents").set(bearer(live))).body.data.map((d) => d.id)).toEqual([liveDoc]);
    expect((await api().get("/api/v1/documents").set(bearer(test))).body.data.map((d) => d.id)).toEqual([testDoc]);
  });
});

describe("P6-11 webhooks", () => {
  it("accepts only an https address on the public internet", async () => {
    const account = await developer();
    const add = (url) => api().post("/api/developer/webhooks").set(account.auth).send({ url, events: ["envelope.completed"] });
    for (const url of [
      "http://93.184.216.34/hook",
      "https://localhost/hook",
      "https://127.0.0.1/hook",
      "https://10.0.0.5/hook",
      "https://172.16.4.4/hook",
      "https://192.168.1.10/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/hook",
      "https://[::ffff:127.0.0.1]/hook",
      "https://[fd00::1]/hook",
      "https://user:secret@93.184.216.34/hook",
      "ftp://93.184.216.34/hook",
      "not a url",
    ]) {
      expect((await add(url)).status, url).toBe(400);
    }
    expect((await add(`${RECEIVER}/hook`)).status).toBe(201);
    expect((await api().post("/api/developer/webhooks").set(account.auth).send({ url: `${RECEIVER}/hook`, events: ["document.exploded"] })).status).toBe(400);
  });

  it("knows a private address in every spelling", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "::ffff:7f00:1", "::ffff:10.0.0.1", "fe80::1", "fc00::1", "fd12:3456::1", "64:ff9b::7f00:1", "2002:7f00:1::1", "garbage"]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    for (const address of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:2800:220:1:248:1893:25c8:1946"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("delivers once to a receiver that fails twice, signed so the receiver can check it", async () => {
    const account = await developer();
    const created = await api().post("/api/developer/webhooks").set(account.auth).send({ url: `${RECEIVER}/hooks/pactdoc`, events: ["envelope.sent"] });
    const { secret, id: webhookId } = created.body.data;
    expect(secret).toMatch(/^whsec_/);
    // The secret is not shown again
    expect(JSON.stringify((await api().get("/api/developer/webhooks").set(account.auth)).body)).not.toContain(secret);

    const calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("", { status: calls.length < 3 ? 500 : 200 });
    });

    const upload = await uploadPdf(account);
    await api().post(`/api/send/${upload.id}`).set(account.auth).send(signersFor("asha@example.test"));
    await settleJobs(3);

    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.url))).toEqual(new Set([`${RECEIVER}/hooks/pactdoc`]));
    expect(calls[0].init.redirect).toBe("manual");

    const bodies = calls.map((call) => JSON.parse(call.init.body));
    // The same event id on every attempt, so the receiver can recognise a repeat
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    expect(bodies[0]).toMatchObject({ type: "envelope.sent", data: { document: { id: upload.id, status: "pending", test: false } } });

    const header = calls[2].init.headers["X-PactDoc-Signature"];
    const { t, v1 } = Object.fromEntries(header.split(",").map((part) => part.split("=")));
    expect(v1).toBe(crypto.createHmac("sha256", secret).update(`${t}.${calls[2].init.body}`).digest("hex"));
    expect(v1).toBe(signPayload(secret, t, calls[2].init.body));

    const deliveries = await api().get(`/api/developer/webhooks/${webhookId}/deliveries`).set(account.auth);
    expect(deliveries.body.data).toHaveLength(1);
    expect(deliveries.body.data[0]).toMatchObject({ event: "envelope.sent", status: "delivered", attempts: 3, responseStatus: 200 });

    // Sending it again keeps the event id
    const replayed = await api().post(`/api/developer/webhooks/deliveries/${deliveries.body.data[0].id}/replay`).set(account.auth);
    expect(replayed.status).toBe(200);
    await settleJobs(1);
    expect(calls).toHaveLength(4);
    expect(JSON.parse(calls[3].init.body).id).toBe(bodies[0].id);
  });

  it("gives up after its attempts are used and says so in the log, and sends nothing for events not asked for", async () => {
    const account = await developer();
    await api().post("/api/developer/webhooks").set(account.auth).send({ url: `${RECEIVER}/down`, events: ["envelope.sent"] });
    const fetched = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("", { status: 503 }));

    const upload = await uploadPdf(account);
    await api().post(`/api/send/${upload.id}`).set(account.auth).send(signersFor("asha@example.test"));
    await settleJobs(6);

    expect(fetched).toHaveBeenCalledTimes(5);
    const delivery = await WebhookDelivery.findOne({});
    expect(delivery).toMatchObject({ status: "failed", attempts: 5, responseStatus: 503 });

    // Voiding raises an event this webhook did not ask for
    await api().post(`/api/send/${upload.id}/void`).set(account.auth);
    await settleJobs(1);
    expect(await WebhookDelivery.countDocuments()).toBe(1);
  });
});

describe("P6-12 embedded signing", () => {
  const setUp = async () => {
    const owner = await developer();
    const { workspaceId, headers } = await teamFor(owner, { allowedFrameOrigins: ["https://app.example.com"] });
    const key = await newKey(owner, { headers });
    const upload = await api().post("/api/v1/documents").set(bearer(key)).attach(...(await file()));
    const sent = await api().post(`/api/v1/documents/${upload.body.data.id}/send`).set(bearer(key)).send(signersFor("asha@example.test"));
    const recipient = await Recipient.findOne({ pdfId: upload.body.data.id });
    return { owner, workspaceId, headers, key, pdfId: upload.body.data.id, recipient, recipientId: sent.body.data.recipients[0].id };
  };
  const embed = (s, origin) => api().post(`/api/v1/documents/${s.pdfId}/recipients/${s.recipientId}/embed`).set(bearer(s.key)).send({ origin });

  it("opens only for a website on the team's list, and records that it did", async () => {
    const s = await setUp();
    expect((await embed(s, "https://evil.example.net")).status).toBe(403);
    expect((await embed(s, "http://app.example.com")).status).toBe(400);
    expect((await embed(s, "nonsense")).status).toBe(400);

    const made = await embed(s, "https://app.example.com/some/page");
    expect(made.status).toBe(201);
    expect(made.body.data.origin).toBe("https://app.example.com");
    const session = new URL(made.body.data.url).searchParams.get("embed");

    const page = await api().get(`/api/signing/${s.recipient.token}`).query({ embed: session });
    expect(page.body.data.embed).toEqual({ origin: "https://app.example.com" });
    // Opened without a session, or with one that was altered, the page is told of no website
    expect((await api().get(`/api/signing/${s.recipient.token}`)).body.data.embed).toBeNull();
    expect((await api().get(`/api/signing/${s.recipient.token}`).query({ embed: `${session}x` })).body.data.embed).toBeNull();

    const log = await PdfAudit.find({ pdfId: s.pdfId }).lean();
    expect(log.some((entry) => /embedded signing session/.test(entry.description || "") && /app\.example\.com/.test(entry.description))).toBe(true);
  });

  it("stops working for another signer, and when the website is taken off the list", async () => {
    const s = await setUp();
    const session = new URL((await embed(s, "https://app.example.com")).body.data.url).searchParams.get("embed");

    // A second document's signer cannot borrow the session
    const other = await api().post("/api/v1/documents").set(bearer(s.key)).attach(...(await file()));
    await api().post(`/api/v1/documents/${other.body.data.id}/send`).set(bearer(s.key)).send(signersFor("ravi@example.test"));
    const otherRecipient = await Recipient.findOne({ pdfId: other.body.data.id });
    expect((await api().get(`/api/signing/${otherRecipient.token}`).query({ embed: session })).body.data.embed).toBeNull();

    expect((await api().patch(`/api/workspaces/${s.workspaceId}`).set(s.headers).send({ allowedFrameOrigins: [] })).status).toBe(200);
    expect((await api().get(`/api/signing/${s.recipient.token}`).query({ embed: session })).body.data.embed).toBeNull();
    expect((await embed(s, "https://app.example.com")).status).toBe(403);
  });
});

describe("P6-15 a team's retention rule", () => {
  const aged = async (headers, { status, days }) => {
    const upload = await api().post("/api/pdf/upload").set(headers).attach("pdf", await makePdfBuffer(), { filename: "old.pdf", contentType: "application/pdf" });
    await Pdf.collection.updateOne({ _id: (await Pdf.findById(upload.body.data.id))._id }, { $set: { status, updatedAt: new Date(Date.now() - days * 86400000) } });
    return String(upload.body.data.id);
  };

  it("erases finished documents past the limit, keeps their audit log, and touches nothing else", async () => {
    const owner = await developer();
    const strict = await teamFor(owner, { policy: { retentionDays: 30 } });
    const keeper = await teamFor(owner);

    const due = await aged(strict.headers, { status: "signed", days: 40 });
    const recent = await aged(strict.headers, { status: "signed", days: 10 });
    const stillOut = await aged(strict.headers, { status: "pending", days: 400 });
    const noRule = await aged(keeper.headers, { status: "signed", days: 400 });
    const key = originalKeyOf(await Pdf.findById(due));
    expect(await fileExists(key)).toBe(true);

    expect(await processRetention()).toMatchObject({ workspaces: 1, documents: 1, failed: 0 });

    expect(await fileExists(key)).toBe(false);
    expect((await Pdf.findById(due)).deletedAt).toBeTruthy();
    expect(await PdfAudit.countDocuments({ pdfId: due, event: "retention_deleted" })).toBe(1);
    expect(await PdfAudit.countDocuments({ pdfId: due })).toBeGreaterThan(1);
    for (const id of [recent, stillOut, noRule]) {
      const doc = await Pdf.findById(id);
      expect(doc.deletedAt, id).toBeFalsy();
      expect(await fileExists(originalKeyOf(doc)), id).toBe(true);
    }
    // Running it again finds nothing more
    expect(await processRetention()).toMatchObject({ documents: 0 });
  });

  it("does not accept a rule shorter than the life of a signer's link", async () => {
    const owner = await developer();
    const { workspaceId, headers } = await teamFor(owner);
    expect((await api().patch(`/api/workspaces/${workspaceId}`).set(headers).send({ policy: { retentionDays: 7 } })).status).toBe(400);
    expect((await api().patch(`/api/workspaces/${workspaceId}`).set(headers).send({ policy: { retentionDays: 90 } })).status).toBe(200);
    expect((await api().patch(`/api/workspaces/${workspaceId}`).set(headers).send({ policy: { retentionDays: null } })).status).toBe(200);
    expect((await Workspace.findById(workspaceId)).policy.retentionDays).toBeNull();
  });
});

describe("P6-15 single sign-on", () => {
  const provider = ({ email = "asha@corp.example", verified = true } = {}) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const address = String(url);
      const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (address.endsWith("/.well-known/openid-configuration")) {
        return json({ authorization_endpoint: `${RECEIVER}/authorize`, token_endpoint: `${RECEIVER}/token`, userinfo_endpoint: `${RECEIVER}/userinfo` });
      }
      if (address === `${RECEIVER}/token`) {
        const form = new URLSearchParams(String(init.body));
        return form.get("code") === "good-code" && form.get("client_secret") === "s3cret-from-idp" ? json({ access_token: "at-1" }) : json({ error: "invalid_grant" }, 400);
      }
      if (address === `${RECEIVER}/userinfo`) return json({ email, email_verified: verified, name: "Asha Rao" });
      return json({}, 404);
    });

  const configured = async () => {
    const owner = await developer();
    const { workspaceId } = await teamFor(owner);
    const settings = `/api/auth/sso/settings/${workspaceId}`;
    const saved = await api().put(settings).set(owner.auth).send({ issuer: RECEIVER, clientId: "pactdoc", clientSecret: "s3cret-from-idp", emailDomains: ["corp.example"] });
    if (saved.status !== 200) throw new Error(`could not save: ${JSON.stringify(saved.body)}`);
    return { owner, workspaceId, settings, saved: saved.body.data };
  };

  const verifyAndEnable = async ({ owner, settings, saved }) => {
    vi.spyOn(dns, "resolveTxt").mockImplementation(async (domain) => (domain === "corp.example" ? [["v=spf1 -all"], [saved.dnsRecord]] : []));
    await api().post(`${settings}/verify-domains`).set(owner.auth);
    return api().put(settings).set(owner.auth).send({ enabled: true });
  };

  const signIn = async ({ code = "good-code", withCookie = true } = {}) => {
    const started = await api().post("/api/auth/sso/start").send({ email: "asha@corp.example" });
    if (started.status !== 200) return { started };
    const state = new URL(started.body.data.redirectUrl).searchParams.get("state");
    let call = api().get("/api/auth/sso/callback").query({ code, state });
    if (withCookie) call = call.set("Cookie", started.headers["set-cookie"]);
    return { started, callback: await call };
  };

  it("is for Enterprise, keeps the client secret encrypted, and cannot be switched on before a domain is proved", async () => {
    const pro = await createUser();
    await setPlan(pro.id, "pro_monthly");
    const proTeam = await teamFor(pro);
    expect((await api().get(`/api/auth/sso/settings/${proTeam.workspaceId}`).set(pro.auth)).status).toBe(403);

    provider();
    const s = await configured();
    expect(s.saved).toMatchObject({ enabled: false, hasClientSecret: true, verifiedDomains: [] });
    expect(s.saved.dnsRecord).toMatch(/^pactdoc-domain-verification=[a-f0-9]{40}$/);
    expect(JSON.stringify(s.saved)).not.toContain("s3cret-from-idp");
    const stored = await Workspace.findById(s.workspaceId).select("+sso.clientSecret").lean();
    expect(stored.sso.clientSecret).not.toContain("s3cret-from-idp");

    expect((await api().put(s.settings).set(s.owner.auth).send({ enabled: true })).status).toBe(400);
    // A record that is not the workspace's own proves nothing
    vi.spyOn(dns, "resolveTxt").mockResolvedValue([["pactdoc-domain-verification=somebody-elses"]]);
    expect((await api().post(`${s.settings}/verify-domains`).set(s.owner.auth)).body.data.verifiedDomains).toEqual([]);
  });

  it("signs a person at a proved domain in, makes their account, and gives them a seat", async () => {
    provider();
    const s = await configured();
    expect((await verifyAndEnable(s)).body.data).toMatchObject({ enabled: true, verifiedDomains: ["corp.example"] });

    const { started, callback } = await signIn();
    const redirect = new URL(started.body.data.redirectUrl);
    expect(redirect.origin + redirect.pathname).toBe(`${RECEIVER}/authorize`);
    expect(redirect.searchParams.get("client_id")).toBe("pactdoc");

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${env.appUrl}/sso/done?workspace=${s.workspaceId}`);
    expect(callback.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken="))).toBe(true);

    const user = await User.findOne({ email: "asha@corp.example" });
    expect(user).toMatchObject({ name: "Asha Rao", emailVerified: true });
    expect((await Workspace.findById(s.workspaceId)).members.map((m) => String(m.userId))).toEqual([String(user._id)]);

    // The session it started is a real one
    const refreshed = await api().post("/api/auth/refresh-token").set("Cookie", callback.headers["set-cookie"]);
    expect(refreshed.status).toBe(200);
  });

  it("refuses an answer that did not come back to the browser that asked, a bad code, and an address elsewhere", async () => {
    provider();
    const s = await configured();
    await verifyAndEnable(s);
    const failed = (res) => res.status === 302 && res.headers.location.startsWith(`${env.appUrl}/login?sso_error=`);

    expect(failed((await signIn({ withCookie: false })).callback)).toBe(true);
    expect(failed((await signIn({ code: "stolen-code" })).callback)).toBe(true);
    expect(await User.countDocuments({ email: "asha@corp.example" })).toBe(0);

    // The provider vouches for an address at a domain the workspace never proved
    vi.restoreAllMocks();
    provider({ email: "ceo@someone-else.example" });
    expect(failed((await signIn()).callback)).toBe(true);
    expect(await User.countDocuments({ email: "ceo@someone-else.example" })).toBe(0);

    vi.restoreAllMocks();
    provider({ verified: false });
    expect(failed((await signIn()).callback)).toBe(true);
  });

  it("starts a session that meets the team's two-step rule, until single sign-on is switched off", async () => {
    provider();
    const s = await configured();
    await verifyAndEnable(s);
    // The owner has two-step sign-in, as anyone who requires it must
    await User.updateOne({ _id: s.owner.id }, { "twoFactor.enabled": true });
    await Workspace.updateOne({ _id: s.workspaceId }, { "policy.requireTwoFactor": true });

    const { callback } = await signIn();
    expect(callback.status).toBe(302);
    const user = await User.findOne({ email: "asha@corp.example" });
    expect(String(user.ssoSessionWorkspaceId)).toBe(s.workspaceId);

    const refreshed = await api().post("/api/auth/refresh-token").set("Cookie", callback.headers["set-cookie"]);
    // Renewing the session keeps what started it
    expect(String((await User.findById(user._id)).ssoSessionWorkspaceId)).toBe(s.workspaceId);
    const inTeam = { Authorization: `Bearer ${refreshed.body.data.accessToken}`, "X-Workspace-Id": s.workspaceId };
    expect((await api().get("/api/pdf/my-documents").set(inTeam)).status).toBe(200);

    expect((await api().put(s.settings).set(s.owner.auth).send({ enabled: false })).status).toBe(200);
    const refused = await api().get("/api/pdf/my-documents").set(inTeam);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/^TWO_FACTOR_REQUIRED/);
  });

  it("stops when the plan is no longer Enterprise, and says how to get in another way", async () => {
    provider();
    const s = await configured();
    await verifyAndEnable(s);
    await setPlan(s.owner.id, "business_monthly");

    const { started } = await signIn();
    expect(started.status).toBe(404);
    expect(started.body.message).toMatch(/Forgot password/);
  });

  it("says the same thing for a domain it does not know as for none", async () => {
    const res = await api().post("/api/auth/sso/start").send({ email: "someone@unknown.example" });
    expect(res.status).toBe(404);
    expect((await api().post("/api/auth/sso/start").send({ email: "" })).status).toBe(404);
  });
});

describe("P6-02 to P6-06 Aadhaar eSign scaffolding (postponed)", () => {
  const twoSigners = async () => {
    const account = await developer();
    const upload = await uploadPdf(account);
    const res = await api()
      .post(`/api/send/${upload.id}`)
      .set(account.auth)
      .send({
        recipients: [
          { name: "Asha Rao", email: "asha@example.test", signatureType: "aadhaar" },
          { name: "Ravi Kumar", email: "ravi@example.test" },
        ],
        fields: [signatureField("sig-asha", "asha@example.test"), signatureField("sig-ravi", "ravi@example.test")],
      });
    await flushEvents();
    const find = (email) => Recipient.findOne({ pdfId: upload.id, email });
    return { account, pdfId: upload.id, res, find };
  };
  const filled = (id) => ({ consent: true, fields: [{ id, signatureUrl: PNG_DATA_URL, value: PNG_DATA_URL }] });

  it("is off unless a provider is named, and the stand-in can never be used in production", async () => {
    expect((await api().get("/api/esign/availability")).body.data.available).toBe(false);
    const { res, pdfId } = await twoSigners();
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/^ESIGN_UNAVAILABLE/);
    expect((await Pdf.findById(pdfId)).status).not.toBe("pending");

    env.esignProvider = "fake";
    expect(esignProvider()?.name).toBe("fake");
    env.isProd = true;
    expect(esignProvider()).toBeNull();
  });

  it("puts the Aadhaar signer last, and applies the signature only after the provider confirms", async () => {
    env.esignProvider = "fake";
    const { res, pdfId, find } = await twoSigners();
    expect(res.status).toBe(200);
    const asha = await find("asha@example.test");
    const ravi = await find("ravi@example.test");
    expect([ravi.signingOrder, asha.signingOrder]).toEqual([1, 2]);
    expect(asha.signatureType).toBe("aadhaar");

    // Not her turn yet
    expect((await api().post(`/api/esign/${asha.token}/start`).send(filled("sig-asha"))).status).toBe(409);
    expect((await signAs(ravi.token, ["sig-ravi"])).status).toBe(200);
    await flushEvents();

    const session = await api().get(`/api/signing/${asha.token}`);
    expect(session.body.data.esign).toMatchObject({ required: true, available: true, standIn: true });

    const started = await api().post(`/api/esign/${asha.token}/start`).send(filled("sig-asha"));
    expect(started.status).toBe(200);
    const { transactionId, redirectUrl } = started.body.data;
    expect(redirectUrl).toContain(`/esign-stand-in/${transactionId}`);

    // Back before the provider has answered: nothing is signed
    expect((await api().post(`/api/esign/${asha.token}/complete`).send({ transactionId })).status).toBe(409);
    expect((await find("asha@example.test")).status).not.toBe("signed");

    expect((await api().post(`/api/esign/stand-in/${transactionId}`).send({ outcome: "signed", name: "RAO ASHA" })).status).toBe(200);
    const done = await api().post(`/api/esign/${asha.token}/complete`).send({ transactionId });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ isFinal: true, nameMatches: true });
    // Asking again changes nothing
    expect((await api().post(`/api/esign/${asha.token}/complete`).send({ transactionId })).body.data).toMatchObject({ alreadyDone: true });

    const signed = await find("asha@example.test");
    expect(signed).toMatchObject({ status: "signed", esign: { status: "signed", signerName: "RAO ASHA", nameMatches: true } });
    expect((await Pdf.findById(pdfId)).status).toBe("signed");
    expect((await PdfAudit.find({ pdfId }).lean()).map((entry) => entry.event)).toEqual(expect.arrayContaining(["esign_started", "esign_verified"]));
    // What she filled in is not kept once it has been applied
    expect((await EsignTransaction.findById(transactionId)).fields).toEqual([]);
  });

  it("leaves the signer unsigned when the provider reports failure, and lets the sender fall back to ordinary signing", async () => {
    env.esignProvider = "fake";
    const { account, find } = await twoSigners();
    const ravi = await find("ravi@example.test");
    await signAs(ravi.token, ["sig-ravi"]);
    await flushEvents();
    const asha = await find("asha@example.test");

    const started = await api().post(`/api/esign/${asha.token}/start`).send(filled("sig-asha"));
    await api().post(`/api/esign/stand-in/${started.body.data.transactionId}`).send({ outcome: "failed" });
    const done = await api().post(`/api/esign/${asha.token}/complete`).send({ transactionId: started.body.data.transactionId });
    expect(done.status).toBe(422);
    expect(await find("asha@example.test")).toMatchObject({ status: expect.not.stringMatching("signed"), esign: { status: "failed" } });

    const stranger = await createUser();
    expect((await api().post(`/api/esign/recipients/${asha._id}/use-ordinary-signing`).set(stranger.auth)).status).toBe(403);
    expect((await api().post(`/api/esign/recipients/${asha._id}/use-ordinary-signing`).set(account.auth)).status).toBe(200);
    expect((await find("asha@example.test")).signatureType).toBe("electronic");
    expect((await signAs(asha.token, ["sig-asha"])).status).toBe(200);
  });
});
