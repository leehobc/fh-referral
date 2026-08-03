# FH Referral Assistant — Full-Stack Build

A full-stack version of the FH referral tool for the National FH Genetic Testing
Program. Frontend (React, no build step), backend API (Node/Express), a MariaDB
database seeded with 200 dummy patients, and a Gemini-powered AI assistant for
clinician Q&A.

```
Browser ── React SPA ──HTTP──> Node/Express API ──SQL──> MariaDB
                                     │
                                     ├── Vertex AI (Gemini) — clinician Q&A assistant
                                     └── serves the frontend too (one port)
```

The Node service serves **both** the API (`/api/...`) and the website, so there
is only one port to expose and no CORS to configure.

---

## 1. What you need

**Recommended path — Docker (simplest, self-contained, works the same on any OS):**

| Requirement | Why |
|---|---|
| **Docker Engine + Docker Compose v2** (the `docker compose` plugin, not the old standalone `docker-compose`) | Runs the whole stack (API + MariaDB) from `docker-compose.yml`. The Node and MariaDB images are pulled automatically, so you do **not** need Node or MariaDB installed on the host for this path. |

How you get Docker depends on where you're hosting:

| Host | How to install Docker |
|---|---|
| Synology NAS | Install **Container Manager** from Package Center (bundles Docker + Compose). |
| QNAP NAS | Install **Container Station** from App Center. |
| Linux server / VPS (Ubuntu, Debian, etc.) | Follow [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) — installs Docker Engine + the Compose plugin. |
| Windows / macOS (dev machine) | Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). |
| Unraid | Install the **Compose Manager** plugin from Community Applications. |

That's the only thing you must install for the recommended path.

**Alternative path — native packages (no Docker):**

| Requirement | Why |
|---|---|
| **Node.js v20** | Runs the API/host. |
| **MariaDB 10** (or MySQL 8) | Database. |
| A DB admin UI (optional) | e.g. phpMyAdmin, Adminer, DBeaver — to browse the database. |
| A reverse proxy (optional) | e.g. nginx, Caddy, Traefik, or your NAS's built-in one (Web Station on Synology) — only needed if you want TLS/a domain in front of Node. Not required; Node already serves the app directly. |

Install these however your OS/NAS normally installs packages (Package Center, apt, your platform's app store, etc.).

---

## 2. Setup — Docker path (recommended)

1. Install Docker for your platform (see the table above).
2. Copy this whole `fh-referral/` folder to the server, e.g.:
   - Synology: `/volume1/docker/fh-referral` (via File Station or SMB).
   - QNAP: `/share/Container/fh-referral`.
   - Linux server: anywhere convenient, e.g. `/opt/fh-referral` (`git clone` or `scp`/`rsync`).
   - Windows/Mac with Docker Desktop: anywhere on disk.
3. In the folder, copy `.env.example` to `.env` and edit the values
   (**change every password and `JWT_SECRET`**). Set `VERTEX_AI_API_KEY` if you
   want the clinician AI assistant to work (see §4b) — everything else runs fine
   without it, the "Ask AI assistant" button just won't respond.
4. Build and start it:
   - **CLI (works everywhere, including over SSH):**
     ```
     cd fh-referral
     docker compose up -d --build
     ```
   - **Synology GUI:** Container Manager → Project → Create → point **Path** at the
     `fh-referral` folder. It detects `docker-compose.yml`; click through to build and start.
   - **QNAP GUI:** Container Station → Create → Create Application, and import/paste
     `docker-compose.yml`.
   - If your Docker's default bridge network has trouble resolving container names
     (DNS timeouts between containers — occasionally seen on some NAS Docker builds),
     use the host-network variant instead:
     `docker compose -f docker-compose.host.yml up -d --build`. See the comments at
     the top of that file for details.
5. Wait ~1 minute on first run (it builds the image, starts MariaDB, creates the
   tables, and seeds the 200 patients + a demo login).
6. Open `http://<server-IP>:8098` (or whatever `APP_PORT` you set).

**First login (auto-created on first run):**
- Clinician ID: `DR-10567`
- Password: `changeme123` (or whatever you set as `DEMO_PASSWORD`)
- 2FA code: `340587` (mock — see §5)

Change the password under **Settings → Change password** after signing in.
Accounts are admin-created — there's no self-registration flow in the UI (the
old `/register` route/link was removed; `POST /api/auth/register` still exists
server-side if you want to script account creation).

