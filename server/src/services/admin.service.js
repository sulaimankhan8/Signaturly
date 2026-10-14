import fs from "fs";
import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit, AUDIT_EVENTS } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { Payment } from "../models/Payment.model.js";
import { Invoice } from "../models/Invoice.model.js";
import { Wallet } from "../models/Wallet.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { Job } from "../models/Job.model.js";
import { TemplateDefinition } from "../models/TemplateDefinition.model.js";
import { AdminAction } from "../models/AdminAction.model.js";
import { WebhookDelivery } from "./webhookDelivery.service.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";
import { upgradeUserPlan, getOrCreateSubscription } from "./subscription.service.js";
import { stopAutoRenew } from "./autoRenew.service.js";
import { revokeSessions } from "./auth.service.js";
import { runJob } from "../jobs/queue.js";
import { PLANS, UNLIMITED, quotaOf, describePlan } from "../config/plans.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { ADMIN_ROLES } from "../middleware/admin.middleware.js";
import { includesOf } from "./entitlements.service.js";

/**
 * What the admin app reads and does (plan tasks AD-01 to AD-11, AD-28 to AD-30).
 *
 * Reading never writes: a list of users does not create subscription rows, and nothing here
 * returns where a file is stored, a signing link or a secret. Every figure comes from the
 * database at the moment it is asked for.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// India has one time zone and no daylight saving, so a fixed offset is exact
const INDIA = "Asia/Kolkata";
const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The calendar day in India that a moment falls on, as YYYY-MM-DD
export const indiaDay = (date) => new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);
// The moment that day begins in India
export const indiaDayStart = (day) => new Date(new Date(`${day}T00:00:00.000Z`).getTime() - INDIA_OFFSET_MS);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containing = (text) => new RegExp(escapeRegex(text), "i");
const paging = ({ page, pageSize }) => ({ skip: (page - 1) * pageSize, limit: pageSize });
const listOf = (items, total, { page, pageSize }, extra = {}) => ({ items, total, page, pageSize, ...extra });

const customers = { role: { $nin: ADMIN_ROLES } };
const adminIds = async () => (await User.find({ role: { $in: ADMIN_ROLES } }).select("_id").lean()).map((u) => u._id);

const stateOf = (user) => (user.deletedAt ? "closed" : user.suspendedAt ? "suspended" : user.emailVerified === false ? "unverified" : "active");

const subscriptionView = (sub) => {
  const plan = sub?.plan || "free";
  const monthlyQuota = sub?.monthlyQuota ?? quotaOf("free");
  return {
    plan,
    status: sub?.status || "free",
    monthlyQuota,
    unlimited: monthlyQuota >= UNLIMITED,
    usedThisMonth: sub?.usedThisMonth ?? 0,
    extraDocuments: sub?.extraDocuments ?? 0,
    seats: sub?.seats ?? 1,
    currentPeriodEnd: sub?.currentPeriodEnd || null,
    gracePeriodEnd: sub?.gracePeriodEnd || null,
    cancelAtPeriodEnd: Boolean(sub?.cancelAtPeriodEnd),
    quotaResetDate: sub?.quotaResetDate || null,
    // Given by an admin, not paid for
    complimentary: Boolean(sub?.complimentary),
    // Renews by itself, and for how much each time (the price when the customer subscribed)
    autoRenew: Boolean(sub?.autoRenew) && plan !== "free",
    renewalAmountInr: sub?.autoRenew ? sub.renewalAmountInr ?? null : null,
    provider: sub?.razorpaySubscriptionId ? "razorpay" : sub?.stripeSubscriptionId ? "stripe" : null,
  };
};

// ----- users -----

const USER_SORTS = { createdAt: "createdAt", name: "name", email: "email", plan: "plan" };

export const listUsers = async (query) => {
  const match = { ...customers };
  if (query.search) {
    const pattern = containing(query.search);
    match.$or = [{ name: pattern }, { email: pattern }];
  }
  if (query.status === "closed") match.deletedAt = { $ne: null };
  if (query.status === "suspended") Object.assign(match, { deletedAt: null, suspendedAt: { $ne: null } });
  if (query.status === "unverified") Object.assign(match, { deletedAt: null, emailVerified: false });
  if (query.status === "active") Object.assign(match, { deletedAt: null, suspendedAt: null, emailVerified: { $ne: false } });

  const direction = query.order === "asc" ? 1 : -1;
  const { skip, limit } = paging(query);

  // An account with no subscription row yet is on the Free plan
  const [found] = await User.aggregate([
    { $match: match },
    { $lookup: { from: Subscription.collection.name, localField: "_id", foreignField: "userId", as: "sub" } },
    { $addFields: { sub: { $first: "$sub" } } },
    { $addFields: { plan: { $ifNull: ["$sub.plan", "free"] } } },
    ...(query.plan ? [{ $match: { plan: query.plan } }] : []),
    {
      $facet: {
        items: [
          { $sort: { [USER_SORTS[query.sort] || "createdAt"]: direction, _id: direction } },
          { $skip: skip },
          { $limit: limit },
          { $project: { name: 1, email: 1, createdAt: 1, emailVerified: 1, deletedAt: 1, suspendedAt: 1, "twoFactor.enabled": 1, sub: 1 } },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]).collation({ locale: "en", strength: 2 });

  const ids = found.items.map((u) => u._id);
  const counts = await Pdf.aggregate([
    { $match: { userId: { $in: ids }, deletedAt: null } },
    { $group: { _id: "$userId", total: { $sum: 1 }, signed: { $sum: { $cond: [{ $eq: ["$status", "signed"] }, 1, 0] } } } },
  ]);
  const countOf = new Map(counts.map((row) => [String(row._id), row]));

  const items = found.items.map((u) => {
    const sub = subscriptionView(u.sub);
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      state: stateOf(u),
      twoFactor: Boolean(u.twoFactor?.enabled),
      plan: sub.plan,
      planStatus: sub.status,
      monthlyQuota: sub.monthlyQuota,
      unlimited: sub.unlimited,
      usedThisMonth: sub.usedThisMonth,
      complimentary: sub.complimentary,
      documents: { total: countOf.get(String(u._id))?.total || 0, signed: countOf.get(String(u._id))?.signed || 0 },
    };
  });

  return listOf(items, found.total[0]?.n || 0, query);
};

const findCustomer = async (id) => {
  const user = await User.findById(id).lean();
  if (!user || ADMIN_ROLES.includes(user.role)) throw new ApiError(404, "User not found");
  return user;
};

export const getUser = async (id) => {
  const user = await findCustomer(id);

  const [sub, payments, wallet, workspaces, apiKeys, webhooks, byStatus, recent] = await Promise.all([
    Subscription.findOne({ userId: id }).lean(),
    Payment.find({ userId: id }).sort({ occurredAt: -1 }).limit(20).lean(),
    Wallet.findOne({ userId: id }).select("balancePaise").lean(),
    Workspace.find({ $or: [{ ownerId: id, personal: { $ne: true } }, { "members.userId": id }] }).select("name ownerId status members").lean(),
    ApiKey.countDocuments({ userId: id, status: "active" }),
    Webhook.countDocuments({ userId: id }),
    Pdf.aggregate([{ $match: { userId: user._id, deletedAt: null } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Pdf.find({ userId: id }).select(DOCUMENT_FIELDS).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const grants = [...(sub?.adminGrants || [])].reverse();
  const [granters, invoices] = await Promise.all([
    User.find({ _id: { $in: grants.map((g) => g.adminId).filter(Boolean) } }).select("email").lean(),
    Invoice.find({ paymentId: { $in: payments.map((p) => p._id) } }).select("number paymentId").lean(),
  ]);
  const emailOf = new Map(granters.map((g) => [String(g._id), g.email]));
  const invoiceOf = new Map(invoices.map((i) => [String(i.paymentId), { id: i._id, number: i.number }]));

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      state: stateOf(user),
      emailVerified: user.emailVerified !== false,
      twoFactor: Boolean(user.twoFactor?.enabled),
      closedAt: user.deletedAt || null,
      suspendedAt: user.suspendedAt || null,
      suspendedReason: user.suspendedReason || "",
      termsAcceptedAt: user.termsAcceptedAt || null,
      billing: user.billing || {},
    },
    subscription: subscriptionView(sub),
    grants: grants.map((g) => ({ plan: g.plan, at: g.at, adminEmail: emailOf.get(String(g.adminId)) || "", reason: g.reason || "", periodEnd: g.periodEnd || null, quota: g.quota ?? null })),
    payments: payments.map((p) => paymentRow(p, invoiceOf)),
    walletBalancePaise: wallet?.balancePaise || 0,
    workspaces: workspaces.map((w) => ({
      id: w._id,
      name: w.name,
      role: String(w.ownerId) === String(id) ? "owner" : w.members.find((m) => String(m.userId) === String(id))?.role || "member",
      status: w.status,
      // The owner is not listed among the members
      people: w.members.length + 1,
    })),
    apiKeys,
    webhooks,
    documents: {
      byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.n])),
      recent: recent.map((pdf) => documentRow(pdf)),
    },
  };
};

/**
 * Puts an account on a plan without a payment.
 *
 * `days` is how long the plan lasts; without it the plan's own period is used (a month or a
 * year). Nothing renews a plan given this way, so at the end of that time the account goes
 * through the usual grace period and back to Free. The allowance is the plan's own unless a
 * custom one is given.
 */
