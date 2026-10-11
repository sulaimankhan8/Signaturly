import { TemplateDefinition, TemplateDraft } from "../models/TemplateDefinition.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { PACKS, SEED_DEFINITIONS } from "../templates/catalogue.js";
import { canUsePack, packUpgradeMessage } from "./entitlements.service.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { checkAnswers, placeholdersIn, KNOWN_FILTERS } from "./templateText.service.js";
import { renderTemplate, BLOCK_TYPES } from "./templateRender.service.js";
import { saveFile } from "./storage.service.js";
import { sha256FromBuffer } from "./hash.service.js";
import { sendDocumentToRecipients } from "./send.service.js";
import { normalizePhone } from "./messaging/index.js";
import { normalizeLanguage } from "../i18n/messages.js";

/**
 * The catalogue of guided templates: what exists, who may use it, and turning one into a
 * document that is sent for signature.
 */

const QUESTION_TYPES = ["text", "longtext", "number", "money", "date", "select", "boolean", "email", "phone"];
const QUESTION_ID = /^[a-z][a-z0-9_]*$/;

/**
 * Everything wrong with a template definition, as a list of sentences. Empty means it is sound.
 * Run on every template that ships with the code and on every one saved from the admin panel,
 * so a broken placeholder is caught before a customer meets it.
 */
export const validateDefinition = (definition) => {
  const problems = [];
  const say = (text) => problems.push(text);

  if (!/^[a-z0-9][a-z0-9-]*$/.test(definition.key || "")) say("key must be lower-case letters, digits and hyphens");
  if (!definition.title) say("title is missing");
  if (!PACKS[definition.pack]) say(`pack "${definition.pack}" does not exist`);
  if (!Number.isInteger(definition.version) || definition.version < 1) say("version must be a whole number from 1");

  const questions = definition.questions || [];
  const seen = new Set();
  for (const question of questions) {
    if (!QUESTION_ID.test(question.id || "")) say(`question id "${question.id}" must be lower-case letters, digits and underscores`);
    if (seen.has(question.id)) say(`question "${question.id}" appears twice`);
    if (!question.label) say(`question "${question.id}" has no label`);
    if (!QUESTION_TYPES.includes(question.type)) say(`question "${question.id}" has unknown type "${question.type}"`);
    if (question.type === "select" && !(question.options?.length > 0)) say(`question "${question.id}" has no options`);
    // A question can only depend on one asked before it
    if (question.showIf && !seen.has(question.showIf.question)) say(`question "${question.id}" depends on "${question.showIf.question}", which is not asked before it`);
    seen.add(question.id);
  }

  const roles = definition.roles || [];
  const roleIds = new Set();
  if (roles.length === 0) say("there are no signers");
  for (const role of roles) {
    if (!role.id || !role.name) say("a signer has no id or name");
    if (roleIds.has(role.id)) say(`signer "${role.id}" appears twice`);
    if (role.nameFrom && !seen.has(role.nameFrom)) say(`signer "${role.id}" takes its name from "${role.nameFrom}", which is not a question`);
    roleIds.add(role.id);
  }

  const checkText = (text, where) => {
    for (const { question, filters } of placeholdersIn(text)) {
      if (!seen.has(question)) say(`${where} uses {{${question}}}, which is not a question`);
      for (const filter of filters) {
        if (!KNOWN_FILTERS.includes(filter)) say(`${where} uses unknown filter "${filter}"`);
      }
    }
    // Text that looks like a placeholder but is not one would be printed as it stands
    const stray = String(text ?? "").replace(/\{\{\s*[\w]+(?:\s*\|\s*[\w]+(?::[-\w.]+)?)*\s*\}\}/g, "");
    if (/\{\{|\}\}/.test(stray)) say(`${where} has a malformed placeholder`);
  };
  const checkCondition = (condition, where) => {
    if (condition && !seen.has(condition.question)) say(`${where} depends on "${condition.question}", which is not a question`);
  };

  const signedRoles = new Set();
  (definition.body || []).forEach((block, index) => {
    const where = `block ${index + 1} (${block.type})`;
    if (!BLOCK_TYPES.includes(block.type)) {
      say(`${where} has an unknown type`);
      return;
    }
    checkCondition(block.showIf, where);
    checkText(block.text, where);
    checkText(block.heading, where);
    for (const item of block.items || []) {
      checkText(typeof item === "string" ? item : item.text, where);
      if (typeof item !== "string") checkCondition(item.showIf, where);
    }
    for (const row of block.rows || []) row.forEach((cell) => checkText(cell, where));

    if (block.type === "signatures") {
      for (const id of block.roles || []) {
        if (!roleIds.has(id)) say(`${where} names signer "${id}", who does not exist`);
      }
      (block.roles || [...roleIds]).forEach((id) => signedRoles.add(id));
    }
  });

  for (const id of roleIds) {
    if (!signedRoles.has(id)) say(`signer "${id}" has nowhere to sign`);
  }

  return problems;
};

