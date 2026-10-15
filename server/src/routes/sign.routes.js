import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { signPdfController, getPdfController, saveDraftController } from "../controllers/sign.controller.js";

const router = Router();

router.post("/sign", protect, signPdfController);
router.get("/:id", protect, getPdfController);
// The editor saves its work here as the sender goes
router.put("/:id/draft", protect, saveDraftController);

export default router;
