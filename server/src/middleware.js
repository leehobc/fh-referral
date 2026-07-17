// Route guard — expects "Authorization: Bearer <token>".
const { verifyToken } = require("./auth");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Not authenticated." });
  req.user = payload; // { id, clinician_id, role }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only." });
  next();
}

module.exports = { requireAuth, requireAdmin };
