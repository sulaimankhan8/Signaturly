import crypto from "crypto";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";
import { inspectSeal } from "./pdfSeal.service.js";

/**
 * Computes SHA-256 hash of a file buffer.
 */
const maskName = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Signer";
  return parts.map((p, i) => (i === 0 ? p : `${p.charAt(0)}.`)).join(" ");
};

const maskEmail = (email = "") => {
  const [local, domain] = String(email).split("@");
  if (!domain) return "";
  return `${local.charAt(0)}***@${domain.charAt(0)}***${domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : ""}`;
};

const describeAuth = (recipient) => {
  if (recipient.authVerified && recipient.authVerifiedAt && recipient.authMethod === "email_otp") return "Email link + one-time code";
  if (recipient.authVerified && recipient.authVerifiedAt && recipient.authMethod === "passcode") return "Email link + access passcode";
  return "Email link";
};

const TITLES = {
  created: "Document created",
  sent: "Sent for signature",
  viewed: "Viewed by a recipient",
  signed: "Signed",
  completed: "Completed by all parties",
  declined: "Declined",
  voided: "Voided by the sender",
  expired: "Expired",
  reminder_sent: "Reminder sent",
  recipient_updated: "Recipient details updated",
};

export function calculateBufferSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Verifies document authenticity and cryptographic chain of custody against the system ledger.
 */
