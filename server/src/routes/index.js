import { Router } from "express";
import authRoutes from "./auth.routes.js";
import pdfRoutes from "./pdf.routes.js";
import signRoutes from "./sign.routes.js";




const router = Router();
router.use("/auth", authRoutes);
router.use("/pdf", pdfRoutes);
router.use("/pdf", signRoutes);

export default router;
