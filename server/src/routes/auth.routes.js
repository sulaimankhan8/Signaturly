import  { Router } from "express";
import { register, login,
  refreshAccessToken,
  getMe, } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.get("/me", protect, getMe);

export default router;