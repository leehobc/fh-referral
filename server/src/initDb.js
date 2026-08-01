// Creates tables if they do not exist, then seeds patients + a demo
// clinician account the first time the app runs. Safe to run every start.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, query } = require("./db");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     clinician_id VARCHAR(50) NOT NULL UNIQUE,
     name VARCHAR(120) NOT NULL,
     email VARCHAR(190) UNIQUE,
     clinic VARCHAR(120),
     role ENUM('clinician','admin') NOT NULL DEFAULT 'clinician',
     password_hash VARCHAR(255) NOT NULL,
     prefs JSON NULL,
     reset_token VARCHAR(120) NULL,
     reset_expires DATETIME NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS patients (
     id INT AUTO_INCREMENT PRIMARY KEY,
     patient_ref VARCHAR(20),
     nric VARCHAR(20) NOT NULL UNIQUE,
     name VARCHAR(120) NOT NULL,
     dob DATE,
     gender VARCHAR(10),
     ethnicity VARCHAR(30),
     nationality VARCHAR(40),
     contact VARCHAR(40),
     ldl DECIMAL(4,1),
     total_chol DECIMAL(4,1) NULL,
     on_statin TINYINT NULL,
     fh_eligible TINYINT DEFAULT 0,
     family_history_cvd TINYINT DEFAULT 0,
     diabetes TINYINT DEFAULT 0,
     hypertension TINYINT DEFAULT 0,
     smoking_status VARCHAR(20),
     clinic VARCHAR(120),
     doctor VARCHAR(120),
     referral_status VARCHAR(30),
     referral_date DATE NULL,
     appointment_status VARCHAR(30) NULL,
     risk_score INT,
     ldl_test_date DATE NULL,
     INDEX idx_nric (nric),
     INDEX idx_eligible (fh_eligible),
     INDEX idx_clinic (clinic)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS referrals (
     id INT AUTO_INCREMENT PRIMARY KEY,
     reference VARCHAR(20) NOT NULL UNIQUE,
     patient_nric VARCHAR(20) NOT NULL,
     patient_name VARCHAR(120),
     dob DATE,
     sex VARCHAR(10),
     nationality VARCHAR(40),
     contact VARCHAR(40),
     ldl DECIMAL(4,1),
     ldl_test_date DATE NULL,
     ldl_test_location VARCHAR(120) NULL,
     total_chol DECIMAL(4,1) NULL,
     on_statin VARCHAR(5),
     notes TEXT,
     referrer_id INT NULL,
     referrer_label VARCHAR(60),
     clinic VARCHAR(120),
     status VARCHAR(30) NOT NULL DEFAULT 'Submitted',
     view_otp VARCHAR(10) NULL,
     view_otp_expires DATETIME NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_ref_referrer (referrer_id),
     INDEX idx_ref_nric (patient_nric),
     CONSTRAINT fk_ref_user FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS audit_log (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NULL,
     action VARCHAR(60) NOT NULL,
     meta JSON NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_audit_user (user_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function seedPatients() {
  const [{ c }] = await query("SELECT COUNT(*) AS c FROM patients");
  if (c > 0) {
    console.log(`Patients already seeded (${c} rows).`);
    return;
  }
  const file = path.join(__dirname, "patients.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const sql = `INSERT INTO patients
    (patient_ref,nric,name,dob,gender,ethnicity,nationality,contact,ldl,fh_eligible,
     family_history_cvd,diabetes,hypertension,smoking_status,clinic,doctor,
     referral_status,referral_date,appointment_status,risk_score,ldl_test_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const p of data) {
      await conn.execute(sql, [
        p.patient_ref, p.nric, p.name, p.dob || null, p.gender, p.ethnicity, p.nationality,
        p.contact, p.ldl, p.fh_eligible, p.family_history_cvd, p.diabetes, p.hypertension,
        p.smoking_status, p.clinic, p.doctor, p.referral_status, p.referral_date,
        p.appointment_status, p.risk_score, p.ldl_test_date || null,
      ]);
    }
    await conn.commit();
    console.log(`Seeded ${data.length} patients.`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Adds columns introduced after a deployment's first run (CREATE TABLE IF NOT
// EXISTS above only helps fresh databases — existing tables need an ALTER).
async function migrateSchema() {
  await query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS ldl_test_date DATE NULL");
  await query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS ldl_test_date DATE NULL");
  await query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS ldl_test_location VARCHAR(120) NULL");
  await query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE NULL");
  await query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS dob DATE NULL");
  await query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS view_otp VARCHAR(10) NULL");
  await query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS view_otp_expires DATETIME NULL");
}

// Backfills a column for patients seeded before that column existed
// (seedPatients() only inserts once, so already-seeded rows never got it).
// `column` is always a hardcoded literal passed from initDb() below, never
// request input, so interpolating it into the SQL is safe.
async function backfillPatientColumn(column) {
  const file = path.join(__dirname, "patients.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const p of data) {
      if (!p[column]) continue;
      await conn.execute(
        `UPDATE patients SET ${column} = ? WHERE patient_ref = ? AND ${column} IS NULL`,
        [p[column], p.patient_ref]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function seedDemoUser() {
  const [{ c }] = await query("SELECT COUNT(*) AS c FROM users");
  if (c > 0) return;
  const id = process.env.DEMO_CLINICIAN_ID || "DR-10567";
  const pw = process.env.DEMO_PASSWORD || "changeme123";
  const hash = await bcrypt.hash(pw, 10);
  await query(
    `INSERT INTO users (clinician_id,name,email,clinic,role,password_hash)
     VALUES (?,?,?,?,?,?)`,
    [id, "Dr Emmanuel Singh", "demo@fh.local", "Bukit Merah Polyclinic", "admin", hash]
  );
  console.log(`Created demo clinician "${id}" with password "${pw}" — change it after first login.`);
}

async function initDb() {
  for (const stmt of SCHEMA) await query(stmt);
  await migrateSchema();
  await seedPatients();
  await backfillPatientColumn("ldl_test_date");
  await backfillPatientColumn("dob");
  await seedDemoUser();
}

module.exports = { initDb };
