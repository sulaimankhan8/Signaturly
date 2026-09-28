import { Router } from "express";
import express from "express";
import {
  handleStripeWebhookController,
  handleRazorpayWebhookController,
} from "../controllers/webhook.controller.js";

const router = Router();

// Stripe webhook receives raw body or JSON
router.post("/stripe", express.raw({ type: "application/json" }), handleStripeWebhookController);
router.post("/razorpay", express.json(), handleRazorpayWebhookController);

export default router;
