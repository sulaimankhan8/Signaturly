import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/profile", protect, getUserProfileController);
router.put("/profile", protect, updateUserProfileController);
router.put("/password", protect, changePasswordController);

export default router;
