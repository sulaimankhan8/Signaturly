import cron from "node-cron";
import { processAutomatedReminders } from "../services/reminder.service.js";
import { processAutomatedExpirations } from "../services/expiration.service.js";

export const initBackgroundJobs = () => {
  console.log("⏰ Initializing background cron jobs...");

  // Run automated reminders every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    console.log("⏰ Running automated reminders check...");
    await processAutomatedReminders();
  });

  // Run automated expiration checks every hour
  cron.schedule("30 * * * *", async () => {
    console.log("⏰ Running automated expiration check...");
    await processAutomatedExpirations();
  });

  console.log("✓ Background cron jobs scheduled successfully.");
};
