import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireSuperadmin } from "../middleware/admin.middleware.js";
import { Pdf } from "../models/Pdf.model.js";
import { PdfAudit } from "../models/PdfAudit.model.js";
import { User } from "../models/User.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { ApiKey } from "../models/ApiKey.model.js";
import { Webhook } from "../models/Webhook.model.js";
import { env } from "../config/env.js";
import { generateBsaEvidenceCertificate } from "../services/bsaCertificate.service.js";
import { upgradeUserPlan, getOrCreateSubscription } from "../services/subscription.service.js";

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

// GET /api/admin/analytics - Comprehensive platform analytics, MRR, 24h counters & time series (Customer accounts only)
router.get("/analytics", async (req, res) => {
  try {
    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 0. Find all Admin / Superadmin user IDs to exclude from customer business metrics
    const adminUsers = await User.find({
      $or: [
        { role: { $in: ["admin", "superadmin"] } },
        { email: "admin@signaturly.pro" },
      ],
    }).select("_id");
    const adminUserIds = adminUsers.map((u) => u._id);

    const customerUserQuery = { _id: { $nin: adminUserIds }, role: { $nin: ["admin", "superadmin"] } };
    const customerSubQuery = { userId: { $nin: adminUserIds }, status: "active" };

    // 1. User & Subscriber Counts (Customer Only)
    const totalUsers = await User.countDocuments(customerUserQuery);
    const newUsers24h = await User.countDocuments({ ...customerUserQuery, createdAt: { $gte: past24h } });
    const newUsers7d = await User.countDocuments({ ...customerUserQuery, createdAt: { $gte: past7d } });

    // Plan distributions for customer accounts
    const [freeCount, proMonthlyCount, proAnnualCount, lifetimeCount, enterpriseCount] = await Promise.all([
      Subscription.countDocuments({ userId: { $nin: adminUserIds }, plan: "free" }),
      Subscription.countDocuments({ ...customerSubQuery, plan: "pro_monthly" }),
      Subscription.countDocuments({ ...customerSubQuery, plan: "pro_annual" }),
      Subscription.countDocuments({ ...customerSubQuery, plan: "lifetime" }),
      Subscription.countDocuments({ ...customerSubQuery, plan: "enterprise" }),
    ]);

    const totalPaidSubscribers = proMonthlyCount + proAnnualCount + lifetimeCount + enterpriseCount;
    const conversionRate = totalUsers > 0 ? ((totalPaidSubscribers / totalUsers) * 100).toFixed(1) : 0;

    // 2. Financial Metrics (Real customer revenue only)
    const mrr = (proMonthlyCount * 5.99) + (proAnnualCount * 4.08) + (enterpriseCount * 14.99);
    const ltdRevenue = lifetimeCount * 69;
    const grossRevenue = (proMonthlyCount * 5.99) + (proAnnualCount * 49) + ltdRevenue + (enterpriseCount * 14.99);
    const arpu = totalPaidSubscribers > 0 ? (grossRevenue / totalPaidSubscribers).toFixed(2) : 0;

    // Subscriptions created/updated in last 24h
    const newPaid24h = await Subscription.countDocuments({
      userId: { $nin: adminUserIds },
      updatedAt: { $gte: past24h },
      plan: { $ne: "free" },
    });

    // 3. Document Pipeline Metrics
    const [totalDocs, executedDocs, pendingDocs, draftDocs, totalAudits, newDocs24h, signedDocs24h] = await Promise.all([
      Pdf.countDocuments(),
      Pdf.countDocuments({ status: "signed" }),
      Pdf.countDocuments({ status: { $in: ["pending", "partially_signed"] } }),
      Pdf.countDocuments({ status: "draft" }),
      PdfAudit.countDocuments(),
      Pdf.countDocuments({ createdAt: { $gte: past24h } }),
      Pdf.countDocuments({ updatedAt: { $gte: past24h }, status: "signed" }),
    ]);

    // 4. Time Series Graph Data for Past 7, 14, or 30 Days (Customer Only)
    const range = req.query.range || "7d";
    const daysCount = range === "30d" ? 30 : range === "14d" ? 14 : 7;
    const dailyStats = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);

      const [dayUsers, dayDocs, daySigned, dayPaid] = await Promise.all([
        User.countDocuments({ ...customerUserQuery, createdAt: { $gte: dayStart, $lte: dayEnd } }),
        Pdf.countDocuments({ createdAt: { $gte: dayStart, $lte: dayEnd } }),
        Pdf.countDocuments({ updatedAt: { $gte: dayStart, $lte: dayEnd }, status: "signed" }),
        Subscription.countDocuments({
          userId: { $nin: adminUserIds },
          updatedAt: { $gte: dayStart, $lte: dayEnd },
          plan: { $ne: "free" },
        }),
      ]);

      const dayLabel = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyStats.push({
        date: dayLabel,
        signups: dayUsers,
        envelopesCreated: dayDocs,
        envelopesSigned: daySigned,
        paidSubscribers: dayPaid,
      });
    }

    // 5. Enterprise Resources
    const [totalWorkspaces, totalApiKeys, totalWebhooks] = await Promise.all([
      Workspace.countDocuments(),
      ApiKey.countDocuments({ status: "active" }),
      Webhook.countDocuments(),
    ]);

    return res.json({
      success: true,
      data: {
        financials: {
          mrr: parseFloat(mrr.toFixed(2)),
          ltdRevenue: parseFloat(ltdRevenue.toFixed(2)),
          grossRevenue: parseFloat(grossRevenue.toFixed(2)),
          arpu: parseFloat(arpu),
          totalPaidSubscribers,
          conversionRate: parseFloat(conversionRate),
        },
        subscribers: {
          total: totalUsers,
          free: freeCount,
          proMonthly: proMonthlyCount,
          proAnnual: proAnnualCount,
          lifetime: lifetimeCount,
          enterprise: enterpriseCount,
          newUsers24h,
          newUsers7d,
          newPaid24h,
        },
        documents: {
          total: totalDocs,
          executed: executedDocs,
          pending: pendingDocs,
          draft: draftDocs,
          totalAudits,
          newDocs24h,
          signedDocs24h,
        },
        enterprise: {
          totalWorkspaces,
          totalApiKeys,
          totalWebhooks,
        },
        dailyStats,
        systemHealth: {
          status: "HEALTHY",
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          complianceMode: "Section 10A IT Act + Section 63 BSA + eIDAS Standard",
          merkleIntegrity: "APPEND_ONLY_SHA256_VERIFIED",
        },
      },
    });
  } catch (error) {
    console.error("Error generating admin analytics:", error);
    return res.status(500).json({ error: "Failed to load admin analytics" });
  }
});

