import { Router } from "express";
import { upload } from "../config/multer.js";
import {
  uploadPdfController,
  getMyPdfsController,
  deletePdfController,
  getPdfAuditController,
  getAuditCertificatePdfController,
} from "../controllers/pdf.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { registerSseClient } from "../services/sse.service.js";

const router = Router();

// Real-time SSE stream for instant status updates without polling
router.get("/events", protect, (req, res) => {
  registerSseClient(req.user.id, req, res);
});

router.post(
  "/upload",
  protect,
  upload.single("pdf"),
  uploadPdfController
);

router.get("/my-documents", protect, getMyPdfsController);
router.delete("/:id", protect, deletePdfController);
router.get("/:id/audit", protect, getPdfAuditController);
router.get("/:id/audit-certificate", protect, getAuditCertificatePdfController);

export default router;