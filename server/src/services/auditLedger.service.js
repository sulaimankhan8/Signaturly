import crypto from "crypto";
import { PdfAudit } from "../models/PdfAudit.model.js";

/**
 * Creates an immutable, cryptographically chained audit log entry for a document event.
 * SHA-256(previousEventHash + event + timestamp + actorEmail + ipAddress + payload)
 */
export async function createChainedAuditLog({
  pdfId,
  userId = null,
  recipientId = null,
  event,
  actorName = "System",
  actorEmail = "system@signaturly.local",
  ipAddress = "127.0.0.1",
  userAgent = "Unknown",
  originalHash = "",
  signedHash = "",
  fieldsMeta = [],
  description = "",
  otpVerified = false,
  authMethod = "Email OTP",
}) {
  // 1. Fetch the last audit log for this PDF to retrieve the previous event hash
  const lastLog = await PdfAudit.findOne({ pdfId }).sort({ createdAt: -1 });
  const previousEventHash = lastLog?.eventHash || "0000000000000000000000000000000000000000000000000000000000000000";

  const timestamp = new Date().toISOString();

  // 2. Build the payload digest string
  const rawDigestData = [
    previousEventHash,
    pdfId.toString(),
    event,
    actorEmail,
    ipAddress,
    timestamp,
    originalHash || "",
    signedHash || "",
  ].join("|");

  // 3. Compute SHA-256 event hash
  const eventHash = crypto.createHash("sha256").update(rawDigestData).digest("hex");

  // 4. Save the append-only audit record
  const auditEntry = await PdfAudit.create({
    pdfId,
    userId,
    recipientId,
    event,
    actorName,
    actorEmail,
    ipAddress,
    userAgent,
    originalHash,
    signedHash,
    fieldsMeta,
    description,
    otpVerified,
    authMethod,
    previousEventHash,
    eventHash,
    signedAt: timestamp,
  });

  return auditEntry;
}

/**
 * Validates the cryptographic integrity of a document's full audit trail.
 * Returns { isChainValid: boolean, tamperedLogId: string | null }
 */
export async function verifyAuditChainIntegrity(pdfId) {
  const auditLogs = await PdfAudit.find({ pdfId }).sort({ createdAt: 1 });
  if (!auditLogs || auditLogs.length === 0) {
    return { isChainValid: true, logsCount: 0 };
  }

  let expectedPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  for (const log of auditLogs) {
    if (log.previousEventHash !== expectedPrevHash) {
      return {
        isChainValid: false,
        tamperedLogId: log._id.toString(),
        reason: `Previous hash mismatch on log ${log._id}`,
      };
    }

    const rawDigestData = [
      log.previousEventHash,
      log.pdfId.toString(),
      log.event,
      log.actorEmail,
      log.ipAddress,
      new Date(log.signedAt).toISOString(),
      log.originalHash || "",
      log.signedHash || "",
    ].join("|");

    const calculatedHash = crypto.createHash("sha256").update(rawDigestData).digest("hex");
    if (calculatedHash !== log.eventHash) {
      return {
        isChainValid: false,
        tamperedLogId: log._id.toString(),
        reason: `Event hash recalculation mismatch on log ${log._id}`,
      };
    }

    expectedPrevHash = log.eventHash;
  }

  return { isChainValid: true, logsCount: auditLogs.length };
}
