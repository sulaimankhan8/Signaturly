import { describe, it, expect } from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";
import { api, createUser, uploadPdf, makePdfBuffer, signatureField, flushEvents, emailsTo, PASSWORD } from "../helpers.js";
import { setPlan } from "../templates/fixtures.js";
import { env } from "../../src/config/env.js";
import { User } from "../../src/models/User.model.js";
import { Pdf } from "../../src/models/Pdf.model.js";
import { Recipient } from "../../src/models/Recipient.model.js";
import { Template } from "../../src/models/Template.model.js";
import { Job } from "../../src/models/Job.model.js";
import { Workspace, Invitation } from "../../src/models/Workspace.model.js";
import { Subscription } from "../../src/models/Subscription.model.js";
import { Payment } from "../../src/models/Payment.model.js";
import { PdfAudit } from "../../src/models/PdfAudit.model.js";
import { BulkBatch } from "../../src/models/ContactList.model.js";
import { up as placeInWorkspaces, down as undoWorkspaces } from "../../src/migrations/002-workspaces-2026-10.js";
import { codeAt } from "../../src/services/twoFactor.service.js";
import { runDueJobs } from "../../src/jobs/queue.js";
import { deleteFile } from "../../src/services/storage.service.js";
import { generateAuditCertificatePdf } from "../../src/services/auditCertificate.service.js";
import { pdfText } from "../render.js";

// Phase 5: teams. Who may reach what is covered route by route in tests/security/access-matrix.test.js;
// these tests cover how the pieces behave.

const subOf = (userId) => Subscription.findOne({ userId });
const inTeam = (account, workspaceId) => ({ ...account.auth, "X-Workspace-Id": String(workspaceId) });

// An owner on the Business plan with this many seats, and a team workspace
const teamOf = async (seats = 3) => {
  const owner = await createUser();
  const paid = await api().post("/api/billing/dev-pay").set(owner.auth).send({ kind: "plan", item: "business_monthly", seats });
  if (paid.status !== 200) throw new Error(`could not buy the plan: ${paid.status} ${JSON.stringify(paid.body)}`);
  const made = await api().post("/api/workspaces").set(owner.auth).send({ name: "Lakeview Society" });
  if (made.status !== 201) throw new Error(`could not make the team: ${made.status} ${JSON.stringify(made.body)}`);
  return { owner, workspaceId: String(made.body.data.id) };
};

const join = async (workspaceId, role = "member") => {
  const account = await createUser();
  await Workspace.updateOne({ _id: workspaceId }, { $push: { members: { userId: account.id, role } } });
  return account;
};

const sendInTeam = async (account, workspaceId, email = "asha@example.test") => {
  const upload = await api().post("/api/pdf/upload").set(inTeam(account, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "agreement.pdf", contentType: "application/pdf" });
  const res = await api().post(`/api/send/${upload.body.data.id}`).set(inTeam(account, workspaceId)).send({ recipients: [{ name: "Asha Rao", email }], fields: [signatureField("sig-1", email)] });
  await flushEvents();
  return { pdfId: String(upload.body.data.id), res };
};

describe("P5-01 every user gets a workspace of their own", () => {
  it("makes it on the first request, once, and reports it on the account", async () => {
    const user = await createUser();
    await Promise.all([api().get("/api/auth/me").set(user.auth), api().get("/api/pdf/my-documents").set(user.auth), api().get("/api/workspaces").set(user.auth)]);
    expect(await Workspace.countDocuments({ ownerId: user.id, personal: true })).toBe(1);

    const upload = await uploadPdf(user);
    const personal = await Workspace.findOne({ ownerId: user.id, personal: true });
    expect(String((await Pdf.findById(upload.id)).workspaceId)).toBe(String(personal._id));
  });

  it("still shows a document made before workspaces existed, to its creator only", async () => {
    const user = await createUser();
    const other = await createUser();
    const old = await Pdf.create({ userId: user.id, originalFileName: "old.pdf", storagePath: "missing/old.pdf", originalHash: "a".repeat(64), pageCount: 1 });

    const mine = await api().get("/api/pdf/my-documents").set(user.auth);
    expect(JSON.stringify(mine.body)).toContain(String(old._id));
    const theirs = await api().get("/api/pdf/my-documents").set(other.auth);
    expect(JSON.stringify(theirs.body)).not.toContain(String(old._id));
    expect((await api().get(`/api/send/${old._id}`).set(other.auth)).status).toBe(403);
  });
});

