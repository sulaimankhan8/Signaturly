import { Router } from "express";
import { upload } from "../config/multer.js";
import { uploadPdfController } from "../controllers/pdf.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
    "/upload",
    protect,
    upload.single("pdf"),
    uploadPdfController
);

export default router;