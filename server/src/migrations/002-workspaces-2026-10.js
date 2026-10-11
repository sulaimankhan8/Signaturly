import { User } from "../models/User.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Template } from "../models/Template.model.js";
import { TemplateDraft } from "../models/TemplateDefinition.model.js";

/**
 * Gives every user a personal workspace and places their existing documents and saved
 * templates in it (plan task P5-01).
 *
 * Nothing is moved between people: a record goes into the personal workspace of the user who
 * already owns it. Team workspaces made before this release keep their members; an owner who
 * was listed among their own workspace's members is taken off that list, since the owner is
 * now recorded once, as the owner.
 *
 * `down` undoes it: it clears the workspace from every record that `up` placed in a personal
 * workspace, and removes the personal workspaces. Records in team workspaces are not touched.
 */
export const name = "002-workspaces-2026-10";

export const up = async () => {
  const counts = { users: 0, workspacesCreated: 0, documents: 0, templates: 0, drafts: 0 };

  const users = await User.find({}).select("_id name").lean();
  for (const user of users) {
    counts.users += 1;
    let workspace = await Workspace.findOne({ ownerId: user._id, personal: true });
    if (!workspace) {
      workspace = await Workspace.create({ ownerId: user._id, personal: true, name: user.name ? `${user.name}'s documents` : "My documents", members: [] });
      counts.workspacesCreated += 1;
    }

    const unplaced = { userId: user._id, $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] };
    counts.documents += (await Pdf.updateMany(unplaced, { $set: { workspaceId: workspace._id } })).modifiedCount;
    counts.templates += (await Template.updateMany(unplaced, { $set: { workspaceId: workspace._id } })).modifiedCount;
    counts.drafts += (await TemplateDraft.collection.updateMany({ userId: user._id, workspaceId: { $exists: false } }, { $set: { workspaceId: workspace._id } })).modifiedCount;
  }

  // The owner is the owner, not also a member
  const teams = await Workspace.find({ personal: { $ne: true } }).select("_id ownerId").lean();
  for (const team of teams) {
    await Workspace.updateOne({ _id: team._id }, { $pull: { members: { userId: team.ownerId } } });
  }

  return counts;
};

export const down = async () => {
  const personal = await Workspace.find({ personal: true }).select("_id").lean();
  const ids = personal.map((workspace) => workspace._id);

  const documents = await Pdf.updateMany({ workspaceId: { $in: ids } }, { $set: { workspaceId: null } });
  const templates = await Template.updateMany({ workspaceId: { $in: ids } }, { $set: { workspaceId: null } });
  await TemplateDraft.collection.updateMany({ workspaceId: { $in: ids } }, { $unset: { workspaceId: 1 } });
  await Workspace.deleteMany({ _id: { $in: ids } });

  return { documents: documents.modifiedCount, templates: templates.modifiedCount, workspacesRemoved: ids.length };
};
