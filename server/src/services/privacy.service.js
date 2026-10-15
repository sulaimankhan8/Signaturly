import crypto from "crypto";
import { User } from "../models/User.model.js";
import { Pdf } from "../models/Pdf.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { Template } from "../models/Template.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Payment } from "../models/Payment.model.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { PasswordReset } from "../models/PasswordReset.model.js";
import { Workspace, Invitation } from "../models/Workspace.model.js";
import { ApiError } from "../utils/ApiError.js";
import { handOverAndRemove } from "./workspace.service.js";
import { deleteFile } from "./storage.service.js";
import { originalKeyOf } from "./documentFiles.service.js";
import { appendAuditEvent } from "./auditLedger.service.js";

/**
 * Everything the service holds about an account, in one machine-readable object.
 * File contents are not included; documents are listed with what is needed to identify them.
 */
export const exportAccountData = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const [documents, templates, subscription, payments] = await Promise.all([
    Pdf.find({ userId, deletedAt: null }).sort({ createdAt: 1 }),
    Template.find({ userId }).sort({ createdAt: 1 }),
    Subscription.findOne({ userId }),
    Payment.find({ userId }).sort({ occurredAt: 1 }),
  ]);

  const recipients = await Recipient.find({ pdfId: { $in: documents.map((d) => d._id) } });
  const recipientsByDoc = new Map();
  for (const r of recipients) {
    const list = recipientsByDoc.get(String(r.pdfId)) || [];
    list.push({ name: r.name, email: r.email, role: r.role, status: r.status, signedAt: r.signedAt || null });
    recipientsByDoc.set(String(r.pdfId), list);
  }

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified !== false,
      createdAt: user.createdAt,
      termsAcceptedAt: user.termsAcceptedAt || null,
      termsVersion: user.termsAccepted ? user.termsVersion : null,
      savedSignature: {
        signature: Boolean(user.savedSignature?.signatureKey),
        initials: Boolean(user.savedSignature?.initialsKey),
        updatedAt: user.savedSignature?.updatedAt || null,
      },
    },
    subscription: subscription && {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      usedThisMonth: subscription.usedThisMonth,
    },
    payments: payments.map((p) => ({
      provider: p.provider,
      kind: p.kind,
      plan: p.plan,
      amount: p.amount,
      currency: p.currency,
      occurredAt: p.occurredAt,
    })),
    documents: documents.map((d) => ({
      id: d._id,
      title: d.originalFileName,
      status: d.status,
      pages: d.pageCount,
      createdAt: d.createdAt,
      originalHash: d.originalHash,
      sealedHash: d.sealedHash || null,
      recipients: recipientsByDoc.get(String(d._id)) || [],
    })),
    templates: templates.map((t) => ({ id: t._id, name: t.name, createdAt: t.createdAt, timesUsed: t.usageCount })),
  };
};

/**
 * Closes an account.
 *  - The profile is anonymised and every session and key is removed, with the webhooks of the
 *    person's own documents.
 *  - What they made in someone else's team stays with that team: it passes to the team's owner,
 *    as when a member is removed. Its webhooks keep working.
 *  - An owner whose team other people work in cannot close their account; teams of their own
 *    that nobody else is in close with it.
 *  - Every document of their own is deleted from their view and its signing links stop working.
 *  - Files of documents that never involved another party are erased.
 *  - Completed agreements and all audit logs are retained: the other parties signed them too.
 */
export const deleteAccount = async (userId, { password, ipAddress, userAgent }) => {
  const user = await User.findById(userId).select("+password");
  if (!user || user.deletedAt) throw new ApiError(404, "User not found");

  if (typeof password !== "string" || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Password is incorrect");
  }

  const teams = await Workspace.find({ personal: { $ne: true }, status: { $ne: "archived" }, $or: [{ ownerId: userId }, { "members.userId": userId }] });
  const owned = teams.filter((team) => String(team.ownerId) === String(userId));
  const joined = teams.filter((team) => String(team.ownerId) !== String(userId));

  const shared = owned.filter((team) => team.members.length > 0);
  if (shared.length > 0) {
    const names = shared.map((team) => `"${team.name}"`).join(", ");
    throw new ApiError(409, `You own ${names}, which other people work in. Remove them from the team before deleting your account.`);
  }

  // Documents in someone else's team are handed to that team, so they do not stop the account closing
  const open = await Pdf.countDocuments({ userId, deletedAt: null, status: { $in: ["pending", "partially_signed"] }, workspaceId: { $nin: joined.map((team) => team._id) } });
  if (open > 0) {
    throw new ApiError(
      409,
      `You have ${open} document${open === 1 ? "" : "s"} out for signature. Void ${open === 1 ? "it" : "them"} before deleting your account.`
    );
  }

  // First the teams: a member's work passes to each team's owner, so what follows finds only the
  // person's own documents and templates
  for (const team of joined) await handOverAndRemove(team, userId);
  if (owned.length > 0) {
    const ownedIds = owned.map((team) => team._id);
    await Workspace.updateMany({ _id: { $in: ownedIds } }, { $set: { status: "archived" } });
    await Invitation.updateMany({ workspaceId: { $in: ownedIds }, status: "pending" }, { $set: { status: "revoked" } });
  }

  const documents = await Pdf.find({ userId, deletedAt: null });
  for (const pdf of documents) {
    const involvedOthers = (pdf.recipients || []).length > 0;

    if (!involvedOthers) {
      // Nobody else has a stake in this file: erase it
      await deleteFile(originalKeyOf(pdf));
      for (const version of pdf.versions || []) await deleteFile(version.key);
      if (pdf.sealedKey) await deleteFile(pdf.sealedKey);
    }

    await Pdf.updateOne({ _id: pdf._id }, { $set: { deletedAt: new Date() } });
    await appendAuditEvent({
      pdfId: pdf._id,
      event: "deleted",
      actorName: "Account owner",
      description: involvedOthers
        ? "Owner closed their account. The agreement and its audit log are retained."
        : "Owner closed their account. The file was erased; the audit log is retained.",
      ipAddress,
      userAgent,
    });
  }

  const templates = await Template.find({ userId });
  for (const template of templates) {
    try {
      await deleteFile(template.sourcePdfPath);
    } catch {
      // A template that pointed at an already-removed file is simply dropped
    }
  }
  await Template.deleteMany({ userId });

  // The signature and initials kept with the account
  for (const key of [user.savedSignature?.signatureKey, user.savedSignature?.initialsKey]) {
    if (!key) continue;
    try {
      await deleteFile(key);
    } catch {
      // Already gone
    }
  }

  await ApiKey.deleteMany({ userId });
  // A webhook made for a team belongs to the team
  await Webhook.deleteMany({ userId, workspaceId: { $nin: joined.map((team) => team._id) } });
  await PasswordReset.deleteMany({ userId });
  await Subscription.updateOne({ userId }, { $set: { plan: "free", status: "canceled", cancelAtPeriodEnd: false } });

  // Anonymise in place: the id stays so retained records still point at "a deleted account"
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        name: "Deleted user",
        email: `deleted-${userId}@deleted.invalid`,
        password: crypto.randomBytes(32).toString("hex"),
        deletedAt: new Date(),
        termsIpAddress: null,
      },
      $unset: {
        refreshTokenHash: 1,
        previousRefreshTokenHash: 1,
        refreshRotatedAt: 1,
        emailVerifyTokenHash: 1,
        emailVerifyExpiresAt: 1,
        savedSignature: 1,
      },
    }
  );

  return { deletedDocuments: documents.length };
};
