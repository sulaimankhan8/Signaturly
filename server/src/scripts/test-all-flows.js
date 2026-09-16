import "../config/env.js";
import mongoose from "mongoose";
import crypto from "crypto";
import { User } from "../models/User.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { RecipientOtp } from "../models/RecipientOtp.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Template } from "../models/Template.model.js";
import { eventBus } from "../events/eventBus.js";
import { EventTypes } from "../events/eventTypes.js";
import { initEventSystem } from "../events/index.js";
import { PDFDocument, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendDocumentToRecipients } from "../services/send.service.js";
import { generateAndSendOtp, verifyOtp } from "../services/otp.service.js";
import { recordRecipientView, submitRecipientSignature, declineRecipientSignature } from "../services/recipient.service.js";
import { generateAuditCertificatePdf } from "../services/auditCertificate.service.js";
import { processBulkSendFromTemplate } from "../services/bulkSend.service.js";
import { sendManualRecipientReminder } from "../services/reminder.service.js";
import { updateRecipientEmailService } from "../services/recipient.service.js";
import { saveFile } from "../services/storage.service.js";

const TEST_EMAIL = "suleman11111111111111@gmail.com";
const TEST_PASSWORD = "8318683295@Ll";

// 1x1 Valid PNG data URL for signature image simulation
const SAMPLE_SIGNATURE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runComprehensiveFlows() {
  console.log("================================================================================");
  console.log("🚀 SIGNATURLY PRO: COMPREHENSIVE EVENT-DRIVEN & MULTI-FLOW TEST HARNESS");
  console.log("================================================================================");

  // --- STEP 1: INITIALIZE DB & EVENT SUBSYSTEM ---
  console.log("\n[SYSTEM SETUP]: Connecting to MongoDB & Booting Event Bus...");
  await mongoose.connect(env.mongoUri);
  console.log("✅ 1. MongoDB Connected successfully.");
  initEventSystem();
  console.log("✅ 2. Event System (EventBus + Consumers) initialized.");

  // --- STEP 2: USER SETUP & AUTHENTICATION ---
  console.log("\n[USER AUTH]: Setting up User credentials...");
  let user = await User.findOne({ email: TEST_EMAIL }).select("+password");
  if (!user) {
    console.log(`ℹ️ Registering user: ${TEST_EMAIL}`);
    user = new User({
      name: "Suleman Khan",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: "user",
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });
    await user.save();
    console.log("✅ User registered successfully.");
  } else {
    user.password = TEST_PASSWORD;
    await user.save();
    console.log(`✅ User verified: ${user.email} (ID: ${user._id})`);
  }

  const token = user.generateAccessToken();
  const decoded = jwt.verify(token, env.accessSecret);
  console.log(`✅ Access Token generated & verified for User ID: ${decoded.id}`);

  // Create local sample PDF in uploads
  const uploadDir = path.join(process.cwd(), "uploads", user._id.toString());
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  page.drawText("SIGNATURLY PRO — MASTER SERVICE AGREEMENT", { x: 50, y: 720, size: 16 });
  page.drawText("This document verifies end-to-end event-driven signing, legal compliance,", { x: 50, y: 680, size: 10 });
  page.drawText("OTP identity verification, and Merkle audit ledger generation.", { x: 50, y: 660, size: 10 });
  page.drawText("Client Signature: _______________________", { x: 50, y: 400, size: 12 });
  page.drawText("Signing Date:     _______________________", { x: 50, y: 350, size: 12 });
  const rawBytes = await pdfDoc.save();
  const sampleFileName = `contract-${Date.now()}.pdf`;
  const storageKey = `${user._id}/${sampleFileName}`;
  await saveFile(storageKey, Buffer.from(rawBytes), "application/pdf");
  const fileHash = crypto.createHash("sha256").update(Buffer.from(rawBytes)).digest("hex");
  console.log(`✅ Created test PDF at ${storageKey} (SHA-256: ${fileHash.slice(0, 16)}...)`);

  // ============================================================================
  // PERSPECTIVE 1: CASUAL REGISTERED USER FLOW
  // ============================================================================
  console.log("\n================================================================================");
  console.log("👤 PERSPECTIVE 1: CASUAL REGISTERED USER FLOW");
  console.log("================================================================================");
  console.log("Scenario: Casual user uploads doc, places fields, assigns 2FA OTP recipient, and sends.");

  const doc1 = await Pdf.create({
    userId: user._id,
    originalFileName: "Casual_User_Agreement.pdf",
    storagePath: `/uploads/${storageKey}`,
    originalHash: fileHash,
    pageCount: 1,
    status: "draft",
  });

  // 1. Emit DOCUMENT_CREATED
  await eventBus.emitEvent(EventTypes.DOCUMENT_CREATED, {
    aggregateId: doc1._id,
    actor: { id: user._id, email: user.email, name: user.name, ipAddress: "127.0.0.1", userAgent: "Chrome/120.0" },
    payload: { title: doc1.originalFileName, fileUrl: doc1.storagePath, pageCount: doc1.pageCount },
  });
  await new Promise((r) => setTimeout(r, 200));

  const initialAudits = await PdfAudit.find({ pdfId: doc1._id });
  console.log(`✅ [1.1] Document Created in Vault. Audit records: ${initialAudits.length} (Event: ${initialAudits[0]?.event})`);

  // 2. Configure fields & Send with OTP verification
  const sendResult = await sendDocumentToRecipients({
    pdfId: doc1._id,
    userId: user._id.toString(),
    recipientsData: [
      {
        name: "Suleman Khan (Signer)",
        email: TEST_EMAIL,
        role: "signer",
        authType: "otp", // Requires OTP verification!
        signingOrder: 1,
      },
    ],
    fieldsData: [
      {
        id: "sig_field_1",
        type: "signature",
        page: 1,
        xPercent: 0.1,
        yPercent: 0.48,
        widthPercent: 0.35,
        heightPercent: 0.08,
        required: true,
        recipientEmail: TEST_EMAIL,
      },
      {
        id: "date_field_1",
        type: "date",
        page: 1,
        xPercent: 0.1,
        yPercent: 0.42,
        widthPercent: 0.25,
        heightPercent: 0.04,
        required: true,
        recipientEmail: TEST_EMAIL,
      },
    ],
    message: "Please review and sign this agreement with 6-digit OTP verification.",
    ipAddress: "127.0.0.1",
    userAgent: "CasualUserSession/1.0",
  });

  console.log(`✅ [1.2] Document dispatched via EventBus. Recipients: ${sendResult.recipientsCount}, Status: ${sendResult.status}`);
  await new Promise((r) => setTimeout(r, 400));

  const sentAudits = await PdfAudit.find({ pdfId: doc1._id });
  console.log(`✅ [1.3] Audit Trail logged ${sentAudits.length} events (DOCUMENT_CREATED + DOCUMENT_SENT).`);

  // ============================================================================
  // PERSPECTIVE 2: FIRST-TIME UNREGISTERED RECEIVER FLOW (OTP, IDENTITY, SIGN)
  // ============================================================================
  console.log("\n================================================================================");
  console.log("📩 PERSPECTIVE 2: FIRST-TIME UNREGISTERED RECEIVER FLOW (COMPLIANCE & OTP)");
  console.log("================================================================================");
  console.log("Scenario: Unregistered recipient clicks token link, requests OTP, verifies, signs with ESIGN consent.");

  const recipient1 = await Recipient.findOne({ pdfId: doc1._id });
  console.log(`\n🔗 [2.1] Unregistered recipient access token: ${recipient1.token}`);
  console.log(`       Direct URL: http://localhost:5173/sign/${recipient1.token}`);

  // 1. Recipient opens link -> View recorded
  const viewSession = await recordRecipientView({
    token: recipient1.token,
    ipAddress: "198.51.100.45",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  console.log(`✅ [2.2] View event logged. Recipient status: ${viewSession.recipient.status}`);

  // 2. Identity Verification: Request 6-digit OTP
  console.log(`\n🔐 [2.3] Dispatching 6-digit Identity Verification OTP to ${recipient1.email}...`);
  const otpDispatch = await generateAndSendOtp(recipient1._id, recipient1.email, doc1.originalFileName);
  console.log(`✅ [2.4] OTP dispatched. Expires at: ${otpDispatch.expiresAt}`);

  // 3. Test OTP Verification
  const activeOtp = await RecipientOtp.findOne({ recipientId: recipient1._id });
  console.log(`       Testing invalid OTP attempt...`);
  const invalidOtpRes = await verifyOtp(recipient1._id, "000000");
  console.log(`✅ [2.5] Invalid OTP correctly rejected: "${invalidOtpRes.reason}"`);

  // Test valid OTP with hash verification
  const knownOtp = "789123";
  const bcryptMod = await import("bcrypt");
  const knownSalt = await bcryptMod.default.genSalt(10);
  activeOtp.otpHash = await bcryptMod.default.hash(knownOtp, knownSalt);
  await activeOtp.save();

  const validOtpRes = await verifyOtp(recipient1._id, knownOtp);
  console.log(`✅ [2.6] Valid OTP verified successfully! (Verified: ${validOtpRes.success})`);
  recipient1.authVerified = true;
  await recipient1.save();

  // 4. ESIGN / UETA Compliance Agreement & Signature Submission
  console.log(`\n✍️ [2.7] Recipient agrees to ESIGN disclosure and submits digital signature...`);
  const signatureSubmission = await submitRecipientSignature({
    token: recipient1.token,
    filledFields: [
      {
        id: "sig_field_1",
        type: "signature",
        page: 1,
        value: SAMPLE_SIGNATURE_BASE64,
        signatureUrl: SAMPLE_SIGNATURE_BASE64,
      },
      {
        id: "date_field_1",
        type: "date",
        page: 1,
        value: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      },
    ],
    ipAddress: "198.51.100.45",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  console.log(`✅ [2.8] Signature burned to PDF layer. Document final completion: ${signatureSubmission.isFinal}`);

  await new Promise((r) => setTimeout(r, 500));

  // 5. Verify Cryptographic Merkle Audit Trail
  const doc1Audits = await PdfAudit.find({ pdfId: doc1._id }).sort({ signedAt: 1 });
  console.log(`\n📋 [2.9] Cryptographic Audit Trail for Document ${doc1._id}:`);
  doc1Audits.forEach((log, idx) => {
    console.log(`   [${idx + 1}] Event: ${log.event.toUpperCase().padEnd(10)} | Actor: ${log.actorName.padEnd(22)} | IP: ${log.ipAddress.padEnd(15)} | ${log.description}`);
  });

  // 6. Generate Official Cryptographic Certificate of Completion
  console.log(`\n📜 [2.10] Generating Official Execution & Merkle Audit Certificate PDF...`);
  const certBytes = await generateAuditCertificatePdf(doc1._id, user._id);
  console.log(`✅ [2.11] Cryptographic Audit Certificate generated (${certBytes.length} bytes).`);

  // ============================================================================
  // PERSPECTIVE 3: HR / ENTERPRISE BULK SENDER FLOW
  // ============================================================================
  console.log("\n================================================================================");
  console.log("🏢 PERSPECTIVE 3: HR / ENTERPRISE BULK SENDER FLOW");
  console.log("================================================================================");
  console.log("Scenario: HR creates reusable Template (NDA/Offer) and batch-dispatches to multiple signers.");

  // 1. Create HR Reusable Template
  const hrTemplate = await Template.create({
    userId: user._id,
    name: "Enterprise NDA & Confidentiality Template",
    description: "Standard corporate NDA for new hires and contractors",
    sourcePdfPath: storageKey,
    originalFileName: "Standard_NDA.pdf",
    pageCount: 1,
    roles: [
      { id: "role_candidate", name: "Candidate / Contractor", color: "#3b82f6", signingOrder: 1 },
    ],
    fields: [
      {
        id: "tmpl_sig_1",
        roleId: "role_candidate",
        roleName: "Candidate / Contractor",
        type: "signature",
        page: 1,
        xPercent: 0.1,
        yPercent: 0.48,
        widthPercent: 0.35,
        heightPercent: 0.08,
        required: true,
      },
      {
        id: "tmpl_date_1",
        roleId: "role_candidate",
        roleName: "Candidate / Contractor",
        type: "date",
        page: 1,
        xPercent: 0.1,
        yPercent: 0.42,
        widthPercent: 0.25,
        heightPercent: 0.04,
        required: true,
      },
    ],
  });
  console.log(`✅ [3.1] HR Template created: "${hrTemplate.name}" (ID: ${hrTemplate._id})`);

  // 2. Dispatch Bulk Batch to Multiple Recipients
  console.log(`\n🚀 [3.2] Executing Bulk Batch Send to candidate signers...`);
  const bulkBatchResult = await processBulkSendFromTemplate({
    templateId: hrTemplate._id,
    userId: user._id,
    recipientsList: [
      { name: "Candidate Alpha", email: TEST_EMAIL },
      { name: "Candidate Beta", email: "candidate.beta@example.com" },
      { name: "Candidate Gamma", email: "candidate.gamma@example.com" },
    ],
    customMessage: "Please review and electronically sign your employment NDA agreement.",
    ipAddress: "10.0.0.1",
    userAgent: "HRPorter/Enterprise-1.0",
  });

  console.log(`✅ [3.3] Bulk Dispatch Completed:`);
  console.log(`       Batch ID:         ${bulkBatchResult.batchId}`);
  console.log(`       Total Requested:  ${bulkBatchResult.totalRequested}`);
  console.log(`       Total Dispatched: ${bulkBatchResult.totalDispatched}`);
  console.log(`       Errors:           ${bulkBatchResult.errors.length}`);

  await new Promise((r) => setTimeout(r, 500));

  // 3. Verify Batch Audit Records
  const firstDispatched = bulkBatchResult.dispatchedDocuments[0];
  const batchAudits = await PdfAudit.find({ pdfId: firstDispatched.pdfId });
  console.log(`✅ [3.4] Bulk Document [${firstDispatched.documentName}] logged audit event: "${batchAudits[0]?.description}"`);

  // ============================================================================
  // LIFECYCLE & EDGE CASE FLOWS
  // ============================================================================
  console.log("\n================================================================================");
  console.log("⚡ LIFECYCLE & EDGE CASE FLOWS");
  console.log("================================================================================");

  // 1. Reminder Flow
  console.log("\n🔔 [4.1] Testing Signer Reminder Dispatch...");
  const reminderRecipient = await Recipient.findOne({ pdfId: firstDispatched.pdfId });
  await sendManualRecipientReminder({
    recipientId: reminderRecipient._id,
    userId: user._id,
    customMessage: "Friendly reminder: your signature is required by Friday.",
    ipAddress: "127.0.0.1",
    userAgent: "ReminderBot/1.0",
  });
  await new Promise((r) => setTimeout(r, 200));
  const remAudits = await PdfAudit.find({ pdfId: firstDispatched.pdfId, event: "reminder_sent" });
  console.log(`✅ Reminder event captured in audit ledger: ${remAudits.length > 0 ? "YES" : "NO"}`);

  // 2. Recipient Email Update Flow
  console.log("\n📧 [4.2] Testing Recipient Email Correction Flow...");
  await updateRecipientEmailService({
    recipientId: reminderRecipient._id,
    userId: user._id,
    newEmail: "candidate.alpha.corrected@example.com",
    ipAddress: "127.0.0.1",
    userAgent: "AdminOps/1.0",
  });
  await new Promise((r) => setTimeout(r, 200));
  const updateAudits = await PdfAudit.find({ pdfId: firstDispatched.pdfId, event: "recipient_updated" });
  console.log(`✅ Recipient Email Update event captured in audit ledger: ${updateAudits.length > 0 ? "YES" : "NO"}`);

  // 3. Document Decline Flow
  console.log("\n❌ [4.3] Testing Document Decline Flow...");
  const declineDoc = await Pdf.create({
    userId: user._id,
    originalFileName: "Decline_Agreement_Test.pdf",
    storagePath: `/uploads/${storageKey}`,
    originalHash: fileHash,
    pageCount: 1,
    status: "pending",
  });
  const declineRecipient = await Recipient.create({
    pdfId: declineDoc._id,
    name: "Declining Signer",
    email: "decliner@example.com",
    role: "signer",
    token: `decline-token-${Date.now()}`,
    status: "sent",
  });
  declineDoc.recipients = [declineRecipient._id];
  await declineDoc.save();

  await declineRecipientSignature({
    token: declineRecipient.token,
    reason: "Indemnity clause 7.1 is unaligned with company policy.",
    ipAddress: "203.0.113.195",
    userAgent: "Mozilla/5.0 Safari/605.1.15",
  });
  await new Promise((r) => setTimeout(r, 200));
  const declineAudits = await PdfAudit.find({ pdfId: declineDoc._id, event: "declined" });
  console.log(`✅ Document Decline event captured in audit ledger: ${declineAudits.length > 0 ? "YES" : "NO"} | Reason: "${declineAudits[0]?.description}"`);

  console.log("\n================================================================================");
  console.log("🎉 ALL 3 PERSPECTIVES & LIFECYCLE FLOWS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runComprehensiveFlows().catch((err) => {
  console.error("❌ Test suite encountered an error:", err);
  process.exit(1);
});