/**
 * Copies the templates that ship with the code into the database. A version already there is
 * left exactly as it is, so this can run on every start and after every deploy.
 */
export const syncCatalogue = async () => {
  let inserted = 0;
  for (const definition of SEED_DEFINITIONS) {
    const problems = validateDefinition(definition);
    if (problems.length > 0) {
      throw new Error(`Template "${definition.key}" is not valid: ${problems.join("; ")}`);
    }

    const { key, language, version, ...rest } = definition;
    const result = await TemplateDefinition.updateOne(
      { key, language, version },
      { $setOnInsert: { ...rest, status: "published", source: "seed" } },
      { upsert: true }
    );
    if (result.upsertedCount) inserted += 1;
  }
  return { inserted, total: SEED_DEFINITIONS.length };
};

// A template nobody has reviewed is shown only where that is allowed (never in production by default)
const isOffered = (definition) => definition.status === "published" && (Boolean(definition.reviewer) || env.templatesAllowUnreviewed);

/**
 * The version of a template that new documents are made from: the newest published one in the
 * language asked for, or in English when it has not been translated.
 */
export const currentDefinition = async (key, language = "en") => {
  if (typeof key !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(key)) throw new ApiError(404, "Template not found");

  const candidates = await TemplateDefinition.find({ key, status: "published" }).sort({ version: -1 }).lean();
  const offered = candidates.filter(isOffered);
  const wanted = normalizeLanguage(language);
  const definition = offered.find((d) => d.language === wanted) || offered.find((d) => d.language === "en");
  if (!definition) throw new ApiError(404, "Template not found");
  return definition;
};

const assertAccess = async (userId, definition) => {
  const subscription = await getOrCreateSubscription(userId);
  if (!canUsePack(subscription, definition.pack)) {
    throw new ApiError(403, packUpgradeMessage(definition.pack));
  }
  return subscription;
};

const summaryOf = (definition, { locked, languages }) => ({
  key: definition.key,
  version: definition.version,
  language: definition.language,
  languages,
  title: definition.title,
  summary: definition.summary,
  pack: definition.pack,
  packName: PACKS[definition.pack]?.name || definition.pack,
  requiredTier: PACKS[definition.pack]?.tier || "pro",
  industry: definition.industry,
  locked,
  reviewer: definition.reviewer || null,
  signatureHint: definition.signatureHint,
  signers: (definition.roles || []).map((role) => role.name),
  questionCount: (definition.questions || []).length,
});

/**
 * Every template on offer, newest version of each, marked with whether this account's plan
 * can use it. Locked ones are listed too: seeing what a higher plan holds is the reason to move up.
 */
export const listCatalogue = async (userId, language = "en") => {
  const subscription = await getOrCreateSubscription(userId);
  const all = (await TemplateDefinition.find({ status: "published" }).sort({ version: -1 }).lean()).filter(isOffered);
  const wanted = normalizeLanguage(language);

  const byKey = new Map();
  for (const definition of all) {
    if (!byKey.has(definition.key)) byKey.set(definition.key, []);
    byKey.get(definition.key).push(definition);
  }

  const templates = [...byKey.values()].map((versions) => {
    const chosen = versions.find((d) => d.language === wanted) || versions.find((d) => d.language === "en") || versions[0];
    return summaryOf(chosen, {
      locked: !canUsePack(subscription, chosen.pack),
      languages: [...new Set(versions.map((d) => d.language))].sort(),
    });
  });

  templates.sort((a, b) => Number(a.locked) - Number(b.locked) || a.packName.localeCompare(b.packName) || a.title.localeCompare(b.title));

  return {
    templates,
    packs: Object.entries(PACKS).map(([id, pack]) => ({
      id,
      name: pack.name,
      description: pack.description,
      requiredTier: pack.tier,
      locked: !canUsePack(subscription, id),
      count: templates.filter((t) => t.pack === id).length,
    })),
  };
};

