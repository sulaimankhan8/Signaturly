import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env, assertValidEnv } from "./config/env.js";
import { initBackgroundJobs } from "./config/cron.js";
import { initEventSystem } from "./events/index.js";
import { syncCatalogue } from "./services/templateCatalogue.service.js";
import { loadPlans } from "./services/planCatalogue.service.js";

// Global Process Safety Guards
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 [Process] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 [Process] Uncaught Exception:", err);
});

// Refuse to start with missing or placeholder secrets
assertValidEnv();

connectDB().then(async () => {
  // Initialize Event-Driven Architecture subsystems
  initEventSystem();

  // Plans and prices as the admins last set them. Without them the shipped list is used.
  try {
    await loadPlans();
  } catch (err) {
    console.error("Plan settings could not be read; using the shipped plans:", err.message);
  }

  // Copy any template that ships with this release and is not in the database yet
  try {
    const { inserted } = await syncCatalogue();
    if (inserted) console.log(`Template catalogue: ${inserted} new template version(s) added`);
  } catch (err) {
    console.error("Template catalogue could not be synced:", err.message);
  }

  const server = app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port}`);
    initBackgroundJobs();
  });

  // Graceful Shutdown on Cloud Deployment (SIGTERM / SIGINT)
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      console.log("✓ HTTP server closed. Process exiting cleanly.");
      process.exit(0);
    });
    // Force close if taking longer than 10 seconds
    setTimeout(() => {
      console.error("⚠️ Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});