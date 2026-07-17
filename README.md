# FH Referral Assistant — Full-Stack Build

A full-stack version of the FH referral tool for the National FH Genetic Testing
Program. Frontend (React), backend API (Node/Express), and a MariaDB database
seeded with the 200 dummy patients.

```
Browser ── React SPA ──HTTP──> Node/Express API ──SQL──> MariaDB
                                     │
                                     └── serves the frontend too (one port)
```

The Node service serves **both** the API (`/api/...`) and the website, so there
is only one port to expose and no CORS to configure.

---

## 1. Which Synology packages to install

**Recommended path — Docker (simplest, self-contained):**

| Package | Why |
|---|---|
| **Container Manager** | Runs the whole stack (API + MariaDB) from `docker-compose.yml`. The Node and MariaDB images are pulled automatically, so you do **not** need the separate Node.js or MariaDB packages on this path. |

That is the only package you must install for the recommended path.

**Alternative path — native packages (no Docker):**

| Package | Why |
|---|---|
| **Node.js v20** | Runs the API/host. |
| **MariaDB 10** | Database. |
| **phpMyAdmin** (optional) | Browse the database in a UI. |
| **Web Station** (optional) | Only if you want Web Station to serve the `public/` folder instead of Node. Not required — Node already serves it. |

Install packages from **DSM → Package Center**.

---

## 2. Setup — Docker path (recommended)

1. Install **Container Manager** from Package Center.
2. Copy this whole `fh-referral/` folder to your NAS (e.g. `/volume1/docker/fh-referral`).
   - File Station, or drag-and-drop over SMB, both work.
3. In the folder, copy `.env.example` to `.env` and edit the values
   (**change every password and `JWT_SECRET`**).
4. Open **Container Manager → Project → Create**:
   - **Path**: the `fh-referral` folder.
   - It will detect `docker-compose.yml`. Click through to build and start.
   - (Equivalent CLI, if you use SSH: `cd /volume1/docker/fh-referral && docker compose up -d --build`.)
5. Wait ~1 minute on first run (it builds the image, starts MariaDB, creates the
   tables, and seeds the 200 patients + a demo login).
6. Open `http://<NAS-IP>:8098` (or whatever `APP_PORT` you set).

**First login (auto-created on first run):**
- Clinician ID: `DR-10567`
- Password: `changeme123` (or whatever you set as `DEMO_PASSWORD`)

Change it under **Settings → Change password** after signing in.

---

## 3. Setup — native path (Node + MariaDB, no Docker)

1. Install **Node.js v20** and **MariaDB 10** from Package Center.
2. In MariaDB, create a database and user (via phpMyAdmin or CLI):
   ```sql
   CREATE DATABASE fh_referral CHARACTER SET utf8mb4;
   CREATE USER 'fh_user'@'%' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON fh_referral.* TO 'fh_user'@'%';
   FLUSH PRIVILEGES;
   ```
3. SSH into the NAS, go to `fh-referral/server`, and create a `.env` file:
   ```
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=fh_referral
   DB_USER=fh_user
   DB_PASSWORD=your_password
   JWT_SECRET=replace-with-a-long-random-secret
   DEMO_CLINICIAN_ID=DR-10567
   DEMO_PASSWORD=changeme123
   NODE_ENV=production
   ```
4. Install and start:
   ```
   npm install
   npm start
   ```
   The server creates tables and seeds data on first start.
5. Open `http://<NAS-IP>:3000`.
   - To run it permanently, wrap it with pm2, or point Web Station's reverse
     proxy at `127.0.0.1:3000`.

---

## 4. What's in the app

- **Login / Register / Forgot / Reset password** — real auth (bcrypt-hashed
  passwords, JWT sessions).
- **New referral (home page)** — the five-step flow: eligibility checklist →
  patient Q&A → consent → **get the patient currently open in the EMR** →
  autofilled form → submit. There is no patient search: the tool asks the EMR
  API for the patient in the current consultation, mirroring a SMART-on-FHIR
  launch context. Patient data is only retrieved **after** consent is recorded.
- **Referrals** — history of referrals you've submitted; open one to print.
- **Profile** — edit your name, email, clinic.
- **Settings** — change password.

At the "retrieve patient" step there is a small **Demo: simulate a different
patient** link, so you can walk through several cases (eligible / not eligible)
without a manual lookup — it just changes which patient the mock EMR reports as
open.

## 4a. Demo EMR page (SMART-on-FHIR-style launch)

A standalone **mock EMR** is served at `http://<NAS-IP>:<APP_PORT>/emr`.

Flow that mirrors real EMR integration:
1. Open the EMR page and enter a **patient ID** (`P0001`), **NRIC**, or **name**,
   then click **Open patient**. The patient's chart appears and becomes the
   "active EMR context".
2. Click **Launch FH Referral Assistant** (opens the referral tool).
3. In the referral tool, do the checklist → Q&A → consent, then at the retrieve
   step click **Get current patient from EMR** — it reads whoever is open in the
   EMR (via `GET /api/emr/current-patient`) and autofills the referral.

This is the demo version of a SMART-on-FHIR launch: the EMR holds the patient
context, and the referral app receives that patient through the API instead of
searching for it. The context is a single in-memory value on the server (fine
for a one-machine demo; a real system would scope it per launch/session).

## 5. Password reset in this build

There is no mail server, so `Forgot password` **returns the reset link on screen**
(and logs it in the API container). In production you'd send that link by email
instead — swap the `console.log` in `server/src/routes/auth.js` for your mailer.

## 6. How to keep adding on

- **New API endpoint**: add a file in `server/src/routes/`, mount it in
  `server/src/server.js`.
- **New DB table/column**: add it to the `SCHEMA` array in
  `server/src/initDb.js` (uses `CREATE TABLE IF NOT EXISTS`).
- **New page**: add a component in `public/js/app.jsx`, add an entry to the `NAV`
  array, and a branch in the router at the bottom of the file. No build step —
  refresh the browser.
- **New patient fields**: they're already in the DB; surface them in the
  Patients table or referral form.

## 7. Going to real production (the honest gap)

This build is production-shaped but still a demo:
- `GET /api/emr/current-patient` is the **swap point** for a real EMR — replace
  the mock context with the patient handed to the app by a real **SMART-on-FHIR
  launch** / authorised **HL7/FHIR** call. Nothing else in the flow changes.
- Replace demo login with **SingPass / hospital SSO**.
- Any real patient/genetic data must meet **PDPA** and **MOH data governance**
  (encryption in transit and at rest, Singapore data residency, access logging —
  there's an `audit_log` table started for this).
- Don't run a real clinical system off dummy data or default secrets.