describe("P5-01 the migration that places existing records", () => {
  const seed = async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    await Workspace.deleteMany({});
    const doc = (userId, name) => Pdf.collection.insertOne({ userId: new mongoose.Types.ObjectId(userId), originalFileName: name, storagePath: `x/${name}`, originalHash: "b".repeat(64), pageCount: 1, status: "draft", deletedAt: null });
    await doc(a.id, "a1.pdf");
    await doc(a.id, "a2.pdf");
    await doc(b.id, "b1.pdf");
    // A team from before this release, whose owner was also listed as a member
    const team = await Workspace.create({ name: "Old team", ownerId: a.id, members: [{ userId: a.id, role: "admin" }, { userId: b.id, role: "member" }] });
    const teamDoc = await Pdf.create({ userId: b.id, workspaceId: team._id, originalFileName: "team.pdf", storagePath: "x/team.pdf", originalHash: "c".repeat(64), pageCount: 1 });
    return { a, b, team, teamDoc };
  };
  const perUser = async () => Object.fromEntries((await Pdf.aggregate([{ $group: { _id: "$userId", n: { $sum: 1 } } }])).map((row) => [String(row._id), row.n]));

  it("puts each person's records in their own workspace and moves nothing between people", async () => {
    const { a, b, team, teamDoc } = await seed();
    const before = await perUser();

    const result = await placeInWorkspaces();
    expect(result).toMatchObject({ users: 2, workspacesCreated: 2, documents: 3 });
    expect(await perUser()).toEqual(before);

    const personalA = await Workspace.findOne({ ownerId: a.id, personal: true });
    const personalB = await Workspace.findOne({ ownerId: b.id, personal: true });
    expect(await Pdf.countDocuments({ userId: a.id, workspaceId: personalA._id })).toBe(2);
    expect(await Pdf.countDocuments({ userId: b.id, workspaceId: personalB._id })).toBe(1);
    // A record already in a team stays there
    expect(String((await Pdf.findById(teamDoc._id)).workspaceId)).toBe(String(team._id));
    // The owner is recorded once, as the owner
    expect((await Workspace.findById(team._id)).members.map((m) => String(m.userId))).toEqual([b.id]);
  });

  it("changes nothing when run again, and can be undone", async () => {
    const { team, teamDoc } = await seed();
    await placeInWorkspaces();
    expect(await placeInWorkspaces()).toMatchObject({ workspacesCreated: 0, documents: 0, templates: 0 });

    const undone = await undoWorkspaces();
    expect(undone).toMatchObject({ documents: 3, workspacesRemoved: 2 });
    expect(await Workspace.countDocuments({ personal: true })).toBe(0);
    expect(await Pdf.countDocuments({ workspaceId: null })).toBe(3);
    expect(String((await Pdf.findById(teamDoc._id)).workspaceId)).toBe(String(team._id));
  });
});

