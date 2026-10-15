import mongoose from "mongoose";
import { ContactList, BulkBatch } from "../models/ContactList.model.js";
import { Template } from "../models/Template.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { assertWorkspaceAccess, assertRecordAccess, assertTwoFactorRule, roleCan, belongsTo } from "./authorize.service.js";
import { reserveQuota, releaseQuota, getOrCreateSubscription } from "./subscription.service.js";
import { limitOf } from "./entitlements.service.js";
import { instantiateDocumentFromTemplate } from "./template.service.js";
import { normalizePhone } from "./messaging/index.js";
import { normalizeLanguage } from "../i18n/messages.js";
import { enqueueJob, registerJobHandler } from "../jobs/queue.js";

/**
 * Saved contact lists, and sending one template to everyone on a list (plan task P5-07).
 */

const MAX_CONTACTS = 2000;
const isId = (value) => mongoose.isValidObjectId(String(value));

// A list or batch opened by its id is checked against its own workspace, whichever one the
// request says it is working in
const workspaceFor = async (workspaceId, userId, action) => {
  const workspace = await Workspace.findById(isId(workspaceId) ? String(workspaceId) : null).lean();
  assertWorkspaceAccess(workspace, userId, action);
  await assertTwoFactorRule(workspace, userId);
  return workspace;
};

/**
 * Tidies a list of people, from a form or a spreadsheet. Returns the rows that can be used and,
 * for each row that cannot, its number and the reason, so the sender can fix the spreadsheet.
 */
export const cleanContacts = (rows) => {
  const contacts = [];
  const problems = [];
  const seen = new Set();

  (Array.isArray(rows) ? rows : []).slice(0, MAX_CONTACTS + 1).forEach((row, index) => {
    const line = index + 1;
    const name = typeof row?.name === "string" ? row.name.trim().slice(0, 120) : "";
    const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
    const phone = row?.phone ? normalizePhone(String(row.phone)) : "";

    if (!name) return problems.push({ row: line, error: "No name" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return problems.push({ row: line, error: `"${email}" is not an email address` });
    if (row?.phone && !phone) return problems.push({ row: line, error: `"${row.phone}" is not a mobile number` });
    if (!email && !phone) return problems.push({ row: line, error: "No email address or mobile number" });

    const key = email || phone;
    if (seen.has(key)) return problems.push({ row: line, error: `${key} appears more than once` });
    seen.add(key);

    contacts.push({ name, email, phone, label: typeof row?.label === "string" ? row.label.trim().slice(0, 60) : "", language: normalizeLanguage(row?.language) });
    return null;
  });

  if (contacts.length > MAX_CONTACTS) throw new ApiError(400, `A list can hold at most ${MAX_CONTACTS} people`);
  return { contacts, problems };
};

/**
 * Reads a spreadsheet saved as CSV. The first line names the columns; "name" and either
 * "email" or "phone" are needed, "label" and "language" are optional. Quoted cells may
 * contain commas.
 */
export const parseContactsCsv = (text) => {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new ApiError(400, "The file needs a heading line and at least one person");

  const cells = (line) => {
    const out = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") {
        out.push(cell);
        cell = "";
      } else cell += char;
    }
    out.push(cell);
    return out.map((value) => value.trim());
  };

  const headings = cells(lines[0]).map((heading) => heading.toLowerCase());
  const column = (...names) => headings.findIndex((heading) => names.includes(heading));
  const columns = { name: column("name", "full name"), email: column("email", "email address"), phone: column("phone", "mobile", "mobile number"), label: column("label", "flat", "flat no", "unit", "code"), language: column("language") };
  if (columns.name < 0) throw new ApiError(400, 'The file needs a column called "name"');
  if (columns.email < 0 && columns.phone < 0) throw new ApiError(400, 'The file needs a column called "email" or "phone"');

  return lines.slice(1).map((line) => {
    const row = cells(line);
    const value = (index) => (index >= 0 ? row[index] || "" : "");
    return { name: value(columns.name), email: value(columns.email), phone: value(columns.phone), label: value(columns.label), language: value(columns.language) };
  });
};

