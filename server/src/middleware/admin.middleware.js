/**
 * Middleware enforcing Superadmin / Admin Role-Based Access Control (RBAC)
 * and Zero-Knowledge audit log immutability protections.
 */
export const requireSuperadmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "superadmin" && req.user.role !== "admin") {
    return res.status(403).json({ error: "ACCESS_DENIED: Superadmin privileges required" });
  }

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
};
