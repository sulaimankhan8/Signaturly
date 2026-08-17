import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  createTemplate,
  getUserTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  instantiateDocumentFromTemplate,
  getPrebuiltTemplatesList,
  importPrebuiltTemplateToUser,
} from "../services/template.service.js";
import path from "path";

export const createTemplateController = asyncHandler(async (req, res) => {
  const { name, description, sourcePdfId, roles, fields } = req.body;
  
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
  });

  res.status(201).json(new ApiResponse(template, "Template created successfully"));
});

export const getMyTemplatesController = asyncHandler(async (req, res) => {
  const templates = await getUserTemplates(req.user.id);
  
  const formatted = templates.map((t) => {
    const fileName = path.basename(t.sourcePdfPath);
    return {
      ...t.toObject(),
      pdfUrl: `/uploads/templates/${t.userId}/${fileName}`,
    };
  });

  res.status(200).json(new ApiResponse(formatted, "Templates retrieved"));
});

export const getPrebuiltTemplatesController = asyncHandler(async (req, res) => {
  const prebuilt = await getPrebuiltTemplatesList();
  res.status(200).json(new ApiResponse(prebuilt, "Prebuilt templates library retrieved"));
});

export const importPrebuiltTemplateController = asyncHandler(async (req, res) => {
  const { prebuiltId } = req.params;
  const imported = await importPrebuiltTemplateToUser(prebuiltId, req.user.id);
  res.status(201).json(new ApiResponse(imported, "Prebuilt template added to your templates!"));
});

export const getTemplateDetailsController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await getTemplateById(id, req.user.id);

  const fileName = path.basename(template.sourcePdfPath);
  const pdfUrl = `/uploads/templates/${template.userId}/${fileName}`;

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

  const result = await instantiateDocumentFromTemplate({
    templateId: id,
    userId: req.user.id,
    roleSignersMap,
    message,
    expiresAt,
    signingOrder,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, "Document created and sent from template"));
});
