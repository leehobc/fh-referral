// Referral routes — create a referral, list history, fetch one.
const express = require("express");
const crypto = require("crypto");
const { query } = require("../db");
const { requireAuth } = require("../middleware");

const router = express.Router();
router.use(requireAuth);

const makeRef = () => "FH-" + crypto.randomBytes(3).toString("hex").toUpperCase();

// POST /api/referrals
router.post("/", async (req, res) => {
  const b = req.body || {};
  const required = ["patient_nric", "patient_name", "contact", "ldl"];
  const missing = required.filter((k) => !String(b[k] ?? "").trim());
  if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });

  const reference = makeRef();
  try {
    await query(
      `INSERT INTO referrals
        (reference,patient_nric,patient_name,age,sex,nationality,contact,ldl,total_chol,
         on_statin,notes,referrer_id,referrer_label,clinic,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'Submitted')`,
      [
        reference, b.patient_nric, b.patient_name, b.age || null, b.sex || null,
        b.nationality || null, b.contact, b.ldl, b.total_chol || null,
        b.on_statin || null, b.notes || null, req.user.id,
        b.referrer_label || req.user.clinician_id, b.clinic || null,
      ]
    );
    // Reflect the referral back onto the patient record where we can match it.
    await query(
      "UPDATE patients SET referral_status = 'Referred', appointment_status = 'Awaiting GAC' WHERE nric = ?",
      [b.patient_nric]
    );
    await query("INSERT INTO audit_log (user_id,action,meta) VALUES (?,?,?)",
      [req.user.id, "referral_created", JSON.stringify({ reference, nric: b.patient_nric })]);
    const [row] = await query("SELECT * FROM referrals WHERE reference = ?", [reference]);
    res.status(201).json({ referral: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not submit referral." });
  }
});

// GET /api/referrals — history (mine, or all for admin) with optional search
router.get("/", async (req, res) => {
  const q = (req.query.query || "").trim();
  const where = [];
  const params = [];
  if (req.user.role !== "admin") { where.push("referrer_id = ?"); params.push(req.user.id); }
  if (q) { where.push("(reference LIKE ? OR patient_name LIKE ? OR patient_nric LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const rows = await query(
      `SELECT id,reference,patient_nric,patient_name,ldl,clinic,status,created_at
       FROM referrals ${whereSql} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json({ referrals: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not list referrals." });
  }
});

// GET /api/referrals/:reference
router.get("/:reference", async (req, res) => {
  try {
    const [row] = await query("SELECT * FROM referrals WHERE reference = ?", [req.params.reference]);
    if (!row) return res.status(404).json({ error: "Referral not found." });
    if (req.user.role !== "admin" && row.referrer_id !== req.user.id)
      return res.status(403).json({ error: "Not your referral." });
    res.json({ referral: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not fetch referral." });
  }
});

module.exports = router;