**Database access (optional):** the `db` service isn't published to the host by
default. `docker-compose.yml` has a commented-out `ports: ["3307:3306"]` under
the `db` service — uncomment it and `docker compose up -d db` to reach it from
a LAN DB client (phpMyAdmin, DBeaver, etc.) at `<host-IP>:3307`, using the
`DB_USER`/`DB_PASSWORD` from your `.env`. Leave it commented out otherwise.

---

## 3. Setup — native path (Node + MariaDB, no Docker)

1. Install **Node.js v20** and **MariaDB 10** on the server.
2. In MariaDB, create a database and user (via phpMyAdmin, a CLI client, or `mysql`):
   ```sql
   CREATE DATABASE fh_referral CHARACTER SET utf8mb4;
   CREATE USER 'fh_user'@'%' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON fh_referral.* TO 'fh_user'@'%';
   FLUSH PRIVILEGES;
   ```
3. On the server, go to `fh-referral/server`, and create a `.env` file:
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
   VERTEX_AI_API_KEY=
   NODE_ENV=production
   ```
4. Install and start:
   ```
   npm install
   npm start
   ```
   The server creates tables and seeds data on first start.
5. Open `http://<server-IP>:3000`.
   - To keep it running permanently, use a process manager (e.g. `pm2`, `systemd`,
     or the NAS's equivalent), and optionally put a reverse proxy (nginx, Caddy,
     Web Station on Synology, etc.) in front of `127.0.0.1:3000` for TLS/a domain.

---

## 4. What's in the app

- **Sign in** — clinician ID + password, then a **2FA code** (see §5). No
  self-registration; accounts are admin-created.
- **New referral (home page)** — a six-step wizard:
  1. **Consent** — record that the patient agrees to proceed.
  2. **Retrieve** — pull the patient currently open in the (mock) EMR. There's
     no manual search: the tool asks the EMR API for whoever is in the current
     consultation, mirroring a SMART-on-FHIR launch context. A **Demo: simulate
     a different patient** link lets you walk through several cases without
     leaving the wizard.
  3. **Assessment** — an automated FH-likelihood check run against the
     retrieved record: Singapore Citizen/PR status is a hard gate (blocks
     referral outright, no override), and a referral is otherwise suggested if
     **either** LDL-C ≥5.5 mmol/L **or** a first-degree relative with known FH
     is present (personal history of coronary stent/bypass is shown for
     context but doesn't gate the decision). The first-degree-relative
     criterion is a checkbox the clinician ticks themselves (not sourced from
     the EMR). If EMR LDL is below threshold, the clinician can manually
     override that one criterion given external proof of a qualifying result —
     doing so requires uploading a supporting document later on the referral
     form. If nothing is suggested, the clinician can end the referral here
     (recorded as "not suggested" or "not eligible"), or use a confirmation
     modal to proceed anyway on their own judgement.
  4. **Q&A** — FAQ accordion + the AI assistant, for explaining the programme
     to the patient.
  5. **Referral form** — autofilled from the EMR record; most fields
     (including LDL, to prevent it being edited around the assessment gate)
     are locked. Testing location is required. Clinical notes are pre-filled
     with an explanatory line if the first-degree-relative or LDL-override
     criteria were used, and a required file upload appears only when the LDL
     override is active.
  6. **Submit** — prints a copy for the patient.

  At any point the clinician can end the wizard as **Patient declines or
  defers**. None of the non-referral outcomes (declined, not suggested, not
  eligible) touch the `referrals` table — they're logged to `audit_log` instead
  so the patient still shows up in the Referrals history, without creating a
  fake referral record.

- **Referrals** — history of everything that happened through the wizard:
  actual referrals plus declined/not-suggested/not-eligible outcomes, in one
  searchable list. Opening a real referral's full details requires a **View**
  button that walks through a consent confirmation, then a 6-digit SMS-style
  verification code (see §5) before revealing/printing it.
- **Profile** — read-only clinician details, managed by an administrator.
- **Settings** — change password.

## 4a. Demo EMR page (SMART-on-FHIR-style launch)

A standalone **mock EMR** is served at `http://<server-IP>:<APP_PORT>/emr`.

Flow that mirrors real EMR integration:
1. Open the EMR page and enter a **patient ID** (`P0001`), **NRIC**, or **name**,
   then click **Open patient**. The patient's chart appears (LDL, clinical
   flags, referral status) and becomes the "active EMR context".
2. Click **Launch FH Referral Assistant** (opens the referral tool).
3. In the referral tool, go through Consent, then at the Retrieve step click
   **Get current patient from EMR** — it reads whoever is open in the EMR (via
   `GET /api/emr/current-patient`) and autofills the referral.

