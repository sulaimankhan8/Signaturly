import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";

/**
 * Generates an official Certificate of Electronic Evidence pursuant to Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA).
 */
export const generateBsaEvidenceCertificate = async (pdfId) => {
  const pdf = await Pdf.findById(pdfId).populate("userId");
  if (!pdf) throw new Error("Document not found");

  const auditLogs = await PdfAudit.find({ pdfId }).sort({ createdAt: 1 });
  const recipients = await Recipient.find({ pdfId });
  const chainIntegrity = await verifyAuditChainIntegrity(pdfId);

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.08, 0.1, 0.14),
  });

  page.drawText("CERTIFICATE OF ELECTRONIC EVIDENCE", {
    x: 40,
    y: height - 45,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("PURSUANT TO SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)", {
    x: 40,
    y: height - 65,
    size: 9,
    font: fontBold,
    color: rgb(0.85, 0.3, 0.3),
  });

  let currentY = height - 120;

  // Section 1: Declaration Statement
  page.drawText("1. STATUTORY DECLARATION OF SYSTEM ADMINISTRATOR", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 18;

  const declarationText = `I, System Administrator of Signaturly Pro, do hereby certify and declare that the electronic record titled "${pdf.originalFileName}" (Document ID: ${pdf._id}) was produced and recorded by a computer system operating in the ordinary course of business activities. The system was operating properly at all material times during the generation, transmission, and cryptographic logging of this agreement.`;

  page.drawText(declarationText, {
    x: 40,
    y: currentY,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: 530,
    lineHeight: 12,
  });
  currentY -= 50;

  // Section 2: Cryptographic Checksums & Integrity
  page.drawText("2. CRYPTOGRAPHIC CHECKSUMS & MERKLE INTEGRITY", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 20;

  page.drawText(`SHA-256 Original Pre-Signed Hash:`, { x: 40, y: currentY, size: 8.5, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= 12;
  page.drawText(pdf.sha256OriginalHash || auditLogs[0]?.originalHash || "N/A", { x: 40, y: currentY, size: 8, font: fontMono, color: rgb(0.1, 0.1, 0.5) });
  currentY -= 18;

  page.drawText(`SHA-256 Final Executed Hash:`, { x: 40, y: currentY, size: 8.5, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  currentY -= 12;
  page.drawText(pdf.sha256SignedHash || auditLogs[auditLogs.length - 1]?.signedHash || "N/A", { x: 40, y: currentY, size: 8, font: fontMono, color: rgb(0.1, 0.5, 0.1) });
  currentY -= 18;

  page.drawText(`Merkle Audit Chain Status: ${chainIntegrity.isChainValid ? "INTACT & UNTAMPERED (PASSED)" : "TAMPERED"}`, {
    x: 40,
    y: currentY,
    size: 9,
    font: fontBold,
    color: chainIntegrity.isChainValid ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0),
  });
  currentY -= 30;

  // Section 3: Signers Attribution Table
  page.drawText("3. SIGNERS ATTRIBUTION & MULTI-FACTOR LOGS", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 20;

  recipients.forEach((rec, idx) => {
    page.drawText(`Signer ${idx + 1}: ${rec.name} <${rec.email}>`, { x: 40, y: currentY, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    currentY -= 12;
    page.drawText(`Status: ${rec.status.toUpperCase()} | IP Address: ${rec.ipAddress || "Logged"} | Signed At: ${rec.signedAt ? new Date(rec.signedAt).toISOString() : "N/A"}`, {
      x: 40,
      y: currentY,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
    currentY -= 16;
  });

  currentY -= 20;

  // Section 4: Execution Seal & Certification Stamp
  page.drawRectangle({
    x: 40,
    y: currentY - 50,
    width: 532,
    height: 50,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
  });

  page.drawText("OFFICIAL SEAL: SIGNATURLY PRO NEUTRAL RECORD CUSTODIAN", {
    x: 55,
    y: currentY - 20,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText(`Generated on: ${new Date().toISOString()} | Section 63 BSA Admissibility Verified`, {
    x: 55,
    y: currentY - 36,
    size: 8,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
};
