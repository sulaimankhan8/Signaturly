import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/subscription.middleware.js";
import {
  getMyApiKeysController,
  createApiKeyController,
  revokeApiKeyController,
  getMyWebhooksController,
  createWebhookController,
  deleteWebhookController,
  listWebhookDeliveriesController,
  replayWebhookDeliveryController,
} from "../controllers/api.controller.js";

const router = Router();

router.use(protect);

// 1. Viewing and revoking existing API keys & webhooks is allowed regardless of tier
router.get("/keys", getMyApiKeysController);
router.delete("/keys/:id", revokeApiKeyController);

router.get("/webhooks", getMyWebhooksController);
router.delete("/webhooks/:id", deleteWebhookController);
router.get("/webhooks/:id/deliveries", listWebhookDeliveriesController);

// 2. Creating new API keys or webhooks, and sending a delivery again, needs a plan that includes the API
router.post("/keys", requireFeature("api"), createApiKeyController);
router.post("/webhooks", requireFeature("api"), createWebhookController);
router.post("/webhooks/deliveries/:deliveryId/replay", requireFeature("api"), replayWebhookDeliveryController);

export default router;
