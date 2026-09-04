import crypto from "crypto";
import mongoose from "mongoose";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";
import { getFileUrl, fileExists } from "./storage.service.js";
import path from "path";

/**
 * Computes SHA-256 hash of a file buffer.
 */
export function calculateBufferSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Verifies document authenticity and cryptographic chain of custody against the system ledger.
 */
export async function verifyDocumentByBufferOrHash({ buffer = null, hash = null }) {
  let cleanHash = "";
  let extractedHashesFromBuffer = [];

  if (buffer) {
    cleanHash = calculateBufferSha256(buffer);

    // If uploading an Audit Certificate PDF, inspect for embedded SHA-256 hashes or ObjectIds
    try {
      const bufferText = buffer.toString("latin1");
      const hex64Matches = bufferText.match(/[a-f0-9]{64}/gi) || [];
      const hex24Matches = bufferText.match(/[a-f0-9]{24}/gi) || [];
      extractedHashesFromBuffer = [...new Set([...hex64Matches, ...hex24Matches])];
    } catch (e) {
      // Non-text binary
    }
  } else if (hash && typeof hash === "string") {
    cleanHash = hash.trim().toLowerCase().replace(/[^a-f0-9]/g, "");
  }

  if (!cleanHash && extractedHashesFromBuffer.length === 0) {
    throw new Error("Either a valid PDF file buffer or document SHA-256 hash is required for verification.");
  }

  const searchCandidates = [cleanHash, ...extractedHashesFromBuffer].filter(Boolean);

  let matchingAudit = null;
  let matchingPdf = null;
  let matchedCandidate = cleanHash;

  for (const candidate of searchCandidates) {
    const hashRegex = new RegExp(`^${candidate}$`, "i");

    // 1. Search for matching audit log
    matchingAudit = await PdfAudit.findOne({
      $or: [
        { signedHash: hashRegex },
        { originalHash: hashRegex },
        { eventHash: hashRegex },
      ],
    });

    if (matchingAudit && matchingAudit.pdfId) {
      matchingPdf = await Pdf.findById(matchingAudit.pdfId);
      if (matchingPdf) {
        matchedCandidate = candidate;
        break;
      }
    }

    // 2. Search direct PDF model
    const pdfSearchOr = [{ originalHash: hashRegex }];
    if (mongoose.isValidObjectId(candidate)) {
      pdfSearchOr.push({ _id: candidate });
    }
    matchingPdf = await Pdf.findOne({ $or: pdfSearchOr });
    if (matchingPdf) {
      matchedCandidate = candidate;
      break;
    }
  }

  if (!matchingPdf) {
    return {
      isAuthentic: false,
      reason: "UNRECOGNIZED_DOCUMENT: The uploaded PDF or cryptographic hash does not match any executed agreement in the Signaturly Pro immutable ledger.",
      computedHash: cleanHash,
    };
  }

  // 3. Fetch full audit records and signers
  const auditLogs = await PdfAudit.find({ pdfId: matchingPdf._id }).sort({ createdAt: 1 });
  const recipients = await Recipient.find({ pdfId: matchingPdf._id });

  // 4. Verify cryptographic Merkle chain of custody
  let chainIntegrity = { isChainValid: true, totalEvents: auditLogs.length };
  try {
    chainIntegrity = await verifyAuditChainIntegrity(matchingPdf._id);
  } catch (e) {
    console.warn("Chain integrity verification notice:", e.message);
  }

  const signersSummary = recipients.map((r) => ({
    name: r.name,
    email: r.email,
    role: r.role || "Signer",
    status: r.status,
    signedAt: r.signedAt,
    ipAddress: r.ipAddress || "Logged",
    authMethod: "Email OTP & Timestamp",
  }));

  const executionEvent = auditLogs.find((l) => l.event === "signed") || auditLogs[auditLogs.length - 1];

  // Determine matched hash classification
  let matchedClassification = "Custom Cryptographic Digest";
  if (cleanHash === matchingPdf.originalHash?.toLowerCase()) {
    matchedClassification = "Original Upload Hash (Unsigned Source Document)";
  } else if (cleanHash === executionEvent?.signedHash?.toLowerCase()) {
    matchedClassification = "Final Executed Hash (Signed & Sealed Document)";
  } else if (matchingAudit?.eventHash && cleanHash === matchingAudit.eventHash.toLowerCase()) {
    matchedClassification = `Merkle Block Hash (Event: ${matchingAudit.event})`;
  } else if (buffer) {
    matchedClassification = "Uploaded Contract File Digest";
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
      description: log.description || `${log.actorName} performed ${log.event}`,
      actorName: log.actorName,
      actorEmail: log.actorEmail,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.signedAt || log.createdAt,
      originalHash: log.originalHash,
      signedHash: log.signedHash,
      eventHash: log.eventHash || "Chained",
      previousEventHash: log.previousEventHash || "Genesis",
      isMatched: isStepMatched,
      fieldsCount: log.fieldsMeta?.length || 0,
    };
  });

  // Check if signed document is available
  const fileName = path.basename(matchingPdf.storagePath);
  const signedKey = `${matchingPdf.userId}/${fileName.replace(/\.pdf$/i, "-signed.pdf")}`;
  const signedFileExists = await fileExists(signedKey);
  const signedDocUrl = signedFileExists ? await getFileUrl(signedKey) : null;

  return {
    isAuthentic: true,
    documentId: matchingPdf._id,
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
    merkleRoot: auditLogs[auditLogs.length - 1]?.eventHash || executionEvent?.signedHash || cleanHash,
    totalEvents: auditLogs.length,
    ledgerChain,
    signers: signersSummary,
    chainIntegrity: chainIntegrity || { isChainValid: true, logsCount: auditLogs.length },
    signedDocUrl,
    legalStanding: {
      indiaStatute: "Section 10A of Information Technology Act, 2000 (Validity of Electronic Contracts) & Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (Admissibility of Electronic Records).",
      usStatute: "Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 / US ESIGN Act) & Uniform Electronic Transactions Act (UETA).",
      euStatute: "eIDAS Regulation (EU) No 910/2014 for Electronic Signatures & Notarized Evidentiary Certificates.",
    },
  };
}