/**
 * One template as the fill-in screen needs it: its questions, signers and notes, and any draft
 * this sender saved. The wording itself is not sent; it reaches the sender as a rendered preview.
 */
export const getCatalogueTemplate = async (userId, key, language) => {
  const definition = await currentDefinition(key, language);
  const subscription = await getOrCreateSubscription(userId);
  const draft = await TemplateDraft.findOne({ userId, key }).lean();

  return {
    ...summaryOf(definition, { locked: !canUsePack(subscription, definition.pack), languages: [definition.language] }),
    stateNotes: definition.stateNotes || [],
    roles: (definition.roles || []).map(({ id, name, color, signingOrder, nameFrom }) => ({ id, name, color, signingOrder, nameFrom })),
    questions: definition.questions || [],
    draft: draft ? { answers: draft.answers || {}, signers: draft.signers || {}, updatedAt: draft.updatedAt } : null,
  };
};

/**
 * What anyone may read about a template without signing in: what it is for, who signs it, what
 * the sender will be asked, and the headings it covers. The wording itself stays behind sign-in.
 */
const publicViewOf = (definition) => ({
  key: definition.key,
  language: definition.language,
  title: definition.title,
  summary: definition.summary,
  pack: definition.pack,
  packName: PACKS[definition.pack]?.name || definition.pack,
  requiredTier: PACKS[definition.pack]?.tier || "pro",
  industry: definition.industry,
  signers: (definition.roles || []).map((role) => role.name),
  questions: (definition.questions || []).map((question) => question.label),
  // A heading that takes its words from an answer has nothing fixed to show
  covers: [...new Set((definition.body || []).filter((block) => block.type === "clause" && block.heading && !block.heading.includes("{{")).map((block) => block.heading))],
  signatureHint: definition.signatureHint,
  stateNotes: definition.stateNotes || [],
  reviewer: definition.reviewer || null,
});

const offeredInEnglish = async () => {
  const all = (await TemplateDefinition.find({ status: "published", language: "en" }).sort({ version: -1 }).lean()).filter(isOffered);
  const newest = new Map();
  for (const definition of all) if (!newest.has(definition.key)) newest.set(definition.key, definition);
  return [...newest.values()];
};

/**
 * Every template on offer, for the public template pages and the site map.
 */
export const listPublicTemplates = async () =>
  (await offeredInEnglish()).map(publicViewOf).sort((a, b) => a.packName.localeCompare(b.packName) || a.title.localeCompare(b.title));

export const getPublicTemplate = async (key) => publicViewOf(await currentDefinition(key, "en"));

// The sender's own date, when they sent a believable one; otherwise today's date in India
const todayFor = (given) => {
  if (typeof given === "string" && /^\d{4}-\d{2}-\d{2}$/.test(given)) return given;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
};

/**
 * The document as it would be sent with the answers given so far. Unanswered questions leave
 * blanks, and `missing` lists what still stands between this preview and a document that can be sent.
 */
export const previewCatalogueTemplate = async ({ userId, key, language, answers, today }) => {
  const definition = await currentDefinition(key, language);
  await assertAccess(userId, definition);

  const day = todayFor(today);
  const partial = checkAnswers(definition, answers, { partial: true, today: day });
  const full = checkAnswers(definition, answers, { today: day });
  const rendered = await renderTemplate(definition, partial.answers);

  return { ...rendered, errors: full.errors, version: definition.version };
};

