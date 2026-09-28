import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTier } from "../middlewares/subscription.middleware.js";
import { upload } from "../config/multer.js";
import {
  createTemplateController,
  getMyTemplatesController,
  getPrebuiltTemplatesController,
  importPrebuiltTemplateController,
  getTemplateDetailsController,
  updateTemplateController,
  deleteTemplateController,
  useTemplateController,
} from "../controllers/template.controller.js";

const router = Router();

// Viewing prebuilt catalog and my templates is accessible so users can see the library
router.get("/prebuilt", protect, getPrebuiltTemplatesController);
router.get("/", protect, getMyTemplatesController);
router.get("/:id", protect, getTemplateDetailsController);

// Importing, creating, and dispatching templates requires Pro, Lifetime, or Enterprise tier
router.post(
  "/prebuilt/:prebuiltId/import",
  protect,
  requireTier(["pro_monthly", "pro_annual", "lifetime", "enterprise"]),
  importPrebuiltTemplateController
);

router.post(
  "/",
  protect,
  requireTier(["pro_monthly", "pro_annual", "lifetime", "enterprise"]),
  upload.single("pdf"),
  createTemplateController
);

router.put(
  "/:id",
  protect,
  requireTier(["pro_monthly", "pro_annual", "lifetime", "enterprise"]),
  updateTemplateController
);

router.delete("/:id", protect, deleteTemplateController);

router.post(
  "/:id/use",
  protect,
  requireTier(["pro_monthly", "pro_annual", "lifetime", "enterprise"]),
  useTemplateController
);

export default router;
