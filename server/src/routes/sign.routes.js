import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { signPdfController , getPdfController} from "../controllers/sign.controller.js";

const router = Router();

router.post("/sign", protect, signPdfController);
router.get("/:id", protect, getPdfController);

export default router;
