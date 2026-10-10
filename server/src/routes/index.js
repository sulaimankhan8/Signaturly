import { Router } from "express";
import authRoutes from "./auth.routes.js";
import pdfRoutes from "./pdf.routes.js";
import signRoutes from "./sign.routes.js";
import sendRoutes from "./send.routes.js";
import signingRoutes from "./signing.routes.js";
import templateRoutes from "./template.routes.js";
import userRoutes from "./user.routes.js";
import bulkRoutes from "./bulk.routes.js";
import otpRoutes from "./otp.routes.js";
import verifyRoutes from "./verify.routes.js";
import adminRoutes from "./admin.routes.js";

import billingRoutes from "./billing.routes.js";

import workspaceRoutes from "./workspace.routes.js";
import developerRoutes from "./api.routes.js";
import internalRoutes from "./internal.routes.js";

const router = Router();

// Unauthenticated liveness check for load balancers and container health checks
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/pdf", pdfRoutes);
router.use("/pdf", signRoutes);
router.use("/send", sendRoutes);
router.use("/signing", signingRoutes);
router.use("/templates", templateRoutes);
router.use("/user", userRoutes);
router.use("/bulk", bulkRoutes);
router.use("/sign/otp", otpRoutes);
router.use("/verify", verifyRoutes);
router.use("/admin", adminRoutes);
router.use("/billing", billingRoutes);
router.use("/workspaces", workspaceRoutes);
router.use("/developer", developerRoutes);
router.use("/internal", internalRoutes);

export default router;


