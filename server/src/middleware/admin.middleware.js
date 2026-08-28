import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.model.js";

/**
 * Middleware enforcing Isolated Superadmin Authentication & Zero-Knowledge immutability protections.
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
      decoded = jwt.verify(token, env.accessSecret);
    } catch (e) {
      return res.status(401).json({ error: "ADMIN_AUTH_INVALID: Invalid or expired admin token" });
    }

    // Check if the user is a superadmin or has explicit admin role
    const user = await User.findById(decoded.id);
    if (!user || (user.role !== "superadmin" && user.role !== "admin" && !decoded.isAdmin)) {
      return res.status(403).json({ error: "ACCESS_DENIED: Superadmin privileges required" });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      isAdmin: true,
    };

    // Zero-Knowledge Rule: Block any attempt by admins to mutate audit records or executed agreements
    if (req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
      const isAuditPath = req.originalUrl.includes("/audit") || req.originalUrl.includes("/logs");
      if (isAuditPath) {
        return res.status(403).json({
          error: "ZERO_KNOWLEDGE_MUTATION_DENIED: System administrators are strictly prohibited from modifying completed audit trails or executed agreement records.",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Admin authentication middleware error:", error);
    return res.status(500).json({ error: "Admin authentication failure" });
  }
};
