import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
  exportAccountController,
  deleteAccountController,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/profile", protect, getUserProfileController);
router.put("/profile", protect, updateUserProfileController);
router.put("/password", protect, changePasswordController);
router.get("/export", protect, exportAccountController);
router.post("/delete-account", protect, deleteAccountController);

export default router;
