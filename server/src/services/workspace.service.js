import mongoose from "mongoose";
import { Workspace, Invitation } from "../models/Workspace.model.js";
import { User } from "../models/User.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Template } from "../models/Template.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { randomToken, sha256Hex } from "../utils/tokens.js";
import { roleOf, roleCan, isReadAction, assertWorkspaceAccess } from "./authorize.service.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { can, tierOf } from "./entitlements.service.js";
import { sendWorkspaceInvitationEmail } from "./email.service.js";

/**
 * Workspaces: the personal one every user has, team workspaces, and who is in them
 * (plan tasks P5-01, P5-04, P5-11).
 */

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);

/**
 * The workspace that holds a user's own documents. Created the first time it is needed.
 */
export const ensurePersonalWorkspace = async (userId, name = "") => {
  const existing = await Workspace.findOne({ ownerId: userId, personal: true });
  if (existing) return existing;
  try {
    return await Workspace.create({ ownerId: userId, personal: true, name: name ? `${name}'s documents` : "My documents", members: [] });
  } catch (err) {
    // Two first requests at once: one creates it, the other reads it
    if (err?.code !== 11000) throw err;
    return Workspace.findOne({ ownerId: userId, personal: true });
  }
};

/**
 * Works out which workspace a request is working in and puts it on the request.
 *
 * The app names it in the X-Workspace-Id header. With no header, or a workspace the user has
 * no part in, the request works in the user's personal workspace: a stale or forged header
 * never gives access to anything.
 *
 *   req.workspace      { id, name, role, personal, ownerId, status }
 *   req.billingUserId  whose plan, allowance and wallet pay: the workspace's owner
 */
export const attachWorkspace = async (req) => {
  const asked = req.headers?.["x-workspace-id"];
  let workspace = null;

  if (isId(asked)) {
    const candidate = await Workspace.findById(asked);
    if (candidate && candidate.status !== "archived" && roleOf(candidate, req.user.id)) workspace = candidate;
  }
  if (!workspace) workspace = await ensurePersonalWorkspace(req.user.id, req.user.name);

  req.workspace = {
    id: workspace._id.toString(),
    name: workspace.name,
    role: roleOf(workspace, req.user.id),
    personal: Boolean(workspace.personal),
    ownerId: workspace.ownerId.toString(),
    status: workspace.status,
    requireTwoFactor: Boolean(workspace.policy?.requireTwoFactor),
  };
  req.billingUserId = req.workspace.ownerId;
};

/**
 * Plan task P5-09: a workspace can require two-step sign-in. A member without it can still
 * reach the pages that set it up, and nothing else in that workspace.
 */
export const assertTwoFactorPolicy = (req) => {
  if (req.workspace?.requireTwoFactor && !req.user.twoFactorEnabled) {
    throw new ApiError(403, "TWO_FACTOR_REQUIRED: This workspace requires two-step sign-in. Switch it on in your settings to continue.");
  }
};

/**
 * Whether the person may do this in the workspace the request is working in. For actions that
 * make something new there (an upload, a template, a send from the catalogue), where there is
 * no existing record to check against.
 */
export const assertCanWorkIn = (req, action) => {
  assertTwoFactorPolicy(req);
  if (!roleCan(req.workspace?.role, action)) throw new ApiError(403, "Your role in this workspace does not allow that");
  if (req.workspace.status !== "active" && !isReadAction(action)) {
    throw new ApiError(403, "WORKSPACE_READ_ONLY: This workspace is read-only. Its owner needs to renew the plan.");
  }
};

const publicWorkspace = (workspace, userId) => ({
  id: workspace._id,
  name: workspace.name,
  personal: Boolean(workspace.personal),
  status: workspace.status,
  role: roleOf(workspace, userId),
  owner: workspace.ownerId?.email ? { id: workspace.ownerId._id, name: workspace.ownerId.name, email: workspace.ownerId.email } : { id: workspace.ownerId },
  memberCount: (workspace.members || []).length,
  branding: workspace.branding || {},
  policy: workspace.policy || {},
});

