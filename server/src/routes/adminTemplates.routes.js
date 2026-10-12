import { Router } from "express";
import { requireSuperadmin } from "../middleware/admin.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  listTemplatesForAdmin,
  getTemplateVersionForAdmin,
  createTemplate,
  createNextVersion,
  updateDraft,
  deleteDraft,
  publishVersion,
  retireVersion,
  setReview,
  previewVersion,
} from "../services/templateAdmin.service.js";
import { recordAdminAction } from "../services/adminLog.service.js";
import { requestClientRebuild } from "../services/deployHook.service.js";

// Guided templates, managed from the admin panel: create, version, publish, retire, record a review.
const router = Router();

router.use(requireSuperadmin);

// What changes which templates senders are offered goes in the record of admin actions,
// and the public pages, which list those templates, are rebuilt (roadmap item A-29).
const changed = async (req, version, action, what) => {
  await recordAdminAction(req, {
    action: `template.${action}`,
    targetType: "template",
    targetId: version._id,
    summary: `${what} version ${version.version} of the template "${version.key}" (${version.language})`,
  });
  await requestClientRebuild(`template ${version.key} ${action}`).catch((err) => console.error("[Templates] could not ask for a rebuild:", err.message));
};

router.get(
  "/",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listTemplatesForAdmin(), "Templates")))
);

router.post(
  "/",
  asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(await createTemplate(req.body, req.user), "Template created as a draft")))
);

// Asks for the public pages to be rebuilt now, for when a change did not show up on them
router.post(
  "/rebuild",
  asyncHandler(async (req, res) => {
    const result = await requestClientRebuild("asked for by an admin");
    if (result.configured) await recordAdminAction(req, { action: "template.pages_rebuild", targetType: "template", summary: "Asked for the public template pages to be rebuilt" });
    const message = !result.configured ? "No deploy hook is set, so nothing was asked for" : result.queued ? "A rebuild has been asked for" : "A rebuild was already asked for in the last few minutes";
    res.json(new ApiResponse(result, message));
  })
);

router.post(
  "/versions",
  asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(await createNextVersion(req.body || {}, req.user), "New draft version started")))
);

router.get(
  "/versions/:id",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await getTemplateVersionForAdmin(req.params.id), "Template version")))
);

router.put(
  "/versions/:id",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await updateDraft(req.params.id, req.body, req.user), "Draft saved")))
);

router.delete(
  "/versions/:id",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await deleteDraft(req.params.id), "Draft deleted")))
);

router.post(
  "/versions/:id/publish",
  asyncHandler(async (req, res) => {
    const version = await publishVersion(req.params.id, req.user);
    await changed(req, version, "published", "Published");
    res.json(new ApiResponse(version, "Version published"));
  })
);

router.post(
  "/versions/:id/retire",
  asyncHandler(async (req, res) => {
    const version = await retireVersion(req.params.id, req.user);
    await changed(req, version, "retired", "Retired");
    res.json(new ApiResponse(version, "Version retired"));
  })
);

router.put(
  "/versions/:id/review",
  asyncHandler(async (req, res) => {
    const version = await setReview(req.params.id, req.body, req.user);
    await changed(req, version, version.reviewer ? "review_recorded" : "review_removed", version.reviewer ? `Recorded the review by ${version.reviewer.name} of` : "Removed the review of");
    res.json(new ApiResponse(version, "Review updated"));
  })
);

router.post(
  "/versions/:id/preview",
  asyncHandler(async (req, res) => {
    const { buffer, pageCount } = await previewVersion(req.params.id, req.body?.answers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Page-Count", String(pageCount));
    res.setHeader("Access-Control-Expose-Headers", "X-Page-Count");
    res.status(200).end(buffer);
  })
);

export default router;
