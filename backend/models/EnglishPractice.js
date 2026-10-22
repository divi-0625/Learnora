import mongoose from "mongoose";

// One saved English practice response with its AI feedback. Always tied to ONE user.
const practiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true }, // groups the responses of one practice session
    mode: { type: String, required: true, enum: ["everyday", "interview", "group", "topic"] },
    topic: { type: String, default: "", maxlength: 200 },
    prompt: { type: String, default: "", maxlength: 700 }, // the coach question the student answered
    response: { type: String, required: true, maxlength: 2100 },
    feedback: { type: mongoose.Schema.Types.Mixed, required: true },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, required: true, min: 0, max: 100 }, // AI-generated practice score
  },
  { timestamps: true }
);

practiceSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("EnglishPractice", practiceSchema);
