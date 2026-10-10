import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    globalSetup: ["./tests/globalSetup.js"],
    setupFiles: ["./tests/setup.js"],
    // One in-memory database is shared, so files run one after another
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret-test-access-secret-0001",
      JWT_REFRESH_SECRET: "test-refresh-secret-test-refresh-secret-01",
      ADMIN_SECRET_KEY: "test-admin-key-test-admin-key-test-admin-01",
      ADMIN_JWT_SECRET: "test-admin-jwt-secret-test-admin-jwt-secret",
      CORS_ORIGIN: "http://localhost:5173,http://localhost:5174",
      APP_URL: "http://localhost:5173",
      STORAGE_PROVIDER: "local",
      STRIPE_WEBHOOK_SECRET: "whsec_test_stripe_secret",
      RAZORPAY_WEBHOOK_SECRET: "test_razorpay_webhook_secret",
      RATE_LIMIT_DISABLED: "true",
      SMTP_USER: "",
      SMTP_PASS: "",
    },
  },
});
