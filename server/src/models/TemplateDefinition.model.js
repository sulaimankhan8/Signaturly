import mongoose from "mongoose";

/**
 * A guided template: the questions a sender answers and the text their answers are filled into.
 *
 * One record is one version of one template in one language. A version is never edited once
 * published: a change is a new version, so a document sent last month can always be traced to
 * the exact wording it was made from.
 */
const templateDefinitionSchema = new mongoose.Schema(
  {
    // Stable name of the template, used in links: "rent-agreement-11-month"
    key: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9][a-z0-9-]*$/ },
    version: { type: Number, required: true, min: 1 },
    language: { type: String, required: true, default: "en" },

    status: { type: String, enum: ["draft", "published", "retired"], default: "published", index: true },

    // Which pack it is sold in; the pack decides which plans can use it
    pack: { type: String, required: true, index: true },
    industry: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" },

    // Shown to the sender before sending: is an ordinary e-signature usually enough,
    // does stamp duty or registration apply
    signatureHint: {
      level: { type: String, enum: ["esign_ok", "stamp_duty", "aadhaar_advised", "check"], default: "check" },
      text: { type: String, default: "" },
    },
    stateNotes: [{ _id: false, state: String, name: String, note: String }],

    // The lawyer who reviewed this version. Null means nobody has, and the app says so.
    reviewer: {
      type: new mongoose.Schema({ name: { type: String, required: true }, date: { type: Date, required: true } }, { _id: false }),
      default: null,
    },

    roles: [
      {
        _id: false,
        id: { type: String, required: true },
        name: { type: String, required: true },
        color: { type: String, default: "#3b82f6" },
        signingOrder: { type: Number, default: 1 },
        // Question whose answer is this signer's name
        nameFrom: { type: String },
      },
    ],

    // Shapes of questions and body blocks are checked by validateDefinition in the catalogue service
    questions: { type: Array, default: [] },
    body: { type: Array, default: [] },

    // Id this template had in the old hand-drawn prebuilt list, if it came from there
    legacyId: { type: String },
    source: { type: String, enum: ["seed", "admin"], default: "seed" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // What was done to this version from the admin panel, and by whom
    history: [
      {
        _id: false,
        action: { type: String, required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        byEmail: { type: String },
        at: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true, minimize: false }
);

templateDefinitionSchema.index({ key: 1, language: 1, version: 1 }, { unique: true });

export const TemplateDefinition = mongoose.model("TemplateDefinition", templateDefinitionSchema);

/**
 * A sender's half-filled template, kept so they can come back to it. One per template per sender.
 */
const templateDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The workspace the person was working in when they started it. A draft stays its author's own.
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
    key: { type: String, required: true },
    language: { type: String, default: "en" },
    answers: { type: Object, default: {} },
    signers: { type: Object, default: {} },
  },
  { timestamps: true, minimize: false }
);

templateDraftSchema.index({ userId: 1, key: 1 }, { unique: true });

export const TemplateDraft = mongoose.model("TemplateDraft", templateDraftSchema);
