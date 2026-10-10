import crypto from "crypto";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { env } from "../config/env.js";

export const GENESIS_HASH = "0".repeat(64);
const MAX_APPEND_ATTEMPTS = 40;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const text = (value) => (value === undefined || value === null ? "" : String(value));

/**
 * Everything an entry says is covered by its hash, in a fixed order.
 * The hash is keyed with a server secret, so someone with database access alone cannot recompute a forged chain.
 */
const computeEventHash = (entry) => {
  const payload = JSON.stringify([
    text(entry.previousEventHash),
    Number(entry.seq),
    text(entry.pdfId),
    text(entry.event),
    text(entry.actorName),
    text(entry.actorEmail),
    text(entry.ipAddress),
    text(entry.userAgent),
    new Date(entry.signedAt).toISOString(),
    text(entry.originalHash),
    text(entry.signedHash),
    text(entry.description),
    text(entry.authMethod),
    Boolean(entry.otpVerified),
    text(entry.consentVersion),
    text(entry.recipientId),
    text(entry.userId),
  ]);

  return crypto.createHmac("sha256", env.auditHmacKey).update(payload).digest("hex");
};

/**
 * Appends one hash-chained entry to a document's audit log.
 * This is the only writer: every event, whoever raises it, goes through here.
 */
export async function appendAuditEvent({
  pdfId,
  userId = null,
  recipientId = null,
  event,
  actorName = "System",
  actorEmail = "",
  ipAddress = "",
  userAgent = "",
  originalHash = "",
  signedHash = "",
  fieldsMeta = [],
  description = "",
  otpVerified = false,
  authMethod = "",
  consentVersion = "",
  signedAt = null,
}) {
  const timestamp = signedAt ? new Date(signedAt) : new Date();

  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    const last = await PdfAudit.findOne({ pdfId, seq: { $type: "number" } }).sort({ seq: -1 });

    const entry = {
      pdfId,
      seq: (last?.seq || 0) + 1,
      userId,
      recipientId,
      event,
      actorName,
      actorEmail,
      ipAddress: text(ipAddress),
      userAgent: text(userAgent),
      originalHash,
      signedHash,
      // Only field ids and types are kept; signature images stay with the document itself
      fieldsMeta: (fieldsMeta || []).map((f) => ({ id: f.id, type: f.type, page: f.page })),
      description,
      otpVerified,
      authMethod,
      consentVersion,
      previousEventHash: last?.eventHash || GENESIS_HASH,
      signedAt: timestamp,
    };
    entry.eventHash = computeEventHash(entry);

    try {
      return await PdfAudit.create(entry);
    } catch (err) {
      // Another writer took this position a moment ago: read the new tail and try again,
      // after a short random wait so a burst of writers does not collide on every round
      if (err?.code !== 11000) throw err;
      await pause(5 + Math.random() * 25);
    }
  }

  throw new Error("Could not append to the audit log: too many concurrent writers");
}

// Earlier name, kept so existing callers keep working
export const createChainedAuditLog = appendAuditEvent;

/**
 * Validates a document's full audit trail.
 * Returns { isChainValid, logsCount, reason?, brokenAtSeq? }.
 */
export async function verifyAuditChainIntegrity(pdfId) {
  const all = await PdfAudit.find({ pdfId }).sort({ seq: 1, createdAt: 1 });
  if (all.length === 0) {
    return { isChainValid: true, logsCount: 0 };
  }

  // Entries written before chaining covered every event cannot be vouched for
  const unchained = all.filter((l) => typeof l.seq !== "number" || !l.eventHash);
  if (unchained.length > 0) {
    return {
      isChainValid: false,
      logsCount: all.length,
      unchainedCount: unchained.length,
      reason: `${unchained.length} entr${unchained.length === 1 ? "y was" : "ies were"} recorded without a chain hash`,
    };
  }

  let expectedPrev = GENESIS_HASH;
  let expectedSeq = 1;

  for (const log of all) {
    if (log.seq !== expectedSeq) {
      return { isChainValid: false, logsCount: all.length, brokenAtSeq: expectedSeq, reason: `Entry ${expectedSeq} is missing` };
    }
    if (log.previousEventHash !== expectedPrev) {
      return { isChainValid: false, logsCount: all.length, brokenAtSeq: log.seq, reason: `Entry ${log.seq} does not link to the one before it` };
    }
    if (computeEventHash(log) !== log.eventHash) {
      return { isChainValid: false, logsCount: all.length, brokenAtSeq: log.seq, reason: `Entry ${log.seq} has been altered` };
    }

    expectedPrev = log.eventHash;
    expectedSeq += 1;
  }

  return { isChainValid: true, logsCount: all.length, headHash: expectedPrev };
}
