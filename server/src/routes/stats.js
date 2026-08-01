// Dashboard stats — counts for cards and a small breakdown by clinic.
const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware");

const router = express.Router();
router.use(requireAuth);

// GET /api/stats/overview
router.get("/overview", async (req, res) => {
  try {
    const [{ totalPatients }] = await query("SELECT COUNT(*) AS totalPatients FROM patients");
    const [{ eligible }] = await query("SELECT COUNT(*) AS eligible FROM patients WHERE fh_eligible = 1");
    const [{ referredPatients }] = await query(
      "SELECT COUNT(*) AS referredPatients FROM patients WHERE referral_status = 'Referred'"
    );
    const [{ pending }] = await query(
      "SELECT COUNT(*) AS pending FROM patients WHERE fh_eligible = 1 AND referral_status <> 'Referred'"
    );
    const [{ myReferrals }] = await query(
      "SELECT COUNT(*) AS myReferrals FROM referrals WHERE referrer_id = ?",
      [req.user.id]
    );
    const byClinic = await query(
      `SELECT clinic,
              COUNT(*) AS total,
              SUM(fh_eligible = 1) AS eligible,
              SUM(referral_status = 'Referred') AS referred
       FROM patients GROUP BY clinic ORDER BY eligible DESC`
    );
    // Scoped to the requesting clinician's own clinic — referrals are
    // patient-identifying (name, NRIC), so this must never span clinics.
    const recent = req.user.clinic
      ? await query(
          `SELECT reference,patient_name,patient_nric,status,created_at
           FROM referrals WHERE clinic = ? ORDER BY created_at DESC LIMIT 6`,
          [req.user.clinic]
        )
      : [];
    res.json({
      cards: { totalPatients, eligible, referredPatients, pending, myReferrals },
      byClinic,
      recent,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load stats." });
  }
});

module.exports = router;