const cleanSigner = (signer) => {
  const source = signer && typeof signer === "object" ? signer : {};
  const text = (value, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  return {
    name: text(source.name),
    email: text(source.email).toLowerCase(),
    phone: text(source.phone, 30),
    channel: ["sms", "whatsapp"].includes(source.channel) ? source.channel : "email",
    language: normalizeLanguage(source.language),
    authType: source.authType === "otp" ? "otp" : "none",
  };
};

export const saveCatalogueDraft = async ({ userId, key, language, answers, signers }) => {
  const definition = await currentDefinition(key, language);
  await assertAccess(userId, definition);

  // Keep what is valid so far; a draft is allowed to be incomplete
  const { answers: cleaned } = checkAnswers(definition, answers, { partial: true, defaults: false });
  const cleanedSigners = {};
  for (const role of definition.roles || []) {
    if (signers && typeof signers === "object" && signers[role.id]) cleanedSigners[role.id] = cleanSigner(signers[role.id]);
  }

  const draft = await TemplateDraft.findOneAndUpdate(
    { userId, key },
    { $set: { language: definition.language, answers: cleaned, signers: cleanedSigners } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { updatedAt: draft.updatedAt };
};

export const deleteCatalogueDraft = async (userId, key) => {
  await TemplateDraft.deleteOne({ userId, key: String(key) });
};

const fileNameFor = (title) => `${title.replace(/[^A-Za-z0-9 ()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Document"}.pdf`;

/**
 * Makes a document from a template and sends it for signature.
 * Every signer the template names must be given, each reachable at a different address or number.
 */
export const sendFromCatalogue = async ({
  userId,
  workspaceId = null,
  key,
  language,
  answers,
  signers,
  message = "",
  expiresAt = null,
  signingOrder = false,
  today,
  ipAddress = "",
  userAgent = "",
}) => {
  const definition = await currentDefinition(key, language);
  await assertAccess(userId, definition);

  const { answers: cleaned, errors } = checkAnswers(definition, answers, { today: todayFor(today) });
  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, "Some answers are missing or not valid", errors);
  }

  // One recipient per signer the template names
  const roles = [...(definition.roles || [])].sort((a, b) => (a.signingOrder || 1) - (b.signingOrder || 1));
  const contacts = new Set();
  const byRole = new Map();
  const recipientsData = roles.map((role, index) => {
    const signer = cleanSigner(signers?.[role.id]);
    if (!signer.name) throw new ApiError(400, `Enter the name of the ${role.name}`);
    if (!signer.email && !signer.phone) throw new ApiError(400, `Enter an email address or mobile number for the ${role.name}`);

    const contact = signer.email || normalizePhone(signer.phone) || signer.phone;
    if (contacts.has(contact)) {
      throw new ApiError(400, "Each signer needs their own email address or mobile number");
    }
    contacts.add(contact);
    byRole.set(role.id, signer);

    return { ...signer, role: "signer", color: role.color || "#3b82f6", signingOrder: index + 1 };
  });

  const { buffer, pageCount, fields } = await renderTemplate(definition, cleaned);

  const fieldsData = fields.map((field) => {
    const signer = byRole.get(field.roleId);
    return { ...field, recipientEmail: signer.email || undefined, recipientPhone: signer.email ? undefined : signer.phone, recipientName: signer.name };
  });

  const originalFileName = fileNameFor(definition.title);
  const storagePath = await saveFile(`${userId}/${Date.now()}-${definition.key}.pdf`, buffer, "application/pdf");

  const pdf = await Pdf.create({
    userId,
    workspaceId,
    originalFileName,
    storagePath,
    originalHash: sha256FromBuffer(buffer),
    pageCount,
    status: "draft",
    template: { key: definition.key, version: definition.version, language: definition.language },
  });

  try {
    const sent = await sendDocumentToRecipients({
      pdfId: pdf._id,
      userId,
      recipientsData,
      fieldsData,
      signingOrder: Boolean(signingOrder),
      message: typeof message === "string" ? message.slice(0, 2000) : "",
      expiresAt,
      ipAddress,
      userAgent,
    });

    await TemplateDraft.deleteOne({ userId, key: definition.key });
    return { pdfId: sent.pdfId, status: sent.status, recipientsCount: sent.recipientsCount, template: pdf.template };
  } catch (error) {
    // Nothing was sent, so the half-made document should not sit in the sender's list
    await Pdf.deleteOne({ _id: pdf._id, status: "draft" });
    throw error;
  }
};
