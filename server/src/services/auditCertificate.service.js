import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";

export const generateAuditCertificatePdf = async (pdfId, requestingUserId) => {
  const pdf = await Pdf.findById(pdfId).populate("userId");
  if (!pdf) throw new ApiError(404, "Document not found");

  const auditLogs = await PdfAudit.find({ pdfId }).sort({ signedAt: 1, createdAt: 1 });
  const recipients = await Recipient.find({ pdfId });

  // Create new PDF Document
  const doc = await PDFDocument.create();
  let page = doc.addPage([612, 792]); // Standard US Letter
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  // Background Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0.05, 0.06, 0.08), // #0c0f14
  });

  page.drawRectangle({
    x: 0,
    y: height - 104,
    width: width,
    height: 4,
    color: rgb(0.86, 0.15, 0.15), // Red accent
  });

  // Brand Title
  page.drawText("SIGNATURLY PRO", {
    x: 40,
    y: height - 50,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("CRYPTOGRAPHIC AUDIT TRAIL & EXECUTION CERTIFICATE", {
    x: 40,
    y: height - 72,
    size: 9,
    font: fontBold,
    color: rgb(0.95, 0.4, 0.4),
  });

  page.drawText(`Certificate ID: ${pdf._id}`, {
    x: width - 240,
    y: height - 50,
    size: 8,
    font: fontMono,
    color: rgb(0.7, 0.7, 0.7),
  });

  page.drawText(`Generated: ${new Date().toUTCString()}`, {
    x: width - 240,
    y: height - 65,
    size: 8,
    font: fontRegular,
    color: rgb(0.7, 0.7, 0.7),
  });

  let currentY = height - 130;

  // Section 1: Document Details
  page.drawText("DOCUMENT SUMMARY", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 15;

  page.drawRectangle({
    x: 40,
    y: currentY - 50,
    width: width - 80,
    height: 60,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
  });

  page.drawText(`Document Title:`, { x: 50, y: currentY - 5, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${pdf.originalFileName}`, { x: 140, y: currentY - 5, size: 9, font: fontBold, color: rgb(0, 0, 0) });

  page.drawText(`Owner / Sender:`, { x: 50, y: currentY - 22, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${pdf.userId?.name || "Sender"} (${pdf.userId?.email || ""})`, { x: 140, y: currentY - 22, size: 9, font: fontRegular, color: rgb(0, 0, 0) });

  page.drawText(`Document Status:`, { x: 50, y: currentY - 39, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${pdf.status.toUpperCase()} (${pdf.pageCount} pages)`, { x: 140, y: currentY - 39, size: 9, font: fontBold, color: pdf.status === "signed" ? rgb(0.05, 0.6, 0.3) : rgb(0.8, 0.4, 0) });

  currentY -= 75;

  // Section 2: Cryptographic Integrity Hashes
  page.drawText("CRYPTOGRAPHIC CHECKSUMS (SHA-256)", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 15;

  page.drawRectangle({
    x: 40,
    y: currentY - 45,
    width: width - 80,
    height: 55,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.9),
    borderWidth: 1,
  });

  page.drawText(`Original Hash:`, { x: 50, y: currentY - 8, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${pdf.originalHash || "N/A"}`, { x: 130, y: currentY - 8, size: 7.5, font: fontMono, color: rgb(0.1, 0.4, 0.7) });

  const latestSignedAudit = auditLogs.filter(a => a.signedHash).pop();
  page.drawText(`Executed Hash:`, { x: 50, y: currentY - 28, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`${latestSignedAudit?.signedHash || pdf.originalHash || "N/A"}`, { x: 130, y: currentY - 28, size: 7.5, font: fontMono, color: rgb(0.7, 0.1, 0.1) });

  currentY -= 70;

  // Section 3: Signer Manifest
  page.drawText(`SIGNER MANIFEST (${recipients.length} Recipient(s))`, {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 15;

  for (const r of recipients) {
    page.drawRectangle({
      x: 40,
      y: currentY - 32,
      width: width - 80,
      height: 38,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.88, 0.9, 0.92),
      borderWidth: 1,
    });

    page.drawText(`${r.name}`, { x: 50, y: currentY - 8, size: 9, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(`${r.email}`, { x: 50, y: currentY - 22, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

    page.drawText(`Status: ${r.status.toUpperCase()}`, { x: 260, y: currentY - 8, size: 8, font: fontBold, color: r.status === "signed" ? rgb(0.05, 0.6, 0.3) : rgb(0.4, 0.4, 0.4) });
    if (r.signedAt) {
      page.drawText(`Signed: ${new Date(r.signedAt).toLocaleString()}`, { x: 260, y: currentY - 22, size: 7.5, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    }

    if (r.ipAddress) {
      page.drawText(`IP: ${r.ipAddress}`, { x: 420, y: currentY - 8, size: 7.5, font: fontMono, color: rgb(0.4, 0.4, 0.4) });
    }

    currentY -= 46;
  }

  currentY -= 15;

  // Section 4: Chronological Event History
  page.drawText("CHRONOLOGICAL AUDIT TIMELINE", {
    x: 40,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  currentY -= 15;

  for (const log of auditLogs.slice(0, 10)) {
    if (currentY < 100) {
      // Add new page if space is low
      page = doc.addPage([612, 792]);
      currentY = height - 50;
    }

    const timeStr = new Date(log.signedAt || log.createdAt).toLocaleString();
    const eventName = (log.event || "LOG").toUpperCase();

    page.drawCircle({
      x: 48,
      y: currentY - 3,
      size: 3,
      color: rgb(0.86, 0.15, 0.15),
    });

    page.drawText(`[${timeStr}]`, { x: 60, y: currentY - 5, size: 7.5, font: fontMono, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${eventName}:`, { x: 175, y: currentY - 5, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    
    const descText = (log.description || `${log.actorName || 'User'} performed ${log.event}`).slice(0, 70);
    page.drawText(descText, { x: 235, y: currentY - 5, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

    currentY -= 20;
  }

  // Footer Disclaimer
  page.drawRectangle({
    x: 40,
    y: 35,
    width: width - 80,
    height: 35,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.9, 0.92, 0.94),
    borderWidth: 1,
  });

  page.drawText("This certificate serves as a legal tamper-evident record of electronic signature execution under India IT Act 2000 (Sec 10A), US ESIGN (15 U.S.C. 7001), and EU eIDAS (No 910/2014).", {
    x: 50,
    y: 54,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText("Cryptographically sealed by Signaturly Pro Vault. Document SHA-256 hashes verify against unauthorized modification.", {
    x: 50,
    y: 43,
    size: 6.5,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
};
