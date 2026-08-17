import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
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

router.get("/prebuilt", protect, getPrebuiltTemplatesController);
router.post("/prebuilt/:prebuiltId/import", protect, importPrebuiltTemplateController);

router.post("/", protect, upload.single("pdf"), createTemplateController);
router.get("/", protect, getMyTemplatesController);
router.get("/:id", protect, getTemplateDetailsController);
router.put("/:id", protect, updateTemplateController);
router.delete("/:id", protect, deleteTemplateController);
router.post("/:id/use", protect, useTemplateController);

export default router;
