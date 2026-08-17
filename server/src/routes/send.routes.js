import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import {
  sendDocumentController,
  getDocumentDetailsController,
  voidDocumentController,
  remindRecipientController,
} from "../controllers/send.controller.js";

const router = Router();

router.post("/:pdfId", protect, sendDocumentController);
router.get("/:pdfId", protect, getDocumentDetailsController);
router.post("/:pdfId/void", protect, voidDocumentController);
router.post("/recipients/:recipientId/remind", protect, remindRecipientController);

export default router;