export const listWorkspaces = async (user) => {
  await ensurePersonalWorkspace(user.id, user.name);
  const workspaces = await Workspace.find({
    status: { $ne: "archived" },
    $or: [{ ownerId: user.id }, { members: { $elemMatch: { userId: user.id, status: "active" } } }],
  })
    .populate("ownerId", "name email")
    .sort({ personal: -1, createdAt: 1 });
  return workspaces.map((workspace) => publicWorkspace(workspace, user.id));
};

/**
 * Seats a team workspace uses: its owner, its members, and invitations not yet answered.
 */
export const seatsUsed = async (workspace) => {
  const pending = await Invitation.countDocuments({ workspaceId: workspace._id, status: "pending", expiresAt: { $gt: new Date() } });
  const memberIds = new Set((workspace.members || []).map((m) => String(m.userId)));
  memberIds.add(String(workspace.ownerId?._id || workspace.ownerId));
  return memberIds.size + pending;
};

/**
 * Refuses a number of seats smaller than one of the owner's teams. A period can be bought with
 * fewer seats than the last one, but not with fewer than the people already in a team; seats
 * are never taken away part-way through a period.
 */
export const assertSeatsCoverTeams = async (ownerId, seats) => {
  for (const team of await Workspace.find({ ownerId, personal: { $ne: true }, status: { $ne: "archived" } })) {
    const inUse = await seatsUsed(team);
    if (inUse > seats) {
      throw new ApiError(400, `"${team.name}" has ${inUse} people, counting invitations not yet answered. Remove some or buy at least ${inUse} seats.`);
    }
  }
};

// Seats the owner's plan pays for. Plans sold by the seat record it; others get the owner alone.
export const seatsAllowed = async (ownerId) => {
  const subscription = await getOrCreateSubscription(ownerId);
  if (!can(subscription, "workspaces")) return 1;
  // Enterprise is agreed per customer. Every account starts with one seat recorded, so on
  // Enterprise a count of one means nobody has set a limit, and there is none.
  if (tierOf(subscription) === "enterprise" && !(subscription.seats > 1)) return Infinity;
  return Math.max(1, subscription.seats || 1);
};

