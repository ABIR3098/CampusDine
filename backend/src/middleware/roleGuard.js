// CampusDine Middleware: Role-Based Access Control (RBAC)
function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = (req.user.role || "").toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      return res.status(403).json({
        error: "Forbidden: You do not have permission to access this resource",
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}

module.exports = roleGuard;
