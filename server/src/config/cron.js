import cron from "node-cron";
import { env } from "./env.js";
import { processAutomatedReminders } from "../services/reminder.service.js";
import { processAutomatedExpirations } from "../services/expiration.service.js";
import { processSubscriptionLifecycle } from "../services/subscription.service.js";
import { runDueJobs } from "../jobs/queue.js";

/**
 * Timers inside the process, for local development only.
 * In production the same work is triggered from outside through /api/internal,
 * because a service scaled to zero has no running timers.
 */
export const initBackgroundJobs = () => {
  if (!env.inProcessCron) return;

  const safely = (name, work) => async () => {
    try {
      await work();
    } catch (err) {
      console.error(`[Cron] ${name} failed:`, err.message);
    }
  };

  cron.schedule("* * * * *", safely("jobs", () => runDueJobs()));
  cron.schedule("0 */4 * * *", safely("reminders", processAutomatedReminders));
  cron.schedule("30 * * * *", safely("expirations", processAutomatedExpirations));
  cron.schedule("15 * * * *", safely("subscriptions", processSubscriptionLifecycle));
};
