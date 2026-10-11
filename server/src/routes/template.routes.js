import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireFeature } from "../middlewares/subscription.middleware.js";
import { upload } from "../config/multer.js";
import {
  createTemplateController,
  getMyTemplatesController,
  getTemplateDetailsController,
  updateTemplateController,
  deleteTemplateController,
  useTemplateController,
} from "../controllers/template.controller.js";

// A sender's own templates: PDFs they uploaded, with fields placed, to send again and again.
// The ready-made templates that are filled in by answering questions live in catalogue.routes.js.
const router = Router();

router.get("/", protect, getMyTemplatesController);
router.get("/:id", protect, getTemplateDetailsController);

router.post("/", protect, requireFeature("templates.own"), upload.single("pdf"), createTemplateController);
router.put("/:id", protect, requireFeature("templates.own"), updateTemplateController);
router.delete("/:id", protect, deleteTemplateController);
router.post("/:id/use", protect, requireFeature("templates.own"), useTemplateController);

export default router;
