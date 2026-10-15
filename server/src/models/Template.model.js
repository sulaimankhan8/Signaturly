import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The workspace whose members share this template. `userId` above is who saved it.
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    sourcePdfPath: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    pageCount: {
      type: Number,
      required: true,
      default: 1,
    },
    roles: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true }, // e.g. "Client", "Manager", "Witness"
        color: { type: String, default: "#3b82f6" },
        signingOrder: { type: Number, default: 1 },
      },
    ],
    fields: [
      {
        id: { type: String, required: true },
        roleId: { type: String, required: true },
        roleName: { type: String, required: true },
        roleColor: { type: String, default: "#3b82f6" },
        type: { type: String, required: true },
        page: { type: Number, required: true, default: 1 },
        xPercent: { type: Number, required: true },
        yPercent: { type: Number, required: true },
        widthPercent: { type: Number, required: true },
        heightPercent: { type: Number, required: true },
        fontSizePercent: { type: Number },
        label: { type: String },
        required: { type: Boolean, default: true },
        // Text: a hint shown in the empty field, what it accepts, and words the sender fills in
        placeholder: { type: String },
        format: { type: String },
        value: { type: String },
        readOnly: { type: Boolean },
        // Dropdown: the choices
        options: { type: [String], default: undefined },
        // Radio: the options that answer one question share a group
        groupId: { type: String },
      },
    ],
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Template = mongoose.model("Template", templateSchema);