export const createTeamWorkspace = async (user, { name, primaryColor, companyName }) => {
  if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Workspace name is required");
  const workspace = await Workspace.create({
    name: name.trim().slice(0, 80),
    ownerId: user.id,
    personal: false,
    members: [],
    branding: { primaryColor: /^#[0-9a-f]{6}$/i.test(primaryColor || "") ? primaryColor : "#4f46e5", companyName: (companyName || name).trim().slice(0, 80) },
  });
  return publicWorkspace(workspace, user.id);
};

const loadTeam = async (workspaceId, userId, action) => {
  if (!isId(String(workspaceId))) throw new ApiError(404, "Workspace not found");
  const workspace = await Workspace.findById(String(workspaceId));
  if (!workspace || workspace.status === "archived") throw new ApiError(404, "Workspace not found");
  assertWorkspaceAccess(workspace, userId, action);
  if (workspace.personal) throw new ApiError(400, "A personal workspace has no members");
  return workspace;
};

export const getWorkspaceDetails = async (workspaceId, user) => {
  const workspace = await Workspace.findById(isId(String(workspaceId)) ? String(workspaceId) : null).populate("ownerId", "name email").populate("members.userId", "name email twoFactor.enabled");
  if (!workspace || workspace.status === "archived") throw new ApiError(404, "Workspace not found");
  const role = assertWorkspaceAccess(workspace, user.id, "activity.read");

  const invitations = workspace.personal
    ? []
    : await Invitation.find({ workspaceId: workspace._id, status: "pending", expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();

  return {
    ...publicWorkspace(workspace, user.id),
    role,
    allowedFrameOrigins: workspace.allowedFrameOrigins || [],
    sso: { enabled: Boolean(workspace.sso?.enabled), issuer: workspace.sso?.issuer || "", clientId: workspace.sso?.clientId || "", emailDomains: workspace.sso?.emailDomains || [] },
    members: [
      { userId: workspace.ownerId._id, name: workspace.ownerId.name, email: workspace.ownerId.email, role: "owner", status: "active" },
      ...workspace.members
        .filter((m) => m.userId && String(m.userId._id) !== String(workspace.ownerId._id))
        .map((m) => ({ userId: m.userId._id, name: m.userId.name, email: m.userId.email, role: m.role, status: m.status, joinedAt: m.joinedAt, twoFactor: Boolean(m.userId.twoFactor?.enabled) })),
    ],
    invitations: invitations.map((i) => ({ id: i._id, email: i.email, role: i.role, expiresAt: i.expiresAt })),
    seats: workspace.personal ? null : { used: await seatsUsed(workspace), allowed: await seatsAllowed(workspace.ownerId._id) },
  };
};

/**
 * Invites someone by email, whether or not they have an account. The invitation takes a seat
 * until it is answered or expires, so a team cannot grow past what it pays for by inviting.
 */
export const inviteToWorkspace = async ({ workspaceId, user, email, role = "member" }) => {
  const workspace = await loadTeam(workspaceId, user.id, "member.manage");
  const address = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new ApiError(400, "Enter an email address");
  if (!["admin", "member", "viewer"].includes(role)) throw new ApiError(400, "Choose a role: admin, member or viewer");

  const existing = await User.findOne({ email: address });
  if (existing && roleOf(workspace, existing._id)) throw new ApiError(409, "That person is already in this workspace");
  if (await Invitation.exists({ workspaceId: workspace._id, email: address, status: "pending", expiresAt: { $gt: new Date() } })) {
    throw new ApiError(409, "That person has already been invited");
  }

  const allowed = await seatsAllowed(workspace.ownerId);
  if ((await seatsUsed(workspace)) + 1 > allowed) {
    throw new ApiError(403, `UPGRADE_REQUIRED: This workspace has ${allowed} seat${allowed === 1 ? "" : "s"} and all are in use. Add a seat to invite someone.`);
  }

  const token = randomToken();
  const invitation = await Invitation.create({
    workspaceId: workspace._id,
    email: address,
    role,
    tokenHash: sha256Hex(token),
    invitedBy: user.id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  });

  await sendWorkspaceInvitationEmail({
    email: address,
    workspaceName: workspace.name,
    inviterName: user.name || user.email,
    role,
    link: `${env.appUrl}/invite/${token}`,
    hasAccount: Boolean(existing),
  });

  return { id: invitation._id, email: address, role, expiresAt: invitation.expiresAt };
};

export const revokeInvitation = async ({ workspaceId, invitationId, user }) => {
  const workspace = await loadTeam(workspaceId, user.id, "member.manage");
  if (!isId(String(invitationId))) throw new ApiError(404, "Invitation not found");
  const result = await Invitation.updateOne({ _id: String(invitationId), workspaceId: workspace._id, status: "pending" }, { status: "revoked" });
  if (result.modifiedCount === 0) throw new ApiError(404, "Invitation not found");
};

const findInvitation = async (token) => {
  const invitation = typeof token === "string" && token ? await Invitation.findOne({ tokenHash: sha256Hex(token) }) : null;
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    throw new ApiError(410, "This invitation is no longer valid. Ask for a new one.");
  }
  return invitation;
};

// What the invitation page shows before the person signs in or signs up
export const describeInvitation = async (token) => {
  const invitation = await findInvitation(token);
  const workspace = await Workspace.findById(invitation.workspaceId).lean();
  if (!workspace || workspace.status === "archived") throw new ApiError(410, "This invitation is no longer valid. Ask for a new one.");
  return { workspaceName: workspace.name, role: invitation.role, email: invitation.email, hasAccount: Boolean(await User.exists({ email: invitation.email })) };
};

/**
 * Accepts an invitation. Only the person it was sent to can accept it: the signed-in account's
 * email must be the invited address, so a forwarded link is of no use to anyone else.
 */
export const acceptInvitation = async (token, user) => {
  const invitation = await findInvitation(token);
  if (invitation.email !== String(user.email).toLowerCase()) {
    throw new ApiError(403, `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`);
  }

  // Claim the invitation first, so two clicks cannot add the person twice
  const claimed = await Invitation.updateOne({ _id: invitation._id, status: "pending" }, { status: "accepted", acceptedAt: new Date() });
  if (claimed.modifiedCount === 0) throw new ApiError(410, "This invitation is no longer valid. Ask for a new one.");

  await Workspace.updateOne(
    { _id: invitation.workspaceId, "members.userId": { $ne: user.id } },
    { $push: { members: { userId: user.id, role: invitation.role, status: "active", joinedAt: new Date() } } }
  );
  const workspace = await Workspace.findById(invitation.workspaceId);
  return publicWorkspace(workspace, user.id);
};

export const changeMemberRole = async ({ workspaceId, memberId, role, user }) => {
  const workspace = await loadTeam(workspaceId, user.id, "member.manage");
  if (!["admin", "member", "viewer"].includes(role)) throw new ApiError(400, "Choose a role: admin, member or viewer");
  const result = await Workspace.updateOne({ _id: workspace._id, "members.userId": String(memberId) }, { $set: { "members.$.role": role } });
  if (result.matchedCount === 0) throw new ApiError(404, "Member not found");
};

/**
 * Removes a member (plan task P5-11). What they made in the workspace stays in it and passes
 * to the workspace's owner, so no document is left without someone responsible for it, and
 * the removed person keeps no access to any of it.
 *
 * A member may remove themselves; removing anyone else needs an admin.
 */
export const removeMember = async ({ workspaceId, memberId, user }) => {
  if (!isId(String(memberId))) throw new ApiError(404, "Member not found");
  const leaving = String(memberId) === String(user.id);
  const workspace = await loadTeam(workspaceId, user.id, leaving ? "activity.read" : "member.manage");

  if (String(workspace.ownerId) === String(memberId)) throw new ApiError(400, "The owner cannot be removed. Transfer or delete the workspace instead.");
  if (!workspace.members.some((m) => String(m.userId) === String(memberId))) throw new ApiError(404, "Member not found");

  await Workspace.updateOne({ _id: workspace._id }, { $pull: { members: { userId: String(memberId) } } });

  const handOver = { workspaceId: workspace._id, userId: String(memberId) };
  const [documents, templates] = await Promise.all([
    Pdf.updateMany(handOver, { $set: { userId: workspace.ownerId, transferredFrom: String(memberId) } }),
    Template.updateMany(handOver, { $set: { userId: workspace.ownerId } }),
  ]);
  return { documentsTransferred: documents.modifiedCount, templatesTransferred: templates.modifiedCount };
};

export const updateWorkspaceSettings = async ({ workspaceId, user, changes }) => {
  if (!isId(String(workspaceId))) throw new ApiError(404, "Workspace not found");
  const workspace = await Workspace.findById(String(workspaceId));
  if (!workspace || workspace.status === "archived") throw new ApiError(404, "Workspace not found");

  const set = {};
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : null);

  if (changes.name !== undefined || changes.branding !== undefined) {
    assertWorkspaceAccess(workspace, user.id, "branding.manage");
    if (changes.name !== undefined && text(changes.name, 80)) set.name = text(changes.name, 80);
    const branding = changes.branding || {};
    if (branding.companyName !== undefined) set["branding.companyName"] = text(branding.companyName, 80);
    if (branding.emailFooterText !== undefined) set["branding.emailFooterText"] = text(branding.emailFooterText, 300);
    if (branding.primaryColor !== undefined) {
      if (!/^#[0-9a-f]{6}$/i.test(branding.primaryColor || "")) throw new ApiError(400, "The colour must look like #1a2b3c");
      set["branding.primaryColor"] = branding.primaryColor;
    }
    if (branding.logoUrl !== undefined) {
      const logo = branding.logoUrl || null;
      // A logo is either a small image carried in the setting itself, or an https address
      const isImage = typeof logo === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) && logo.length <= 200000;
      const isLink = typeof logo === "string" && /^https:\/\/[^\s"'<>]+$/.test(logo) && logo.length <= 500;
      if (logo !== null && !isImage && !isLink) throw new ApiError(400, "The logo must be a PNG or JPEG under 150 KB, or an https address");
      set["branding.logoUrl"] = logo;
    }
  }

  if (changes.policy !== undefined) {
    assertWorkspaceAccess(workspace, user.id, "policy.manage");
    if (changes.policy.requireTwoFactor !== undefined) set["policy.requireTwoFactor"] = Boolean(changes.policy.requireTwoFactor);
    if (changes.policy.retentionDays !== undefined) {
      const days = changes.policy.retentionDays === null || changes.policy.retentionDays === "" ? null : Number(changes.policy.retentionDays);
      if (days !== null && (!Number.isInteger(days) || days < 30 || days > 3650)) throw new ApiError(400, "Keep documents for between 30 and 3,650 days, or leave it empty to keep them");
      set["policy.retentionDays"] = days;
    }
  }

  if (changes.allowedFrameOrigins !== undefined) {
    assertWorkspaceAccess(workspace, user.id, "developer.manage");
    const origins = Array.isArray(changes.allowedFrameOrigins) ? changes.allowedFrameOrigins : [];
    const cleaned = [];
    for (const origin of origins.slice(0, 20)) {
      let url;
      try {
        url = new URL(String(origin));
      } catch {
        throw new ApiError(400, `"${origin}" is not a web address`);
      }
      if (url.protocol !== "https:" && !(url.hostname === "localhost" && !env.isProd)) throw new ApiError(400, "Sites that embed signing must use https");
      cleaned.push(url.origin);
    }
    set.allowedFrameOrigins = [...new Set(cleaned)];
  }

  if (Object.keys(set).length > 0) await Workspace.updateOne({ _id: workspace._id }, { $set: set });
  return getWorkspaceDetails(workspace._id.toString(), user);
};

/**
 * What has happened in a workspace lately, newest first: the team's activity view.
 */
export const workspaceActivity = async (workspaceId, user, { limit = 50 } = {}) => {
  const workspace = await Workspace.findById(isId(String(workspaceId)) ? String(workspaceId) : null).lean();
  if (!workspace) throw new ApiError(404, "Workspace not found");
  assertWorkspaceAccess(workspace, user.id, "activity.read");

  const filter = workspace.personal ? { userId: user.id } : { workspaceId: workspace._id };
  const documents = await Pdf.find({ ...filter, deletedAt: null }).select("_id originalFileName").sort({ updatedAt: -1 }).limit(500).lean();
  const titles = new Map(documents.map((d) => [String(d._id), d.originalFileName]));

  const entries = await PdfAudit.find({ pdfId: { $in: documents.map((d) => d._id) } }).sort({ createdAt: -1 }).limit(Math.min(200, limit)).lean();
  return entries.map((entry) => ({
    at: entry.signedAt || entry.createdAt,
    event: entry.event,
    actor: entry.actorName || entry.actorEmail || "",
    documentId: entry.pdfId,
    document: titles.get(String(entry.pdfId)) || "",
    description: entry.description || "",
  }));
};

/**
 * When the plan that pays for a team stops covering workspaces, its team workspaces become
 * read-only: everything can still be read and downloaded, nothing new can be sent. Paying
 * again makes them active again.
 */
export const syncWorkspacesWithPlan = async (ownerId) => {
  const subscription = await getOrCreateSubscription(ownerId);
  const status = can(subscription, "workspaces") ? "active" : "read_only";
  await Workspace.updateMany({ ownerId, personal: { $ne: true }, status: { $in: ["active", "read_only"] } }, { $set: { status } });
  return status;
};
