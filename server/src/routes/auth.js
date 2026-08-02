// Authentication routes: register, login, forgot-password, reset-password.
const express = require("express");
const crypto = require("crypto");
const { query } = require("../db");
const { hashPassword, verifyPassword, signToken, signPendingToken, verifyToken } = require("../auth");

// Fixed mock verification code for the 2FA step — no real authenticator
// app / SMS-TOTP is wired up in this build, so every login accepts the
// same code once the password has already been verified (same pattern as
// the fixed DEMO_OTP used for the referral-view SMS flow).
const DEMO_2FA_CODE = "340587";

const router = express.Router();

const publicUser = (u) => ({
  id: u.id, clinician_id: u.clinician_id, name: u.name,
  email: u.email, clinic: u.clinic, role: u.role,
  prefs: u.prefs ? (typeof u.prefs === "string" ? JSON.parse(u.prefs) : u.prefs) : {},
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { clinician_id, name, email, clinic, password } = req.body || {};
  if (!clinician_id || !name || !password)
    return res.status(400).json({ error: "clinician_id, name and password are required." });
  if (String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const existing = await query(
      "SELECT id FROM users WHERE clinician_id = ? OR (email IS NOT NULL AND email = ?)",
      [clinician_id, email || null]
    );
    if (existing.length) return res.status(409).json({ error: "Clinician ID or email already registered." });

    const hash = await hashPassword(password);
    const result = await query(
      "INSERT INTO users (clinician_id,name,email,clinic,role,password_hash) VALUES (?,?,?,?,?,?)",
      [clinician_id, name, email || null, clinic || null, "clinician", hash]
    );
    const [u] = await query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    res.status(201).json({ token: signToken(u), user: publicUser(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not register." });
  }
});

// POST /api/auth/login — first factor. On success this does NOT issue a
// full session token; it returns a short-lived pending token that only
// POST /api/auth/verify-2fa can redeem, once the second factor is checked.
router.post("/login", async (req, res) => {
  const { clinician_id, password } = req.body || {};
  if (!clinician_id || !password)
    return res.status(400).json({ error: "Enter your clinician ID and password." });
  try {
    const [u] = await query("SELECT * FROM users WHERE clinician_id = ?", [clinician_id]);
    if (!u || !(await verifyPassword(password, u.password_hash)))
      return res.status(401).json({ error: "Invalid clinician ID or password." });
    res.json({ mfaRequired: true, pendingToken: signPendingToken(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not sign in." });
  }
});

// POST /api/auth/verify-2fa — second factor. No real authenticator app /
// SMS-TOTP is wired up in this build, so DEMO_2FA_CODE always works.
router.post("/verify-2fa", async (req, res) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || !code) return res.status(400).json({ error: "Enter the verification code." });
  const payload = verifyToken(pendingToken);
  if (!payload || !payload.pending2fa)
    return res.status(401).json({ error: "Session expired — sign in again." });
  if (String(code).trim() !== DEMO_2FA_CODE)
    return res.status(401).json({ error: "Incorrect verification code." });
  try {
    const [u] = await query("SELECT * FROM users WHERE id = ?", [payload.id]);
    if (!u) return res.status(401).json({ error: "Session expired — sign in again." });
    await query("INSERT INTO audit_log (user_id,action) VALUES (?, 'login')", [u.id]);
    res.json({ token: signToken(u), user: publicUser(u) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not verify code." });
  }
});

// POST /api/auth/forgot-password
// In production this emails a link. For this build it returns the token
// (and logs it) so you can complete the flow without a mail server.
router.post("/forgot-password", async (req, res) => {
  const { clinician_id, email } = req.body || {};
  try {
    const [u] = await query(
      "SELECT * FROM users WHERE clinician_id = ? OR email = ?",
      [clinician_id || null, email || null]
    );
    // Always respond the same way so accounts can't be enumerated.
    if (!u) return res.json({ ok: true });
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await query("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?",
      [token, expires, u.id]);
    const link = `${process.env.APP_URL || ""}/#/reset?token=${token}`;
    console.log(`[password reset] ${u.clinician_id}: ${link}`);
    const devReveal = (process.env.NODE_ENV !== "production");
    res.json({ ok: true, ...(devReveal ? { token, link } : {}) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not start password reset." });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Token and new password required." });
  if (String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const [u] = await query(
      "SELECT * FROM users WHERE reset_token = ? AND reset_expires > NOW()",
      [token]
    );
    if (!u) return res.status(400).json({ error: "Reset link is invalid or has expired." });
    const hash = await hashPassword(password);
    await query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
      [hash, u.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not reset password." });
  }
});

module.exports = { router, publicUser };