describe("P5-04 invitations", () => {
  const invitationLink = (address) => emailsTo(address).map((m) => /\/invite\/([a-f0-9]+)/.exec(m.html)?.[1]).find(Boolean);

  it("needs a plan with teams to start one", async () => {
    const free = await createUser();
    const res = await api().post("/api/workspaces").set(free.auth).send({ name: "My team" });
    expect(res.status).toBe(403);
    expect(await Workspace.countDocuments({ ownerId: free.id, personal: { $ne: true } })).toBe(0);
  });

  it("brings in someone who has no account yet, once they sign up with the invited address", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const address = "newcomer@example.test";
    const invited = await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: address, role: "member" });
    expect(invited.status).toBe(201);
    await flushEvents();

    const token = invitationLink(address);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    // Only a hash of the link is stored
    expect(await Invitation.countDocuments({ tokenHash: token })).toBe(0);

    const described = await api().get(`/api/workspaces/invitations/${token}`);
    expect(described.body.data).toMatchObject({ workspaceName: "Lakeview Society", role: "member", email: address, hasAccount: false });

    const newcomer = await createUser({ email: address });
    const accepted = await api().post(`/api/workspaces/invitations/${token}/accept`).set(newcomer.auth);
    expect(accepted.status).toBe(200);
    const listed = await api().get("/api/workspaces").set(newcomer.auth);
    expect(listed.body.data.map((w) => String(w.id))).toContain(workspaceId);
    expect(listed.body.data.find((w) => String(w.id) === workspaceId).role).toBe("member");

    // The link works once
    expect((await api().post(`/api/workspaces/invitations/${token}/accept`).set(newcomer.auth)).status).toBe(410);
  });

  it("cannot be accepted by anyone but the person it was sent to, or after it expires", async () => {
    const { owner, workspaceId } = await teamOf(3);
    await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: "invited@example.test" });
    await flushEvents();
    const token = invitationLink("invited@example.test");

    const someoneElse = await createUser();
    expect((await api().post(`/api/workspaces/invitations/${token}/accept`).set(someoneElse.auth)).status).toBe(403);
    expect((await Workspace.findById(workspaceId)).members).toHaveLength(0);

    await Invitation.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const invitee = await createUser({ email: "invited@example.test" });
    expect((await api().post(`/api/workspaces/invitations/${token}/accept`).set(invitee.auth)).status).toBe(410);
    expect((await api().get(`/api/workspaces/invitations/${token}`)).status).toBe(410);
  });

  it("counts an unanswered invitation as a seat, and frees it when withdrawn", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const first = await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: "one@example.test" });
    expect(first.status).toBe(201);

    const second = await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: "two@example.test" });
    expect(second.status).toBe(403);
    expect(second.body.message).toMatch(/2 seats/);

    const details = await api().get(`/api/workspaces/${workspaceId}`).set(owner.auth);
    expect(details.body.data.seats).toEqual({ used: 2, allowed: 2 });

    expect((await api().delete(`/api/workspaces/${workspaceId}/invitations/${first.body.data.id}`).set(owner.auth)).status).toBe(200);
    expect((await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: "two@example.test" })).status).toBe(201);
  });
});

