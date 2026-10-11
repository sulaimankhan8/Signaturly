import { Router } from "express";
import mongoose from "mongoose";
import { apiKeyAuth, requireScope } from "../middlewares/apiKey.middleware.js";
import { upload } from "../config/multer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { Template } from "../models/Template.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { uplodedPdf } from "../services/pdfUpload.service.js";
import { sendDocumentToRecipients, voidDocument } from "../services/send.service.js";
import { sendManualRecipientReminder } from "../services/reminder.service.js";
import { instantiateDocumentFromTemplate } from "../services/template.service.js";
import { reserveQuota, releaseQuota } from "../services/subscription.service.js";
import { assertRecordAccess, recordsIn, roleCan, belongsTo } from "../services/authorize.service.js";
import { getFileUrl } from "../services/storage.service.js";
import { downloadKeyOf, originalKeyOf, hasSignedCopy } from "../services/documentFiles.service.js";
import { appendAuditEvent } from "../services/auditLedger.service.js";
import { createEmbedSession } from "../services/embed.service.js";
import { listDeliveries, replayDelivery } from "../services/webhookDelivery.service.js";
import { createWebhook, inWorkspace } from "../controllers/api.controller.js";
import { eventBus, EventTypes } from "../events/index.js";

/**
 * The public API, version 1 (plan task P6-10). Described for customers in docs/api/openapi.yaml;
 * a change here that changes what a customer sees belongs in that file too.
 *
 * Every request carries an API key. A live key works on real documents. A test key works only
 * on test documents, which are watermarked, never counted against the plan and never emailed.
 * The two never see each other's documents.
 *
 * Answers are `{ "data": ... }`; lists add `hasMore` and `nextCursor`. Errors use the same
 * shape as the rest of the service, with an HTTP status that says what went wrong.
 */
const router = Router();

router.use(apiKeyAuth);

const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
const context = (req) => ({ ipAddress: req.ip || req.socket?.remoteAddress, userAgent: req.headers["user-agent"] });

// Documents this key can see: its workspace's, of its own kind (live or test)
const visible = (req) => ({
  ...recordsIn(req.workspace, req.user.id),
  deletedAt: null,
  testMode: req.testMode ? true : { $ne: true },
});

const loadDocument = async (req, action) => {
  const pdf = isId(req.params.id) ? await Pdf.findOne({ _id: req.params.id, deletedAt: null }) : null;
  // A live key asking for a test document, or the reverse, is told it does not exist. So is a key
  // asking for a document of another workspace, even one its maker also belongs to.
  if (!pdf || Boolean(pdf.testMode) !== req.testMode || !belongsTo(pdf, req.workspace)) throw new ApiError(404, "Document not found");
  await assertRecordAccess(pdf, req.user.id, action);
  return pdf;
};

const publicRecipient = (recipient, { withLink = false } = {}) => ({
  id: recipient._id,
  name: recipient.name,
  email: recipient.email || null,
  phone: recipient.phone || null,
  role: recipient.role,
  signingOrder: recipient.signingOrder,
  status: recipient.status,
  signatureType: recipient.signatureType || "electronic",
  viewedAt: recipient.viewedAt || null,
  signedAt: recipient.signedAt || null,
  declineReason: recipient.declineReason || null,
  // Test documents are not emailed, so their links are given here to try the signing page out
  ...(withLink ? { signingUrl: `${env.appUrl}/sign/${recipient.token}` } : {}),
});

const publicDocument = (pdf, recipients = null) => ({
  id: pdf._id,
  title: pdf.originalFileName,
  status: pdf.status,
  pageCount: pdf.pageCount,
  test: Boolean(pdf.testMode),
  sealed: Boolean(pdf.sealedKey),
  expiresAt: pdf.expiresAt || null,
  createdAt: pdf.createdAt,
  updatedAt: pdf.updatedAt,
  ...(recipients ? { recipients: recipients.map((r) => publicRecipient(r, { withLink: Boolean(pdf.testMode) })) } : {}),
});

const withRecipients = async (pdf) => publicDocument(pdf, await Recipient.find({ pdfId: pdf._id }).sort({ signingOrder: 1 }));

// ---------- who am I ----------

router.get("/me", (req, res) => {
  res.json({
    data: {
      workspace: { id: req.workspace.id, name: req.workspace.name },
      mode: req.apiKey.mode,
      scopes: req.apiKey.scopes,
    },
  });
});

// ---------- documents ----------

