import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getSubscriptionController,
  createCheckoutSessionController,
  devMockUpgradeController,
  createBillingPortalController,
} from "../controllers/billing.controller.js";

const router = Router();

router.use(protect); // All billing routes require authenticated user

router.get("/subscription", getSubscriptionController);
router.post("/checkout", createCheckoutSessionController);
router.post("/dev-upgrade", devMockUpgradeController);
router.post("/portal", createBillingPortalController);

export default router;