describe("P5-05 the Business plan is paid by the seat", () => {
  const razorpay = (body, eventId) => {
    const payload = JSON.stringify(body);
    const signature = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(payload).digest("hex");
    return api().post("/api/webhooks/razorpay").set("Content-Type", "application/json").set({ "x-razorpay-signature": signature, "x-razorpay-event-id": eventId }).send(payload);
  };
  const captured = (userId, paymentId, amountPaise, notes) => ({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, amount: amountPaise, currency: "INR", notes: { userId, ...notes } } } } });

  it("charges the seat price for each seat and pools every seat's documents", async () => {
    const owner = await createUser();
    const order = await api().post("/api/billing/checkout").set(owner.auth).send({ kind: "plan", item: "business_monthly", seats: 3 });
    expect(order.body.data).toMatchObject({ amount: 1497, seats: 3 });

    await api().post("/api/billing/dev-pay").set(owner.auth).send({ kind: "plan", item: "business_monthly", seats: 3 });
    expect(await subOf(owner.id)).toMatchObject({ plan: "business_monthly", seats: 3, monthlyQuota: 300, status: "active" });
    expect(await Payment.findOne({ userId: owner.id })).toMatchObject({ kind: "purchase", amount: 1497, seats: 3 });
  });

  it("grants nothing when the payment is for fewer seats than it names", async () => {
    const owner = await createUser();
    // Paid for one seat, named five
    await razorpay(captured(owner.id, "pay_short", 49900, { kind: "plan", item: "business_monthly", plan: "business_monthly", seats: "5" }), "evt_short");
    expect((await subOf(owner.id))?.plan || "free").toBe("free");
  });

  it("adds a seat part-way through for less than a full month, and refuses an underpayment", async () => {
    const { owner } = await teamOf(2);
    // Ten days into a thirty-day period
    await Subscription.updateOne({ userId: owner.id }, { currentPeriodEnd: new Date(Date.now() + 20 * 86400000) });

    const order = await api().post("/api/billing/checkout").set(owner.auth).send({ kind: "seats", item: "1" });
    expect(order.status).toBe(200);
    expect(order.body.data.amount).toBe(Math.ceil((499 * 20) / 30));

    await razorpay(captured(owner.id, "pay_seat_cheap", 100, { kind: "seats", item: "1" }), "evt_seat_cheap");
    expect(await subOf(owner.id)).toMatchObject({ seats: 2, monthlyQuota: 200 });

    await razorpay(captured(owner.id, "pay_seat", order.body.data.amount * 100, { kind: "seats", item: "1" }), "evt_seat");
    expect(await subOf(owner.id)).toMatchObject({ seats: 3, monthlyQuota: 300 });
    // Reported again by the provider: still one seat added
    await razorpay(captured(owner.id, "pay_seat", order.body.data.amount * 100, { kind: "seats", item: "1" }), "evt_seat_again");
    expect((await subOf(owner.id)).seats).toBe(3);
  });

  it("lets the next period be bought with fewer seats, but not fewer than the people in the team", async () => {
    const { owner, workspaceId } = await teamOf(4);
    await join(workspaceId);
    await api().post(`/api/workspaces/${workspaceId}/invitations`).set(owner.auth).send({ email: "pending@example.test" });
    // The owner, one member and one unanswered invitation: three seats in use
    const buy = (seats) => api().post("/api/billing/checkout").set(owner.auth).send({ kind: "plan", item: "business_monthly", seats });

    const tooFew = await buy(2);
    expect(tooFew.status).toBe(400);
    expect(tooFew.body.message).toMatch(/3 people/);
    expect((await buy(3)).status).toBe(200);
    // Nothing changes until that purchase is paid for
    expect((await subOf(owner.id)).seats).toBe(4);
  });

  it("cannot add seats to a plan that is not sold by the seat", async () => {
    const pro = await createUser();
    await setPlan(pro.id, "pro_monthly");
    expect((await api().post("/api/billing/checkout").set(pro.auth).send({ kind: "seats", item: "1" })).status).toBe(400);
  });

  it("counts a member's documents against the team's allowance, not their own", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const member = await join(workspaceId);
    const { res } = await sendInTeam(member, workspaceId);
    expect(res.status).toBe(200);
    expect((await subOf(owner.id)).usedThisMonth).toBe(1);
    expect((await subOf(member.id))?.usedThisMonth || 0).toBe(0);
  });

  it("charges the team that holds the document, whichever workspace the sender is looking at", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const member = await join(workspaceId);
    const upload = await api().post("/api/pdf/upload").set(inTeam(member, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "a.pdf", contentType: "application/pdf" });
    // Sent with no workspace named: the member's own free allowance must not be touched
    const res = await api().post(`/api/send/${upload.body.data.id}`).set(member.auth).send({ recipients: [{ name: "Asha Rao", email: "asha@example.test" }], fields: [signatureField("sig-1", "asha@example.test")] });
    expect(res.status).toBe(200);
    expect((await subOf(owner.id)).usedThisMonth).toBe(1);
    expect((await subOf(member.id))?.usedThisMonth || 0).toBe(0);
  });
});

