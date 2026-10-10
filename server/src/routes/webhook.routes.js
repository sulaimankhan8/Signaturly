import { Router } from "express";
import express from "express";
import {
  handleStripeWebhookController,
  handleRazorpayWebhookController,
} from "../controllers/webhook.controller.js";

const router = Router();

// Signatures are computed over the exact bytes sent, so both routes take the raw body.
// This router is mounted in app.js before express.json().
const rawJson = express.raw({ type: () => true, limit: "1mb" });

router.post("/stripe", rawJson, handleStripeWebhookController);
router.post("/razorpay", rawJson, handleRazorpayWebhookController);

export default router;
