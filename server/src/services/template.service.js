import { Template } from "../models/Template.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sha256FromBuffer } from "./hash.service.js";
import { sendDocumentToRecipients } from "./send.service.js";
import { PREBUILT_TEMPLATES_DEFINITIONS, ensurePrebuiltPdfsExist } from "./prebuiltTemplates.service.js";
import path from "path";
import { saveFile, readFile, fileExists } from "./storage.service.js";

export const createTemplate = async ({
  userId,
  name,
  description = "",
  file = null,
  sourcePdfId = null,
  roles = [],
  fields = [],
}) => {
  let sourcePdfPath = "";
  let originalFileName = "";
  let pageCount = 1;

  if (file) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${Date.now()}-${sanitizedName}`;
    const relativeKey = `templates/${userId.toString()}/${fileName}`;
    sourcePdfPath = await saveFile(relativeKey, file.buffer, "application/pdf");
    originalFileName = file.originalname;

    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(file.buffer);
    pageCount = pdfDoc.getPageCount();
  } else if (sourcePdfId) {
    const existingPdf = await Pdf.findById(sourcePdfId);
    if (!existingPdf) throw new ApiError(404, "Source PDF not found");
    sourcePdfPath = existingPdf.storagePath;
    originalFileName = existingPdf.originalFileName;
    pageCount = existingPdf.pageCount;
  } else {
    throw new ApiError(400, "A PDF file or source PDF reference is required");
  }

  const template = await Template.create({
    userId,
    name: name.trim(),
    description,
    sourcePdfPath,
    originalFileName,
    pageCount,
    roles: roles.length > 0 ? roles : [
      { id: "role-1", name: "Signer 1", color: "#3b82f6", signingOrder: 1 },
    ],
    fields,
  });

  return template;
};

export const getUserTemplates = async (userId) => {
  return Template.find({ userId }).sort({ createdAt: -1 });
};

export const getTemplateById = async (templateId, userId) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  if (template.userId.toString() !== userId) throw new ApiError(403, "Unauthorized");
  return template;
};

export const updateTemplate = async (templateId, userId, updates) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  if (template.userId.toString() !== userId) throw new ApiError(403, "Unauthorized");

  if (updates.name) template.name = updates.name.trim();
  if (updates.description !== undefined) template.description = updates.description;
  if (updates.roles) template.roles = updates.roles;
  if (updates.fields) template.fields = updates.fields;

  await template.save();
  return template;
};

export const deleteTemplate = async (templateId, userId) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  if (template.userId.toString() !== userId) throw new ApiError(403, "Unauthorized");

  await Template.findByIdAndDelete(templateId);
  return { id: templateId };
};

export const getPrebuiltTemplatesList = async () => {
  await ensurePrebuiltPdfsExist();
  return PREBUILT_TEMPLATES_DEFINITIONS.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    pageCount: tpl.pageCount,
    category: tpl.category,
    roles: tpl.roles,
    fieldsCount: tpl.fields.length,
    fileName: tpl.fileName,
  }));
};

export const importPrebuiltTemplateToUser = async (prebuiltId, userId) => {
  await ensurePrebuiltPdfsExist();
  const def = PREBUILT_TEMPLATES_DEFINITIONS.find((t) => t.id === prebuiltId);
  if (!def) throw new ApiError(404, "Prebuilt template not found");

  const prebuiltKey = `templates/prebuilt/${def.fileName}`;
  let buffer;
  const exists = await fileExists(prebuiltKey);
  if (!exists) {
    buffer = await def.generateDoc();
    await saveFile(prebuiltKey, buffer, "application/pdf");
  } else {
    buffer = await readFile(prebuiltKey);
  }

  // Copy to user's templates
  const targetFileName = `${Date.now()}-${def.fileName}`;
  const targetKey = `templates/${userId.toString()}/${targetFileName}`;
  const targetPath = await saveFile(targetKey, buffer, "application/pdf");

  const template = await Template.create({
    userId,
    name: def.name,
    description: def.description,
    sourcePdfPath: targetPath,
    originalFileName: def.fileName,
    pageCount: def.pageCount,
    roles: def.roles,
    fields: def.fields,
  });

  return template;
};

export const instantiateDocumentFromTemplate = async ({
  templateId,
  userId,
  roleSignersMap, // { "role-1": { name: "...", email: "..." } }
  message = "",
  expiresAt = null,
  signingOrder = false,
  ipAddress = "",
  userAgent = "",
}) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  if (template.userId.toString() !== userId) throw new ApiError(403, "Unauthorized");

  const isMissing = !(await fileExists(template.sourcePdfPath));
  if (isMissing) {
    throw new ApiError(404, "Template source PDF file is missing");
  }

  // 1. Read template PDF buffer and save to new user document storage path
  const sourceBuffer = await readFile(template.sourcePdfPath);
  const originalHash = sha256FromBuffer(sourceBuffer);

  const newFileName = `${Date.now()}-${template.originalFileName}`;
  const newRelativeKey = `${userId.toString()}/${newFileName}`;
  const newStoragePath = await saveFile(newRelativeKey, sourceBuffer, "application/pdf");

  // 2. Create new Pdf document record
  const newPdf = await Pdf.create({
    userId,
    originalFileName: template.originalFileName,
    storagePath: newStoragePath,
    originalHash,
    pageCount: template.pageCount,
    status: "draft",
  });

  // 3. Map template roles to actual recipient data and tag fields
  const recipientsData = [];
  const instantiatedFields = [];

  for (const role of template.roles) {
    const signer = roleSignersMap[role.id] || roleSignersMap[role.name];
    if (signer && signer.email) {
      const recipientObj = {
        name: signer.name || role.name,
        email: signer.email,
        role: "signer",
        color: role.color,
        signingOrder: role.signingOrder || 1,
      };
      recipientsData.push(recipientObj);
    }
  }

  if (recipientsData.length === 0) {
    throw new ApiError(400, "Please assign at least one signer to a template role");
  }

  // 4. Send document to recipients
  const sendResult = await sendDocumentToRecipients({
    pdfId: newPdf._id,
    userId,
    recipientsData,
    fields: template.fields,
    signingOrder,
    message,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    pdf: sendResult.pdf,
    recipients: sendResult.recipients,
  };
};
