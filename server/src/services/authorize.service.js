import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.model.js";
import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Who may do what (plan task P5-02).
 *
 * Every permission check on a document, template or workspace goes through this file. A route
 * says which action it performs; the table below says which roles may perform it.
 *
 * Roles, from most to least: owner, admin, member, viewer. Each role can do everything the
 * roles below it can.
 */

export const ROLES = ["viewer", "member", "admin", "owner"];

// The lowest role that may perform each action
const REQUIRED_ROLE = {
  "document.read": "viewer",
  "activity.read": "viewer",
  "template.read": "viewer",
  "contacts.read": "viewer",

  "document.create": "member",
  "document.send": "member",
  "document.remind": "member",
  "template.use": "member",
  "contacts.write": "member",

  // A member may void or delete a document they sent themselves; anyone else's needs an admin
  "document.void": "admin",
  "document.delete": "admin",
  "template.manage": "admin",
  "member.manage": "admin",
  "branding.manage": "admin",
  "policy.manage": "admin",
  "developer.manage": "admin",

  "billing.manage": "owner",
  "workspace.delete": "owner",
};

// Actions that change nothing, and so stay allowed when a workspace is read-only
const READ_ACTIONS = new Set(["document.read", "activity.read", "template.read", "contacts.read"]);

// Actions the person who created a document may take on it whatever their role is above viewer
const CREATOR_ACTIONS = new Set(["document.void", "document.delete"]);

export const ACTIONS = Object.keys(REQUIRED_ROLE);

export const isReadAction = (action) => READ_ACTIONS.has(action);

const rank = (role) => ROLES.indexOf(role);

/**
 * Whether a role may perform an action. Unknown actions are refused, loudly: a typo in a
 * route must not become a permission nobody checks.
 */
export const roleCan = (role, action) => {
  if (!(action in REQUIRED_ROLE)) throw new Error(`Unknown action: ${action}`);
  return rank(role) >= 0 && rank(role) >= rank(REQUIRED_ROLE[action]);
};

/**
 * A user's role in a workspace, or null when they have no part in it.
 */
export const roleOf = (workspace, userId) => {
  if (!workspace || !userId) return null;
  const id = String(userId);
  if (String(workspace.ownerId?._id || workspace.ownerId) === id) return "owner";
  const member = (workspace.members || []).find((m) => String(m.userId?._id || m.userId) === id);
  return member && member.status !== "suspended" ? member.role : null;
};

const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a?._id || a) === String(b?._id || b);

/**
 * Plan task P5-09: a team can require two-step sign-in. Someone without it may see the team and
 * leave it, and do nothing else in it: no document, template, contact list, activity or setting.
 *
 * The person is `who`: as the request knows them ({ id, twoFactorEnabled, ssoWorkspaceId }), or
 * only their id, in which case their account is read. A session started through the team's own
 * single sign-on meets the rule, because the organisation's identity provider asks for the
 * second step.
 */
export const twoFactorRequired = () =>
  new ApiError(403, "TWO_FACTOR_REQUIRED: This workspace requires two-step sign-in. Switch it on in your settings to continue.");

// Whether the person signs in to this workspace with a second step
export const hasSecondStep = (workspace, who) => Boolean(who?.twoFactorEnabled) || sameId(who?.ssoWorkspaceId, workspace?._id || workspace?.id);

export const meetsTwoFactorRule = (workspace, who) => !workspace?.policy?.requireTwoFactor || hasSecondStep(workspace, who);

const twoFactorStateOf = async (userId) => {
  const user = mongoose.isValidObjectId(userId) ? await User.findById(String(userId)).select("twoFactor.enabled ssoSessionWorkspaceId").lean() : null;
  return { twoFactorEnabled: Boolean(user?.twoFactor?.enabled), ssoWorkspaceId: user?.ssoSessionWorkspaceId || null };
};

export const assertTwoFactorRule = async (workspace, who) => {
  if (!workspace?.policy?.requireTwoFactor) return;
  const person = typeof who?.twoFactorEnabled === "boolean" ? who : await twoFactorStateOf(who);
  if (!meetsTwoFactorRule(workspace, person)) throw twoFactorRequired();
};

// The same, for the workspace a document or template belongs to
export const assertTwoFactorRuleFor = async (record, who) => {
  if (record?.workspaceId) await assertTwoFactorRule(await Workspace.findById(record.workspaceId).select("policy").lean(), who);
};

/**
 * Checks that a user may perform an action in a workspace, and returns their role.
 * Someone with no part in the workspace is told it does not exist, not that it is forbidden.
 */
export const assertWorkspaceAccess = (workspace, userId, action) => {
  const role = roleOf(workspace, userId);
  if (!role) throw new ApiError(404, "Workspace not found");
  if (!roleCan(role, action)) throw new ApiError(403, "Your role in this workspace does not allow that");
  if (workspace.status !== "active" && !READ_ACTIONS.has(action)) {
    throw new ApiError(403, "WORKSPACE_READ_ONLY: This workspace is read-only. Its owner needs to renew the plan.");
  }
  return role;
};

/**
 * Checks that a user may perform an action on a document or a saved template.
 *
 * A record belongs to a workspace. In a personal workspace only its owner has any access.
 * In a team workspace access follows the user's role, with one addition: the member who
 * created a document may void or delete it.
 *
 * Records made before workspaces existed have no workspace and belong to their creator alone.
 */
export const assertRecordAccess = async (record, userId, action, { notFound = "Document not found", hideFromOutsiders = false } = {}) => {
  if (!record) throw new ApiError(404, notFound);
  const isCreator = sameId(record.userId, userId);
  // With hideFromOutsiders, someone with no part in the record is told it does not exist,
  // the same answer as for an id that was never used
  const outsider = () => (hideFromOutsiders ? new ApiError(404, notFound) : new ApiError(403, "Not authorized for this document"));

  if (!record.workspaceId) {
    if (!isCreator) throw outsider();
    return "owner";
  }

  const workspace = await Workspace.findById(record.workspaceId).lean();
  const role = roleOf(workspace, userId);
  if (!role) throw outsider();

  const allowed = roleCan(role, action) || (isCreator && CREATOR_ACTIONS.has(action) && roleCan(role, "document.create"));
  if (!allowed) throw new ApiError(403, "Your role in this workspace does not allow that");
  // Checked here, by the record's own workspace, whichever workspace the app says it is working in
  await assertTwoFactorRule(workspace, userId);

  if (workspace.status !== "active" && !READ_ACTIONS.has(action)) {
    throw new ApiError(403, "WORKSPACE_READ_ONLY: This workspace is read-only. Its owner needs to renew the plan.");
  }
  return role;
};

/**
 * Whether a record is one of the workspace's own. A record from before workspaces existed
 * belongs to its creator's personal workspace.
 */
export const belongsTo = (record, workspace) => {
  if (!record || !workspace) return false;
  if (record.workspaceId) return sameId(record.workspaceId, workspace.id);
  return Boolean(workspace.personal) && sameId(record.userId, workspace.ownerId);
};

/**
 * The filter that lists the records of the workspace a request is working in.
 * In a personal workspace that also takes in the user's records from before workspaces existed.
 */
export const recordsIn = (workspace, userId) => {
  if (!workspace) return { userId };
  const workspaceId = new mongoose.Types.ObjectId(String(workspace.id));
  return workspace.personal ? { userId, $or: [{ workspaceId }, { workspaceId: null }, { workspaceId: { $exists: false } }] } : { workspaceId };
};
