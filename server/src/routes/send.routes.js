import { Router } from "express";
import { protect, requireVerifiedEmail } from "../middlewares/auth.middleware.js";
import {
  sendDocumentController,
  getDocumentDetailsController,
  voidDocumentController,
  remindRecipientController,
  updateRecipientEmailController,
} from "../controllers/send.controller.js";

const router = Router();

router.post("/:pdfId", protect, requireVerifiedEmail, sendDocumentController);
router.get("/:pdfId", protect, getDocumentDetailsController);
router.post("/:pdfId/void", protect, voidDocumentController);
router.post("/recipients/:recipientId/remind", protect, remindRecipientController);
router.patch("/recipients/:recipientId/email", protect, updateRecipientEmailController);

export default router;
