// Clinician-facing "Ask the AI assistant" helper (Gemini-powered), used on
// the referral wizard's Q&A step. No patient data ever passes through here.
const express = require("express");
const { requireAuth } = require("../middleware");
const { askGemini } = require("../gemini");

const router = express.Router();
router.use(requireAuth);

const MAX_MESSAGE_LEN = 600;
const MAX_HISTORY_TURNS = 6; // exchanges (user+model pairs) kept for context

// Simple in-memory rate limit: N requests per clinician per rolling minute.
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const hits = new Map(); // userId -> [timestamps]

function isRateLimited(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

// POST /api/chat/ask
router.post("/ask", async (req, res) => {
  const { message, history } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LEN} characters).` });
  }
  if (isRateLimited(req.user.id)) {
    return res.status(429).json({ error: "Too many questions in a short time — please wait a moment." });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
        .slice(-MAX_HISTORY_TURNS * 2)
    : [];

  try {
    const answer = await askGemini(message.trim(), safeHistory);
    res.json({ answer });
  } catch (e) {
    console.error("Gemini chat error:", e);
    res.status(502).json({ error: "The AI assistant is unavailable right now. Please try again shortly." });
  }
});

module.exports = router;
