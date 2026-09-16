import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });
import mongoose from "mongoose";
import { User } from "./server/src/models/User.model.js";
import { Pdf } from "./server/src/models/Pdf.model.js";
import { Recipient } from "./server/src/models/Recipient.model.js";
import { PdfAudit } from "./server/src/models/PdfAudit.model.js";
import { Template } from "./server/src/models/Template.model.js";

async function runHealthCheck() {
  console.log("--- STARTING DATABASE AND USER VERIFICATION ---");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas!");

  const targetEmail = "suleman1111111111111111@gmail.com";
  let user = await User.findOne({ email: targetEmail });
  
  if (!user) {
    console.log(`User ${targetEmail} not found in DB. Creating/Registering user...`);
    user = await User.create({
      name: "Suleman Khan",
      email: targetEmail,
      password: "8318683295@Ll", // User model pre-save hook will hash this if configured
      isVerified: true,
      role: "user"
    });
    console.log("Created user with ID:", user._id);
  } else {
    console.log(`User ${targetEmail} exists with ID:`, user._id);
  }

  const pdfCount = await Pdf.countDocuments({ ownerId: user._id });
  const templateCount = await Template.countDocuments({ ownerId: user._id });
  console.log(`User has ${pdfCount} PDFs and ${templateCount} Templates.`);

  await mongoose.disconnect();
  console.log("--- VERIFICATION FINISHED ---");
}

runHealthCheck().catch(err => {
  console.error("Health check error:", err);
  process.exit(1);
});
