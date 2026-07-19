// FH Referral Assistant — API + static host.
// Serves the JSON API under /api and the React frontend from /public.
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { waitForDb } = require("./db");
const { initDb } = require("./initDb");

const authRoutes = require("./routes/auth").router;
const accountRoutes = require("./routes/account");
const patientRoutes = require("./routes/patients");
const referralRoutes = require("./routes/referrals");
const statsRoutes = require("./routes/stats");
const emrRoutes = require("./routes/emr");
const chatRoutes = require("./routes/chat");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check (useful for Container Manager / uptime checks).
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRoutes);
app.use("/api/me", accountRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/emr", emrRoutes);
app.use("/api/chat", chatRoutes);

// Static frontend. The SPA uses hash routing, so any non-API path
// returns index.html — except /emr, the standalone demo EMR page.
const publicDir = path.join(__dirname, "..", "..", "public");
app.use(express.static(publicDir));
app.get("/emr", (req, res) => res.sendFile(path.join(publicDir, "emr.html")));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(publicDir, "index.html")));

const PORT = Number(process.env.PORT || 3000);

(async () => {
  try {
    await waitForDb();
    await initDb();
    app.listen(PORT, () => console.log(`FH Referral Assistant running on port ${PORT}`));
  } catch (e) {
    console.error("Startup failed:", e);
    process.exit(1);
  }
})();
