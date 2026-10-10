import { beforeAll, afterAll, beforeEach, inject } from "vitest";

// Must be set before any application module is imported
process.env.MONGO_URI = inject("mongoUri");
process.env.UPLOADS_DIR = inject("uploadsDir");

let mongoose;

beforeAll(async () => {
  mongoose = (await import("mongoose")).default;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const { initEventSystem } = await import("../src/events/index.js");
  const { eventBus } = await import("../src/events/eventBus.js");
  if (eventBus.recorders.length === 0) initEventSystem();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));

  const { emailOutbox } = await import("../src/config/email.js");
  emailOutbox.length = 0;

  const { env } = await import("../src/config/env.js");
  env.rateLimitDisabled = true;
});

afterAll(async () => {
  await mongoose.disconnect();
});