describe("P5-06 a team's documents carry its name", () => {
  it("puts the team's name and colour on the signing email and the signing page", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const saved = await api().patch(`/api/workspaces/${workspaceId}`).set(owner.auth).send({ branding: { companyName: "Lakeview Society", primaryColor: "#0a7a4b", emailFooterText: "Managed by the committee" } });
    expect(saved.status).toBe(200);

    const { pdfId } = await sendInTeam(owner, workspaceId, "signer@example.test");
    const email = emailsTo("signer@example.test")[0];
    expect(email.html).toContain("Lakeview Society");
    expect(email.html).toContain("#0a7a4b");
    expect(email.html).toContain("Managed by the committee");

    const recipient = await Recipient.findOne({ pdfId });
    const session = await api().get(`/api/signing/${recipient.token}`);
    expect(session.body.data.branding).toMatchObject({ badge: false, companyName: "Lakeview Society", primaryColor: "#0a7a4b" });
  });

  it("leaves a personal document unbranded, with the Free-plan line where it applies", async () => {
    const free = await createUser();
    const upload = await uploadPdf(free);
    await api().post(`/api/send/${upload.id}`).set(free.auth).send({ recipients: [{ name: "Asha Rao", email: "plain@example.test" }], fields: [signatureField("sig-1", "plain@example.test")] });
    await flushEvents();
    const recipient = await Recipient.findOne({ pdfId: upload.id });
    const session = await api().get(`/api/signing/${recipient.token}`);
    expect(session.body.data.branding).toEqual({ badge: true });
  });

  it("heads the signing record with the team's name, and still says who kept the record", async () => {
    const { owner, workspaceId } = await teamOf(2);
    await api().patch(`/api/workspaces/${workspaceId}`).set(owner.auth).send({ branding: { companyName: "Lakeview Society" } });
    const { pdfId } = await sendInTeam(owner, workspaceId);

    const pages = await pdfText(await generateAuditCertificatePdf(pdfId));
    expect(pages[0]).toContain("Lakeview Society");
    expect(pages[0]).toContain(`Record of events logged by ${env.appName}`);

    // A personal document's record is headed by the service's own name, as before
    const solo = await createUser();
    const upload = await uploadPdf(solo);
    expect((await pdfText(await generateAuditCertificatePdf(upload.id)))[0]).not.toContain("Lakeview Society");
  });

  it("refuses a colour or a logo that is not what it claims to be", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const patch = (branding) => api().patch(`/api/workspaces/${workspaceId}`).set(owner.auth).send({ branding });
    expect((await patch({ primaryColor: "red; background:url(x)" })).status).toBe(400);
    expect((await patch({ logoUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await patch({ logoUrl: "http://example.com/logo.png" })).status).toBe(400);
    expect((await patch({ logoUrl: "https://example.com/logo.png" })).status).toBe(200);
  });
});

