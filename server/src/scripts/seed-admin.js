import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { env } from "../config/env.js";

async function seedAdmin() {
  console.log("\n=======================================================");
  console.log("👑  SIGNATURLY PRO - SUPERADMIN ACCOUNT INITIALIZER  👑");
  console.log("=======================================================\n");

  // Parse command line arguments (e.g., node seed-admin.js --email=admin@test.com --password=SecretPassword)
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split("=");
    if (key?.startsWith("--")) {
      acc[key.replace("--", "")] = value;
    }
    return acc;
  }, {});

  const email = (args.email || process.env.ADMIN_EMAIL || "admin@signaturly.pro").trim().toLowerCase();
  const password = args.password || process.env.ADMIN_PASSWORD || "Admin@123456";
  const name = args.name || process.env.ADMIN_NAME || "System Superadmin";
  const adminSecret = env.adminSecret || process.env.ADMIN_SECRET || "signaturly-superadmin-secret";

  try {
    if (!env.mongoUri) {
      console.error("❌ ERROR: MONGO_URI is missing in server environment config.");
      process.exit(1);
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(env.mongoUri);
    console.log("✓ Connected successfully.");

    let user = await User.findOne({ email }).select("+password");

    if (user) {
      user.role = "superadmin";
      user.name = name;
      user.password = password; // Trigger pre-save bcrypt hash
      user.termsAccepted = true;
      await user.save();
      console.log(`\n✓ SUCCESS: Updated existing account <${email}> to SUPERADMIN.`);
    } else {
      user = await User.create({
        name,
        email,
        password,
        role: "superadmin",
        termsAccepted: true,
      });
      console.log(`\n✓ SUCCESS: Created new SUPERADMIN account for <${email}>.`);
    }

    // Initialize/Update Enterprise Unlimited Subscription for Admin
    let sub = await Subscription.findOne({ userId: user._id });
    if (!sub) {
      sub = await Subscription.create({
        userId: user._id,
        plan: "enterprise",
        status: "active",
        monthlyQuota: 999999,
        usedThisMonth: 0,
      });
    } else {
      sub.plan = "enterprise";
      sub.status = "active";
      sub.monthlyQuota = 999999;
      await sub.save();
    }
    console.log("✓ Enterprise Tier & Unlimited Quota granted to Superadmin.");

    console.log("\n=======================================================");
    console.log("  SUPERADMIN CREDENTIALS FOR ADMIN PORTAL LOGIN:");
    console.log("=======================================================");
    console.log(`  Admin Portal URL: http://localhost:5174/login`);
    console.log(`  Admin Email     : ${email}`);
    console.log(`  Password        : ${password}`);
    console.log(`  Admin Secret Key: ${adminSecret}`);
    console.log("=======================================================\n");

    await mongoose.disconnect();
    console.log("✓ Database connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ FAILED to seed superadmin user:", error);
    process.exit(1);
  }
}

seedAdmin();