export const grantPlan = async (id, { plan, reason, days, customQuota, seats }, admin) => {
  const user = await findCustomer(id);
  if (user.deletedAt) throw new ApiError(409, "This account is closed");

  const before = subscriptionView(await Subscription.findOne({ userId: id }).lean());
  const sub = await upgradeUserPlan(id, plan, { seats: PLANS[plan].perSeat ? seats : undefined, grantedByAdmin: admin.email });

  const lasts = plan !== "free" && plan !== "lifetime";
  if (days && lasts) sub.currentPeriodEnd = new Date(Date.now() + days * DAY_MS);
  if (customQuota) sub.monthlyQuota = customQuota;

  sub.adminGrants.push({ adminId: admin.id, plan, reason, periodEnd: sub.currentPeriodEnd, quota: sub.monthlyQuota });
  await sub.save();

  return { user, before, subscription: subscriptionView(sub.toObject()) };
};

export const resetUsage = async (id) => {
  const user = await findCustomer(id);
  const sub = await getOrCreateSubscription(id);
  const before = sub.usedThisMonth;
  sub.usedThisMonth = 0;
  await sub.save();
  return { user, before, subscription: subscriptionView(sub.toObject()) };
};

/**
 * Stops an account being used: it cannot sign in, its sessions and API keys stop working.
 * Documents it has already sent can still be signed, since the signers did nothing wrong.
 */
