import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { processBulkSendFromTemplate } from "../services/bulkSend.service.js";

export const bulkSendController = asyncHandler(async (req, res) => {
  const { templateId, recipients, message } = req.body;

  const result = await processBulkSendFromTemplate({
    templateId,
    userId: req.user.id,
    recipientsList: recipients,
    customMessage: message,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json(new ApiResponse(result, `Successfully dispatched ${result.totalDispatched} documents.`));
});
