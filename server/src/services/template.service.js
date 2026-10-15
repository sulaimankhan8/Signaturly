import { Template } from "../models/Template.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sha256FromBuffer } from "./hash.service.js";
import { sendDocumentToRecipients } from "./send.service.js";
import path from "path";
import { saveFile, readFile, fileExists } from "./storage.service.js";
import { assertRecordAccess, recordsIn } from "./authorize.service.js";
import { PDFDocument } from "pdf-lib";
import { watermarkTestDocument } from "./pdfUpload.service.js";
import { normalizeFieldList } from "./fieldRules.service.js";

export const createTemplate = async ({
  userId,
  name,
  description = "",
  file = null,
  sourcePdfId = null,
  roles = [],
  fields = [],
  workspaceId = null,
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
    // Only a document the caller can read can become a template
    const existingPdf = await Pdf.findOne({ _id: String(sourcePdfId), deletedAt: null });
    if (!existingPdf) throw new ApiError(404, "Source PDF not found");
    await assertRecordAccess(existingPdf, userId, "document.read", { notFound: "Source PDF not found", hideFromOutsiders: true });
    sourcePdfPath = existingPdf.storagePath;
    originalFileName = existingPdf.originalFileName;
    pageCount = existingPdf.pageCount;
  } else {
    throw new ApiError(400, "A PDF file or source PDF reference is required");
  }

  const templateRoles = roles.length > 0 ? roles : [
    { id: "role-1", name: "Signer 1", color: "#3b82f6", signingOrder: 1 },
  ];

  const template = await Template.create({
    userId,
    workspaceId,
    name: name.trim(),
    description,
    sourcePdfPath,
    originalFileName,
    pageCount,
    roles: templateRoles,
    fields: templateFields(fields, templateRoles, pageCount),
  });

  return template;
};

/**
 * A template's fields, checked like any document's, each belonging to one of the template's roles.
 */
const templateFields = (fields, roles, pageCount) => {
  const byId = new Map((roles || []).map((role) => [String(role.id), role]));
  return normalizeFieldList(fields || [], { pageCount, values: "layout" }).map((field) => {
    const role = byId.get(String(field.roleId || ""));
    if (!role) throw new ApiError(400, `The ${field.type} field on page ${field.page} is not given to any role`);
    return { ...field, roleId: String(role.id), roleName: role.name, roleColor: role.color || "#3b82f6" };
  });
};

// The templates of the workspace the request is working in: a team's shared library, or the user's own
export const getUserTemplates = async (userId, workspace = null) => {
  return Template.find(recordsIn(workspace, userId)).sort({ createdAt: -1 });
};

export const getTemplateById = async (templateId, userId) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  await assertRecordAccess(template, userId, "template.read", { notFound: "Template not found" });
  return template;
};

export const updateTemplate = async (templateId, userId, updates) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  await assertRecordAccess(template, userId, "template.manage", { notFound: "Template not found" });

  if (updates.name) template.name = updates.name.trim();
  if (updates.description !== undefined) template.description = updates.description;
  if (updates.roles) template.roles = updates.roles;
  if (updates.fields || updates.roles) {
    template.fields = templateFields(updates.fields || template.fields, template.roles, template.pageCount);
  }

  await template.save();
  return template;
};

export const deleteTemplate = async (templateId, userId) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  await assertRecordAccess(template, userId, "template.manage", { notFound: "Template not found" });

  await Template.findByIdAndDelete(templateId);
  return { id: templateId };
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
  // Set by a test API key: the document is watermarked and never billed or emailed
  testMode = false,
}) => {
  const template = await Template.findById(templateId);
  if (!template) throw new ApiError(404, "Template not found");
  await assertRecordAccess(template, userId, "template.use", { notFound: "Template not found" });

  const isMissing = !(await fileExists(template.sourcePdfPath));
  if (isMissing) {
    throw new ApiError(404, "Template source PDF file is missing");
  }

  // 1. Read template PDF buffer and save to new user document storage path
  let sourceBuffer = await readFile(template.sourcePdfPath);
  if (testMode) {
    const marked = await PDFDocument.load(sourceBuffer);
    await watermarkTestDocument(marked);
    sourceBuffer = Buffer.from(await marked.save());
  }
  const originalHash = sha256FromBuffer(sourceBuffer);

  const newFileName = `${Date.now()}-${template.originalFileName}`;
  const newRelativeKey = `${userId.toString()}/${newFileName}`;
  const newStoragePath = await saveFile(newRelativeKey, sourceBuffer, "application/pdf");

  // 2. Create new Pdf document record
  const newPdf = await Pdf.create({
    userId,
    workspaceId: template.workspaceId || null,
    testMode,
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
        // The role's fields go to this person
        roleId: String(role.id),
      };
      recipientsData.push(recipientObj);
    }
  }

  if (recipientsData.length === 0) {
    throw new ApiError(400, "Please assign at least one signer to a template role");
  }

  // A role nobody was named for is left out, with its fields
  const filledRoles = new Set(recipientsData.map((r) => r.roleId));
  for (const field of template.fields) {
    instantiatedFields.push(typeof field.toObject === "function" ? field.toObject() : { ...field });
  }
  const fieldsData = instantiatedFields.filter((field) => filledRoles.has(String(field.roleId)));

  // 4. Send document to recipients
  const sendResult = await sendDocumentToRecipients({
    pdfId: newPdf._id,
    userId,
    recipientsData,
    fieldsData,
    signingOrder,
    message,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    pdfId: sendResult.pdfId,
    status: sendResult.status,
    recipientsCount: sendResult.recipientsCount,
  };
};