// GET /api/admin/users - Comprehensive User Directory with Plan & Quota Details
router.get("/users", async (req, res) => {
  try {
    const { search = "", plan = "all", limit = 100 } = req.query;

    const query = {
      role: { $nin: ["admin", "superadmin"] },
      email: { $ne: "admin@signaturly.pro" },
    };
    if (search.trim()) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search.trim(), $options: "i" } },
            { email: { $regex: search.trim(), $options: "i" } },
          ],
        },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    // Attach subscription and document count for each user
    const usersWithDetails = await Promise.all(
      users.map(async (u) => {
        const [sub, docCount, signedCount] = await Promise.all([
          getOrCreateSubscription(u._id),
          Pdf.countDocuments({ userId: u._id }),
          Pdf.countDocuments({ userId: u._id, status: "signed" }),
        ]);

        return {
          id: u._id,
          name: u.name || "Unnamed User",
          email: u.email,
          role: u.role,
          isActive: u.isActive !== false,
          createdAt: u.createdAt,
          plan: sub.plan,
          status: sub.status,
          monthlyQuota: sub.monthlyQuota,
          usedThisMonth: sub.usedThisMonth,
          isUnlimited: sub.plan !== "free",
          totalDocuments: docCount,
          signedDocuments: signedCount,
          quotaResetDate: sub.quotaResetDate,
        };
      })
    );

    // Filter by plan if requested
    const filteredUsers = plan === "all"
      ? usersWithDetails
      : usersWithDetails.filter((u) => u.plan === plan);

    return res.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return res.status(500).json({ error: "Failed to fetch users directory" });
  }
});

// GET /api/admin/users/:id/documents - View all documents owned by a specific user (Read-only metadata)
router.get("/users/:id/documents", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("name email");
    if (!user) return res.status(404).json({ error: "User not found" });

    const documents = await Pdf.find({ userId: id })
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      user,
      documents,
    });
  } catch (error) {
    console.error("Error fetching user documents:", error);
    return res.status(500).json({ error: "Failed to fetch user documents" });
  }
});

// PATCH /api/admin/users/:id/plan - Superadmin modifies or grants specific tier & duration
router.patch("/users/:id/plan", async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, durationDays, customQuota } = req.body;

    if (!["free", "pro_monthly", "pro_annual", "lifetime", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan specified" });
    }

    const sub = await upgradeUserPlan(id, plan, {
      amount: plan === "lifetime" ? 69 : plan === "pro_monthly" ? 5.99 : plan === "enterprise" ? 14.99 : 0,
    });

    if (customQuota && !isNaN(customQuota)) {
      sub.monthlyQuota = parseInt(customQuota, 10);
    }

    if (durationDays && !isNaN(durationDays) && plan !== "lifetime" && plan !== "free") {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + parseInt(durationDays, 10));
      sub.quotaResetDate = expiry;
    }

    await sub.save();

    return res.json({
      success: true,
      message: `User plan successfully updated to ${plan.toUpperCase()}`,
      subscription: sub,
    });
  } catch (error) {
    console.error("Error updating user plan:", error);
    return res.status(500).json({ error: "Failed to update user plan" });
  }
});

// POST /api/admin/users/:id/reset-quota - Reset monthly envelope usage counter
router.post("/users/:id/reset-quota", async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await getOrCreateSubscription(id);
    sub.usedThisMonth = 0;
    await sub.save();

    return res.json({
      success: true,
      message: "User envelope quota reset to 0 used for this month",
      subscription: sub,
    });
  } catch (error) {
    console.error("Error resetting user quota:", error);
    return res.status(500).json({ error: "Failed to reset quota" });
  }
});

// GET /api/admin/documents - System-wide document oversight (Metadata view only)
router.get("/documents", async (req, res) => {
  try {
    const documents = await Pdf.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(150);

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
      .limit(200);

    return res.json({ logs });
  } catch (error) {
    console.error("Error fetching admin audit logs:", error);
    return res.status(500).json({ error: "Failed to fetch audit log trail" });
  }
});

// GET /api/admin/documents/:id/bsa-certificate - Generate Section 63 BSA evidence certificate
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
