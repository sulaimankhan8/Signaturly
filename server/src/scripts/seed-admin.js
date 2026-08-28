import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";

async function seedAdmin() {
  console.log("=================================================");
  console.log("  SIGNATURLY PRO - SUPERADMIN CREATION SCRIPT");
  console.log("=================================================");

  // Parse command line arguments (e.g. node seed-admin.js --email=admin@test.com --password=SecretPassword)
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split("=");
    if (key.startsWith("--")) {
      acc[key.replace("--", "")] = value;
    }
    return acc;
  }, {});

  const email = (args.email || process.env.ADMIN_EMAIL || "admin@signaturly.com").trim().toLowerCase();
  const password = args.password || process.env.ADMIN_PASSWORD || "Admin@123456";
  const name = args.name || process.env.ADMIN_NAME || "System Superadmin";

  try {
    if (!env.mongoUri) {
      console.error("ERROR: MONGO_URI is missing in server environment config.");
      process.exit(1);
    }

    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(env.mongoUri);
    console.log("Connected successfully.");

    let existingUser = await User.findOne({ email });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (existingUser) {
      existingUser.role = "superadmin";
      existingUser.name = name;
      existingUser.password = hashedPassword;
      await existingUser.save();
      console.log(`\n SUCCESS: Updated existing user <${email}> to SUPERADMIN role!`);
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        role: "superadmin",
      });
      console.log(`\n SUCCESS: Created new SUPERADMIN account for <${email}>!`);
    }

    console.log("\n-------------------------------------------------");
    console.log("  SUPERADMIN CREDENTIALS FOR ADMIN LOGIN:");
    console.log(`  Portal URL : ${env.appUrl || "http://localhost:5173"}/admin/login`);
    console.log(`  Admin Email: ${email}`);
    console.log(`  Password   : ${password}`);
    console.log(`  Admin Key  : ${env.adminSecret || "signaturly-superadmin-secret"}`);
    console.log("-------------------------------------------------\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("FAILED to seed superadmin user:", error);
    process.exit(1);
  }
}

seedAdmin();
