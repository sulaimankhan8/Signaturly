import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTier } from "../middlewares/subscription.middleware.js";
import { bulkSendController } from "../controllers/bulk.controller.js";

const router = Router();

router.post(
  "/send",
  protect,
  requireTier(["pro_monthly", "pro_annual", "lifetime", "enterprise"]),
  bulkSendController
);

export default router;
