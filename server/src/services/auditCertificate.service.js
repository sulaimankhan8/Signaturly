import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";

const PAGE = { width: 612, height: 792, margin: 40 };
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.85, 0.87, 0.9);
const GOOD = rgb(0.05, 0.5, 0.28);
const BAD = rgb(0.75, 0.15, 0.15);

// The built-in fonts cover Latin text only. Other scripts are shown as "?" until Unicode fonts are embedded.
const latin = (value) => String(value ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const utc = (date) => (date ? `${new Date(date).toISOString().replace("T", " ").slice(0, 19)} UTC` : "-");

const EVENT_LABELS = {
  created: "Uploaded",
  sent: "Sent",
  viewed: "Opened",
  identity_verified: "Identity checked",
  signed: "Signed",
  completed: "Completed",
  sealed: "Sealed",
  declined: "Declined",
  voided: "Voided",
  downloaded: "Downloaded",
  expired: "Expired",
  reminder_sent: "Reminder",
  automated_reminder: "Reminder",
  recipient_updated: "Signer updated",
  deleted: "Deleted",
};

const identityCheckOf = (recipient) => {
  if (recipient.authVerified && recipient.authVerifiedAt && recipient.authMethod === "email_otp") {
    return `Email link + one-time code (passed ${utc(recipient.authVerifiedAt)})`;
  }
  if (recipient.authVerified && recipient.authVerifiedAt && recipient.authMethod === "passcode") {
    return `Email link + access passcode (passed ${utc(recipient.authVerifiedAt)})`;
  }
  return "Email link";
};

export const verificationUrlFor = (hash) => `${env.appUrl}/verify?hash=${hash}`;

/**
 * Builds the signing record for a document from its complete audit log.
 *
 * @param {string} pdfId
 * @param {string|null} requestingUserId - when given, the caller must own the document
 * @param {{ finalHash?: string }} options - hash of the final signed copy, when the caller already has it
 */
export const generateAuditCertificatePdf = async (pdfId, requestingUserId = null, options = {}) => {
  const pdf = await Pdf.findById(pdfId).populate("userId");
  if (!pdf) throw new ApiError(404, "Document not found");

  if (requestingUserId && String(pdf.userId?._id || pdf.userId) !== String(requestingUserId)) {
    throw new ApiError(403, "Unauthorized access to audit trail");
  }

  const auditLogs = await PdfAudit.find({ pdfId }).sort({ seq: 1, createdAt: 1 });
  const recipients = await Recipient.find({ pdfId }).sort({ signingOrder: 1 });
  const chain = await verifyAuditChainIntegrity(pdfId);

  const finalHash =
    options.finalHash || pdf.versions?.[pdf.versions.length - 1]?.hash || pdf.originalHash || "";

  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page;
  let y;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };

  const ensure = (needed) => {
    if (y - needed < PAGE.margin + 30) newPage();
  };

  const write = (value, { x = PAGE.margin, size = 9, font = regular, color = INK } = {}) => {
    page.drawText(latin(value), { x, y, size, font, color });
  };

  const wrap = (value, font, size, maxWidth) => {
    const words = latin(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const heading = (title) => {
    ensure(40);
    y -= 14;
    write(title, { size: 10.5, font: bold });
    y -= 6;
    page.drawLine({
      start: { x: PAGE.margin, y },
      end: { x: PAGE.width - PAGE.margin, y },
      thickness: 0.75,
      color: RULE,
    });
    y -= 14;
  };

  const row = (label, value, { valueFont = regular, valueSize = 9, color = INK } = {}) => {
    const lines = wrap(value, valueFont, valueSize, PAGE.width - PAGE.margin * 2 - 110);
    ensure(lines.length * 12 + 4);
    write(label, { size: 8.5, font: bold, color: MUTED });
    for (const line of lines) {
      write(line, { x: PAGE.margin + 110, size: valueSize, font: valueFont, color });
      y -= 12;
    }
    y -= 2;
  };

  // ---------- Header ----------
  newPage();
  const completed = pdf.status === "signed";

  write(env.appName, { size: 16, font: bold });
  y -= 18;
  write(completed ? "Certificate of Completion" : "Signing Record", { size: 11, font: bold, color: MUTED });

  // QR code linking to public verification of the final signed copy
  if (finalHash) {
    try {
      const qr = await doc.embedPng(await QRCode.toBuffer(verificationUrlFor(finalHash), { margin: 0, width: 220 }));
      page.drawImage(qr, { x: PAGE.width - PAGE.margin - 64, y: PAGE.height - PAGE.margin - 58, width: 64, height: 64 });
      page.drawText("Scan to verify", {
        x: PAGE.width - PAGE.margin - 62,
        y: PAGE.height - PAGE.margin - 68,
        size: 6.5,
        font: regular,
        color: MUTED,
      });
    } catch (err) {
      console.error("Could not draw verification QR code:", err.message);
    }
  }

  y -= 26;
  write(`Document ID ${pdf._id}`, { size: 7.5, font: mono, color: MUTED });
  y -= 10;
  write(`Generated ${utc(new Date())}`, { size: 7.5, color: MUTED });
  y -= 8;

  // ---------- Document ----------
  heading("Document");
  row("Title", pdf.originalFileName);
  row("Sent by", `${pdf.userId?.name || "Sender"} <${pdf.userId?.email || ""}>`);
  row("Status", `${pdf.status} (${pdf.pageCount} page${pdf.pageCount === 1 ? "" : "s"})`, {
    valueFont: bold,
    color: completed ? GOOD : INK,
  });
  row("Original SHA-256", pdf.originalHash || "-", { valueFont: mono, valueSize: 7.5 });
  row("Signed copy SHA-256", pdf.versions?.length ? finalHash : "-", { valueFont: mono, valueSize: 7.5 });
  if (finalHash) row("Verify online", verificationUrlFor(finalHash), { valueSize: 7.5 });

  // ---------- Signers ----------
  heading(`Recipients (${recipients.length})`);
  if (recipients.length === 0) {
    row("Signed by", `${pdf.userId?.name || "Owner"} (document owner, signed in to their account)`);
  }
  for (const r of recipients) {
    ensure(86);
    write(`${r.name}  <${r.email}>`, { size: 9.5, font: bold });
    y -= 13;
    row("Role / status", `${r.role} / ${r.status}`, { color: r.status === "signed" ? GOOD : r.status === "declined" ? BAD : INK });
    row("Identity check", identityCheckOf(r));
    if (r.status === "signed") {
      row("Signed at", utc(r.signedAt));
      row(
        "Consent",
        r.consent?.accepted
          ? `Agreed to sign electronically (${r.consent.version || "consent text"}) at ${utc(r.consent.acceptedAt)}`
          : "Not recorded"
      );
    }
    if (r.status === "declined") row("Decline reason", r.declineReason || "-");
    if (r.ipAddress) row("IP address", r.ipAddress, { valueFont: mono, valueSize: 8 });
    y -= 6;
  }

  // ---------- Events ----------
  heading(`Audit log (${auditLogs.length} entr${auditLogs.length === 1 ? "y" : "ies"})`);
  for (const log of auditLogs) {
    const description = log.description || `${log.actorName || "User"}: ${log.event}`;
    const lines = wrap(description, regular, 8, PAGE.width - PAGE.margin * 2 - 215);
    ensure(lines.length * 10 + 16);

    write(typeof log.seq === "number" ? `#${log.seq}` : "-", { size: 7.5, font: mono, color: MUTED });
    write(utc(log.signedAt || log.createdAt), { x: PAGE.margin + 26, size: 7.5, font: mono, color: MUTED });
    write(EVENT_LABELS[log.event] || log.event, { x: PAGE.margin + 138, size: 8, font: bold });
    lines.forEach((line, i) => {
      if (i > 0) y -= 10;
      write(line, { x: PAGE.margin + 215, size: 8 });
    });
    y -= 10;
    if (log.eventHash) {
      write(`entry hash ${log.eventHash.slice(0, 32)}...`, { x: PAGE.margin + 215, size: 6.5, font: mono, color: MUTED });
      y -= 9;
    }
    y -= 3;
  }

  ensure(30);
  y -= 6;
  write(
    chain.isChainValid
      ? "Audit log integrity: every entry is linked to the one before it and none has been altered."
      : `Audit log integrity: could not be confirmed (${chain.reason || "unknown reason"}).`,
    { size: 8, font: bold, color: chain.isChainValid ? GOOD : BAD }
  );

  // ---------- Footer on every page ----------
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      latin(`Record of events logged by ${env.appName}. Times are in UTC. Page ${index + 1} of ${pages.length} of this record.`),
      { x: PAGE.margin, y: 24, size: 6.5, font: regular, color: MUTED }
    );
  });

  doc.setTitle(latin(`Signing record - ${pdf.originalFileName}`));
  doc.setProducer(latin(env.appName));

  return Buffer.from(await doc.save());
};
