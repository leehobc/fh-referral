// Auth helpers: JWT issue/verify + bcrypt password hashing.
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const EXPIRES = process.env.JWT_EXPIRES || "12h";

const hashPassword = (pw) => bcrypt.hash(pw, 10);
const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

function signToken(user) {
  return jwt.sign(
    { id: user.id, clinician_id: user.clinician_id, role: user.role },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