describe("P5-07 contact lists and bulk send", () => {
  const withTemplate = async () => {
    const { owner, workspaceId } = await teamOf(2);
    const upload = await api().post("/api/pdf/upload").set(inTeam(owner, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "notice.pdf", contentType: "application/pdf" });
    const template = await api()
      .post("/api/templates")
      .set(inTeam(owner, workspaceId))
      .send({
        name: "Maintenance notice",
        sourcePdfId: upload.body.data.id,
        roles: [{ id: "role-1", name: "Member" }],
        fields: [{ id: "f1", roleId: "role-1", roleName: "Member", type: "signature", page: 1, xPercent: 0.1, yPercent: 0.8, widthPercent: 0.25, heightPercent: 0.06 }],
      });
    if (template.status !== 201) throw new Error(`template failed: ${JSON.stringify(template.body)}`);
    return { owner, workspaceId, templateId: String(template.body.data._id) };
  };
  const csv = (rows) => ["name,email,label", ...rows].join("\n");
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      await flushEvents();
      await Job.updateMany({ status: "pending" }, { $set: { runAfter: new Date(Date.now() - 1000) } });
      await runDueJobs();
    }
    await flushEvents();
  };

  it("imports a spreadsheet and says which rows it left out, and why", async () => {
    const { owner, workspaceId } = await teamOf(2);
    const res = await api()
      .post("/api/contacts/lists")
      .set(inTeam(owner, workspaceId))
      .send({ name: "Block A", csv: csv(['"Rao, Asha",asha@example.test,A-101', ",nobody@example.test,A-102", "Ravi Kumar,not-an-email,A-103", "Asha again,asha@example.test,A-104", "Meera Iyer,meera@example.test,A-105"]) });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.problems.map((p) => p.row)).toEqual([2, 3, 4]);

    const list = await api().get(`/api/contacts/lists/${res.body.data.id}`).set(inTeam(owner, workspaceId));
    expect(list.body.data.contacts[0]).toMatchObject({ name: "Rao, Asha", email: "asha@example.test", label: "A-101" });

    // The same name twice in one workspace is refused, not silently duplicated
    const again = await api().post("/api/contacts/lists").set(inTeam(owner, workspaceId)).send({ name: "Block A", rows: [{ name: "X", email: "x@example.test" }] });
    expect(again.status).toBe(409);
  });

  it("sends one document to each person on the list and counts each against the team", async () => {
    const { owner, workspaceId, templateId } = await withTemplate();
    const list = await api().post("/api/contacts/lists").set(inTeam(owner, workspaceId)).send({ name: "Block A", csv: csv(["Asha Rao,a1@example.test,", "Ravi Kumar,a2@example.test,", "Meera Iyer,a3@example.test,"]) });

    const started = await api().post("/api/contacts/bulk").set(inTeam(owner, workspaceId)).send({ templateId, listId: list.body.data.id, message: "Please sign" });
    expect(started.status).toBe(202);
    expect(started.body.data).toMatchObject({ total: 3 });
    await settle();

    const progress = await api().get(`/api/contacts/bulk/${started.body.data.id}`).set(inTeam(owner, workspaceId));
    expect(progress.body.data).toMatchObject({ total: 3, sent: 3, failed: 0, pending: 0 });
    expect(await Pdf.countDocuments({ workspaceId, status: "pending" })).toBe(3);
    expect((await subOf(owner.id)).usedThisMonth).toBe(3);
    expect(emailsTo("a2@example.test")).toHaveLength(1);
  });

  it("reports a row that could not be sent, gives its document back, and sends it again when asked", async () => {
    const { owner, workspaceId, templateId } = await withTemplate();
    const list = await api().post("/api/contacts/lists").set(inTeam(owner, workspaceId)).send({ name: "Block B", csv: csv(["Asha Rao,b1@example.test,", "Ravi Kumar,b2@example.test,"]) });
    // The template's file goes missing, so no row can be sent
    await deleteFile((await Template.findById(templateId)).sourcePdfPath);

    const started = await api().post("/api/contacts/bulk").set(inTeam(owner, workspaceId)).send({ templateId, listId: list.body.data.id });
    expect(started.status).toBe(202);
    expect((await subOf(owner.id)).usedThisMonth).toBe(2);
    await settle();

    const failed = await api().get(`/api/contacts/bulk/${started.body.data.id}`).set(inTeam(owner, workspaceId));
    expect(failed.body.data).toMatchObject({ sent: 0, failed: 2, pending: 0 });
    expect(failed.body.data.failures[0]).toMatchObject({ row: 1, email: "b1@example.test" });
    expect(failed.body.data.failures[0].error).toBeTruthy();
    // Nothing was sent, so nothing is counted
    expect((await subOf(owner.id)).usedThisMonth).toBe(0);

    const retried = await api().post(`/api/contacts/bulk/${started.body.data.id}/retry`).set(inTeam(owner, workspaceId));
    expect(retried.status).toBe(200);
    expect(retried.body.data).toMatchObject({ failed: 0, pending: 2 });
    expect((await subOf(owner.id)).usedThisMonth).toBe(2);
  });

  it("completes a send to 500 people, the most the Business plan sends at once", async () => {
    const { owner, workspaceId, templateId } = await withTemplate();
    await Subscription.updateOne({ userId: owner.id }, { monthlyQuota: 600 });
    const rows = Array.from({ length: 500 }, (_, i) => ({ name: `Member ${i + 1}`, email: `flat${i + 1}@example.test`, label: `A-${i + 1}` }));

    const started = await api().post("/api/contacts/bulk").set(inTeam(owner, workspaceId)).send({ templateId, rows });
    expect(started.status).toBe(202);
    expect(started.body.data.total).toBe(500);

    // The rows are sent by background jobs; wait until none is left
    for (let round = 0; round < 200; round++) {
      const batch = await BulkBatch.findById(started.body.data.id).lean();
      if (!batch.rows.some((row) => row.status === "pending")) break;
      await Job.updateMany({ status: "pending" }, { $set: { runAfter: new Date(Date.now() - 1000) } });
      await runDueJobs({ limit: 100 });
      await flushEvents();
    }

    const progress = await api().get(`/api/contacts/bulk/${started.body.data.id}`).set(inTeam(owner, workspaceId));
    expect(progress.body.data).toMatchObject({ total: 500, sent: 500, failed: 0, pending: 0 });
    expect(await Pdf.countDocuments({ workspaceId, status: "pending" })).toBe(500);
    expect((await subOf(owner.id)).usedThisMonth).toBe(500);
    // Each person gets their own copy, addressed to them alone
    expect(await Recipient.countDocuments({ email: "flat500@example.test" })).toBe(1);
  }, 240000);

  it("refuses a list longer than the plan sends at once, and counts nothing", async () => {
    const { owner, workspaceId, templateId } = await withTemplate();
    await BulkBatch.deleteMany({});
    const rows = Array.from({ length: 501 }, (_, i) => ({ name: `Person ${i}`, email: `p${i}@example.test` }));
    const res = await api().post("/api/contacts/bulk").set(inTeam(owner, workspaceId)).send({ templateId, rows });
    expect(res.status).toBe(403);
    expect((await subOf(owner.id)).usedThisMonth).toBe(0);
    expect(await BulkBatch.countDocuments()).toBe(0);
  });
});

