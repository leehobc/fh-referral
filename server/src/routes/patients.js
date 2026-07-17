// Patient routes — this is the real EMR stand-in, backed by the database.
// GET /api/patients/:nric is the production equivalent of the PoC's
// fetchPatientFromEMR() mock; in a live deployment it would proxy a FHIR call.
const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware");

const router = express.Router();
router.use(requireAuth);

const LDL_THRESHOLD = 5.5;

// GET /api/patients?query=&eligible=&clinic=&page=&pageSize=
router.get("/", async (req, res) => {
  const q = (req.query.query || "").trim();
  const eligible = req.query.eligible; // "1" | "0" | undefined
  const clinic = (req.query.clinic || "").trim();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "20", 10)));
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];
  if (q) { where.push("(name LIKE ? OR nric LIKE ? OR patient_ref LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (eligible === "1" || eligible === "0") { where.push("fh_eligible = ?"); params.push(Number(eligible)); }
  if (clinic) { where.push("clinic = ?"); params.push(clinic); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM patients ${whereSql}`, params);
    const rows = await query(
      `SELECT id,patient_ref,nric,name,age,gender,ethnicity,ldl,fh_eligible,
              risk_score,clinic,doctor,referral_status,appointment_status
       FROM patients ${whereSql}
       ORDER BY fh_eligible DESC, risk_score DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.json({ total, page, pageSize, patients: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not list patients." });
  }
});

// GET /api/patients/:nric — full record used to autofill a referral.
router.get("/:nric", async (req, res) => {
  try {
    const [p] = await query("SELECT * FROM patients WHERE nric = ?", [req.params.nric.trim().toUpperCase()]);
    if (!p) return res.status(404).json({ error: "No record found for that NRIC." });
    p.eligible = Number(p.ldl) >= LDL_THRESHOLD;
    res.json({ patient: p });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not fetch patient." });
  }
});

module.exports = router;
