// Optional: run `npm run seed` to (re)create tables and seed data manually.
// Normally the server does this automatically on first start.
require("dotenv").config();
const { waitForDb } = require("./db");
const { initDb } = require("./initDb");

(async () => {
  await waitForDb();
  await initDb();
  console.log("Seed complete.");
  process.exit(0);
})();
