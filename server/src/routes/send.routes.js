import { Router } from "express";
import { protect, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import {
  sendDocumentController,
  getDocumentDetailsController,
  voidDocumentController,
  remindRecipientController,
  updateRecipientEmailController,
  recentRecipientsController,
} from "../controllers/send.controller.js";

const router = Router();

// Before the routes that take a document id, which would otherwise read this as one
router.get("/recent-recipients", protect, recentRecipientsController);
router.post("/:pdfId", protect, requireVerifiedEmail, sendDocumentController);
router.get("/:pdfId", protect, getDocumentDetailsController);
router.post("/:pdfId/void", protect, voidDocumentController);
router.post("/recipients/:recipientId/remind", protect, remindRecipientController);
router.patch("/recipients/:recipientId/email", protect, updateRecipientEmailController);

export default router;