const summary = (list) => ({ id: list._id, name: list.name, count: list.contacts.length, updatedAt: list.updatedAt });

export const listContactLists = async (workspaceId, userId) => {
  await workspaceFor(workspaceId, userId, "contacts.read");
  return (await ContactList.find({ workspaceId }).sort({ name: 1 }).lean()).map(summary);
};

export const getContactList = async (listId, userId) => {
  const list = isId(listId) ? await ContactList.findById(String(listId)).lean() : null;
  if (!list) throw new ApiError(404, "List not found");
  await workspaceFor(list.workspaceId, userId, "contacts.read");
  return { ...summary(list), contacts: list.contacts };
};

export const saveContactList = async ({ listId, workspaceId, userId, name, rows }) => {
  await workspaceFor(workspaceId, userId, "contacts.write");
  const title = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (!title) throw new ApiError(400, "Give the list a name");

  const { contacts, problems } = cleanContacts(rows);
  if (contacts.length === 0) throw new ApiError(400, "The list has nobody in it who can be sent to", problems);

  try {
    const list = listId
      ? await ContactList.findOneAndUpdate({ _id: String(listId), workspaceId }, { $set: { name: title, contacts } }, { new: true })
      : await ContactList.create({ workspaceId, createdBy: userId, name: title, contacts });
    if (!list) throw new ApiError(404, "List not found");
    return { ...summary(list), problems };
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, "This workspace already has a list with that name");
    throw err;
  }
};

export const deleteContactList = async (listId, userId) => {
  const list = isId(listId) ? await ContactList.findById(String(listId)) : null;
  if (!list) throw new ApiError(404, "List not found");
  await workspaceFor(list.workspaceId, userId, "contacts.write");
  await list.deleteOne();
};

// ---------- bulk send ----------

const progressOf = (batch) => {
  const count = (status) => batch.rows.filter((row) => row.status === status).length;
  return {
    id: batch._id,
    templateName: batch.templateName,
    createdAt: batch.createdAt,
    total: batch.rows.length,
    sent: count("sent"),
    failed: count("failed"),
    pending: count("pending"),
    failures: batch.rows.filter((row) => row.status === "failed").map((row) => ({ row: row.index + 1, name: row.name, email: row.email, error: row.error })),
  };
};

/**
 * Starts sending one saved template to every person on a list, or to the rows given.
 * The documents are counted against the plan now; each row is then sent by its own job.
 * A row that cannot be sent gives its document back to the allowance.
 */
export const startBulkSend = async ({ user, workspace, billingUserId, templateId, listId, rows, message = "" }) => {
  if (!isId(templateId)) throw new ApiError(400, "Choose a template");
  if (!roleCan(workspace.role, "document.send")) throw new ApiError(403, "Your role in this workspace does not allow that");
  const template = await Template.findById(String(templateId));
  // The documents are counted against this workspace, so the template must be one of its own
  if (!belongsTo(template, workspace)) throw new ApiError(404, "Template not found");
  await assertRecordAccess(template, user.id, "template.use", { notFound: "Template not found" });
  if (!template.roles || template.roles.length !== 1) {
    throw new ApiError(400, "Bulk send needs a template with exactly one signer");
  }

  let people = rows;
  if (listId) {
    const list = await getContactList(listId, user.id);
    people = list.contacts;
  }
  const { contacts, problems } = cleanContacts(people);
  const reachable = contacts.filter((contact) => contact.email);
  if (reachable.length === 0) throw new ApiError(400, "Nobody on the list has an email address to send to", problems);

  const most = limitOf(await getOrCreateSubscription(billingUserId), "bulkSendMax");
  if (reachable.length > most) {
    throw new ApiError(403, `UPGRADE_REQUIRED: Your plan sends to at most ${most} people at a time. This list has ${reachable.length}.`);
  }

  await reserveQuota(billingUserId, reachable.length);

  let batch;
  try {
    batch = await BulkBatch.create({
      workspaceId: workspace.id,
      userId: user.id,
      billingUserId,
      templateId: template._id,
      templateName: template.name,
      listId: listId || null,
      message: typeof message === "string" ? message.slice(0, 2000) : "",
      rows: reachable.map((contact, index) => ({ index, name: contact.name, email: contact.email, label: contact.label })),
    });
  } catch (err) {
    await releaseQuota(billingUserId, reachable.length);
    throw err;
  }

  for (const row of batch.rows) {
    await enqueueJob("bulk.row", { batchId: batch._id.toString(), index: row.index }, { idempotencyKey: `bulk:${batch._id}:${row.index}:0`, maxAttempts: 3 });
  }

  return { ...progressOf(batch), skipped: [...problems, ...contacts.filter((c) => !c.email).map((c) => ({ row: null, error: `${c.name} has no email address` }))] };
};

