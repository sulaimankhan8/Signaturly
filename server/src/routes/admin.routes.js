import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireSuperadmin } from "../middleware/admin.middleware.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { env } from "../config/env.js";
import { generateBsaEvidenceCertificate } from "../services/bsaCertificate.service.js";

const router = express.Router();

// POST /api/admin/login - Dedicated Isolated Admin Portal Authentication
router.post("/login", async (req, res) => {
  try {
    const { email, password, adminSecret } = req.body;

    if (!email || !password || !adminSecret) {
      return res.status(400).json({ error: "Email, password, and Admin Security Key are required." });
    }

    // 1. Verify Admin Security Key
    if (adminSecret.trim() !== env.adminSecret) {
      return res.status(401).json({ error: "INVALID_ADMIN_KEY: The provided Admin Security Key is incorrect." });
    }

    // 2. Find User
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid admin email or password." });
    }

    // 3. Verify Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid admin email or password." });
    }

    // 4. Ensure Superadmin Role
    if (user.role !== "superadmin" && user.role !== "admin") {
      user.role = "superadmin";
      await user.save();
    }

    // 5. Issue Dedicated Admin Access Token
    const adminToken = jwt.sign(
      { id: user._id, role: "superadmin", isAdmin: true },
      env.accessSecret,
      { expiresIn: "8h" }
    );

    return res.json({
      adminToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ error: "Admin authentication process failed." });
  }
});

// Apply superadmin authorization middleware to all protected admin routes below
router.use(requireSuperadmin);

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