export const suspendUser = async (id, reason) => {
  const user = await findCustomer(id);
  if (user.deletedAt) throw new ApiError(409, "This account is closed");
  if (user.suspendedAt) throw new ApiError(409, "This account is already suspended");

  await User.updateOne({ _id: id }, { $set: { suspendedAt: new Date(), suspendedReason: reason } });
  await revokeSessions(id);
  return user;
};

export const restoreUser = async (id) => {
  const user = await findCustomer(id);
  if (!user.suspendedAt) throw new ApiError(409, "This account is not suspended");
  await User.updateOne({ _id: id }, { $set: { suspendedAt: null, suspendedReason: "" } });
  return user;
};

// ----- subscriptions: plans that renew by themselves -----

// How a subscription stands: renewing, renewing with a payment overdue, or turned off and running out
const SUBSCRIPTION_STATES = {
  active: { autoRenew: true, status: "active" },
  overdue: { autoRenew: true, status: "past_due" },
  ending: { autoRenew: { $ne: true }, cancelAtPeriodEnd: true, status: "active" },
};
const subscriptionStateOf = (sub) => (sub.autoRenew ? (sub.status === "past_due" ? "overdue" : "active") : "ending");

/**
 * Every account whose plan renews by itself, and those that turned that off and are running
 * out their paid time.
 */
