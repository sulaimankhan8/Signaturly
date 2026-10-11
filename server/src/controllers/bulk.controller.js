import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { processBulkSendFromTemplate } from "../services/bulkSend.service.js";
import { limitOf } from "../services/entitlements.service.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";
import { Template } from "../models/Template.model.js";
import { belongsTo } from "../services/authorize.service.js";
import { assertCanWorkIn } from "../services/workspace.service.js";

export const bulkSendController = asyncHandler(async (req, res) => {
  const { templateId, recipients, message } = req.body;

  // The sender's role in the workspace they are working in must send documents
  assertCanWorkIn(req, "document.send");

  // How many people one bulk send may reach depends on the plan
  const most = limitOf(req.subscription, "bulkSendMax");
  if (Array.isArray(recipients) && recipients.length > most) {
    throw new ApiError(403, `UPGRADE_REQUIRED: Your plan sends to at most ${most} recipients at a time. This list has ${recipients.length}.`);
  }

  // The documents are counted against that workspace, so the template must be one of its own
  const template = typeof templateId === "string" && mongoose.isValidObjectId(templateId) ? await Template.findById(templateId).select("userId workspaceId") : null;
  if (!belongsTo(template, req.workspace)) throw new ApiError(404, "Template not found");

  const result = await processBulkSendFromTemplate({
    templateId,
    userId: req.user.id,
    workspaceId: req.workspace?.id || null,
    billingUserId: req.billingUserId || req.user.id,
    recipientsList: recipients,
    customMessage: message,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, `Successfully dispatched ${result.totalDispatched} documents.`));
});
