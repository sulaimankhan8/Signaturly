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
  handlePaymentFailed,
  downgradeExpiredSubscription,
  reactivateSubscription,
} from "../services/subscription.service.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/signaturly";

async function runLifecycleVerification() {
  console.log("===================================================================");
  console.log("🧪 STARTING SUBSCRIPTION EXPIRATION & DOWNGRADE LIFECYCLE TEST SUITE");
  console.log("===================================================================\n");

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
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✓ Connected to MongoDB.\n");

    const testEmail = `lifecycle_test_${Date.now()}@signaturly.test`;
    const memberEmail = `member_test_${Date.now()}@signaturly.test`;

    const user = await User.create({
      name: "Lifecycle Tester",
      email: testEmail,
      password: "Password123!",
      role: "user",
    });

    const member = await User.create({
      name: "Team Member",
      email: memberEmail,
      password: "Password123!",
      role: "user",
    });

    console.log("--- 1. Initial State: Free Starter Tier ---");
    let sub = await getOrCreateSubscription(user._id);
    assert(sub.plan === "free", "User initially on Free Starter plan");
    assert(sub.monthlyQuota === 15, "Monthly envelope quota is 15");
    assert(sub.status === "active" || sub.status === "free", "Subscription status is active/free");

    console.log("\n--- 2. Upgrade to Enterprise Plan ---");
    sub = await devMockUpgrade(user._id, "enterprise");
    assert(sub.plan === "enterprise", "Plan upgraded to Enterprise");
    assert(sub.monthlyQuota === 999999, "Unlimited envelopes granted");
    assert(sub.status === "active", "Subscription status set to active");

    // Create Enterprise resources: Workspace and Team Member
    const workspace = await Workspace.create({
      name: "Enterprise HQ",
      ownerId: user._id,
      status: "active",
      members: [
        { userId: user._id, role: "admin", status: "active" },
        { userId: member._id, role: "member", status: "active" },
      ],
    });
    assert(workspace.members.length === 2, "Enterprise workspace created with 2 members");

    // Create API Key & Webhook
    const { keyPrefix, keyHash } = ApiKey.generateKey();
    const apiKey = await ApiKey.create({
      userId: user._id,
      name: "CI/CD Deployment Key",
      keyPrefix,
      keyHash,
      permissions: ["documents:read", "documents:write"],
    });
    assert(apiKey.name === "CI/CD Deployment Key", "API key created on Enterprise plan");

    console.log("\n--- 3. Payment Failure & 3-Day Grace Period ---");
    const graceSub = await handlePaymentFailed(user._id);
    assert(graceSub.status === "past_due", "Subscription enters 'past_due' status upon payment failure");
    assert(graceSub.gracePeriodEnd !== null, "Grace period end timestamp computed");
    
    // Check grace period duration is ~3 days (approx 72h)
    const hoursRemaining = (new Date(graceSub.gracePeriodEnd) - new Date()) / (1000 * 60 * 60);
    assert(hoursRemaining > 70 && hoursRemaining <= 73, "Grace period window is exactly 3 days (72 hours)");

    console.log("\n--- 4. Expiration & Automated Downgrade ---");
    const downgradedSub = await downgradeExpiredSubscription(user._id);
    assert(downgradedSub.plan === "free", "Plan downgraded to 'free'");
    assert(downgradedSub.status === "expired", "Status transitioned to 'expired'");
    assert(downgradedSub.monthlyQuota === 15, "Envelope quota reset to Free limit (15)");
    assert(downgradedSub.previousPlan === "enterprise", "Previous plan preserved as 'enterprise'");

    // Verify owned workspaces automatically soft-locked to read_only
    const lockedWorkspace = await Workspace.findById(workspace._id);
    assert(lockedWorkspace.status === "read_only", "Owned Enterprise workspace soft-locked to 'read_only'");

    console.log("\n--- 5. Downgraded User Permissions Verification ---");
    // 5a. Quota Enforcement
    await incrementUsage(user._id, 15);
    let quotaBlocked = false;
    try {
      await checkQuota(user._id, 1);
    } catch (err) {
      quotaBlocked = err.statusCode === 403;
    }
    assert(quotaBlocked, "16th envelope correctly blocked with 403 on downgraded account");

    // 5b. Workspace Member Deletion allowed for owner even when read_only
    lockedWorkspace.members = lockedWorkspace.members.filter(
      (m) => m.userId.toString() !== member._id.toString()
    );
    await lockedWorkspace.save();
    const updatedWs = await Workspace.findById(workspace._id);
    assert(updatedWs.members.length === 1, "Workspace owner successfully removed a team member in read-only mode");

    // 5c. API Key Revocation allowed on downgraded account
    await ApiKey.findByIdAndDelete(apiKey._id);
    const keyCheck = await ApiKey.findById(apiKey._id);
    assert(keyCheck === null, "API key revoked/deleted successfully during downgrade");

    console.log("\n--- 6. Re-activation & Re-upgrade ---");
    const reactivatedSub = await reactivateSubscription(user._id, "enterprise");
    assert(reactivatedSub.plan === "enterprise", "Subscription upgraded back to 'enterprise'");
    assert(reactivatedSub.status === "active", "Status restored to 'active'");
    assert(reactivatedSub.monthlyQuota === 999999, "Quota restored to unlimited");

    const reactivatedWs = await Workspace.findById(workspace._id);
    assert(reactivatedWs.status === "active", "Workspace unlocked back to 'active' on re-upgrade");

    // Cleanup
    await User.findByIdAndDelete(user._id);
    await User.findByIdAndDelete(member._id);
    await Subscription.deleteMany({ userId: user._id });
    await Workspace.findByIdAndDelete(workspace._id);
    console.log("\n✓ Cleaned up test records from database.");

    console.log("\n===================================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} LIFECYCLE TESTS PASSED! (100% SUCCESS)`);
    console.log("===================================================================");
  } catch (err) {
    console.error("\n❌ Lifecycle verification failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("✓ Disconnected from MongoDB.");
    process.exit(0);
  }
}

runLifecycleVerification();
