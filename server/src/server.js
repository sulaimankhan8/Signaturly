import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initBackgroundJobs } from "./config/cron.js";
import { initEventSystem } from "./events/index.js";

connectDB().then(() => {
  // Initialize Event-Driven Architecture subsystems
  initEventSystem();

  app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port}`);
    initBackgroundJobs();
  });
});