export const listSubscriptions = async (query) => {
  const match = { userId: { $nin: await adminIds() }, plan: { $ne: "free" } };
  if (query.plan) match.plan = query.plan;
  if (query.state) Object.assign(match, SUBSCRIPTION_STATES[query.state]);
  else match.$or = Object.values(SUBSCRIPTION_STATES);

  const { skip, limit } = paging(query);
  const [items, total] = await Promise.all([
    Subscription.find(match)
      .select("userId plan status seats autoRenew renewalAmountInr currentPeriodEnd gracePeriodEnd cancelAtPeriodEnd razorpaySubscriptionId stripeSubscriptionId")
      .populate("userId", "name email")
      .sort({ currentPeriodEnd: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(match),
  ]);

  return listOf(
    items.map((sub) => ({
      id: sub._id,
      account: sub.userId ? { id: sub.userId._id, name: sub.userId.name, email: sub.userId.email } : null,
      plan: sub.plan,
      seats: PLANS[sub.plan]?.perSeat ? sub.seats || 1 : null,
      state: subscriptionStateOf(sub),
      // What each renewal charges: the price when the customer subscribed
      amountInr: sub.autoRenew ? sub.renewalAmountInr ?? null : null,
      // The next charge for one that renews; the last day for one that is ending
      periodEnd: sub.currentPeriodEnd || null,
      gracePeriodEnd: sub.gracePeriodEnd || null,
      provider: sub.razorpaySubscriptionId ? "razorpay" : sub.stripeSubscriptionId ? "stripe" : null,
      providerSubscriptionId: sub.razorpaySubscriptionId || sub.stripeSubscriptionId || null,
      // Made in development, with no payment provider behind it
      simulated: String(sub.razorpaySubscriptionId || "").startsWith("sim_sub_"),
    })),
    total,
    query
  );
};

/**
 * Turns off auto-renew for an account, as the customer could themselves. They keep the time
 * already paid for.
 */
export const stopUserAutoRenew = async (id) => {
  const user = await findCustomer(id);
  const before = subscriptionView(await Subscription.findOne({ userId: id }).lean());
  await stopAutoRenew(id);
  return { user, before, subscription: subscriptionView(await Subscription.findOne({ userId: id }).lean()) };
};

// ----- documents -----

// What a list shows. Where the file is kept, its fields and its lock are never selected.
const DOCUMENT_FIELDS = "originalFileName status createdAt sealedAt sealedKey deletedAt testMode pageCount recipients template userId";

const documentRow = (pdf) => ({
  id: pdf._id,
  name: pdf.originalFileName,
  status: pdf.status,
  createdAt: pdf.createdAt,
  sealedAt: pdf.sealedAt || null,
  sealed: Boolean(pdf.sealedKey),
  deletedAt: pdf.deletedAt || null,
  testMode: Boolean(pdf.testMode),
  pageCount: pdf.pageCount,
  signers: pdf.recipients?.length || 0,
  template: pdf.template?.key || null,
  owner: pdf.userId && typeof pdf.userId === "object" && "email" in pdf.userId ? { id: pdf.userId._id, name: pdf.userId.name, email: pdf.userId.email } : null,
});

export const listDocuments = async (query) => {
  const match = {};
  if (query.status) match.status = query.status;
  if (query.owner) match.userId = query.owner;
  if (query.show === "live") Object.assign(match, { deletedAt: null, testMode: { $ne: true } });
  if (query.show === "deleted") match.deletedAt = { $ne: null };
  if (query.show === "test") match.testMode = true;
  if (query.search) {
    const pattern = containing(query.search);
    const owners = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select("_id").limit(200).lean();
    match.$or = [{ originalFileName: pattern }, { userId: { $in: owners.map((o) => o._id) } }];
  }

  const { skip, limit } = paging(query);
  const [items, total] = await Promise.all([
    Pdf.find(match).select(DOCUMENT_FIELDS).populate("userId", "name email").sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Pdf.countDocuments(match),
  ]);
  return listOf(items.map(documentRow), total, query);
};

export const getDocument = async (id) => {
  const pdf = await Pdf.findById(id)
    .select(`${DOCUMENT_FIELDS} originalHash sealedHash expiresAt signingOrder declineReason workspaceId updatedAt`)
    .populate("userId", "name email")
    .lean();
  if (!pdf) throw new ApiError(404, "Document not found");

  const [recipients, trail, chain, workspace] = await Promise.all([
    Recipient.find({ pdfId: id })
      .sort({ signingOrder: 1, createdAt: 1 })
      .select("name email phone channel role signingOrder status signedAt viewedAt authMethod signatureType delivery declineReason")
      .lean(),
    PdfAudit.find({ pdfId: id }).sort({ seq: 1, createdAt: 1 }).select(AUDIT_FIELDS).lean(),
    verifyAuditChainIntegrity(id),
    pdf.workspaceId ? Workspace.findById(pdf.workspaceId).select("name personal").lean() : null,
  ]);

  return {
    document: {
      ...documentRow(pdf),
      updatedAt: pdf.updatedAt,
      originalHash: pdf.originalHash,
      sealedHash: pdf.sealedHash || null,
      expiresAt: pdf.expiresAt || null,
      signingOrder: Boolean(pdf.signingOrder),
      declineReason: pdf.declineReason || "",
      templateVersion: pdf.template?.version ?? null,
      workspace: workspace && !workspace.personal ? workspace.name : null,
    },
    recipients: recipients.map((r) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      channel: r.channel,
      role: r.role,
      signingOrder: r.signingOrder,
      status: r.status,
      signedAt: r.signedAt || null,
      viewedAt: r.viewedAt || null,
      authMethod: r.authMethod,
      signatureType: r.signatureType,
      delivery: r.delivery?.status || null,
      deliveryError: r.delivery?.lastError || null,
      declineReason: r.declineReason || "",
    })),
    trail: trail.map((entry) => auditRow(entry)),
    // The result of checking the chain now, not a label
    chain: {
      intact: chain.isChainValid,
      entries: chain.logsCount,
      reason: chain.reason || null,
      brokenAtSeq: chain.brokenAtSeq ?? null,
    },
  };
};

