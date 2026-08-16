import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import fs from "fs";
import path from "path";

const nukeDatabase = async () => {
  console.log("⚠️  =========================================");
  console.log("💣  INITIATING DATABASE NUKE OPERATION...  💣");
  console.log("⚠️  =========================================");

  try {
    await connectDB();

    console.log("🔥 Dropping all collections & documents...");

    const deleteUsers = await User.deleteMany({});
    console.log(`  - Deleted ${deleteUsers.deletedCount} User records`);

    const deletePdfs = await Pdf.deleteMany({});
    console.log(`  - Deleted ${deletePdfs.deletedCount} Pdf records`);

    const deleteAudits = await PdfAudit.deleteMany({});
    console.log(`  - Deleted ${deleteAudits.deletedCount} PdfAudit records`);

    // Drop entire database to reset indexes & collections
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log("💥 Entire MongoDB database dropped successfully.");
    }

    // Clean uploads directory if present
    const uploadsDir = path.resolve("uploads");
    if (fs.existsSync(uploadsDir)) {
      console.log("🧹 Cleaning uploaded PDF files from disk...");
      const files = fs.readdirSync(uploadsDir, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(".pdf")) {
          const filePath = path.join(file.parentPath || file.path || uploadsDir, file.name);
          try {
            fs.unlinkSync(filePath);
            console.log(`  - Deleted file: ${file.name}`);
          } catch (e) {
            console.error(`  - Failed to delete file ${file.name}:`, e.message);
          }
        }
      }
    }

    console.log("✨ =========================================");
    console.log("✅ DATABASE & UPLOADS NUKED CLEANLY!");
    console.log("✨ =========================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ Nuke operation failed with error:", error);
    process.exit(1);
  }
};

nukeDatabase();