router.get(
  "/documents",
  requireScope("documents:read"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = visible(req);
    if (typeof req.query.status === "string") filter.status = req.query.status;
    // The cursor is the id of the last document of the page before
    if (isId(req.query.cursor)) filter._id = { $lt: new mongoose.Types.ObjectId(req.query.cursor) };

    const found = await Pdf.find(filter).sort({ _id: -1 }).limit(limit + 1);
    const page = found.slice(0, limit);
    res.json({
      data: page.map((pdf) => publicDocument(pdf)),
      hasMore: found.length > limit,
      nextCursor: found.length > limit ? page[page.length - 1]._id : null,
    });
  })
);

// Upload a PDF as multipart form data, in the field "file"
router.post(
  "/documents",
  requireScope("documents:write"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!roleCan(req.workspace.role, "document.create")) throw new ApiError(403, "This key's role in the workspace does not allow that");
    if (req.workspace.status !== "active") throw new ApiError(403, "WORKSPACE_READ_ONLY: This workspace is read-only. Its owner needs to renew the plan.");

    const pdf = await uplodedPdf({ file: req.file, userId: req.user.id, workspaceId: req.workspace.id, testMode: req.testMode });
    await eventBus.emitEvent(EventTypes.DOCUMENT_CREATED, {
      aggregateId: pdf._id,
      actor: { id: req.user.id, name: req.user.name || "API", email: req.user.email || "", ...context(req) },
      payload: { title: pdf.originalFileName, pageCount: pdf.pageCount },
    });
    res.status(201).json({ data: publicDocument(pdf, []) });
  })
);

router.get(
  "/documents/:id",
  requireScope("documents:read"),
  asyncHandler(async (req, res) => {
    res.json({ data: await withRecipients(await loadDocument(req, "document.read")) });
  })
);

/**
 * Send a document for signature. The body names the recipients and where each one's fields go:
 * { recipients: [{ name, email, role, signingOrder, language, authType }],
 *   fields: [{ type, page, xPercent, yPercent, widthPercent, heightPercent, recipientEmail }],
 *   message, expiresAt, signingOrder }
 */
router.post(
  "/documents/:id/send",
  requireScope("documents:write"),
  asyncHandler(async (req, res) => {
    const pdf = await loadDocument(req, "document.send");
    const { recipients, fields, message, expiresAt, signingOrder } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) throw new ApiError(400, "recipients must be a list with at least one person");
    if (recipients.length > 50) throw new ApiError(400, "A document can have at most 50 recipients");

    const billed = !pdf.testMode;
    if (billed) await reserveQuota(req.billingUserId, 1);
    try {
      await sendDocumentToRecipients({
        pdfId: pdf._id.toString(),
        userId: req.user.id,
        recipientsData: recipients,
        fieldsData: Array.isArray(fields) ? fields.slice(0, 500) : [],
        message: typeof message === "string" ? message.slice(0, 2000) : "",
        expiresAt,
        signingOrder: Boolean(signingOrder),
        ...context(req),
      });
    } catch (err) {
      if (billed) await releaseQuota(req.billingUserId, 1);
      throw err;
    }
    res.json({ data: await withRecipients(await Pdf.findById(pdf._id)) });
  })
);

router.post(
  "/documents/:id/void",
  requireScope("documents:write"),
  asyncHandler(async (req, res) => {
    const pdf = await loadDocument(req, "document.void");
    await voidDocument({ pdfId: pdf._id.toString(), userId: req.user.id, ...context(req) });
    res.json({ data: await withRecipients(await Pdf.findById(pdf._id)) });
  })
);

// A short-lived link to the file: the sealed copy once everyone has signed, else the latest version
router.get(
  "/documents/:id/download",
  requireScope("documents:read"),
  asyncHandler(async (req, res) => {
    const pdf = await loadDocument(req, "document.read");
    const signed = await hasSignedCopy(pdf);
    const url = await getFileUrl(signed ? await downloadKeyOf(pdf) : originalKeyOf(pdf));
    res.json({ data: { url, signed, expiresInSeconds: env.fileUrlTtlSeconds } });
  })
);

const loadRecipient = async (req, pdf) => {
  const recipient = isId(req.params.recipientId) ? await Recipient.findOne({ _id: req.params.recipientId, pdfId: pdf._id }) : null;
  if (!recipient) throw new ApiError(404, "Recipient not found");
  return recipient;
};

router.post(
  "/documents/:id/recipients/:recipientId/remind",
  requireScope("documents:write"),
  asyncHandler(async (req, res) => {
    const pdf = await loadDocument(req, "document.remind");
    const recipient = await loadRecipient(req, pdf);
    await sendManualRecipientReminder({
      recipientId: recipient._id.toString(),
      userId: req.user.id,
      customMessage: typeof req.body?.message === "string" ? req.body.message.slice(0, 2000) : "",
      ...context(req),
    });
    res.json({ data: publicRecipient(await Recipient.findById(recipient._id)) });
  })
);

