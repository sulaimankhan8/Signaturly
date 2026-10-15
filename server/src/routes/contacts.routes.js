import { Router } from "express";
import { protect, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/subscription.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {
  listContactLists,
  getContactList,
  saveContactList,
  deleteContactList,
  parseContactsCsv,
  startBulkSend,
  getBulkBatch,
  listBulkBatches,
  retryBulkBatch,
} from "../services/contactList.service.js";

// Saved lists of people, and sending one template to a whole list (plan task P5-07).
// Lists belong to the workspace the request is working in; roles are checked in the service.
const router = Router();

router.use(protect);

// A spreadsheet arrives as text in `csv`; a form sends `rows`
const rowsFrom = (body) => {
  if (typeof body?.csv === "string") {
    if (body.csv.length > 500000) throw new ApiError(400, "That file is too large. Keep it under 500 KB.");
    return parseContactsCsv(body.csv);
  }
  return body?.rows;
};

router.get(
  "/lists",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listContactLists(req.workspace.id, req.user.id), "Contact lists")))
);

router.post(
  "/lists",
  asyncHandler(async (req, res) => {
    const list = await saveContactList({ workspaceId: req.workspace.id, userId: req.user.id, name: req.body?.name, rows: rowsFrom(req.body) });
    res.status(201).json(new ApiResponse(list, "List saved"));
  })
);

router.get(
  "/lists/:id",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getContactList(req.params.id, req.user.id), "Contact list")))
);

router.put(
  "/lists/:id",
  asyncHandler(async (req, res) => {
    const list = await saveContactList({ listId: req.params.id, workspaceId: req.workspace.id, userId: req.user.id, name: req.body?.name, rows: rowsFrom(req.body) });
    res.json(new ApiResponse(list, "List saved"));
  })
);

router.delete(
  "/lists/:id",
  asyncHandler(async (req, res) => {
    await deleteContactList(req.params.id, req.user.id);
    res.json(new ApiResponse({}, "List deleted"));
  })
);

// ---------- bulk sends ----------

router.get(
  "/bulk",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listBulkBatches(req.workspace.id, req.user.id), "Bulk sends")))
);

router.post(
  "/bulk",
  requireVerifiedEmail,
  requireFeature("bulkSend"),
  asyncHandler(async (req, res) => {
    const batch = await startBulkSend({
      user: req.user,
      workspace: req.workspace,
      billingUserId: req.billingUserId,
      templateId: req.body?.templateId,
      listId: req.body?.listId,
      rows: req.body?.listId ? undefined : rowsFrom(req.body),
      message: req.body?.message,
    });
    res.status(202).json(new ApiResponse(batch, `Sending ${batch.total} documents`));
  })
);

router.get(
  "/bulk/:id",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getBulkBatch(req.params.id, req.user.id), "Bulk send")))
);

router.post(
  "/bulk/:id/retry",
  requireVerifiedEmail,
  asyncHandler(async (req, res) => res.json(new ApiResponse(await retryBulkBatch(req.params.id, req.user.id), "Failed rows queued again")))
);

export default router;