export const documentExists = async (id) => Boolean(await Pdf.exists({ _id: id }));

// ----- the audit log -----

const AUDIT_FIELDS = "pdfId seq event actorName actorEmail description ipAddress authMethod createdAt";

const auditRow = (entry) => ({
  id: entry._id,
  seq: entry.seq ?? null,
  event: entry.event,
  actorName: entry.actorName || "",
  actorEmail: entry.actorEmail || "",
  description: entry.description || "",
  ipAddress: entry.ipAddress || "",
  authMethod: entry.authMethod || "",
  at: entry.createdAt,
  document:
    entry.pdfId && typeof entry.pdfId === "object" && "originalFileName" in entry.pdfId
      ? { id: entry.pdfId._id, name: entry.pdfId.originalFileName, status: entry.pdfId.status }
      : undefined,
});

const dayRange = ({ from, to }) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = indiaDayStart(from);
  if (to) range.$lt = new Date(indiaDayStart(to).getTime() + DAY_MS);
  return range;
};

export const listAudit = async (query) => {
  const match = {};
  if (query.event) match.event = query.event;
  if (query.document) match.pdfId = query.document;
  const range = dayRange(query);
  if (range) match.createdAt = range;

  const { skip, limit } = paging(query);
  const [items, total] = await Promise.all([
    PdfAudit.find(match).select(AUDIT_FIELDS).populate("pdfId", "originalFileName status").sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    PdfAudit.countDocuments(match),
  ]);
  return listOf(items.map(auditRow), total, query);
};

// ----- money -----

const paymentRow = (payment, invoiceOf) => ({
  id: payment._id,
  kind: payment.kind,
  provider: payment.provider,
  plan: payment.plan,
  item: payment.item,
  seats: payment.seats,
  // In the currency's main unit: rupees, not paise
  amount: payment.amount,
  currency: payment.currency,
  occurredAt: payment.occurredAt,
  invoice: invoiceOf.get(String(payment._id)) || null,
  account: payment.userId && typeof payment.userId === "object" && "email" in payment.userId ? { id: payment.userId._id, name: payment.userId.name, email: payment.userId.email } : undefined,
});

export const listPayments = async (query) => {
  const match = {};
  if (query.kind) match.kind = query.kind;
  if (query.provider) match.provider = query.provider;
  if (query.user) match.userId = query.user;
  const range = dayRange(query);
  if (range) match.occurredAt = range;

  const { skip, limit } = paging(query);
  const [payments, total] = await Promise.all([
    Payment.find(match).populate("userId", "name email").sort({ occurredAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(match),
  ]);
  const invoices = await Invoice.find({ paymentId: { $in: payments.map((p) => p._id) } }).select("number paymentId").lean();
  const invoiceOf = new Map(invoices.map((i) => [String(i.paymentId), { id: i._id, number: i.number }]));

  return listOf(payments.map((p) => paymentRow(p, invoiceOf)), total, query);
};

export const getInvoiceForAdmin = async (id) => {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw new ApiError(404, "Invoice not found");
  return invoice;
};

// ----- the overview -----

const RANGES = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };

// What an active subscription is worth in a month at list price
const monthlyValue = (plan, seats) => {
  const details = PLANS[plan];
  if (!details?.priceInr) return 0;
  const price = details.priceInr * (details.perSeat ? seats : 1);
  return details.interval === "year" ? price / 12 : details.interval === "month" ? price : 0;
};

const perDay = (model, match, dateField, extraStages = [], sum = 1) =>
  model.aggregate([
    { $match: match },
    ...extraStages,
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: INDIA } }, n: { $sum: sum } } },
  ]);

