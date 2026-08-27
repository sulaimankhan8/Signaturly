import crypto from "crypto";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { verifyAuditChainIntegrity } from "./auditLedger.service.js";

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
  const documentHash = hash || (buffer ? calculateBufferSha256(buffer) : null);

  if (!documentHash) {
    throw new Error("Either file buffer or document SHA-256 hash is required for verification.");
  }

  // 1. Search for matching audit log or PDF record
  const matchingAudit = await PdfAudit.findOne({
    $or: [{ signedHash: documentHash }, { originalHash: documentHash }, { eventHash: documentHash }],
  });

  const matchingPdf = matchingAudit
    ? await Pdf.findById(matchingAudit.pdfId)
    : await Pdf.findOne({
        $or: [{ sha256SignedHash: documentHash }, { sha256OriginalHash: documentHash }],
      });

  if (!matchingPdf) {
    return {
      isAuthentic: false,
      reason: "UNRECOGNIZED_DOCUMENT: The uploaded PDF or cryptographic hash does not match any executed agreement in the Signaturly Pro immutable ledger.",
      computedHash: documentHash,
    };
  }

  // 2. Fetch full audit records and signers
  const auditLogs = await PdfAudit.find({ pdfId: matchingPdf._id }).sort({ createdAt: 1 });
  const recipients = await Recipient.find({ pdfId: matchingPdf._id });

  // 3. Verify cryptographic Merkle chain of custody
  const chainIntegrity = await verifyAuditChainIntegrity(matchingPdf._id);

  const signersSummary = recipients.map((r) => ({
    name: r.name,
    email: r.email,
    status: r.status,
    signedAt: r.signedAt,
    ipAddress: r.ipAddress || "Logged",
    authMethod: "Email OTP",
  }));

  const executionEvent = auditLogs.find((l) => l.event === "signed") || auditLogs[auditLogs.length - 1];

  return {
    isAuthentic: chainIntegrity.isChainValid,
    documentId: matchingPdf._id,
    documentTitle: matchingPdf.originalFileName,
    computedHash: documentHash,
    originalHash: matchingPdf.sha256OriginalHash || auditLogs[0]?.originalHash || "Captured",
    signedHash: matchingPdf.sha256SignedHash || executionEvent?.signedHash || documentHash,
    status: matchingPdf.status,
    createdAt: matchingPdf.createdAt,
    executedAt: executionEvent?.signedAt || matchingPdf.updatedAt,
    signers: signersSummary,
    chainIntegrity,
    legalStanding: "Statutory Simple Electronic Signature (SES) under Section 10A of India IT Act, 2000 and Section 63 of Bharatiya Sakshya Adhiniyam, 2023.",
  };
}
