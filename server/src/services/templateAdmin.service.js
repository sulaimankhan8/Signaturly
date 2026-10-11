import mongoose from "mongoose";
import { TemplateDefinition } from "../models/TemplateDefinition.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { PACKS } from "../templates/catalogue.js";
import { validateDefinition } from "./templateCatalogue.service.js";
import { checkAnswers } from "./templateText.service.js";
import { renderTemplate } from "./templateRender.service.js";
import { SUPPORTED_LANGUAGES } from "../i18n/messages.js";

/**
 * Managing guided templates from the admin panel (plan task P4-05).
 *
 * The rules that make versions trustworthy:
 *   - Only a draft can be edited. A published version's wording never changes.
 *   - A change to a published template is a new version, drafted from an existing one.
 *   - Publishing makes a version the one new documents use. Documents already sent keep theirs.
 *   - Retiring takes a version out of use; the one before it is used again.
 *   - A review (who, when) can be recorded against any version: it vouches for that exact wording.
 * Every action is written to the version's own history with the admin who took it.
 */

// What an admin may set on a draft. Key, language and version identify the record and never change.
const EDITABLE = ["title", "summary", "pack", "industry", "signatureHint", "stateNotes", "roles", "questions", "body"];

const findVersion = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Template version not found");
  const version = await TemplateDefinition.findById(id);
  if (!version) throw new ApiError(404, "Template version not found");
  return version;
};

const record = (version, action, admin, note = "") => {
  version.history.push({ action, by: admin.id, byEmail: admin.email, at: new Date(), note });
};

const assertSound = (definition) => {
  const problems = validateDefinition(definition);
  if (problems.length > 0) throw new ApiError(400, "The template has problems that must be fixed first", problems);
};

const plain = (version) => (typeof version.toObject === "function" ? version.toObject() : version);

/**
 * Every template with all its versions, newest first, and how many documents each version made.
 */
export const listTemplatesForAdmin = async () => {
  const [versions, usage] = await Promise.all([
    TemplateDefinition.find({}).sort({ key: 1, language: 1, version: -1 }).lean(),
    Pdf.aggregate([
      { $match: { "template.key": { $exists: true } } },
      { $group: { _id: { key: "$template.key", language: "$template.language", version: "$template.version" }, documents: { $sum: 1 } } },
    ]),
  ]);

  const used = new Map(usage.map((row) => [`${row._id.key}:${row._id.language}:${row._id.version}`, row.documents]));
  const templates = new Map();

  for (const version of versions) {
    const id = `${version.key}:${version.language}`;
    if (!templates.has(id)) {
      templates.set(id, { key: version.key, language: version.language, title: version.title, pack: version.pack, packName: PACKS[version.pack]?.name || version.pack, versions: [] });
    }
    templates.get(id).versions.push({
      id: version._id,
      version: version.version,
      status: version.status,
      title: version.title,
      reviewer: version.reviewer || null,
      source: version.source,
      updatedAt: version.updatedAt,
      documents: used.get(`${id}:${version.version}`) || 0,
    });
  }

  const list = [...templates.values()].map((template) => {
    const current = template.versions.find((v) => v.status === "published");
    return { ...template, title: current?.title || template.versions[0].title, currentVersion: current?.version ?? null };
  });

  return {
    templates: list,
    packs: Object.entries(PACKS).map(([id, pack]) => ({ id, name: pack.name, tier: pack.tier })),
    languages: SUPPORTED_LANGUAGES,
  };
};

export const getTemplateVersionForAdmin = async (id) => plain(await findVersion(id));

/**
 * Starts a brand-new template as version 1, in draft.
 */
export const createTemplate = async (input, admin) => {
  const key = String(input?.key || "").trim().toLowerCase();
  const language = String(input?.language || "en").toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(language)) throw new ApiError(400, "That language is not supported");
  if (await TemplateDefinition.exists({ key, language })) {
    throw new ApiError(409, "A template with this key already exists in this language. Open it and start a new version.");
  }

  const definition = {
    key,
    language,
    version: 1,
    pack: input.pack,
    industry: input.industry || "",
    title: String(input.title || "").trim(),
    summary: input.summary || "",
    signatureHint: input.signatureHint || { level: "check", text: "" },
    stateNotes: input.stateNotes || [],
    roles: input.roles || [{ id: "signer", name: "Signer", nameFrom: "signer_name", color: "#3b82f6", signingOrder: 1 }],
    questions: input.questions || [{ id: "signer_name", label: "Signer's full name", type: "text", required: true }],
    body: input.body || [
      { type: "title", text: String(input.title || "").trim() },
      { type: "paragraph", text: "I, **{{signer_name}}**, ..." },
      { type: "signatures" },
    ],
  };
  assertSound(definition);

  const version = new TemplateDefinition({ ...definition, status: "draft", source: "admin", createdBy: admin.id, reviewer: null });
  record(version, "created", admin);
  await version.save();
  return plain(version);
};

