import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initBackgroundJobs } from "./config/cron.js";
import { initEventSystem } from "./events/index.js";

// Global Process Safety Guards
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 [Process] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 [Process] Uncaught Exception:", err);
});

connectDB().then(() => {
  // Initialize Event-Driven Architecture subsystems
  initEventSystem();

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