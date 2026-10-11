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

// Guided templates, managed from the admin panel: create, version, publish, retire, record a review.
const router = Router();

router.use(requireSuperadmin);

router.get(
  "/",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await listTemplatesForAdmin(), "Templates")))
);

router.post(
  "/",
  asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(await createTemplate(req.body, req.user), "Template created as a draft")))
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
  asyncHandler(async (req, res) => res.json(new ApiResponse(await publishVersion(req.params.id, req.user), "Version published")))
);

router.post(
  "/versions/:id/retire",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await retireVersion(req.params.id, req.user), "Version retired")))
);

router.put(
  "/versions/:id/review",
  asyncHandler(async (req, res) => res.json(new ApiResponse(await setReview(req.params.id, req.body, req.user), "Review updated")))
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
