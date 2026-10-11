import { Router } from "express";
import { protect, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import {
  listCatalogueController,
  getCatalogueTemplateController,
  previewCatalogueTemplateController,
  saveCatalogueDraftController,
  deleteCatalogueDraftController,
  sendFromCatalogueController,
  getEntitlementsController,
} from "../controllers/catalogue.controller.js";

// Ready-made templates that are filled in by answering questions.
// Which plan may use which pack is checked in the service, per template, not here.
const router = Router();

router.use(protect);

router.get("/", listCatalogueController);
router.get("/entitlements", getEntitlementsController);
router.get("/:key", getCatalogueTemplateController);
router.post("/:key/preview", previewCatalogueTemplateController);
router.put("/:key/draft", saveCatalogueDraftController);
router.delete("/:key/draft", deleteCatalogueDraftController);
router.post("/:key/send", requireVerifiedEmail, sendFromCatalogueController);

export default router;
