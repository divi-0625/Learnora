import { Router } from "express";
import mongoose from "mongoose";
import HistoryItem from "../models/HistoryItem.js";
import { isDbReady } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const FEATURE_IDS = ["ask", "explain", "summarize", "quiz", "plan"];

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
  console.error(`[${new Date().toISOString()}] History ${what} error: ${err.message}`);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

// GET /api/history?feature=ask  -> the user's newest 50 items (without the long result)
router.get("/", async (req, res) => {
  try {
    const filter = { userId: req.userId }; // only THIS user's data
    const feature = req.query.feature;
    if (typeof feature === "string" && feature !== "") {
      if (!FEATURE_IDS.includes(feature)) {
        return res.status(400).json({ error: "Unknown feature." });
      }
      filter.feature = feature;
    }

    const items = await HistoryItem.find(filter)
      .select("feature level title resultType createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      items: items.map((i) => ({
        id: i._id,
        feature: i.feature,
        level: i.level,
        title: i.title,
        resultType: i.resultType,
        createdAt: i.createdAt,
      })),
    });
  } catch (err) {
    serverError(res, err, "list");
  }
});

// GET /api/history/:id  -> one full item
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item id." });
    }
    const item = await HistoryItem.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!item) {
      return res.status(404).json({ error: "History item not found." });
    }
    res.json({
      item: {
        id: item._id,
        feature: item.feature,
        level: item.level,
        title: item.title,
        inputs: item.inputs,
        resultType: item.resultType,
        result: item.result,
        createdAt: item.createdAt,
      },
    });
  } catch (err) {
    serverError(res, err, "read");
  }
});

// DELETE /api/history/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item id." });
    }
    const outcome = await HistoryItem.deleteOne({ _id: req.params.id, userId: req.userId });
    if (outcome.deletedCount === 0) {
      return res.status(404).json({ error: "History item not found." });
    }
    res.json({ deleted: true });
  } catch (err) {
    serverError(res, err, "delete");
  }
});

export default router;