export const getBulkBatch = async (batchId, userId) => {
  const batch = isId(batchId) ? await BulkBatch.findById(String(batchId)).lean() : null;
  if (!batch) throw new ApiError(404, "Bulk send not found");
  await workspaceFor(batch.workspaceId, userId, "document.read");
  return progressOf(batch);
};

export const listBulkBatches = async (workspaceId, userId) => {
  await workspaceFor(workspaceId, userId, "document.read");
  return (await BulkBatch.find({ workspaceId }).sort({ createdAt: -1 }).limit(30).lean()).map(progressOf);
};

/**
 * Sends the failed rows of a bulk send again. Each is counted against the plan again, since
 * its document was given back when it failed.
 */
export const retryBulkBatch = async (batchId, userId) => {
  const batch = isId(batchId) ? await BulkBatch.findById(String(batchId)) : null;
  if (!batch) throw new ApiError(404, "Bulk send not found");
  await workspaceFor(batch.workspaceId, userId, "document.send");

  const failed = batch.rows.filter((row) => row.status === "failed");
  if (failed.length === 0) return progressOf(batch);

  await reserveQuota(batch.billingUserId, failed.length);
  for (const row of failed) {
    await BulkBatch.updateOne({ _id: batch._id, "rows.index": row.index }, { $set: { "rows.$.status": "pending", "rows.$.error": "" }, $inc: { "rows.$.attempts": 1 } });
    await enqueueJob("bulk.row", { batchId: batch._id.toString(), index: row.index }, { idempotencyKey: `bulk:${batch._id}:${row.index}:${row.attempts + 1}`, maxAttempts: 3 });
  }
  return progressOf(await BulkBatch.findById(batch._id).lean());
};

/**
 * The job that sends one row. Registered with the other job handlers at start-up.
 */
export const registerBulkJobHandlers = () => {
  registerJobHandler(
    "bulk.row",
    async ({ batchId, index }) => {
      const batch = await BulkBatch.findById(batchId);
      const row = batch?.rows.find((r) => r.index === index);
      // Already sent by an earlier attempt of this job
      if (!row || row.status === "sent") return;

      const template = await Template.findById(batch.templateId);
      if (!template) throw new Error("The template no longer exists");

      const sent = await instantiateDocumentFromTemplate({
        templateId: batch.templateId.toString(),
        userId: batch.userId.toString(),
        roleSignersMap: { [template.roles[0].id]: { name: row.name, email: row.email } },
        message: batch.message,
      });

      await BulkBatch.updateOne({ _id: batch._id, "rows.index": index }, { $set: { "rows.$.status": "sent", "rows.$.pdfId": sent.pdfId, "rows.$.error": "" } });
    },
    {
      // Every attempt failed: record why on the row and give its document back to the allowance
      onFailed: async ({ batchId, index }, message) => {
        const batch = await BulkBatch.findOneAndUpdate(
          { _id: batchId, rows: { $elemMatch: { index, status: "pending" } } },
          { $set: { "rows.$.status": "failed", "rows.$.error": String(message || "Could not be sent").slice(0, 300) } }
        );
        if (batch) await releaseQuota(batch.billingUserId, 1);
      },
    }
  );
};