describe("P5-09 two-step sign-in", () => {
  const stepNow = () => Math.floor(Date.now() / 1000 / 30);
  const login = (account, code) => api().post("/api/auth/login").send({ email: account.email, password: PASSWORD, ...(code ? { code } : {}) });

  const switchOn = async (account) => {
    const begun = await api().post("/api/auth/2fa/begin").set(account.auth);
    const secret = begun.body.data.secret;
    const confirmed = await api().post("/api/auth/2fa/confirm").set(account.auth).send({ code: codeAt(secret, stepNow()) });
    if (confirmed.status !== 200) throw new Error(`could not confirm: ${JSON.stringify(confirmed.body)}`);
    return { secret, recoveryCodes: confirmed.body.data.recoveryCodes };
  };

  it("is off until a code from the app proves the key was added", async () => {
    const user = await createUser();
    const begun = await api().post("/api/auth/2fa/begin").set(user.auth);
    expect(begun.body.data.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(begun.body.data.otpauthUrl).toContain("otpauth://totp/");

    expect((await api().post("/api/auth/2fa/confirm").set(user.auth).send({ code: "000000" })).status).toBe(400);
    expect((await api().get("/api/auth/2fa").set(user.auth)).body.data.enabled).toBe(false);
    expect((await login(user)).status).toBe(200);
  });

  it("then asks for a code at sign-in, takes each code once, and stores the key encrypted", async () => {
    const user = await createUser();
    const { secret, recoveryCodes } = await switchOn(user);
    expect(recoveryCodes).toHaveLength(10);

    const stored = await User.findById(user.id).select("+twoFactor.secret +twoFactor.recoveryHashes").lean();
    expect(JSON.stringify(stored.twoFactor)).not.toContain(secret);
    expect(JSON.stringify(stored.twoFactor)).not.toContain(recoveryCodes[0]);

    const noCode = await login(user);
    expect(noCode.status).toBe(401);
    expect(noCode.body.message).toMatch(/^TWO_FACTOR_CODE_NEEDED/);
    expect((await login(user, "123456")).body.message).toMatch(/^TWO_FACTOR_CODE_WRONG/);
    // A wrong password is not told whether the account has a second step
    const wrongPassword = await api().post("/api/auth/login").send({ email: user.email, password: "not-the-password" });
    expect(wrongPassword.body.message).not.toMatch(/TWO_FACTOR/);

    const next = codeAt(secret, stepNow() + 1);
    expect((await login(user, next)).status).toBe(200);
    expect((await login(user, next)).status).toBe(401);
  });

  it("lets a recovery code sign in once", async () => {
    const user = await createUser();
    const { recoveryCodes } = await switchOn(user);
    expect((await login(user, recoveryCodes[3])).status).toBe(200);
    expect((await login(user, recoveryCodes[3])).status).toBe(401);
    expect((await api().get("/api/auth/2fa").set(user.auth)).body.data.recoveryCodesLeft).toBe(9);
  });

  it("can be required by a team, without locking a member out of setting it up", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const member = await join(workspaceId);
    expect((await api().patch(`/api/workspaces/${workspaceId}`).set(owner.auth).send({ policy: { requireTwoFactor: true } })).status).toBe(200);

    const refused = await api().get("/api/pdf/my-documents").set(inTeam(member, workspaceId));
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/^TWO_FACTOR_REQUIRED/);
    expect((await api().post("/api/pdf/upload").set(inTeam(member, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "a.pdf", contentType: "application/pdf" })).status).toBe(403);
    // Their own documents and the set-up pages still work
    expect((await api().get("/api/pdf/my-documents").set(member.auth)).status).toBe(200);
    expect((await api().get("/api/auth/2fa").set(inTeam(member, workspaceId))).status).toBe(200);

    await switchOn(member);
    // Setting it up cannot be started twice
    expect((await api().post("/api/auth/2fa/begin").set(member.auth)).status).toBe(409);
    // The session that set it up carries on, now let in
    expect((await api().get("/api/pdf/my-documents").set(inTeam(member, workspaceId))).status).toBe(200);
  });
});

