import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Workspace } from "../models/Workspace.model.js";
import { User } from "../models/User.model.js";

export const getMyWorkspacesController = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const workspaces = await Workspace.find({
    $or: [{ ownerId: userId }, { "members.userId": userId }],
  }).populate("ownerId", "name email");

  res.status(200).json(
    new ApiResponse(workspaces, "User workspaces retrieved")
  );
});

export const createWorkspaceController = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, primaryColor, companyName } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Workspace name is required");
  }

  const workspace = await Workspace.create({
    name: name.trim(),
    ownerId: userId,
    members: [{ userId, role: "admin" }],
    branding: {
      primaryColor: primaryColor || "#4f46e5",
      companyName: companyName || name,
    },
  });

  res.status(201).json(
    new ApiResponse(workspace, "Team workspace created successfully")
  );
});

export const inviteMemberController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, role = "member" } = req.body;

  const workspace = await Workspace.findById(id);
  if (!workspace) throw new ApiError(404, "Workspace not found");

  if (workspace.ownerId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the workspace owner can invite members");
  }

  const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (!targetUser) {
    throw new ApiError(404, `User with email ${email} is not registered on Signaturly`);
  }

  // Check if already member
  const alreadyMember = workspace.members.some(
    (m) => m.userId.toString() === targetUser._id.toString()
  );

  if (alreadyMember) {
    throw new ApiError(400, "User is already a member of this workspace");
  }

  workspace.members.push({ userId: targetUser._id, role });
  await workspace.save();

  res.status(200).json(
    new ApiResponse(workspace, `Successfully added ${email} to workspace`)
  );
});

export const updateBrandingController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { logo, logoUrl, primaryColor, companyName, emailFooterText } = req.body;

  const workspace = await Workspace.findById(id);
  if (!workspace) throw new ApiError(404, "Workspace not found");

  if (workspace.ownerId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the owner can update branding");
  }

  if (!workspace.branding) workspace.branding = {};
  if (logo !== undefined) workspace.branding.logo = logo;
  if (logoUrl !== undefined) workspace.branding.logoUrl = logoUrl;
  if (primaryColor) workspace.branding.primaryColor = primaryColor;
  if (companyName) workspace.branding.companyName = companyName;
  if (emailFooterText !== undefined) workspace.branding.emailFooterText = emailFooterText;

  await workspace.save();

  res.status(200).json(
    new ApiResponse(workspace, "Branding preferences saved")
  );
});

export const removeMemberController = asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;

  const workspace = await Workspace.findById(id);
  if (!workspace) throw new ApiError(404, "Workspace not found");

  if (workspace.ownerId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the workspace owner can remove members");
  }

  workspace.members = workspace.members.filter(
    (m) => m.userId.toString() !== memberId.toString() && m._id.toString() !== memberId.toString()
  );
  await workspace.save();

  res.status(200).json(
    new ApiResponse(workspace, "Member removed from workspace")
  );
});
