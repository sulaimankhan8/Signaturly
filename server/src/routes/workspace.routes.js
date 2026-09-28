import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTier } from "../middlewares/subscription.middleware.js";
import {
  getMyWorkspacesController,
  createWorkspaceController,
  inviteMemberController,
  updateBrandingController,
  removeMemberController,
} from "../controllers/workspace.controller.js";

const router = Router();

router.use(protect);

// 1. Reading workspaces and deleting members is permitted for workspace owners regardless of tier
router.get("/", getMyWorkspacesController);
router.delete("/:id/members/:memberId", removeMemberController);

// 2. Creating workspaces, inviting new members, and changing white-label branding requires active Enterprise tier
router.post("/", requireTier(["enterprise"]), createWorkspaceController);
router.post("/:id/members", requireTier(["enterprise"]), inviteMemberController);
router.patch("/:id/branding", requireTier(["enterprise"]), updateBrandingController);
router.put("/:id/branding", requireTier(["enterprise"]), updateBrandingController);

export default router;
