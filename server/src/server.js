import app from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initBackgroundJobs } from "./config/cron.js";

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port}`);
    initBackgroundJobs();
  });
});