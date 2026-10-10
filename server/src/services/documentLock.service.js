import crypto from "crypto";
import { Pdf } from "../models/Pdf.model.js";
import { ApiError } from "../utils/ApiError.js";

const LOCK_TTL_MS = 60 * 1000;
const WAIT_STEP_MS = 150;
const MAX_WAIT_MS = 30 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `work` while holding a per-document lock stored in the database,
 * so stamping is serialised across every API instance, not only inside one process.
 */
export const withDocumentLock = async (pdfId, work) => {
  const holder = crypto.randomUUID();
  const startedAt = Date.now();

  while (true) {
    const now = new Date();
    const claimed = await Pdf.findOneAndUpdate(
      { _id: pdfId, $or: [{ signLockUntil: null }, { signLockUntil: { $lt: now } }] },
      { $set: { signLockUntil: new Date(now.getTime() + LOCK_TTL_MS), signLockHolder: holder } }
    );
    if (claimed) break;

    if (!(await Pdf.exists({ _id: pdfId }))) {
      throw new ApiError(404, "Document not found");
    }
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      throw new ApiError(503, "The document is busy. Please try again in a moment.");
    }
    await sleep(WAIT_STEP_MS);
  }

  try {
    return await work();
  } finally {
    await Pdf.updateOne(
      { _id: pdfId, signLockHolder: holder },
      { $set: { signLockUntil: null, signLockHolder: null } }
    );
  }
};
