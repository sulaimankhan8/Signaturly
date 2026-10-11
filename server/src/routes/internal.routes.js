import { Router } from "express";
import { env } from "../config/env.js";
import { safeEqual } from "../utils/tokens.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { runDueJobs } from "../jobs/queue.js";
import { processAutomatedReminders } from "../services/reminder.service.js";
import { processAutomatedExpirations } from "../services/expiration.service.js";
import { processSubscriptionLifecycle } from "../services/subscription.service.js";
import { processRetention } from "../services/retention.service.js";

const router = Router();

/**
 * Endpoints for the scheduler (Cloud Scheduler in production). They replace timers inside the
 * process, which do not fire while the service is scaled to zero. Every call must present the
 * shared secret; without one configured, the endpoints are closed.
 */
router.use((req, res, next) => {
  const presented = req.headers["x-internal-secret"];
  if (!env.internalSecret || typeof presented !== "string" || !safeEqual(presented, env.internalSecret)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

router.post("/jobs/run", asyncHandler(async (req, res) => {
  res.json({ ok: true, ...(await runDueJobs()) });
}));

router.post("/cron/reminders", asyncHandler(async (req, res) => {
  await processAutomatedReminders();
  res.json({ ok: true });
}));

router.post("/cron/expirations", asyncHandler(async (req, res) => {
  await processAutomatedExpirations();
  res.json({ ok: true });
}));

router.post("/cron/subscriptions", asyncHandler(async (req, res) => {
  await processSubscriptionLifecycle();
  res.json({ ok: true });
}));

// Once a day: erases finished documents older than their workspace asks to keep
router.post("/cron/retention", asyncHandler(async (req, res) => {
  res.json({ ok: true, ...(await processRetention()) });
}));

export default router;
