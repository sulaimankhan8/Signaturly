import { Router } from "express";
import { upload, uploadSeveral, MAX_FILES_TO_JOIN } from "../config/multer.js";
import {
  uploadPdfController,
  getMyPdfsController,
  syncUpdatesController,
  deletePdfController,
  getPdfAuditController,
  getAuditCertificatePdfController,
} from "../controllers/pdf.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Lightweight Delta Sync Endpoint (Zero-Idle-Cost on Cloud Run)
router.get("/sync/updates", protect, syncUpdatesController);

router.post(
  "/upload",
  protect,
  upload.single("pdf"),
  uploadPdfController
);

// Several PDFs joined into one document, in the order sent
router.post("/upload-joined", protect, uploadSeveral.array("pdfs", MAX_FILES_TO_JOIN), uploadPdfController);

router.get("/my-documents", protect, getMyPdfsController);
router.delete("/:id", protect, deletePdfController);
router.get("/:id/audit", protect, getPdfAuditController);
router.get("/:id/audit-certificate", protect, getAuditCertificatePdfController);

export default router;