// Leaves out documents made with a test API key, which are not real work
const realDocumentsOnly = [
  { $lookup: { from: Pdf.collection.name, localField: "pdfId", foreignField: "_id", as: "pdf" } },
  { $match: { "pdf.testMode": { $ne: true } } },
];

export const getOverview = async ({ range = "30d" } = {}) => {
  const now = new Date();
  const days = RANGES[range] || 30;
  const today = indiaDay(now);
  const dayList = Array.from({ length: days }, (_, i) => indiaDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
  const since = indiaDayStart(dayList[0]);
  // The same number of days just before, for what each figure is measured against
  const before = { $gte: new Date(since.getTime() - days * DAY_MS), $lt: since };
  const past24h = new Date(now.getTime() - DAY_MS);
  const monthStart = indiaDayStart(`${today.slice(0, 7)}-01`);
  const lastMonthStart = indiaDayStart(`${indiaDay(new Date(monthStart.getTime() - DAY_MS)).slice(0, 7)}-01`);

  const admins = await adminIds();
  const realDocuments = { deletedAt: null, testMode: { $ne: true } };
  const paid = { kind: { $ne: "failed" }, currency: /^inr$/i };

  const [
    accounts, newAccounts24h, closedAccounts,
    plans, documentStatuses, completed24h,
    receivedByKind, receivedLastMonth, failedPayments30d,
    signupsByDay, createdByDay, completedByDay, receivedByDay,
    attention,
    signupsBefore, createdBefore, completedBefore, receivedBefore,
  ] = await Promise.all([
    User.countDocuments({ ...customers, deletedAt: null }),
    User.countDocuments({ ...customers, deletedAt: null, createdAt: { $gte: past24h } }),
    User.countDocuments({ ...customers, deletedAt: { $ne: null } }),
    Subscription.aggregate([
      { $match: { userId: { $nin: admins }, plan: { $ne: "free" }, status: { $in: ["active", "past_due"] } } },
      { $group: { _id: { plan: "$plan", status: "$status", complimentary: { $ifNull: ["$complimentary", false] } }, accounts: { $sum: 1 }, seats: { $sum: { $ifNull: ["$seats", 1] } } } },
    ]),
    Pdf.aggregate([{ $match: realDocuments }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    PdfAudit.aggregate([{ $match: { event: "completed", createdAt: { $gte: past24h } } }, ...realDocumentsOnly, { $count: "n" }]),
    Payment.aggregate([{ $match: { ...paid, occurredAt: { $gte: monthStart } } }, { $group: { _id: "$kind", amount: { $sum: "$amount" }, payments: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { ...paid, occurredAt: { $gte: lastMonthStart, $lt: monthStart } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    Payment.countDocuments({ kind: "failed", occurredAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) } }),
    perDay(User, { ...customers, createdAt: { $gte: since } }, "createdAt"),
    perDay(Pdf, { testMode: { $ne: true }, createdAt: { $gte: since } }, "createdAt"),
    perDay(PdfAudit, { event: "completed", createdAt: { $gte: since } }, "createdAt", realDocumentsOnly),
    perDay(Payment, { ...paid, occurredAt: { $gte: since } }, "occurredAt", [], "$amount"),
    needsAttention(now),
    User.countDocuments({ ...customers, createdAt: before }),
    Pdf.countDocuments({ testMode: { $ne: true }, createdAt: before }),
    PdfAudit.aggregate([{ $match: { event: "completed", createdAt: before } }, ...realDocumentsOnly, { $count: "n" }]),
    Payment.aggregate([{ $match: { ...paid, occurredAt: before } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
  ]);

  // One row per plan that is sold or still held, in the catalogue's order
  const planRows = Object.keys(PLANS)
    .filter((id) => id !== "free")
    .map((id) => {
      const rows = plans.filter((row) => row._id.plan === id);
      const paying = rows.filter((row) => row._id.status === "active" && !row._id.complimentary);
      return {
        plan: id,
        accounts: rows.reduce((sum, row) => sum + row.accounts, 0),
        seats: rows.reduce((sum, row) => sum + row.seats, 0),
        complimentary: rows.filter((row) => row._id.complimentary).reduce((sum, row) => sum + row.accounts, 0),
        pastDue: rows.filter((row) => row._id.status === "past_due").reduce((sum, row) => sum + row.accounts, 0),
        monthlyValue: Math.round(paying.reduce((sum, row) => sum + monthlyValue(id, row.seats / row.accounts) * row.accounts, 0)),
      };
    });
  const onPaidPlan = planRows.reduce((sum, row) => sum + row.accounts, 0);

  const kinds = Object.fromEntries(receivedByKind.map((row) => [row._id, { amount: row.amount, payments: row.payments }]));
  const valueOn = (rows) => {
    const map = new Map(rows.map((row) => [row._id, row.n]));
    return (day) => map.get(day) || 0;
  };
  const [signups, created, completed, received] = [signupsByDay, createdByDay, completedByDay, receivedByDay].map(valueOn);
  const dayRows = dayList.map((day) => ({ day, signups: signups(day), documentsCreated: created(day), documentsCompleted: completed(day), received: received(day) }));
  const sumOf = (key) => dayRows.reduce((sum, row) => sum + row[key], 0);

  return {
    range,
    asOf: now,
    accounts: { total: accounts, new24h: newAccounts24h, closed: closedAccounts, onPaidPlan, free: Math.max(0, accounts - onPaidPlan) },
    money: {
      currency: "INR",
      // Taken from the payments the providers reported
      receivedThisMonth: Object.values(kinds).reduce((sum, kind) => sum + kind.amount, 0),
      receivedLastMonth: receivedLastMonth[0]?.amount || 0,
      byKind: kinds,
      failedPayments30d,
      // An estimate: paying subscriptions at list price. Plans given by an admin are left out.
      mrrEstimate: planRows.reduce((sum, row) => sum + row.monthlyValue, 0),
      mrrUsesFromPrice: planRows.some((row) => PLANS[row.plan].priceIsFrom && row.monthlyValue > 0),
    },
    plans: planRows,
    documents: {
      byStatus: Object.fromEntries(documentStatuses.map((row) => [row._id, row.n])),
      total: documentStatuses.reduce((sum, row) => sum + row.n, 0),
      completed24h: completed24h[0]?.n || 0,
    },
    days: dayRows,
    // The period's totals, and the same for the period of the same length just before it
    period: { signups: sumOf("signups"), documentsCreated: sumOf("documentsCreated"), documentsCompleted: sumOf("documentsCompleted"), received: sumOf("received") },
    previous: { signups: signupsBefore, documentsCreated: createdBefore, documentsCompleted: completedBefore[0]?.n || 0, received: receivedBefore[0]?.amount || 0 },
    attention,
  };
};

// Things that will not fix themselves
const needsAttention = async (now = new Date()) => {
  const [failedJobs, failedDeliveries24h, unreviewedTemplates, unsealed, pastDue] = await Promise.all([
    Job.countDocuments({ status: "failed" }),
    WebhookDelivery.countDocuments({ status: "failed", createdAt: { $gte: new Date(now.getTime() - DAY_MS) } }),
    TemplateDefinition.countDocuments({ status: "published", reviewer: null }),
    // Signed more than ten minutes ago and still without its sealed copy
    Pdf.countDocuments({ status: "signed", sealedKey: null, deletedAt: null, updatedAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) } }),
    Subscription.countDocuments({ status: "past_due" }),
  ]);
  return { failedJobs, failedDeliveries24h, unreviewedTemplates, unsealed, pastDue };
};

// ----- how the service is running -----

const CONNECTION = ["disconnected", "connected", "connecting", "disconnecting"];

const serverVersion = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;
  } catch {
    return null;
  }
})();

export const getSystem = async () => {
  const now = new Date();
  const [jobs, oldestWaiting, deliveries24h, attention] = await Promise.all([
    Job.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Job.findOne({ status: "pending", runAfter: { $lte: now } }).sort({ runAfter: 1 }).select("runAfter type").lean(),
    WebhookDelivery.aggregate([{ $match: { createdAt: { $gte: new Date(now.getTime() - DAY_MS) } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    needsAttention(now),
    User.countDocuments({ ...customers, createdAt: before }),
    Pdf.countDocuments({ testMode: { $ne: true }, createdAt: before }),
    PdfAudit.aggregate([{ $match: { event: "completed", createdAt: before } }, ...realDocumentsOnly, { $count: "n" }]),
    Payment.aggregate([{ $match: { ...paid, occurredAt: before } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
  ]);

  return {
    asOf: now,
    database: CONNECTION[mongoose.connection.readyState] || "unknown",
    startedAt: new Date(now.getTime() - process.uptime() * 1000),
    version: serverVersion,
    // The deployed revision, where the host names one
    revision: process.env.K_REVISION || process.env.GIT_SHA || null,
    node: process.version,
    environment: env.nodeEnv,
    storage: env.storageProvider,
    jobs: {
      byStatus: Object.fromEntries(jobs.map((row) => [row._id, row.n])),
      // A job that is due and has not run means the scheduler is not calling in
      oldestWaiting: oldestWaiting ? { type: oldestWaiting.type, since: oldestWaiting.runAfter } : null,
    },
    deliveries24h: Object.fromEntries(deliveries24h.map((row) => [row._id, row.n])),
    switchedOn: {
      billing: env.billingEnabled,
      messaging: env.messagingEnabled,
      usageCharging: env.usageChargingEnabled,
      unreviewedTemplates: env.templatesAllowUnreviewed,
      aadhaarEsign: Boolean(env.esignProvider),
      adminTwoStep: env.adminRequire2fa,
      publicPageRebuild: Boolean(env.clientDeployHookUrl),
    },
    attention,
  };
};

// ----- background work -----

export const listJobs = async (query) => {
  const match = {};
  if (query.status) match.status = query.status;
  if (query.type) match.type = query.type;

  const { skip, limit } = paging(query);
  const [items, total, types] = await Promise.all([
    // The payload is left out: it can name people, and the type and error say what went wrong
    Job.find(match).select("type status attempts maxAttempts runAfter lastError createdAt finishedAt").sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(match),
    Job.distinct("type"),
  ]);
  return listOf(items.map(({ _id, ...job }) => ({ id: _id, ...job })), total, query, { types: types.sort() });
};

/**
 * Gives a job that used up its attempts a fresh set, and tries it at once.
 * Job handlers are written to be safe to run twice, which is what makes this safe.
 */
export const retryJob = async (id) => {
  const job = await Job.findOneAndUpdate(
    { _id: id, status: "failed" },
    { $set: { status: "pending", attempts: 0, runAfter: new Date(), finishedAt: null, lockedUntil: null } },
    { new: true }
  );
  if (!job) throw new ApiError(409, "Only a job that has failed can be run again");

  const outcome = await runJob(job._id);
  const after = await Job.findById(job._id).select("status lastError").lean();
  return { id: job._id, type: job.type, outcome, status: after?.status, lastError: after?.lastError || null };
};

export const listDeliveries = async (query) => {
  const match = {};
  if (query.status) match.status = query.status;

  const { skip, limit } = paging(query);
  const [items, total] = await Promise.all([
    WebhookDelivery.find(match)
      .select("event status attempts responseStatus lastError createdAt deliveredAt webhookId userId")
      .populate("userId", "name email")
      .populate("webhookId", "url")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WebhookDelivery.countDocuments(match),
  ]);

  return listOf(
    items.map((d) => ({
      id: d._id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      responseStatus: d.responseStatus,
      lastError: d.lastError || "",
      createdAt: d.createdAt,
      deliveredAt: d.deliveredAt || null,
      url: d.webhookId?.url || null,
      account: d.userId ? { id: d.userId._id, name: d.userId.name, email: d.userId.email } : null,
    })),
    total,
    query
  );
};

// ----- what admins did -----

export const listActivity = async (query) => {
  const match = {};
  if (query.action) match.action = query.action;
  if (query.target) match.targetId = query.target;

  const { skip, limit } = paging(query);
  const [items, total, actions] = await Promise.all([
    AdminAction.find(match).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    AdminAction.countDocuments(match),
    AdminAction.distinct("action"),
  ]);

  return listOf(
    items.map((a) => ({ id: a._id, at: a.at, adminEmail: a.adminEmail, action: a.action, targetType: a.targetType, targetId: a.targetId, summary: a.summary, ipAddress: a.ipAddress })),
    total,
    query,
    { actions: actions.sort() }
  );
};

// ----- what the app needs to draw itself -----

export const getMeta = (admin) => ({
  admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  plans: Object.keys(PLANS).map((id) => ({ ...describePlan(id), ...includesOf(PLANS[id]) })),
  documentStatuses: Pdf.schema.path("status").enumValues,
  auditEvents: AUDIT_EVENTS,
  paymentKinds: Payment.schema.path("kind").enumValues,
  jobStatuses: Job.schema.path("status").enumValues,
});
