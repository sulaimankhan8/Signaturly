import mongoose from "mongoose";
import { env } from "../config/env.js";
import { runMigrations } from "../migrations/index.js";

// Runs the data migrations that have not run yet. Usage: npm run migrate
const main = async () => {
  if (!env.mongoUri) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri);
  const ran = await runMigrations();
  if (ran.length === 0) console.log("Nothing to migrate.");
  for (const { name, result } of ran) console.log(`Ran ${name}:`, JSON.stringify(result));
  await mongoose.disconnect();
};

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
