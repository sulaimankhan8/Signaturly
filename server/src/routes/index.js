import { Router } from "express";
import authRoutes from "./auth.routes.js";
import pdfRoutes from "./pdf.routes.js";
import signRoutes from "./sign.routes.js";
import sendRoutes from "./send.routes.js";
import signingRoutes from "./signing.routes.js";
import templateRoutes from "./template.routes.js";
import userRoutes from "./user.routes.js";
import bulkRoutes from "./bulk.routes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/pdf", pdfRoutes);
router.use("/pdf", signRoutes);
router.use("/send", sendRoutes);
router.use("/signing", signingRoutes);
router.use("/templates", templateRoutes);
router.use("/user", userRoutes);
router.use("/bulk", bulkRoutes);

export default router;

