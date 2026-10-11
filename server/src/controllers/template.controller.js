import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createTemplate,
  getUserTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  instantiateDocumentFromTemplate,
} from "../services/template.service.js";
import path from "path";
import { getFileUrl } from "../services/storage.service.js";
import { reserveQuota, releaseQuota } from "../services/subscription.service.js";
import { assertCanWorkIn } from "../services/workspace.service.js";
import { billingUserIdOf } from "../services/branding.service.js";
import { Template } from "../models/Template.model.js";
import mongoose from "mongoose";

const templatePdfUrl = (template) =>
  getFileUrl(`templates/${template.userId}/${path.basename(template.sourcePdfPath.replace(/\\/g, "/"))}`);

export const createTemplateController = asyncHandler(async (req, res) => {
  const { name, description, sourcePdfId, roles, fields } = req.body;

  // A template saved in a team is shared with the whole team, so saving one needs the role that manages them
  assertCanWorkIn(req, "template.manage");

  const parsedRoles = typeof roles === "string" ? JSON.parse(roles) : roles;
  const parsedFields = typeof fields === "string" ? JSON.parse(fields) : fields;

  const template = await createTemplate({
    userId: req.user.id,
    name,
    description,
    file: req.file,
    sourcePdfId,
    roles: parsedRoles || [],
    fields: parsedFields || [],
    workspaceId: req.workspace?.id || null,
  });

  res.status(201).json(new ApiResponse(template, "Template created successfully"));
});

export const getMyTemplatesController = asyncHandler(async (req, res) => {
  const templates = await getUserTemplates(req.user.id, req.workspace);
  
  const formatted = await Promise.all(
    templates.map(async (t) => ({
      ...t.toObject(),
      pdfUrl: await templatePdfUrl(t),
    }))
  );

  res.status(200).json(new ApiResponse(formatted, "Templates retrieved"));
});

export const getTemplateDetailsController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await getTemplateById(id, req.user.id);

  const pdfUrl = await templatePdfUrl(template);

  res.status(200).json(
    new ApiResponse(
      {
        ...template.toObject(),
        pdfUrl,
      },
      "Template loaded"
    )
  );
});

export const updateTemplateController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await updateTemplate(id, req.user.id, req.body);
  res.status(200).json(new ApiResponse(updated, "Template updated"));
});

export const deleteTemplateController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await deleteTemplate(id, req.user.id);
  res.status(200).json(new ApiResponse(result, "Template deleted"));
});

export const useTemplateController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roleSignersMap, message, expiresAt, signingOrder } = req.body;

  if (!roleSignersMap || typeof roleSignersMap !== "object") {
    throw new ApiError(400, "Please assign at least one signer to a template role");
  }

  // A document sent from a template counts against the plan like any other: the plan that pays
  // for the workspace the template is in
  const template = mongoose.isValidObjectId(String(id)) ? await Template.findById(String(id)).select("userId workspaceId") : null;
  const payer = template ? await billingUserIdOf(template) : req.user.id;
  await reserveQuota(payer, 1);

  let result;
  try {
    result = await instantiateDocumentFromTemplate({
      templateId: id,
      userId: req.user.id,
      roleSignersMap,
      message,
      expiresAt,
      signingOrder,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
  } catch (err) {
    await releaseQuota(payer, 1);
    throw err;
  }

  res.status(200).json(new ApiResponse(result, "Document created and sent from template"));
});
