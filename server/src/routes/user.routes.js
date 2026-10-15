import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
  exportAccountController,
  deleteAccountController,
  getSavedSignatureController,
  saveSignatureController,
  deleteSavedSignatureController,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/profile", protect, getUserProfileController);
router.put("/profile", protect, updateUserProfileController);
router.put("/password", protect, changePasswordController);
router.get("/export", protect, exportAccountController);
router.post("/delete-account", protect, deleteAccountController);

// The signature and initials the user adopted, kept with the account
router.get("/signature", protect, getSavedSignatureController);
router.put("/signature", protect, saveSignatureController);
router.delete("/signature", protect, deleteSavedSignatureController);

export default router;
