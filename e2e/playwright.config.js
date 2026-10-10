import { defineConfig } from "@playwright/test";

export const WEB_URL = "http://localhost:4173";
export const CONTROL_URL = "http://localhost:5056";

// A small Android phone: the narrowest screen the signing page must work on
const PHONE = {
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
};

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One server and one database are shared, so tests run one after another
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    // The Chrome already on the machine (or the CI runner): nothing to download.
    // Set PW_CHANNEL=msedge to use Edge, or PW_CHANNEL= (empty) for Playwright's own Chromium.
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: PHONE, testMatch: /(phone|public)\.spec\.js$/ },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } }, testMatch: /(desktop|public)\.spec\.js$/ },
  ],
  // Builds the client and starts a throwaway database, the API and a static host
  webServer: {
    command: "node stack.mjs",
    url: `${CONTROL_URL}/ready`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