export async function verifyDocumentByBufferOrHash({ buffer = null, hash = null }) {
  let cleanHash = "";

  // For an uploaded file, only the hash of the file itself counts. Text found inside the file is never
  // trusted: anyone can paste a genuine hash into a forged PDF.
  if (buffer) {
    cleanHash = calculateBufferSha256(buffer);
  } else if (hash && typeof hash === "string") {
    cleanHash = hash.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
    if (cleanHash.length !== 64) cleanHash = "";
  }

  if (!cleanHash) {
    throw new Error("Either a valid PDF file buffer or document SHA-256 hash is required for verification.");
  }

  // The certificate signature inside the uploaded file, if any
  const seal = buffer ? inspectSeal(buffer) : null;
  const publicSeal = seal && {
    present: seal.present,
    intact: seal.intact,
    issuedByThisService: seal.issuedByThisService,
    signerName: seal.signerName,
    signedAt: seal.signedAt,
  };

  const matchedCandidate = cleanHash;

  // 1. A document whose original, signed version or sealed copy has exactly this hash
  let matchingPdf = await Pdf.findOne({
    $or: [{ originalHash: cleanHash }, { sealedHash: cleanHash }, { "versions.hash": cleanHash }],
  });

  // 2. Older documents: hashes recorded only in the audit log
  let matchingAudit = null;
  if (!matchingPdf) {
    matchingAudit = await PdfAudit.findOne({ $or: [{ signedHash: cleanHash }, { originalHash: cleanHash }] });
    if (matchingAudit?.pdfId) matchingPdf = await Pdf.findById(matchingAudit.pdfId);
  }

  if (!matchingPdf) {
    const changedAfterSealing = Boolean(seal?.present && !seal.intact);
    return {
      isAuthentic: false,
      reason: changedAfterSealing
        ? "MODIFIED_AFTER_SEALING: This file carries a certificate seal that no longer matches its contents. It was changed after it was sealed."
        : "UNRECOGNIZED_DOCUMENT: The uploaded PDF or hash does not match any document in our records.",
      computedHash: cleanHash,
      seal: publicSeal,
    };
  }

  // 3. Fetch full audit records and signers
  const auditLogs = await PdfAudit.find({ pdfId: matchingPdf._id }).sort({ seq: 1, createdAt: 1 });
  const recipients = await Recipient.find({ pdfId: matchingPdf._id });

  // 4. Verify the audit hash chain
  let chainIntegrity;
  try {
    chainIntegrity = await verifyAuditChainIntegrity(matchingPdf._id);
  } catch (e) {
    // If the check itself fails, the log is reported as unconfirmed, never as valid
    chainIntegrity = { isChainValid: false, logsCount: auditLogs.length, reason: "The audit log could not be checked" };
  }

  // Anyone holding a file can call this, so personal details are masked and network details withheld
  const signersSummary = recipients.map((r) => ({
    name: maskName(r.name),
    email: maskEmail(r.email),
    role: r.role || "Signer",
    status: r.status,
    signedAt: r.signedAt,
    ipAddress: "Recorded",
    authMethod: describeAuth(r),
  }));

  const executionEvent = auditLogs.find((l) => l.event === "signed") || auditLogs[auditLogs.length - 1];

  // Say which copy of the document this hash belongs to
  const versionIndex = (matchingPdf.versions || []).findIndex((v) => v.hash === cleanHash);
  let matchedClassification = "Hash recorded in the audit log";
  let fileStatus = "recorded_hash";
  if (cleanHash === matchingPdf.sealedHash) {
    matchedClassification = "Sealed final copy, unchanged";
    fileStatus = "sealed_copy";
  } else if (versionIndex >= 0) {
    const isLast = versionIndex === matchingPdf.versions.length - 1;
    matchedClassification = isLast ? "Final signed copy, before sealing" : `Signed version ${versionIndex + 1} of ${matchingPdf.versions.length}`;
    fileStatus = isLast ? "final_signed_version" : "earlier_signed_version";
  } else if (cleanHash === matchingPdf.originalHash?.toLowerCase()) {
    matchedClassification = "Original upload, before any signature";
    fileStatus = "original_upload";
  }

  // Build structured ledger event chain
  const ledgerChain = auditLogs.map((log, idx) => {
    const isStepMatched = [log.signedHash, log.originalHash, log.eventHash]
      .filter(Boolean)
      .some((h) => h.toLowerCase() === cleanHash.toLowerCase() || h.toLowerCase() === matchedCandidate.toLowerCase());

    return {
      step: idx + 1,
      id: log._id.toString(),
      event: log.event,
      title:
        log.event === "created"
          ? "Document Created & Uploaded"
          : log.event === "sent"
          ? "Sent to Authorized Signers"
          : log.event === "opened"
          ? "Document Viewed by Recipient"
          : log.event === "signed"
          ? "Digital Signature Executed"
          : log.event === "voided"
          ? "Document Voided"
          : log.event,
      description: TITLES[log.event] || log.event,
      actorName: maskName(log.actorName),
      actorEmail: maskEmail(log.actorEmail),
      ipAddress: "Recorded",
      userAgent: "Recorded",
      timestamp: log.signedAt || log.createdAt,
      originalHash: log.originalHash,
      signedHash: log.signedHash,
      eventHash: log.eventHash || "Chained",
      previousEventHash: log.previousEventHash || "Genesis",
      isMatched: isStepMatched,
      fieldsCount: log.fieldsMeta?.length || 0,
    };
  });

  // The signed file itself is never handed out here; parties download it from their own links
  const signedDocUrl = null;

  return {
    isAuthentic: true,
    fileStatus,
    isSealed: Boolean(matchingPdf.sealedKey),
    sealedAt: matchingPdf.sealedAt,
    seal: publicSeal,
    documentTitle: matchingPdf.originalFileName,
    pageCount: matchingPdf.pageCount || 1,
    status: matchingPdf.status,
    createdAt: matchingPdf.createdAt,
    executedAt: executionEvent?.signedAt || matchingPdf.updatedAt,
    computedHash: cleanHash,
    matchedCandidate,
    matchedClassification,
    originalHash: matchingPdf.originalHash || auditLogs[0]?.originalHash || "Captured",
    signedHash: executionEvent?.signedHash || matchingPdf.originalHash || cleanHash,
    chainHead: auditLogs[auditLogs.length - 1]?.eventHash || executionEvent?.signedHash || cleanHash,
    totalEvents: auditLogs.length,
    ledgerChain,
    signers: signersSummary,
    chainIntegrity,
    signedDocUrl,
    legalStanding: {
      indiaStatute: "Section 10A of Information Technology Act, 2000 (Validity of Electronic Contracts) & Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (Admissibility of Electronic Records).",
      usStatute: "Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 / US ESIGN Act) & Uniform Electronic Transactions Act (UETA).",
      euStatute: "eIDAS Regulation (EU) No 910/2014: simple electronic signature.",
    },
  };
}
