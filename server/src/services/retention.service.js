import { Workspace } from "../models/Workspace.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { deleteFile } from "./storage.service.js";
import { originalKeyOf } from "./documentFiles.service.js";
import { appendAuditEvent } from "./auditLedger.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Documents that are finished. One still out for signature is never removed by this.
const FINISHED = ["signed", "voided", "declined", "expired"];
const BATCH = 200;

/**
 * Removes documents a workspace has asked not to keep (plan task P6-15).
 *
 * A workspace may set how many days a finished document is kept, 30 at the least, which is
 * also how long a signer's link to their copy lasts. After that its files are erased and the
 * document disappears from the workspace. Its audit log is kept: that a document existed,
 * who signed it and what its hash was can still be shown.
 *
 * Erasing is not reversible. Run once a day.
 */
export const processRetention = async ({ now = new Date() } = {}) => {
  const counts = { workspaces: 0, documents: 0, failed: 0 };
  const workspaces = await Workspace.find({ "policy.retentionDays": { $gte: 30 }, status: { $ne: "archived" } }).select("_id policy").lean();

  for (const workspace of workspaces) {
    counts.workspaces += 1;
    const before = new Date(now.getTime() - workspace.policy.retentionDays * DAY_MS);
    const due = await Pdf.find({ workspaceId: workspace._id, deletedAt: null, status: { $in: FINISHED }, updatedAt: { $lt: before } }).limit(BATCH);

    for (const pdf of due) {
      try {
        await deleteFile(originalKeyOf(pdf));
        for (const version of pdf.versions || []) await deleteFile(version.key);
        if (pdf.sealedKey) await deleteFile(pdf.sealedKey);

        await Pdf.updateOne({ _id: pdf._id }, { $set: { deletedAt: now } });
        await appendAuditEvent({
          pdfId: pdf._id,
          event: "retention_deleted",
          actorName: "System",
          description: `Files erased after ${workspace.policy.retentionDays} days, as the workspace's settings ask. The audit log is retained.`,
        });
        counts.documents += 1;
      } catch (err) {
        // One document that cannot be erased must not stop the rest; it is tried again tomorrow
        counts.failed += 1;
        console.error(`[Retention] Could not erase document ${pdf._id}:`, err.message);
      }
    }
  }
  return counts;
};
