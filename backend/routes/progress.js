import { Router } from "express";
import mongoose from "mongoose";
import HistoryItem from "../models/HistoryItem.js";
import QuizAttempt from "../models/QuizAttempt.js";
import { isDbReady } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  scoreAnswers,
  normalizeTopic,
  percent,
  buildSummary,
  summarizeTopics,
} from "../progressLogic.js";
import { analyzeTopic, buildAdaptiveOverview } from "../adaptiveLogic.js";

const router = Router();

const MAX_ATTEMPTS_PER_USER = 500;
const MAX_ITEMS_FOR_SUMMARY = 500;

// Used by the study plan (server.js) to find a student's weak topics.
// Always filtered by the user's own id.
export async function loadWeakTopics(userId) {
  const attempts = await QuizAttempt.find({ userId })
    .select("topic topicKey level score total createdAt")
    .sort({ createdAt: -1 })
    .limit(MAX_ATTEMPTS_PER_USER)
    .lean();

  const weak = summarizeTopics(attempts)
    .filter((t) => t.weak)
    .slice(0, 5);
  return { hasData: attempts.length > 0, weak };
}

// Used by adaptive quizzes (server.js): the analysis of ONE topic for ONE user (or null if no attempts)
export async function loadAdaptiveForTopic(userId, topic) {
  const topicKey = normalizeTopic(topic);
  if (!topicKey) return null;
  const attempts = await QuizAttempt.find({ userId, topicKey })
    .select("topic topicKey level score total createdAt results")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return analyzeTopic(attempts);
}

// Everything here needs a logged-in user and a working database
router.use(requireAuth);
router.use((req, res, next) => {
  if (!isDbReady()) {
    return res
      .status(503)
      .json({ error: "The database is not connected right now. Please try again shortly." });
  }
  next();
});

function serverError(res, err, what) {
  console.error(`[${new Date().toISOString()}] Progress ${what} error: ${err.message}`);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

// POST /api/progress/quiz-attempts
// Body: { historyId, answers: [0-3, 0-3, ...] }
// The browser sends ONLY which option was chosen. The server loads the saved quiz,
// compares with the trusted correct answers and decides the score itself.
router.post("/quiz-attempts", async (req, res) => {
  try {
    const { historyId, answers } = req.body || {};

    if (typeof historyId !== "string" || !mongoose.isValidObjectId(historyId)) {
      return res.status(400).json({ error: "Invalid quiz id." });
    }
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "Your answers are required." });
    }

    // Only this user's own saved quiz can be used
    const item = await HistoryItem.findOne({
      _id: historyId,
      userId: req.userId,
      feature: "quiz",
    }).lean();
    if (!item) {
      return res.status(404).json({ error: "This quiz was not found in your history." });
    }

    const graded = scoreAnswers(item.result?.questions, answers);
    if (!graded.ok) {
      return res.status(400).json({ error: graded.error });
    }

    const topic = String(item.inputs?.topic || item.title || "Quiz").trim().slice(0, 200);
    const attempt = await QuizAttempt.create({
      userId: req.userId,
      historyId: item._id,
      topic,
      topicKey: normalizeTopic(topic),
      level: item.level || "",
      score: graded.score,
      total: graded.total,
      results: graded.results,
    });

    // Keep only the newest attempts (cleanup problems must not fail the request)
    try {
      const count = await QuizAttempt.countDocuments({ userId: req.userId });
      if (count > MAX_ATTEMPTS_PER_USER) {
        const old = await QuizAttempt.find({ userId: req.userId })
          .sort({ createdAt: -1 })
          .skip(MAX_ATTEMPTS_PER_USER)
          .select("_id")
          .lean();
        await QuizAttempt.deleteMany({ _id: { $in: old.map((o) => o._id) } });
      }
    } catch (cleanupError) {
      console.error(`Attempt cleanup failed: ${cleanupError.message}`);
    }

    res.status(201).json({
      attempt: {
        id: attempt._id,
        score: graded.score,
        total: graded.total,
        percent: percent(graded.score, graded.total),
        createdAt: attempt.createdAt,
      },
    });
  } catch (err) {
    serverError(res, err, "attempt save");
  }
});

// GET /api/progress/summary?tz=-330
// tz is the browser's timezone offset, so "days" match the student's own calendar.
router.get("/summary", async (req, res) => {
  try {
    let tz = Number.parseInt(req.query.tz, 10);
    if (!Number.isInteger(tz) || Math.abs(tz) > 840) tz = 0;

    const [items, attempts] = await Promise.all([
      HistoryItem.find({ userId: req.userId })
        .select("feature level title createdAt inputs.topic inputs.subject")
        .sort({ createdAt: -1 })
        .limit(MAX_ITEMS_FOR_SUMMARY)
        .lean(),
      QuizAttempt.find({ userId: req.userId })
        .select("topic topicKey level score total createdAt")
        .sort({ createdAt: -1 })
        .limit(MAX_ATTEMPTS_PER_USER)
        .lean(),
    ]);

    res.set("Cache-Control", "no-store");
    res.json(buildSummary({ items, attempts, tzOffsetMinutes: tz, now: new Date() }));
  } catch (err) {
    serverError(res, err, "summary");
  }
});

// GET /api/progress/adaptive
// Recommendations built ONLY from the student's own saved quiz attempts.
router.get("/adaptive", async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ userId: req.userId })
      .select("topic topicKey level score total createdAt results")
      .sort({ createdAt: -1 })
      .limit(MAX_ATTEMPTS_PER_USER)
      .lean();

    res.set("Cache-Control", "no-store");
    res.json(buildAdaptiveOverview(attempts));
  } catch (err) {
    serverError(res, err, "adaptive");
  }
});

export default router;
