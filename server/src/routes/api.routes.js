import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTier } from "../middlewares/subscription.middleware.js";
import {
  getMyApiKeysController,
  createApiKeyController,
  revokeApiKeyController,
  getMyWebhooksController,
  createWebhookController,
  deleteWebhookController,
} from "../controllers/api.controller.js";

const router = Router();

router.use(protect);

// 1. Viewing and revoking existing API keys & webhooks is allowed regardless of tier
router.get("/keys", getMyApiKeysController);
router.delete("/keys/:id", revokeApiKeyController);

router.get("/webhooks", getMyWebhooksController);
router.delete("/webhooks/:id", deleteWebhookController);

// 2. Creating new API keys or webhooks requires active Enterprise tier
router.post("/keys", requireTier(["enterprise"]), createApiKeyController);
router.post("/webhooks", requireTier(["enterprise"]), createWebhookController);

export default router;
