import { AdminAction } from "../models/AdminAction.model.js";

/**
 * Writes one line to the record of admin actions. `req` supplies who and from where.
 *
 * `quietMs` is for looking at something: the same admin opening the same thing again within
 * that time adds no second line, so reloading a page does not bury the actions that matter.
 *
 * A failure to write is logged and swallowed: the record must never be the reason an
 * operator cannot act, and the action itself has already happened by the time this runs.
 */
export const recordAdminAction = async (req, { action, targetType = "", targetId = "", summary = "", meta = {}, admin, quietMs = 0 } = {}) => {
  const who = admin || req?.user || {};
  const target = targetId ? String(targetId) : "";
  try {
    if (quietMs && who.id && (await AdminAction.exists({ adminId: who.id, action, targetId: target, at: { $gte: new Date(Date.now() - quietMs) } }))) return;

    await AdminAction.create({
      adminId: who.id || null,
      adminEmail: who.email || "",
      action,
      targetType,
      targetId: target,
      summary: String(summary).slice(0, 500),
      meta,
      ipAddress: req?.ip || "",
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    });
  } catch (err) {
    console.error(`[Admin log] could not record ${action}:`, err.message);
  }
};