describe("P5-11 leaving, and a plan that lapses", () => {
  it("hands a removed member's documents to the owner and shuts the member out", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const member = await join(workspaceId);
    const { pdfId } = await sendInTeam(member, workspaceId);

    const removed = await api().delete(`/api/workspaces/${workspaceId}/members/${member.id}`).set(owner.auth);
    expect(removed.status).toBe(200);
    expect(removed.body.data.documentsTransferred).toBe(1);

    const doc = await Pdf.findById(pdfId);
    expect(String(doc.userId)).toBe(owner.id);
    expect(String(doc.transferredFrom)).toBe(member.id);
    expect(String(doc.workspaceId)).toBe(workspaceId);

    expect((await api().get(`/api/send/${pdfId}`).set(inTeam(member, workspaceId))).status).toBe(403);
    expect((await api().post(`/api/send/${pdfId}/void`).set(member.auth)).status).toBe(403);
    expect(JSON.stringify((await api().get("/api/pdf/my-documents").set(inTeam(member, workspaceId))).body)).not.toContain(pdfId);
    expect((await api().get("/api/workspaces").set(member.auth)).body.data.map((w) => String(w.id))).not.toContain(workspaceId);
    // The owner still has it
    expect((await api().get(`/api/send/${pdfId}`).set(inTeam(owner, workspaceId))).status).toBe(200);
  });

  it("lets a member leave, and does not let the owner be removed", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const member = await join(workspaceId);
    const other = await join(workspaceId);
    expect((await api().delete(`/api/workspaces/${workspaceId}/members/${other.id}`).set(member.auth)).status).toBe(403);
    expect((await api().delete(`/api/workspaces/${workspaceId}/members/${owner.id}`).set(owner.auth)).status).toBe(400);
    expect((await api().delete(`/api/workspaces/${workspaceId}/members/${member.id}`).set(member.auth)).status).toBe(200);
  });

  it("makes a team read-only when its plan lapses: everything can be read, nothing new is sent", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const member = await join(workspaceId);
    const draft = await api().post("/api/pdf/upload").set(inTeam(member, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "a.pdf", contentType: "application/pdf" });

    // The paid period and its grace both run out
    await Subscription.updateOne({ userId: owner.id }, { status: "past_due", currentPeriodEnd: new Date(Date.now() - 5 * 86400000), gracePeriodEnd: new Date(Date.now() - 86400000) });
    await api().get("/api/billing/subscription").set(owner.auth);
    expect((await Workspace.findById(workspaceId)).status).toBe("read_only");

    const upload = await api().post("/api/pdf/upload").set(inTeam(member, workspaceId)).attach("pdf", await makePdfBuffer(), { filename: "b.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(403);
    expect(upload.body.message).toMatch(/^WORKSPACE_READ_ONLY/);
    const sent = await api().post(`/api/send/${draft.body.data.id}`).set(inTeam(member, workspaceId)).send({ recipients: [{ name: "Asha Rao", email: "asha@example.test" }], fields: [signatureField("sig-1", "asha@example.test")] });
    expect(sent.status).toBe(403);

    const listed = await api().get("/api/pdf/my-documents").set(inTeam(member, workspaceId));
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).toContain(String(draft.body.data.id));

    // Paying again opens it
    await api().post("/api/billing/dev-pay").set(owner.auth).send({ kind: "plan", item: "business_monthly", seats: 3 });
    expect((await Workspace.findById(workspaceId)).status).toBe("active");
  });

  it("keeps a record of who did what for the team's activity view", async () => {
    const { owner, workspaceId } = await teamOf(3);
    const member = await join(workspaceId);
    const { pdfId } = await sendInTeam(member, workspaceId);
    expect(await PdfAudit.countDocuments({ pdfId })).toBeGreaterThan(0);

    const activity = await api().get(`/api/workspaces/${workspaceId}/activity`).set(inTeam(owner, workspaceId));
    expect(activity.status).toBe(200);
    expect(activity.body.data.some((entry) => entry.event === "sent" && String(entry.documentId) === pdfId)).toBe(true);
  });
});
