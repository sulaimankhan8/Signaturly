import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { Template } from "../models/Template.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { RecipientOtp } from "../models/RecipientOtp.model.js";
import { PasswordReset } from "../models/PasswordReset.model.js";
import fs from "fs";
import path from "path";

const nukeDatabase = async () => {
  console.log("\n=======================================================");
  console.log("💣  SIGNATURLY PRO - TOTAL DATABASE & SYSTEM NUKE  💣");
  console.log("=======================================================\n");

  try {
    await connectDB();

    console.log("🔥 Wiping all MongoDB collections and documents...");

    const models = [
      { name: "Users & Admins", model: User },
      { name: "Subscriptions & Quotas", model: Subscription },
      { name: "Workspaces & Teams", model: Workspace },
      { name: "Developer API Keys", model: ApiKey },
      { name: "Webhooks", model: Webhook },
      { name: "Document Templates", model: Template },
      { name: "Envelopes & PDFs", model: Pdf },
      { name: "Audit Trail Certificates", model: PdfAudit },
      { name: "Recipients", model: Recipient },
      { name: "Recipient OTPs", model: RecipientOtp },
      { name: "Password Reset Tokens", model: PasswordReset },
    ];

    for (const item of models) {
      try {
        const result = await item.model.deleteMany({});
        console.log(`  ✓ Cleared ${item.name}: ${result.deletedCount} records deleted`);
      } catch (err) {
        console.warn(`  ⚠️ Warning clearing ${item.name}:`, err.message);
      }
    }

    // Drop entire database
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log("\n💥 Entire MongoDB Database dropped cleanly (collections & indexes reset).");
    }

    // Clean physical uploaded files from disk
    const uploadsDir = path.resolve("uploads");
    if (fs.existsSync(uploadsDir)) {
      console.log("\n🧹 Cleaning uploads directory on disk...");
      const files = fs.readdirSync(uploadsDir, { recursive: true, withFileTypes: true });
      let deletedFilesCount = 0;

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(file.parentPath || file.path || uploadsDir, file.name);
          try {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          } catch (e) {
            console.error(`  - Failed to delete file ${file.name}:`, e.message);
          }
        }
      }
      console.log(`  ✓ Deleted ${deletedFilesCount} physical uploaded files from disk.`);
    }

    console.log("\n=======================================================");
    console.log("✨  SUCCESS: SYSTEM WIPED 100% CLEAN!  ✨");
    console.log("   - All Users, Admins, Documents & Keys Deleted");
    console.log("   - Database is completely empty and ready for fresh setup");
    console.log("=======================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Nuke operation failed with error:", error);
    process.exit(1);
  }
};

nukeDatabase();
