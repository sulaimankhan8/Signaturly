import { Router } from "express";
import { protect, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/subscription.middleware.js";
import { bulkSendController } from "../controllers/bulk.controller.js";

const router = Router();

router.post(
  "/send",
  protect,
  requireVerifiedEmail,
  requireFeature("bulkSend"),
  bulkSendController
);

export default router;