/**
 * Starts the next version of a template as a draft, copied from an existing version
 * (the newest, unless another is named). One draft at a time per template and language.
 */
export const createNextVersion = async ({ key, language = "en", from }, admin) => {
  const versions = await TemplateDefinition.find({ key: String(key), language: String(language) }).sort({ version: -1 });
  if (versions.length === 0) throw new ApiError(404, "Template not found");

  const draft = versions.find((v) => v.status === "draft");
  if (draft) throw new ApiError(409, `Version ${draft.version} is still a draft. Publish or delete it before starting another.`);

  const source = from ? versions.find((v) => v.version === Number(from)) : versions[0];
  if (!source) throw new ApiError(404, "The version to copy from was not found");

  const copy = source.toObject();
  const next = new TemplateDefinition({
    ...Object.fromEntries(EDITABLE.map((field) => [field, copy[field]])),
    key: source.key,
    language: source.language,
    legacyId: source.legacyId,
    version: versions[0].version + 1,
    status: "draft",
    source: "admin",
    createdBy: admin.id,
    // A review vouches for exact wording, so it does not carry over to a copy that will be edited
    reviewer: null,
  });
  record(next, "created", admin, `copied from version ${source.version}`);
  await next.save();
  return plain(next);
};

export const updateDraft = async (id, changes, admin) => {
  const version = await findVersion(id);
  if (version.status !== "draft") {
    throw new ApiError(409, "Only a draft can be edited. Start a new version to change a published template.");
  }

  for (const field of EDITABLE) {
    if (changes && field in changes) version[field] = changes[field];
  }
  assertSound(plain(version));

  record(version, "edited", admin);
  await version.save();
  return plain(version);
};

export const deleteDraft = async (id) => {
  const version = await findVersion(id);
  if (version.status !== "draft") throw new ApiError(409, "Only a draft can be deleted. Retire a published version instead.");
  await version.deleteOne();
  return { id };
};

export const publishVersion = async (id, admin) => {
  const version = await findVersion(id);
  if (version.status === "published") return plain(version);
  if (version.status === "retired") throw new ApiError(409, "A retired version cannot be published again. Start a new version from it.");

  assertSound(plain(version));
  version.status = "published";
  record(version, "published", admin);
  await version.save();
  return plain(version);
};

export const retireVersion = async (id, admin) => {
  const version = await findVersion(id);
  if (version.status === "draft") throw new ApiError(409, "A draft is not in use. Delete it instead.");
  if (version.status === "retired") return plain(version);

  version.status = "retired";
  record(version, "retired", admin);
  await version.save();
  return plain(version);
};

/**
 * Records that a lawyer reviewed this exact version, or (with no name) removes that record.
 */
export const setReview = async (id, review, admin) => {
  const version = await findVersion(id);
  if (version.status === "retired") throw new ApiError(409, "A retired version cannot be reviewed");

  const name = typeof review?.name === "string" ? review.name.trim() : "";
  if (!name) {
    version.reviewer = null;
    record(version, "review removed", admin);
  } else {
    const date = new Date(review.date);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, "Enter the date of the review");
    if (date > new Date(Date.now() + 24 * 60 * 60 * 1000)) throw new ApiError(400, "The review date cannot be in the future");
    version.reviewer = { name: name.slice(0, 120), date };
    record(version, "review recorded", admin, name.slice(0, 120));
  }
  await version.save();
  return plain(version);
};

/**
 * Any version drawn as a PDF, drafts included, so it can be read before it is published.
 */
export const previewVersion = async (id, answers) => {
  const version = plain(await findVersion(id));
  assertSound(version);
  const { answers: cleaned } = checkAnswers(version, answers, { partial: true, defaults: false });
  return renderTemplate(version, cleaned);
};
