import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";
import { drawShapedText, measureText, isPlainLatin } from "./textShaping.service.js";
import { formatEvidenceTime } from "../utils/format.js";
import { describeIdentityCheck } from "../utils/identityCheck.js";
import { t, own, LANGUAGE_NAMES, DEFAULT_LANGUAGE } from "../i18n/messages.js";
import { brandingFor } from "./branding.service.js";

const PAGE = { width: 612, height: 792, margin: 40 };
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.85, 0.87, 0.9);
const GOOD = rgb(0.05, 0.5, 0.28);
const BAD = rgb(0.75, 0.15, 0.15);

// Columns of the audit log table, measured from the left margin
const TIME_COLUMN = 26;
const EVENT_COLUMN = 250;
const DESCRIPTION_COLUMN = 330;
// Width of the label column in the document and signer sections
const LABEL_COLUMN = 120;

// The built-in fonts cover Latin text only. Other scripts are shown as "?" until Unicode fonts are embedded.
const latin = (value) => String(value ?? "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const utc = (date) => formatEvidenceTime(date);

const EVENT_KEYS = new Set([
  "created",
  "sent",
  "viewed",
  "identity_verified",
  "signed",
  "completed",
  "sealed",
  "declined",
  "voided",
  "downloaded",
  "expired",
  "reminder_sent",
  "automated_reminder",
  "recipient_updated",
  "deleted",
]);

/**
 * The second language of a signing record, or null for an English-only record.
 *
 * The record is always written in English. When signers were sent the document in another
 * language, the headings and labels are repeated in the one most of them read, so a signer can
 * follow what the record says. Values (names, times, hashes, the logged descriptions) appear once.
 */
export const recordLanguageOf = (recipients) => {
  const counts = new Map();
  for (const recipient of recipients) {
    const language = recipient.language;
    if (!language || language === DEFAULT_LANGUAGE) continue;
    // A language whose wording has not been written yet cannot be printed
    if (own(language, "record.title.pending") === undefined) continue;
    counts.set(language, (counts.get(language) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const identityCheckOf = (recipient) => {
  const label = describeIdentityCheck(recipient);
  const passed = recipient.authVerified && recipient.authVerifiedAt && recipient.authType !== "none";
  return passed ? `${label} (passed ${utc(recipient.authVerifiedAt)})` : label;
};

const contactOf = (recipient) => recipient.email || recipient.phone || "";

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

  // English, and the same heading in the signers' language when there is one
  const second = recordLanguageOf(recipients);
  const english = (key, params) => t(DEFAULT_LANGUAGE, key, params);
  const translated = (key, params) => (second ? own(second, key, params) : undefined);

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
    if (isPlainLatin(value)) {
      page.drawText(String(value ?? ""), { x, y, size, font, color });
    } else {
      drawShapedText(page, value, { x, y, size, color, bold: font === bold });
    }
  };

  const widthOf = (value, font, size) =>
    isPlainLatin(value) ? font.widthOfTextAtSize(value, size) : measureText(value, size, { bold: font === bold });

  const wrap = (value, font, size, maxWidth) => {
    const words = String(value ?? "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate, font, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  const heading = (key, suffix = "") => {
    ensure(40);
    y -= 14;
    const title = `${english(key)}${suffix}`;
    write(title, { size: 10.5, font: bold });
    const other = translated(key);
    if (other) write(other, { x: PAGE.margin + widthOf(title, bold, 10.5) + 10, size: 9.5, color: MUTED });
    y -= 6;
    page.drawLine({
      start: { x: PAGE.margin, y },
      end: { x: PAGE.width - PAGE.margin, y },
      thickness: 0.75,
      color: RULE,
    });
    y -= 14;
  };

  const row = (key, value, { valueFont = regular, valueSize = 9, color = INK } = {}) => {
    const lines = wrap(value, valueFont, valueSize, PAGE.width - PAGE.margin * 2 - LABEL_COLUMN);
    const other = translated(key);
    ensure(Math.max(lines.length, other ? 2 : 1) * 12 + 4);

    const top = y;
    write(english(key), { size: 8.5, font: bold, color: MUTED });
    for (const line of lines) {
      write(line, { x: PAGE.margin + LABEL_COLUMN, size: valueSize, font: valueFont, color });
      y -= 12;
    }
    if (other) {
      // The second-language label sits under the English one, so the row is at least two lines tall
      const valueBottom = y;
      y = top - 10;
      write(other, { size: 7.5, color: MUTED });
      y = Math.min(valueBottom, top - 22);
    }
    y -= 2;
  };

  // ---------- Header ----------
  newPage();
  const completed = pdf.status === "signed";

  // A team's documents carry the team's name at the head of the record. The foot of every page
  // still says who kept the record.
  const { brand } = await brandingFor(pdf);
  write(brand?.companyName || env.appName, { size: 16, font: bold });
  y -= 18;
  const titleKey = completed ? "record.title.completed" : "record.title.pending";
  write(english(titleKey), { size: 11, font: bold, color: MUTED });
  if (translated(titleKey)) {
    write(translated(titleKey), { x: PAGE.margin + widthOf(english(titleKey), bold, 11) + 10, size: 10.5, color: MUTED });
  }

  // QR code linking to public verification of the final signed copy
  if (finalHash) {
    try {
      const qr = await doc.embedPng(await QRCode.toBuffer(verificationUrlFor(finalHash), { margin: 0, width: 220 }));
      page.drawImage(qr, { x: PAGE.width - PAGE.margin - 64, y: PAGE.height - PAGE.margin - 58, width: 64, height: 64 });
      // Both captions end at the right margin, under the code
      const captionY = y;
      const caption = (text, offset, size) => {
        y = PAGE.height - PAGE.margin - offset;
        write(text, { x: PAGE.width - PAGE.margin - widthOf(text, regular, size), size, color: MUTED });
      };
      caption(english("record.scan"), 68, 6.5);
      if (translated("record.scan")) caption(translated("record.scan"), 77, 6);
      y = captionY;
    } catch (err) {
      console.error("Could not draw verification QR code:", err.message);
    }
  }

  y -= 26;
  write(`Document ID ${pdf._id}`, { size: 7.5, font: mono, color: MUTED });
  y -= 10;
  write(`Generated ${utc(new Date())}`, { size: 7.5, color: MUTED });
  if (second) {
    const language = LANGUAGE_NAMES[second] || second;
    const noteWidth = PAGE.width - PAGE.margin * 2 - 80;
    for (const note of [english("record.note", { language }), translated("record.note", { language })]) {
      if (!note) continue;
      for (const line of wrap(note, regular, 7.5, noteWidth)) {
        y -= 10;
        write(line, { size: 7.5, color: MUTED });
      }
    }
  }
  y -= 8;

  // ---------- Document ----------
  heading("record.section.document");
  row("record.label.title", pdf.originalFileName);
  row("record.label.sentBy", `${pdf.userId?.name || "Sender"} <${pdf.userId?.email || ""}>`);
  row("record.label.status", `${pdf.status} (${pdf.pageCount} page${pdf.pageCount === 1 ? "" : "s"})`, {
    valueFont: bold,
    color: completed ? GOOD : INK,
  });
  row("record.label.originalHash", pdf.originalHash || "-", { valueFont: mono, valueSize: 7.5 });
  row("record.label.signedHash", pdf.versions?.length ? finalHash : "-", { valueFont: mono, valueSize: 7.5 });
  if (finalHash) row("record.label.verifyOnline", verificationUrlFor(finalHash), { valueSize: 7.5 });

  // ---------- Signers ----------
  heading("record.section.recipients", ` (${recipients.length})`);
  if (recipients.length === 0) {
    row("record.label.signedBy", `${pdf.userId?.name || "Owner"} (document owner, signed in to their account)`);
  }
  for (const r of recipients) {
    ensure(second ? 150 : 86);
    write(`${r.name}  <${contactOf(r)}>`, { size: 9.5, font: bold });
    y -= 13;
    row("record.label.roleStatus", `${r.role} / ${r.status}`, { color: r.status === "signed" ? GOOD : r.status === "declined" ? BAD : INK });
    row("record.label.identityCheck", identityCheckOf(r));
    if (r.status === "signed") {
      row("record.label.signedAt", utc(r.signedAt));
      row(
        "record.label.consent",
        r.consent?.accepted
          ? `Agreed to sign electronically (${r.consent.version || "consent text"}) at ${utc(r.consent.acceptedAt)}`
          : "Not recorded"
      );
    }
    if (r.status === "declined") row("record.label.declineReason", r.declineReason || "-");
    if (r.ipAddress) row("record.label.ipAddress", r.ipAddress, { valueFont: mono, valueSize: 8 });
    y -= 6;
  }

  // ---------- Events ----------
  heading("record.section.auditLog", ` (${auditLogs.length} entr${auditLogs.length === 1 ? "y" : "ies"})`);
  for (const log of auditLogs) {
    const description = log.description || `${log.actorName || "User"}: ${log.event}`;
    const lines = wrap(description, regular, 8, PAGE.width - PAGE.margin * 2 - DESCRIPTION_COLUMN);
    ensure(lines.length * 10 + 16);

    const top = y;
    const eventKey = EVENT_KEYS.has(log.event) ? `record.event.${log.event}` : null;
    write(typeof log.seq === "number" ? `#${log.seq}` : "-", { size: 7.5, font: mono, color: MUTED });
    write(utc(log.signedAt || log.createdAt), { x: PAGE.margin + TIME_COLUMN, size: 6.5, font: mono, color: MUTED });
    write(eventKey ? english(eventKey) : log.event, { x: PAGE.margin + EVENT_COLUMN, size: 8, font: bold });
    if (eventKey && translated(eventKey)) {
      y = top - 9;
      write(translated(eventKey), { x: PAGE.margin + EVENT_COLUMN, size: 6.5, color: MUTED });
      y = top;
    }
    lines.forEach((line, i) => {
      if (i > 0) y -= 10;
      write(line, { x: PAGE.margin + DESCRIPTION_COLUMN, size: 8 });
    });
    y -= 10;
    if (log.eventHash) {
      write(`entry hash ${log.eventHash.slice(0, 32)}...`, { x: PAGE.margin + DESCRIPTION_COLUMN, size: 6.5, font: mono, color: MUTED });
      y -= 9;
    }
    // Room for the second-language event label under the English one
    if (second) y = Math.min(y, top - 19);
    y -= 3;
  }

  ensure(second ? 44 : 30);
  y -= 6;
  const integrityKey = chain.isChainValid ? "record.integrity.ok" : "record.integrity.failed";
  const integrityParams = { reason: chain.reason || "unknown reason" };
  const integrityColor = chain.isChainValid ? GOOD : BAD;
  write(english(integrityKey, integrityParams), { size: 8, font: bold, color: integrityColor });
  if (translated(integrityKey, integrityParams)) {
    y -= 12;
    write(translated(integrityKey, integrityParams), { size: 7.5, color: integrityColor });
  }

  // ---------- Footer on every page ----------
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(
      latin(`Record of events logged by ${env.appName}. Times are given in UTC and in India time (IST). Page ${index + 1} of ${pages.length} of this record.`),
      { x: PAGE.margin, y: 24, size: 6.5, font: regular, color: MUTED }
    );
  });

  doc.setTitle(latin(`Signing record - ${pdf.originalFileName}`));
  doc.setProducer(latin(env.appName));

  return Buffer.from(await doc.save());
};
