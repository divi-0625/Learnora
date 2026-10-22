import mongoose from "mongoose";

// One row per question: what the student chose and whether it was right
const resultSchema = new mongoose.Schema(
  {
    question: { type: String, default: "" },
    selected: { type: String, default: "" },
    correctAnswer: { type: String, default: "" },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // The saved quiz this attempt belongs to. Attempts are kept even if that history item is deleted.
    historyId: { type: mongoose.Schema.Types.ObjectId, ref: "HistoryItem", required: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    topicKey: { type: String, required: true, maxlength: 200 }, // lowercase topic used for grouping
    level: { type: String, default: "" },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    results: { type: [resultSchema], default: [] },
  },
  { timestamps: true }
);

attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ userId: 1, topicKey: 1 });

export default mongoose.model("QuizAttempt", attemptSchema);