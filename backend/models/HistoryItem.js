import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    feature: {
      type: String,
      required: true,
      enum: ["ask", "explain", "summarize", "quiz", "plan"],
    },
    level: { type: String, default: "" }, // "" when the feature has no level
    title: { type: String, required: true, maxlength: 120 }, // short label for the list
    inputs: { type: mongoose.Schema.Types.Mixed, default: {} }, // what the student entered
    resultType: { type: String, required: true, enum: ["text", "quiz"] },
    result: { type: mongoose.Schema.Types.Mixed, required: true }, // text, or the quiz JSON
  },
  { timestamps: true }
);

// Makes "newest items of one user" fast
historySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("HistoryItem", historySchema);