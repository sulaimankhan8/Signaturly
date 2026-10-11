import mongoose from "mongoose";

/**
 * A saved list of people a workspace sends to again and again: all flats in a society, all
 * staff, all tenants (plan task P5-07).
 */
const contactListSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    contacts: [
      {
        _id: false,
        name: { type: String, required: true, trim: true, maxlength: 120 },
        email: { type: String, default: "", lowercase: true, trim: true },
        phone: { type: String, default: "" },
        // A flat number, an employee code: anything the sender uses to tell rows apart
        label: { type: String, default: "", maxlength: 60 },
        language: { type: String, default: "en" },
      },
    ],
  },
  { timestamps: true }
);

contactListSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const ContactList = mongoose.model("ContactList", contactListSchema);

/**
 * One bulk send: the same template to every person on a list, one document each.
 * Each row is sent by its own job, so a failure in one row neither stops the rest nor is lost:
 * it is recorded on the row and can be sent again.
 */
const bulkBatchSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Whose plan the documents are counted against
    billingUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template", required: true },
    templateName: { type: String, default: "" },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: "ContactList", default: null },
    message: { type: String, default: "" },
    rows: [
      {
        _id: false,
        index: { type: Number, required: true },
        name: { type: String, required: true },
        email: { type: String, default: "" },
        label: { type: String, default: "" },
        status: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
        error: { type: String, default: "" },
        pdfId: { type: mongoose.Schema.Types.ObjectId, ref: "Pdf", default: null },
        attempts: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

export const BulkBatch = mongoose.model("BulkBatch", bulkBatchSchema);
