// Account routes: current profile, update profile/preferences, change password.
const express = require("express");
const { query } = require("../db");
const { hashPassword, verifyPassword } = require("../auth");
const { requireAuth } = require("../middleware");
const { publicUser } = require("./auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/me   (router mounted at /api/me)
router.get("/", async (req, res) => {
  const [u] = await query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!u) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(u) });
});

// PUT /api/me — disabled. Profile fields (name, email, clinic) are set by an
// administrator, not self-editable, so the UI has no form for this — this
// route stays in place only to reject any direct call that bypasses the UI.
router.put("/", (req, res) => {
  res.status(403).json({ error: "Profile fields are managed by an administrator and cannot be changed here." });
});

// POST /api/me/change-password
router.post("/change-password", async (req, res) => {
  const { current, next: nextPw } = req.body || {};
  if (!current || !nextPw) return res.status(400).json({ error: "Current and new password required." });
  if (String(nextPw).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  try {
    const [u] = await query("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!(await verifyPassword(current, u.password_hash)))
      return res.status(400).json({ error: "Current password is incorrect." });
    const hash = await hashPassword(nextPw);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not change password." });
  }
});

module.exports = router;
