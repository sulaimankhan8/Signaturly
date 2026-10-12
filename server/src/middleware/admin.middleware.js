import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";

export const ADMIN_ROLES = ["superadmin", "admin"];

/**
 * Middleware enforcing isolated admin authentication.
 * Admin tokens are signed with their own secret, so a normal user token is never accepted here.
 */
export const requireSuperadmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "ADMIN_AUTH_REQUIRED: Admin authentication token missing" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, env.adminJwtSecret);
    } catch (e) {
      return res.status(401).json({ error: "ADMIN_AUTH_INVALID: Invalid or expired admin token" });
    }

    // The role is read from the database on every request, never trusted from the token alone
    const user = await User.findById(decoded.id);
    if (!user || !decoded.isAdmin || !ADMIN_ROLES.includes(user.role) || user.deletedAt || user.suspendedAt) {
      return res.status(403).json({ error: "ACCESS_DENIED: Superadmin privileges required" });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      isAdmin: true,
    };

    // Block any attempt by admins to mutate audit records or executed agreements
    if (req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
      const isAuditPath = req.originalUrl.includes("/audit") || req.originalUrl.includes("/logs");
      if (isAuditPath) {
        return res.status(403).json({
          error: "AUDIT_MUTATION_DENIED: Administrators cannot modify audit trails or executed agreement records.",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Admin authentication middleware error:", error.message);
    return res.status(500).json({ error: "Admin authentication failure" });
  }
};
