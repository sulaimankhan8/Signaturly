import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireSuperadmin } from "../middleware/admin.middleware.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { Recipient } from "../models/Recipient.model.js";
import { User } from "../models/User.model.js";
import { generateBsaEvidenceCertificate } from "../services/bsaCertificate.service.js";

const router = express.Router();

// Apply auth + superadmin check to all admin routes
router.use(protect, requireSuperadmin);

// GET /api/admin/stats - Superadmin dashboard system metrics & governance statistics
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDocuments = await Pdf.countDocuments();
    const executedDocuments = await Pdf.countDocuments({ status: "signed" });
    const pendingDocuments = await Pdf.countDocuments({ status: { $in: ["pending", "partially_signed"] } });
    const totalAuditEvents = await PdfAudit.countDocuments();

    return res.json({
      systemMetrics: {
        totalUsers,
        totalDocuments,
        executedDocuments,
        pendingDocuments,
        totalAuditEvents,
        storageImmutabilityMode: "MongoDB Append-Only SHA-256 Merkle Chain + WORM Compliant",
        complianceStatus: "India IT Act Sec 10A & BSA Sec 63 Compliant",
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return res.status(500).json({ error: "Failed to load admin dashboard stats" });
  }
});

// GET /api/admin/documents - System-wide document oversight (Metadata view only)
router.get("/documents", async (req, res) => {
  try {
    const documents = await Pdf.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ documents });
  } catch (error) {
    console.error("Error fetching admin documents:", error);
    return res.status(500).json({ error: "Failed to fetch document directory" });
  }
});

// GET /api/admin/audit-logs - System-wide immutable audit trail inspection
router.get("/audit-logs", async (req, res) => {
  try {
    const logs = await PdfAudit.find()
      .populate("pdfId", "originalFileName status")
      .sort({ createdAt: -1 })
      .limit(150);

    return res.json({ logs });
  } catch (error) {
    console.error("Error fetching admin audit logs:", error);
    return res.status(500).json({ error: "Failed to fetch audit log trail" });
  }
});

// GET /api/admin/documents/:id/bsa-certificate - Generate Section 63 BSA evidence certificate for court subpoena
router.get("/documents/:id/bsa-certificate", async (req, res) => {
  try {
    const pdfBytes = await generateBsaEvidenceCertificate(req.params.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="BSA_Sec63_Evidence_Certificate_${req.params.id}.pdf"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generating BSA certificate:", error);
    return res.status(500).json({ error: "Failed to generate Section 63 BSA Evidence Certificate" });
  }
});

export default router;
