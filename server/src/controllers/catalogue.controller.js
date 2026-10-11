import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  listCatalogue,
  getCatalogueTemplate,
  previewCatalogueTemplate,
  saveCatalogueDraft,
  deleteCatalogueDraft,
  sendFromCatalogue,
} from "../services/templateCatalogue.service.js";
import { describeEntitlements } from "../services/entitlements.service.js";
import { getOrCreateSubscription, reserveQuota, releaseQuota } from "../services/subscription.service.js";
import { assertCanWorkIn } from "../services/workspace.service.js";

const languageOf = (req) => (typeof req.query.language === "string" ? req.query.language : req.body?.language);

export const listCatalogueController = asyncHandler(async (req, res) => {
  const catalogue = await listCatalogue(req.user.id, languageOf(req));
  res.status(200).json(new ApiResponse(catalogue, "Template catalogue"));
});

export const getCatalogueTemplateController = asyncHandler(async (req, res) => {
  const template = await getCatalogueTemplate(req.user.id, req.params.key, languageOf(req));
  res.status(200).json(new ApiResponse(template, "Template loaded"));
});

// The preview is the PDF itself. What is still missing travels beside it in a header.
export const previewCatalogueTemplateController = asyncHandler(async (req, res) => {
  const { buffer, pageCount, errors, version } = await previewCatalogueTemplate({
    userId: req.user.id,
    key: req.params.key,
    language: languageOf(req),
    answers: req.body?.answers,
    today: req.body?.today,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Page-Count", String(pageCount));
  res.setHeader("X-Template-Version", String(version));
  res.setHeader("X-Unanswered", Object.keys(errors).join(","));
  res.setHeader("Access-Control-Expose-Headers", "X-Page-Count, X-Template-Version, X-Unanswered");
  res.status(200).end(buffer);
});

export const saveCatalogueDraftController = asyncHandler(async (req, res) => {
  const saved = await saveCatalogueDraft({
    userId: req.user.id,
    key: req.params.key,
    language: languageOf(req),
    answers: req.body?.answers,
    signers: req.body?.signers,
  });
  res.status(200).json(new ApiResponse(saved, "Draft saved"));
});

export const deleteCatalogueDraftController = asyncHandler(async (req, res) => {
  await deleteCatalogueDraft(req.user.id, req.params.key);
  res.status(200).json(new ApiResponse({}, "Draft removed"));
});

export const sendFromCatalogueController = asyncHandler(async (req, res) => {
  const { answers, signers, message, expiresAt, signingOrder, today } = req.body || {};

  // The document is made in the workspace the sender is working in, if their role there sends documents
  assertCanWorkIn(req, "document.send");

  // A document made from a template counts against the plan like any other
  await reserveQuota(req.billingUserId || req.user.id, 1);

  let result;
  try {
    result = await sendFromCatalogue({
      userId: req.user.id,
      workspaceId: req.workspace?.id || null,
      key: req.params.key,
      language: languageOf(req),
      answers,
      signers,
      message,
      expiresAt,
      signingOrder,
      today,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    await releaseQuota(req.billingUserId || req.user.id, 1);
    throw err;
  }

  res.status(200).json(new ApiResponse(result, "Document created from the template and sent"));
});

// What this account's plan includes, for the app to show or hide features
export const getEntitlementsController = asyncHandler(async (req, res) => {
  const subscription = await getOrCreateSubscription(req.user.id);
  res.status(200).json(new ApiResponse(describeEntitlements(subscription), "Entitlements"));
});
