import { Router } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import EnglishPractice from "../models/EnglishPractice.js";
import { isDbReady } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ValidationError, BadResponseError, toUserError } from "../aiErrors.js";
import * as E from "../english.js";

const MAX_PRACTICES_PER_USER = 300;

// aiService and Type are passed in from server.js so every feature shares the same AI code
export default function createEnglishRouter(aiService, Type) {
  const router = Router();

  // EVERY route below needs a valid login token. A guest gets 401, even with a hand-typed URL.
  router.use(requireAuth);

  function fail(res, err, what) {
    console.error(`[${new Date().toISOString()}] English ${what} error: ${err.name}: ${err.message}`);
    const { status, message } = toUserError(err);
    res.status(status).json({ error: message });
  }

  function needDb(req, res, next) {
    if (!isDbReady()) {
      return res.status(503).json({ error: "The database is not connected right now. Please try again shortly." });
    }
    next();
  }

  // Saving never breaks the feedback: if the database fails we just say "not saved"
  async function savePractice({ userId, v, feedback, stats }) {
    if (!isDbReady()) return { saved: false, saveNote: "Not saved: the database is offline." };
    try {
      const doc = await EnglishPractice.create({
        userId,
        sessionId: v.sessionId,
        mode: v.mode,
        topic: v.topic,
        prompt: v.prompt,
        response: v.response,
        feedback,
        stats,
        score: feedback.score,
      });
      const count = await EnglishPractice.countDocuments({ userId });
      if (count > MAX_PRACTICES_PER_USER) {
        const old = await EnglishPractice.find({ userId }).sort({ createdAt: -1 }).skip(MAX_PRACTICES_PER_USER).select("_id").lean();
        await EnglishPractice.deleteMany({ _id: { $in: old.map((o) => o._id) } });
      }
      return { saved: true, practiceId: doc._id };
    } catch (err) {
      console.error(`[${new Date().toISOString()}] English save failed: ${err.message}`);
      return { saved: false, saveNote: "Could not save this practice result." };
    }
  }

  // POST /api/english/start  -> the coach's opening message (or a speaking topic)
  router.post("/start", async (req, res) => {
    try {
      const v = E.validateStart(req.body);
      if (!v.ok) throw new ValidationError(v.error);

      const { text } = await aiService.generate({
        systemInstruction: E.COACH_SYSTEM,
        contents: E.buildStartPrompt(v),
        generationConfig: { responseMimeType: "application/json", responseSchema: E.getStartSchema(Type) },
      });
      const checked = E.validateStartResult(text);
      if (!checked.ok) throw new BadResponseError(checked.message);

      res.json({
        sessionId: crypto.randomBytes(12).toString("hex"),
        mode: v.mode,
        topic: v.topic,
        durationSeconds: v.durationSeconds,
        message: checked.message,
        hints: checked.hints,
      });
    } catch (err) {
      fail(res, err, "start");
    }
  });

  // POST /api/english/respond  -> feedback + practice score (+ the coach's next message)
  router.post("/respond", async (req, res) => {
    try {
      const v = E.validateRespond(req.body);
      if (!v.ok) throw new ValidationError(v.error);

      const { text } = await aiService.generate({
        systemInstruction: E.COACH_SYSTEM,
        contents: E.buildRespondPrompt(v),
        generationConfig: { responseMimeType: "application/json", responseSchema: E.getRespondSchema(Type) },
      });
      const checked = E.validateRespondResult(text, v.mode);
      if (!checked.ok) throw new BadResponseError(checked.message);

      const stats = E.computeStats(v.response, { elapsedSeconds: v.elapsedSeconds });
      const payload = {
        nextMessage: checked.nextMessage,
        feedback: checked.feedback,
        stats,
        scoreLabel: "AI-generated practice score",
      };
      Object.assign(payload, await savePractice({ userId: req.userId, v, feedback: checked.feedback, stats }));
      res.json(payload);
    } catch (err) {
      fail(res, err, "respond");
    }
  });

  // GET /api/english/history  -> this user's newest practice results
  router.get("/history", needDb, async (req, res) => {
    try {
      const items = await EnglishPractice.find({ userId: req.userId })
        .select("mode topic score prompt response createdAt")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
      res.json({
        items: items.map((i) => ({
          id: i._id,
          mode: i.mode,
          topic: i.topic,
          score: i.score,
          prompt: i.prompt,
          snippet: String(i.response || "").slice(0, 100),
          createdAt: i.createdAt,
        })),
      });
    } catch (err) {
      fail(res, err, "history list");
    }
  });

  // GET /api/english/history/:id  -> one full result (only if it belongs to this user)
  router.get("/history/:id", needDb, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid item id." });
      const item = await EnglishPractice.findOne({ _id: req.params.id, userId: req.userId }).lean();
      if (!item) return res.status(404).json({ error: "Practice result not found." });
      res.json({
        item: {
          id: item._id,
          mode: item.mode,
          topic: item.topic,
          prompt: item.prompt,
          response: item.response,
          feedback: item.feedback,
          stats: item.stats,
          score: item.score,
          createdAt: item.createdAt,
        },
      });
    } catch (err) {
      fail(res, err, "history read");
    }
  });

  // DELETE /api/english/history/:id
  router.delete("/history/:id", needDb, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid item id." });
      const outcome = await EnglishPractice.deleteOne({ _id: req.params.id, userId: req.userId });
      if (outcome.deletedCount === 0) return res.status(404).json({ error: "Practice result not found." });
      res.json({ deleted: true });
    } catch (err) {
      fail(res, err, "history delete");
    }
  });

  return router;
}
