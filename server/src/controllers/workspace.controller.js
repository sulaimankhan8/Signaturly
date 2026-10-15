import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  listWorkspaces,
  createTeamWorkspace,
  getWorkspaceDetails,
  inviteToWorkspace,
  revokeInvitation,
  resendInvitation,
  remindTwoFactor,
  describeInvitation,
  acceptInvitation,
  changeMemberRole,
  removeMember,
  updateWorkspaceSettings,
  workspaceActivity,
} from "../services/workspace.service.js";

// Permission for each of these is checked in the service, by role, through services/authorize.service.js

export const getMyWorkspacesController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await listWorkspaces(req.user), "User workspaces retrieved"));
});

export const createWorkspaceController = asyncHandler(async (req, res) => {
  const workspace = await createTeamWorkspace(req.user, req.body || {});
  res.status(201).json(new ApiResponse(workspace, "Team workspace created successfully"));
});

export const getWorkspaceController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await getWorkspaceDetails(req.params.id, req.user), "Workspace"));
});

export const inviteMemberController = asyncHandler(async (req, res) => {
  const invitation = await inviteToWorkspace({ workspaceId: req.params.id, user: req.user, email: req.body?.email, role: req.body?.role });
  res.status(201).json(new ApiResponse(invitation, `Invitation sent to ${invitation.email}`));
});

export const revokeInvitationController = asyncHandler(async (req, res) => {
  await revokeInvitation({ workspaceId: req.params.id, invitationId: req.params.invitationId, user: req.user });
  res.status(200).json(new ApiResponse({}, "Invitation withdrawn"));
});

export const resendInvitationController = asyncHandler(async (req, res) => {
  const invitation = await resendInvitation({ workspaceId: req.params.id, invitationId: req.params.invitationId, user: req.user });
  res.status(200).json(new ApiResponse(invitation, `Invitation sent again to ${invitation.email}`));
});

export const remindTwoFactorController = asyncHandler(async (req, res) => {
  const result = await remindTwoFactor({ workspaceId: req.params.id, memberId: req.params.memberId, user: req.user });
  res.status(200).json(new ApiResponse(result, `Reminder sent to ${result.email}`));
});

// Open to anyone holding the link: it shows the workspace's name and look, who invited whom, and until when
export const describeInvitationController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await describeInvitation(req.params.token), "Invitation"));
});

export const acceptInvitationController = asyncHandler(async (req, res) => {
  const workspace = await acceptInvitation(req.params.token, req.user);
  res.status(200).json(new ApiResponse(workspace, `You have joined ${workspace.name}`));
});

export const changeMemberRoleController = asyncHandler(async (req, res) => {
  await changeMemberRole({ workspaceId: req.params.id, memberId: req.params.memberId, role: req.body?.role, user: req.user });
  res.status(200).json(new ApiResponse({}, "Role updated"));
});

export const removeMemberController = asyncHandler(async (req, res) => {
  const result = await removeMember({ workspaceId: req.params.id, memberId: req.params.memberId, user: req.user });
  res.status(200).json(new ApiResponse(result, "Member removed from workspace"));
});

export const updateWorkspaceController = asyncHandler(async (req, res) => {
  const workspace = await updateWorkspaceSettings({ workspaceId: req.params.id, user: req.user, changes: req.body || {} });
  res.status(200).json(new ApiResponse(workspace, "Workspace updated"));
});

// Kept for the older settings screen, which sends branding fields at the top level
export const updateBrandingController = asyncHandler(async (req, res) => {
  const { logo, logoUrl, primaryColor, companyName, emailFooterText } = req.body || {};
  const branding = {};
  if (logoUrl !== undefined || logo !== undefined) branding.logoUrl = logoUrl ?? logo;
  if (primaryColor !== undefined) branding.primaryColor = primaryColor;
  if (companyName !== undefined) branding.companyName = companyName;
  if (emailFooterText !== undefined) branding.emailFooterText = emailFooterText;
  const workspace = await updateWorkspaceSettings({ workspaceId: req.params.id, user: req.user, changes: { branding } });
  res.status(200).json(new ApiResponse(workspace, "Branding preferences saved"));
});

export const getWorkspaceActivityController = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(await workspaceActivity(req.params.id, req.user), "Activity"));
});
