import { Workspace } from "../models/Workspace.model.js";
import { getOrCreateSubscription } from "./subscription.service.js";
import { can, tierOf } from "./entitlements.service.js";

/**
 * How a document presents itself to the people signing it (plan task P5-06).
 *
 * A document in a team workspace carries that workspace's name, colour and logo on its emails
 * and signing page, for as long as the owner's plan includes teams. A document from a Free
 * account carries the "Signed with PactDoc" line instead.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Whose plan, allowance and wallet a document is charged to: the owner of its workspace,
 * or the person who made it when it has none.
 */
export const billingUserIdOf = async (pdf) => {
  if (!pdf?.workspaceId) return pdf.userId;
  const workspace = await Workspace.findById(pdf.workspaceId).select("ownerId").lean();
  return workspace?.ownerId || pdf.userId;
};

export const brandingFor = async (pdf) => {
  const plain = { badge: false, brand: null };
  try {
    const workspace = pdf.workspaceId ? await Workspace.findById(pdf.workspaceId).select("ownerId personal name branding").lean() : null;
    // The creator may arrive as an id or as the loaded account
    const subscription = await getOrCreateSubscription(workspace?.ownerId || pdf.userId?._id || pdf.userId);
    const badge = tierOf(subscription) === "free";

    if (!workspace || workspace.personal || !can(subscription, "workspaces")) return { badge, brand: null };

    const branding = workspace.branding || {};
    return {
      badge,
      brand: {
        companyName: branding.companyName || workspace.name,
        primaryColor: HEX.test(branding.primaryColor || "") ? branding.primaryColor : null,
        logoUrl: branding.logoUrl || null,
        emailFooterText: branding.emailFooterText || null,
      },
    };
  } catch {
    // Presentation must never stop a document from being sent or signed
    return plain;
  }
};
