-- Reference schema. The server creates these automatically on first start,
-- so you normally do NOT need to run this by hand. Provided for reference or
-- if you prefer to manage the schema manually (e.g. via phpMyAdmin).

CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_ref VARCHAR(20),
  nric VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  age INT,
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
  INDEX idx_nric (nric),
  INDEX idx_eligible (fh_eligible),
  INDEX idx_clinic (clinic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE,
  patient_nric VARCHAR(20) NOT NULL,
  patient_name VARCHAR(120),
  age INT,
  sex VARCHAR(10),
  nationality VARCHAR(40),
  contact VARCHAR(40),
  ldl DECIMAL(4,1),
  total_chol DECIMAL(4,1) NULL,
  on_statin VARCHAR(5),
  notes TEXT,
  referrer_id INT NULL,
  referrer_label VARCHAR(60),
  clinic VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'Submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ref_referrer (referrer_id),
  INDEX idx_ref_nric (patient_nric),
  CONSTRAINT fk_ref_user FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
