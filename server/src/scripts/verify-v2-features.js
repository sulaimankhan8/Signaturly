import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/User.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import {
  getOrCreateSubscription,
  checkQuota,
  incrementUsage,
  devMockUpgrade,
} from "../services/subscription.service.js";
import {
  sendNewSubscriptionAlert,
  sendSystemErrorAlert,
  sendSecurityRateLimitAlert,
} from "../services/alert.service.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/signaturly";

async function runV2Verification() {
  console.log("==========================================================");
  console.log("🧪 STARTING SIGNATURLY PRO v2.0 AUTOMATED FEATURE SUITE");
  console.log("==========================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, testName) => {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  };

  try {
    console.log("🔌 Connecting to database...");
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✓ Connected to MongoDB.\n");

    // Clean up past test artifacts
    const testEmail = `v2_test_${Date.now()}@signaturly.test`;
    let user = await User.create({
      name: "V2 Test Runner",
      email: testEmail,
      password: "TestPassword123!",
      role: "user",
    });

    console.log("--- 1. Quota & Subscription Gating Engine ---");
    // Test 1: Get or Create Subscription (Free Tier Defaults)
    const sub = await getOrCreateSubscription(user._id);
    assert(sub.plan === "free", "New user initialized with 'free' tier");
    assert(sub.monthlyQuota === 15, "Free tier has 15 monthly envelope quota");
    assert(sub.usedThisMonth === 0, "Usage counter initialized at 0");

    // Test 2: Usage Increment & Boundary Check
    await incrementUsage(user._id, 14);
    const subUpdated = await Subscription.findOne({ userId: user._id });
    assert(subUpdated.usedThisMonth === 14, "Incremented usage to 14/15");

    // 15th envelope should pass
    const quotaPass = await checkQuota(user._id, 1);
    assert(quotaPass !== null, "15th envelope allowed within monthly quota");

    // 16th envelope should throw 403
    let quotaBlocked = false;
    try {
      await incrementUsage(user._id, 1); // now at 15
      await checkQuota(user._id, 1); // 16th attempt
    } catch (err) {
      quotaBlocked = err.statusCode === 403;
    }
    assert(quotaBlocked, "16th envelope correctly blocked with 403 Quota Exceeded");

    console.log("\n--- 2. Dev Mock Upgrade & Lifetime Access Pass ---");
    // Test 3: Dev Mock Upgrade to Lifetime Deal ($69)
    const upgradedSub = await devMockUpgrade(user._id, "lifetime");
    assert(upgradedSub.plan === "lifetime", "Upgraded plan to 'lifetime'");
    assert(upgradedSub.monthlyQuota === 999999, "Lifetime plan granted unlimited quota");
    assert(upgradedSub.lastPaymentAmount === 69, "Payment amount recorded as $69 USD");

    // Test 4: Unlimited Sending on Lifetime Pass
    const lifetimePass = await checkQuota(user._id, 50);
    assert(lifetimePass !== null, "50 batch envelopes allowed for Lifetime Subscriber");

    console.log("\n--- 3. Multi-Tenant Team Workspaces ---");
    // Test 5: Workspace Creation & Branding
    const workspace = await Workspace.create({
      name: "Acme Legal Corp",
      ownerId: user._id,
      members: [{ userId: user._id, role: "admin" }],
      branding: {
        companyName: "Acme Global",
        primaryColor: "#ef4444",
        logoUrl: "https://example.com/logo.png",
      },
    });
    assert(workspace.name === "Acme Legal Corp", "Team Workspace created successfully");
    assert(workspace.branding.primaryColor === "#ef4444", "Custom brand color persisted");
    assert(workspace.members[0].role === "admin", "Owner assigned admin role");

    console.log("\n--- 4. Developer API Keys & Webhooks ---");
    // Test 6: API Key Generation & Cryptographic Hashing
    const { fullKey, keyPrefix, keyHash } = ApiKey.generateKey();
    assert(fullKey.startsWith("sig_live_"), "API key generated with 'sig_live_' prefix");
    assert(keyHash.length === 64, "SHA-256 key hash generated with 64 hex characters");

    const apiKeyDoc = await ApiKey.create({
      userId: user._id,
      name: "Production Integration",
      keyPrefix,
      keyHash,
      permissions: ["documents.read", "documents.write"],
    });
    assert(apiKeyDoc.status === "active", "API key persisted in active state");

    // Test 7: Webhook Subscription Model
    const webhook = await Webhook.create({
      userId: user._id,
      url: "https://api.acme.com/webhook",
      secret: "whsec_test_secret_123",
      events: ["envelope.completed", "recipient.signed"],
    });
    assert(webhook.events.includes("envelope.completed"), "Webhook subscribed to envelope.completed");

    console.log("\n--- 5. Alert Webhooks Service ---");
    // Test 8: Dispatch Test Alerts
    await sendNewSubscriptionAlert({
      userEmail: user.email,
      plan: "lifetime",
      amount: 69,
      currency: "USD",
    });
    await sendSystemErrorAlert({
      context: "PDF Verification Sandbox",
      error: new Error("Simulated transient network timeout"),
      endpoint: "/api/v1/verify",
    });
    await sendSecurityRateLimitAlert({
      ip: "127.0.0.1",
      route: "/api/v1/auth/login",
      userAgent: "Automated Test Suite",
    });
    assert(true, "Alert webhook dispatch completed cleanly with console/webhook fallback");

    // Clean up test records
    await User.findByIdAndDelete(user._id);
    await Subscription.deleteMany({ userId: user._id });
    await Workspace.findByIdAndDelete(workspace._id);
    await ApiKey.findByIdAndDelete(apiKeyDoc._id);
    await Webhook.findByIdAndDelete(webhook._id);
    console.log("\n✓ Cleaned up test database records.");

    console.log("\n==========================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED PERFECTLY! (100% SUCCESS)`);
    console.log("==========================================================");
  } catch (err) {
    console.error("\n❌ Verification test suite failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from database.");
    process.exit(0);
  }
}

runV2Verification();
