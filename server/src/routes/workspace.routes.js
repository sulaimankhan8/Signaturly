import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/subscription.middleware.js";
import {
  getMyWorkspacesController,
  createWorkspaceController,
  getWorkspaceController,
  inviteMemberController,
  revokeInvitationController,
  resendInvitationController,
  remindTwoFactorController,
  describeInvitationController,
  acceptInvitationController,
  changeMemberRoleController,
  removeMemberController,
  updateWorkspaceController,
  updateBrandingController,
  getWorkspaceActivityController,
} from "../controllers/workspace.controller.js";

const router = Router();

// What an invitation is for, shown before the person signs in or signs up
router.get("/invitations/:token", describeInvitationController);

router.use(protect);

router.post("/invitations/:token/accept", acceptInvitationController);

// Belonging to a workspace needs no plan of one's own: the workspace's owner pays.
router.get("/", getMyWorkspacesController);
router.get("/:id", getWorkspaceController);
router.get("/:id/activity", getWorkspaceActivityController);
router.delete("/:id/members/:memberId", removeMemberController);

// Starting a team workspace needs a plan that includes them. Everything after that is decided
// by the person's role in the workspace, and by its seats.
router.post("/", requireFeature("workspaces", { own: true }), createWorkspaceController);
router.patch("/:id", updateWorkspaceController);
router.post("/:id/members", inviteMemberController);
router.post("/:id/invitations", inviteMemberController);
router.delete("/:id/invitations/:invitationId", revokeInvitationController);
router.post("/:id/invitations/:invitationId/resend", resendInvitationController);
router.post("/:id/members/:memberId/remind-two-factor", remindTwoFactorController);
router.patch("/:id/members/:memberId", changeMemberRoleController);
router.patch("/:id/branding", updateBrandingController);
router.put("/:id/branding", updateBrandingController);

export default router;
