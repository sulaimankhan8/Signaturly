import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  getSubscriptionController,
  createCheckoutSessionController,
  devMockUpgradeController,
  createBillingPortalController,
} from "../controllers/billing.controller.js";
import { env } from "../config/env.js";

const router = Router();

router.use(protect); // All billing routes require authenticated user

router.get("/subscription", getSubscriptionController);
router.post("/checkout", createCheckoutSessionController);
router.post("/portal", createBillingPortalController);

// The simulated upgrade exists only outside production; in production the route is not registered at all
if (env.devBillingSimulation) {
  router.post("/dev-upgrade", devMockUpgradeController);
}

export default router;