/**
 * Embedded signing (plan task P6-12): returns an address to load in a frame on the customer's
 * own website, for one signer. The website must be on the workspace's list of allowed sites.
 * The signing record says the page was presented by the sender's website, because the sender's
 * website, not an email to the signer, is what put the signer in front of the document.
 */
router.post(
  "/documents/:id/recipients/:recipientId/embed",
  requireScope("documents:write"),
  asyncHandler(async (req, res) => {
    const pdf = await loadDocument(req, "document.send");
    const recipient = await loadRecipient(req, pdf);
    const session = await createEmbedSession({ recipient, pdf, origin: req.body?.origin });

    await appendAuditEvent({
      pdfId: pdf._id,
      userId: req.user.id,
      recipientId: recipient._id,
      event: "recipient_updated",
      actorName: req.user.name || "API",
      actorEmail: req.user.email || "",
      ...context(req),
      description: `An embedded signing session for ${recipient.name} was created through the API. The signing page is presented by the sender's website, ${session.origin}.`,
    });
    res.status(201).json({ data: session });
  })
);

// ---------- templates ----------

router.get(
  "/templates",
  requireScope("templates:read"),
  asyncHandler(async (req, res) => {
    const templates = await Template.find(recordsIn(req.workspace, req.user.id)).sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      data: templates.map((template) => ({
        id: template._id,
        name: template.name,
        pageCount: template.pageCount,
        roles: (template.roles || []).map((role) => ({ id: role.id, name: role.name })),
        createdAt: template.createdAt,
      })),
    });
  })
);

/**
 * Make a document from a saved template and send it.
 * { signers: { "<role id>": { name, email } }, message, expiresAt, signingOrder }
 */
router.post(
  "/templates/:id/documents",
  requireScope("documents:write"),
  asyncHandler(async (req, res) => {
    const template = isId(req.params.id) ? await Template.findById(req.params.id).select("userId workspaceId") : null;
    if (!belongsTo(template, req.workspace)) throw new ApiError(404, "Template not found");
    const { signers, message, expiresAt, signingOrder } = req.body || {};
    if (!signers || typeof signers !== "object" || Array.isArray(signers)) throw new ApiError(400, "signers must map each role id to a name and email");

    const billed = !req.testMode;
    if (billed) await reserveQuota(req.billingUserId, 1);
    let sent;
    try {
      sent = await instantiateDocumentFromTemplate({
        templateId: req.params.id,
        userId: req.user.id,
        roleSignersMap: signers,
        message: typeof message === "string" ? message.slice(0, 2000) : "",
        expiresAt: expiresAt || null,
        signingOrder: Boolean(signingOrder),
        testMode: req.testMode,
        ...context(req),
      });
    } catch (err) {
      if (billed) await releaseQuota(req.billingUserId, 1);
      throw err;
    }
    res.status(201).json({ data: await withRecipients(await Pdf.findById(sent.pdfId)) });
  })
);

// ---------- webhooks ----------

const webhookView = (webhook) => ({ id: webhook._id, url: webhook.url, events: webhook.events, status: webhook.status, createdAt: webhook.createdAt });

router.get(
  "/webhooks",
  requireScope("webhooks:manage"),
  asyncHandler(async (req, res) => {
    res.json({ data: (await Webhook.find(inWorkspace(req)).sort({ createdAt: -1 }).lean()).map(webhookView) });
  })
);

// The signing secret is in the answer to this request and is not shown again
router.post(
  "/webhooks",
  requireScope("webhooks:manage"),
  asyncHandler(async (req, res) => {
    const webhook = await createWebhook({ userId: req.user.id, workspaceId: req.workspace.id, scope: inWorkspace(req), url: req.body?.url, events: req.body?.events });
    res.status(201).json({ data: { id: webhook.id, url: webhook.url, events: webhook.events, status: webhook.status, createdAt: webhook.createdAt, secret: webhook.secret } });
  })
);

router.delete(
  "/webhooks/:id",
  requireScope("webhooks:manage"),
  asyncHandler(async (req, res) => {
    const webhook = isId(req.params.id) ? await Webhook.findOneAndDelete({ _id: req.params.id, ...inWorkspace(req) }) : null;
    if (!webhook) throw new ApiError(404, "Webhook not found");
    res.json({ data: { id: webhook._id, deleted: true } });
  })
);

router.get(
  "/webhooks/:id/deliveries",
  requireScope("webhooks:manage"),
  asyncHandler(async (req, res) => {
    res.json({ data: await listDeliveries(req.params.id, inWorkspace(req)) });
  })
);

router.post(
  "/webhooks/deliveries/:deliveryId/replay",
  requireScope("webhooks:manage"),
  asyncHandler(async (req, res) => {
    res.json({ data: await replayDelivery(req.params.deliveryId, inWorkspace(req)) });
  })
);

export default router;
