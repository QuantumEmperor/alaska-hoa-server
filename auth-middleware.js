const jwt = require("jsonwebtoken");

// Reads the login token a signed-in person's browser sends, and
// attaches who they are to the request. Rejects anyone without a
// valid token.
function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "You need to sign in first." });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Your session expired. Please sign in again." });
  }
}

// Only lets the administrator's own account through. This is what
// keeps everyone's registration info visible to just you.
function requireAdmin(req, res, next) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  if (!req.user || req.user.email !== adminEmail) {
    return res.status(403).json({ error: "Only the administrator can see this." });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