This is the demo version of a SMART-on-FHIR launch: the EMR holds the patient
context, and the referral app receives that patient through the API instead of
searching for it. The context is a single in-memory value on the server (fine
for a one-machine demo; a real system would scope it per launch/session).

## 4b. AI assistant (clinician Q&A)

The Q&A step (and the standalone `/#/consulting` page — no longer linked from
the sidebar nav, but still reachable by URL) has an **"Ask AI assistant"**
widget, backed by Google Gemini via **Vertex AI Express Mode**
(`server/src/gemini.js`). It answers questions about the *programme* —
eligibility, process, costs — using a system prompt with the actual referral
and subsidy criteria baked in. It never sees patient data.

Requires `VERTEX_AI_API_KEY` in `.env` (see the comment above it in
`.env.example` for how to get one — free within quota for 90 days, no GCP
project setup needed). Leave it blank to disable the assistant; the rest of
the app is unaffected.

## 4c. Patient-facing pages

- **`/resources`** — a static "learn more about FH" page with links to
  official Singapore resources (Singapore Heart Foundation, NUH leaflets, the
  SingHealth Genomic Assessment Centre). Linked via a QR code shown on the
  "no referral made" outcome screens.
- **Print leaflet** — the "no referral made" screens also offer the official
  NUH "What is FH?" patient leaflet in all four of Singapore's languages
  (English/Malay/Tamil/Chinese), served from `public/leaflets/` and
  auto-printed via a hidden iframe (falls back to "open in a new tab" if the
  browser blocks it).

## 5. Mock security flows in this build

Two flows in this app stand in for real security integrations that aren't
wired up — **do not treat either as real security**:

- **2FA login**: after password verification, every login requires a 6-digit
  code. No authenticator app / SMS-TOTP is actually wired up — the code is
  always **`340587`** (`DEMO_2FA_CODE` in `server/src/routes/auth.js`, also
  shown directly in the UI). The password-verified-but-not-yet-2FA'd state is
  a short-lived (5 min) JWT that's explicitly rejected by `requireAuth` if
  sent to any protected route — only `POST /api/auth/verify-2fa` accepts it.
- **Referral-view SMS OTP**: viewing a submitted referral's full details
  requires "SMS-verifying" with the patient first. There's no SMS gateway, so
  the real per-referral code is logged server-side and echoed back in the API
  response outside `NODE_ENV=production`; a fixed fallback code **`583920`**
  (`DEMO_OTP`) always works too, for demoing on a deployment where you can't
  tail logs mid-demo.

There's also no mail server, so **`Forgot password`** returns the reset link
on screen (and logs it in the API container) instead of emailing it — swap
the `console.log` in `server/src/routes/auth.js` for a real mailer in
production.

## 6. How to keep adding on

- **New API endpoint**: add a file in `server/src/routes/`, mount it in
  `server/src/server.js`.
- **New DB table/column**: add it to the `SCHEMA` array in
  `server/src/initDb.js` (`CREATE TABLE IF NOT EXISTS` for fresh installs) —
  and add a matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in
  `migrateSchema()` so existing deployments pick it up on next start too.
- **New page**: add a component in `public/js/app.jsx`, add an entry to the
  `NAV` array, and a branch in the router at the bottom of the file. No build
  step — refresh the browser (`public/` is bind-mounted in Docker; `server/`
  changes need `docker compose up -d --build`).
- **New patient fields**: add them to `server/src/patients.json` and the
  schema/migration; `emr.js`'s `SELECT *` picks them up automatically, so
  they just need surfacing in the EMR page or referral wizard.

## 7. Going to real production (the honest gap)

This build is production-shaped but still a demo:
- `GET /api/emr/current-patient` is the **swap point** for a real EMR — replace
  the mock context with the patient handed to the app by a real **SMART-on-FHIR
  launch** / authorised **HL7/FHIR** call. Nothing else in the flow changes.
- Replace the mock 2FA code and referral-view OTP (§5) with a real
  authenticator/SMS integration.
- Replace demo login with **SingPass / hospital SSO**.
- The LDL-override proof document is stored as a `LONGBLOB` directly in the
  `referrals` table (there's no persisted volume for `server/` in the Docker
  setup, only for the database) — fine at this scale, but move to object
  storage (S3-compatible, etc.) before this sees real file volumes.
- Any real patient/genetic data must meet **PDPA** and **MOH data governance**
  (encryption in transit and at rest, Singapore data residency, access logging —
  there's an `audit_log` table started for this).
- Don't run a real clinical system off dummy data or default secrets.
