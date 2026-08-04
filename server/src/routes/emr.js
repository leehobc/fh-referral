// EMR context — the bridge between the demo EMR page and the referral tool.
//
// The demo EMR page (/emr) sets which patient is "open" via POST /context.
// The referral tool then reads that same context via GET /current-patient,
// exactly as a real app would receive its patient from a SMART-on-FHIR launch.
//
// The context is a single in-memory value (fine for a one-machine demo).
const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware");

const router = express.Router();
const LDL_THRESHOLD = 5.5;
const IDLE_MS = 30 * 60 * 1000; // auto-close the open patient after 30 min idle

// Which patient is currently open in the demo EMR.
let emrContext = { nric: null };
let idleTimer = null;

// Any read/write of the context counts as activity and pushes the auto-close
// out another 30 minutes — mirrors a real EMR session timeout, so a chart
// left open unattended doesn't stay "active" (and readable via the referral
// tool's EMR API) indefinitely.
function touchIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = emrContext.nric
    ? setTimeout(() => { emrContext = { nric: null }; idleTimer = null; }, IDLE_MS)
    : null;
}

async function getByNric(nric) {
  const [p] = await query("SELECT * FROM patients WHERE nric = ?", [nric]);
  if (p) p.eligible = Number(p.ldl) >= LDL_THRESHOLD;
  return p || null;
}
async function findPatient(identifier) {
  const id = String(identifier || "").trim();
  if (!id) return null;
  const rows = await query(
    "SELECT * FROM patients WHERE patient_ref = ? OR nric = ? OR name LIKE ? LIMIT 1",
    [id.toUpperCase(), id.toUpperCase(), `%${id}%`]
  );
  const p = rows[0];
  if (p) p.eligible = Number(p.ldl) >= LDL_THRESHOLD;
  return p || null;
}

/* ── Demo EMR page endpoints (no auth: stands in for a separate system) ── */

// What patient is open in the EMR right now.
router.get("/context", async (req, res) => {
  if (!emrContext.nric) return res.json({ patient: null });
  touchIdleTimer();
  res.json({ patient: await getByNric(emrContext.nric) });
});

// Open a patient in the EMR (by patient ref P0001, NRIC, or name).
router.post("/context", async (req, res) => {
  const p = await findPatient(req.body && req.body.identifier);
  if (!p) return res.status(404).json({ error: "No patient found for that ID / NRIC / name." });
  emrContext = { nric: p.nric };
  touchIdleTimer();
  res.json({ patient: p });
});

// Close the patient (clear context).
router.delete("/context", (req, res) => {
  emrContext = { nric: null };
  touchIdleTimer();
  res.json({ ok: true });
});

/* ── Referral tool endpoint (auth): the patient currently open in the EMR ── */

router.get("/current-patient", requireAuth, async (req, res) => {
  if (!emrContext.nric)
    return res.status(404).json({ error: "No patient is open in the EMR. Open one in the demo EMR first." });
  const p = await getByNric(emrContext.nric);
  if (!p) return res.status(404).json({ error: "The EMR patient could not be read." });
  touchIdleTimer();
  res.json({ patient: p, source: "EMR (demo context)" });
});

// Demo shortcut: simulate a random patient being opened in the EMR.
router.post("/current-patient/next", requireAuth, async (req, res) => {
  const [r] = await query("SELECT nric FROM patients ORDER BY RAND() LIMIT 1");
  if (r) emrContext = { nric: r.nric };
  touchIdleTimer();
  res.json({ patient: await getByNric(emrContext.nric), source: "EMR (demo context)" });
});

module.exports = router;
