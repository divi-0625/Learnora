import "dotenv/config"; // loads variables from backend/.env into process.env
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import { connectDB, isDbReady, dbStatus } from "./db.js";
import authRouter from "./routes/auth.js";
import historyRouter from "./routes/history.js";
import progressRouter, { loadWeakTopics, loadAdaptiveForTopic } from "./routes/progress.js";
import createEnglishRouter from "./routes/english.js";
import HistoryItem from "./models/HistoryItem.js";
import { optionalAuth } from "./middleware/auth.js";
import { createAiService } from "./aiService.js";
import { ValidationError, BadResponseError, toUserError } from "./aiErrors.js";
import { focusQuestions } from "./adaptiveLogic.js";
import {
  validateDocumentRequest,
  buildDocumentRequest,
  getDocumentSchema,
  validateDocumentResult,
} from "./documentTools.js";
import {
  VISUAL_SYSTEM_INSTRUCTION,
  getVisualSchema,
  buildVisualPrompt,
  validateDiagram,
} from "./visual.js";

// ---------- 1. Configuration ----------
const PORT = process.env.PORT || 5000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === "your_api_key_here") {
  console.error(
    "ERROR: GEMINI_API_KEY is missing. Copy backend/.env.example to backend/.env and add your key."
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// ONE shared AI service: Gemini first, OpenAI only as a backup (see aiService.js)
const aiService = createAiService({ gemini: ai, model: MODEL });

// ---------- 2. Express setup (middleware) ----------
const app = express();

// CORS: allow the local frontend by default; add the deployed frontend URL in CLIENT_ORIGIN.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

// ---------- 2b. Study-material questions (Summarize). ----------
// This route must come BEFORE the normal 100 KB JSON limit because PDFs are larger.
// Guests may use it. The file is read from the request, sent to the AI and then forgotten:
// it is never written to disk, never saved in the database and never shared.
app.post("/api/document", express.json({ limit: "8mb" }), async (req, res) => {
  try {
    const v = validateDocumentRequest(req.body);
    if (!v.ok) throw new ValidationError(v.error);

    const request = buildDocumentRequest(v, `DOC-${crypto.randomBytes(8).toString("hex")}`);
    const { text } = await aiService.generate({
      ...request,
      generationConfig: { responseMimeType: "application/json", responseSchema: getDocumentSchema(Type) },
    });
    if (!text || text.trim() === "") {
      throw new BadResponseError("The AI returned an empty response. Please try again.");
    }

    const checked = validateDocumentResult(text, v.action);
    if (!checked.ok) throw new BadResponseError(checked.message);

    const { ok, ...result } = checked;
    return res.json({ type: "document", action: v.action, result });
  } catch (err) {
    // Only the error type and a fixed message are logged, never the document
    console.error(`[${new Date().toISOString()}] Document ${err.name}: ${err.message}`);
    const { status, message } = toUserError(err);
    res.status(status).json({ error: message });
  }
});

// Parse JSON request bodies into req.body (everything else)
app.use(express.json({ limit: "100kb" }));

// ---------- 4. Helpers ----------
function getText(value, label, maxLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`Please enter the ${label}.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `The ${label} is too long (maximum ${maxLength} characters).`
    );
  }
  return trimmed;
}

// Like getText, but the value may be missing or empty (returns "" in that case)
function getOptionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new ValidationError(`The ${label} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `The ${label} is too long (maximum ${maxLength} characters).`
    );
  }
  return trimmed;
}

// Gemini sometimes adds markdown symbols. We show plain text, so remove them.
function cleanText(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/`/g, "")
    .trim();
}

const PLAIN_TEXT_RULE =
  "Write in plain text only. Do not use markdown symbols such as **, #, or backticks. " +
  "Write section headings in CAPITAL LETTERS on their own line and start list items with a dash (-).";

// ---------- 4b. Learning level (optional) ----------
const LEVELS = ["beginner", "intermediate", "advanced"];

// Returns null when no level was sent, so the prompts stay exactly as before.
function getLevel(body) {
  const level = body.level;
  if (level === undefined || level === null || level === "") return null;
  if (typeof level !== "string" || !LEVELS.includes(level)) {
    throw new ValidationError(
      "Invalid learning level. Choose beginner, intermediate or advanced."
    );
  }
  return level;
}

// Extra instructions for each feature and level
const LEVEL_NOTES = {
  ask: {
    beginner: "Use simple words, avoid jargon, and include a basic everyday example.",
    intermediate:
      "Assume the student knows the basics. Explain the reasoning clearly and use correct technical terms.",
    advanced:
      "Be concise and technical. Include deeper details, edge cases or trade-offs where relevant.",
  },
  explain: {
    beginner:
      "Explain exactly as described above, for a complete beginner, in very simple language.",
    intermediate:
      "The student already knows the basics. Keep the same sections and friendly tone, but skip very basic definitions, " +
      "go a little deeper, and use correct technical terms (briefly defined). This overrides the 'complete beginner' assumption.",
    advanced:
      "The student is advanced. Keep the same sections and friendly tone, but explain in depth: how it works internally, " +
      "edge cases and trade-offs, using proper technical terms. This overrides the 'complete beginner' assumption.",
  },
  quiz: {
    beginner:
      "Make the questions easy: basic definitions and simple ideas. This overrides the difficulty mix mentioned earlier. " +
      "Still create exactly 5 questions with exactly 4 options each.",
    intermediate:
      "Make a mix of easy and medium questions testing understanding of core ideas. " +
      "Still create exactly 5 questions with exactly 4 options each.",
    advanced:
      "Make the questions challenging: application, analysis and tricky options. This overrides the difficulty mix mentioned earlier. " +
      "Still create exactly 5 questions with exactly 4 options each.",
  },
  plan: {
    beginner:
      "The student is a beginner: start from the fundamentals, move slowly, and give extra time to basics and practice.",
    intermediate:
      "The student knows the basics: focus on core topics, regular practice and revision.",
    advanced:
      "The student already knows the core concepts: focus on advanced topics, problem solving and revising weak areas.",
  },
};

// Adds the level instructions to a prompt (does nothing if no level was sent)
function withLevel(prompt, feature, level) {
  if (!level) return prompt;
  return `${prompt}\n\nStudent's learning level: ${level.toUpperCase()}.\n${LEVEL_NOTES[feature][level]}`;
}

// ---------- 4c. Personalised study plan (weak topics from past quizzes) ----------
// Makes a topic name safe to put inside a prompt: one line, no quotes, short
function oneLine(text, max) {
  const flat = String(text).replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

function weakTopicsText(weakTopics) {
  const lines = weakTopics.map(
    (t) =>
      `- ${oneLine(t.topic, 80)}: average quiz score ${t.average}% over ${t.attempts} attempt${t.attempts === 1 ? "" : "s"}`
  );
  return (
    "The student's weak topics from their own practice quizzes (weakest first):\n" +
    lines.join("\n") +
    "\nIn the plan, give these topics extra time, practice and revision, and add a short section named WEAK TOPICS FOCUS. " +
    "Use only the topics and scores listed here, never invent other results, and do not exceed the available study time."
  );
}

// Decides whether this plan request can be personalised.
// Returns { info, weakTopics }. It never throws: a problem just means "not personalised".
async function preparePersonalization(userId) {
  if (!userId) {
    return {
      info: { used: false, note: "Log in to personalize your plan with your quiz results." },
      weakTopics: [],
    };
  }
  if (!isDbReady()) {
    return {
      info: { used: false, note: "Personalization is unavailable because the database is offline." },
      weakTopics: [],
    };
  }
  try {
    const { hasData, weak } = await loadWeakTopics(userId);
    if (weak.length > 0) {
      return { info: { used: true, topics: weak.map((t) => t.topic) }, weakTopics: weak };
    }
    return {
      info: {
        used: false,
        note: hasData
          ? "No weak topics found: all your quiz averages are 70% or higher."
          : "No quiz results yet. Take a quiz first, then personalize your plan.",
      },
      weakTopics: [],
    };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Personalization error: ${err.message}`);
    return {
      info: { used: false, note: "Could not read your quiz results, so the plan is not personalized." },
      weakTopics: [],
    };
  }
}

// ---------- 4d. Adaptive quiz (uses the student's own saved quiz attempts) ----------
function adaptiveQuizText(adaptive) {
  let text = "This quiz is personalised from the student's own quiz history.";
  if (adaptive.focus.length > 0) {
    text +=
      "\nThe student previously answered these questions incorrectly:\n" +
      adaptive.focus.map((q) => `- ${oneLine(q, 160)}`).join("\n") +
      "\nCreate 5 NEW questions (do not repeat these) that test the underlying concepts.";
  }
  text += `\nWrite the questions at ${adaptive.level} level. Start with a slightly easier question and finish with the hardest.`;
  return text;
}

// Never throws: a problem just means "a normal quiz". Nothing is invented when there is no history.
async function prepareAdaptive(userId, topic, body) {
  if (!userId) {
    return { info: { used: false, note: "Log in to use adaptive practice." } };
  }
  if (!isDbReady()) {
    return { info: { used: false, note: "Adaptive practice is unavailable because the database is offline." } };
  }
  try {
    const analysis = await loadAdaptiveForTopic(userId, topic);
    if (!analysis) {
      return {
        info: {
          used: false,
          note: "No quiz history on this topic yet, so this is a regular quiz. Take a quiz first, then try adaptive practice.",
        },
      };
    }
    const focus = focusQuestions(analysis);
    // With a single quiz the level is NOT changed (one result is not a trend)
    const level = analysis.canPersonalize ? analysis.recommendedLevel : getLevel(body) || analysis.currentLevel;
    const info = {
      used: true,
      level,
      levelChange: analysis.canPersonalize ? analysis.levelChange : "same",
      status: analysis.status,
      attempts: analysis.attempts,
      focusCount: focus.length,
      basis: analysis.repeatedQuestions.length ? "repeated" : focus.length ? "recent" : "none",
    };
    if (!analysis.canPersonalize) {
      info.note = "Based on your only quiz on this topic so far. Take another to unlock level changes.";
    }
    return { info, levelOverride: level, extras: { focus, level } };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Adaptive error: ${err.message}`);
    return { info: { used: false, note: "Could not read your quiz history, so this is a regular quiz." } };
  }
}

// ---------- 5. The five features: each has its OWN instructions and prompt ----------
// inputFields: which request fields are saved in the learning history.
// buildPrompt(body, extras): extras holds optional data found by the server.
const FEATURES = {
  // Feature 1: ASK QUESTION
  ask: {
    inputFields: ["question"],
    systemInstruction:
      "You are a knowledgeable, patient academic tutor. Answer the student's question accurately and clearly. " +
      "Start with a direct answer, then explain the concept step by step. Use a short example when it helps. " +
      "Avoid unnecessary complexity. If you are not sure about something, say so honestly. " +
      PLAIN_TEXT_RULE,
    buildPrompt(body) {
      const question = getText(body.question, "question", 2000);
      const level = getLevel(body);
      return withLevel(
        `Student's question:\n"""\n${question}\n"""\n\nAnswer this question for a student.`,
        "ask",
        level
      );
    },
  },

  // Feature 2: EXPLAIN SIMPLY
  explain: {
    inputFields: ["topic"],
    systemInstruction:
      "You are a friendly teacher explaining ideas to a complete beginner with no background knowledge. " +
      "Use very simple everyday language and avoid jargon (define any technical word you must use). " +
      "Use a real-life analogy and include one concrete example. " +
      "Organize the answer into these sections: WHAT IS IT, SIMPLE EXPLANATION, EXAMPLE, REMEMBER THIS. " +
      PLAIN_TEXT_RULE,
    buildPrompt(body) {
      const topic = getText(body.topic, "topic", 200);
      const level = getLevel(body);
      return withLevel(
        `Topic to explain:\n"""\n${topic}\n"""\n\nExplain this topic simply, as if teaching a beginner.`,
        "explain",
        level
      );
    },
  },

  // Feature 3: SUMMARIZE (the level does not apply: it only uses the pasted text)
  summarize: {
    inputFields: ["text"],
    systemInstruction:
      "You are a study-notes summarizer. Use ONLY the text provided by the student. " +
      "Do not add outside facts or opinions. Produce exactly two sections: " +
      "SUMMARY (a concise paragraph of 3 to 5 sentences) and KEY POINTS (5 to 8 short bullet points). " +
      PLAIN_TEXT_RULE,
    buildPrompt(body) {
      const text = getText(body.text, "text to summarize", 15000);
      return `Study material to summarize:\n"""\n${text}\n"""\n\nSummarize only this material.`;
    },
  },

  // Feature 4: QUIZ (structured JSON output, optional adaptive practice)
  quiz: {
    inputFields: ["topic"],
    systemInstruction:
      "You are an exam question writer. Create exactly 5 multiple-choice questions on the given topic. " +
      "Each question must have exactly 4 options and exactly one correct answer. " +
      "The 'correctAnswer' value must be copied exactly (word for word) from one of the 4 options. " +
      "Give a short 1 to 2 sentence explanation for each answer. Keep every question relevant to the topic, " +
      "and mix easy and medium difficulty.",
    buildPrompt(body, extras = {}) {
      const topic = getText(body.topic, "quiz topic", 200);
      const level = getLevel(body);
      let prompt = `Quiz topic:\n"""\n${topic}\n"""\n\nCreate the 5-question multiple-choice quiz.`;
      if (extras.adaptive) {
        prompt += `\n\n${adaptiveQuizText(extras.adaptive)}`;
      }
      return withLevel(prompt, "quiz", level);
    },
    // Ask Gemini to answer in JSON that matches this schema
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["question", "options", "correctAnswer", "explanation"],
            },
          },
        },
        required: ["questions"],
      },
    },
  },

  // Feature 5: STUDY PLAN (optional learning goal and weak-topic personalisation)
  plan: {
    inputFields: ["subject", "studyTime", "goal"],
    systemInstruction:
      "You are an experienced study coach. Create a realistic, practical study plan using BOTH the subject " +
      "and the study time the student provides. Never schedule more than the time available. " +
      "Include these sections: OVERVIEW, TOPICS AND TIME ALLOCATION, DAILY SCHEDULE, PRACTICE, REVISION, TIPS. " +
      "Include short breaks and avoid unrealistic workloads. If the student gives a learning goal, build the plan around it. " +
      PLAIN_TEXT_RULE,
    buildPrompt(body, extras = {}) {
      const subject = getText(body.subject, "subject or topic", 200);
      const studyTime = getText(body.studyTime, "available study time", 100);
      const goal = getOptionalText(body.goal, "learning goal", 200);
      const level = getLevel(body);

      let prompt =
        `Subject/topic:\n"""\n${subject}\n"""\n\n` +
        `Available study time:\n"""\n${studyTime}\n"""\n\n`;
      if (goal) {
        prompt += `Student's learning goal:\n"""\n${goal}\n"""\n\n`;
      }
      if (extras.weakTopics && extras.weakTopics.length > 0) {
        prompt += `${weakTopicsText(extras.weakTopics)}\n\n`;
      }
      prompt += "Create the study plan.";

      return withLevel(prompt, "plan", level);
    },
  },
};

// ---------- 6. Check the quiz JSON that the AI returned ----------
function parseQuiz(text) {
  let data;
  try {
    data = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new BadResponseError(
      "The AI returned the quiz in an unreadable format. Please try again."
    );
  }

  const questions = data?.questions;
  const isValid =
    Array.isArray(questions) &&
    questions.length === 5 &&
    questions.every(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o) => typeof o === "string") &&
        typeof q.correctAnswer === "string" &&
        q.options.includes(q.correctAnswer) &&
        typeof q.explanation === "string"
    );

  if (!isValid) {
    throw new BadResponseError("The AI returned an incomplete quiz. Please try again.");
  }
  return { questions };
}

// ---------- 7b. Saving results to the learning history (logged-in users only) ----------
const MAX_HISTORY_PER_USER = 200;

// A short label for the history list
function makeTitle(feature, inputs) {
  let title;
  if (feature === "ask") title = inputs.question;
  else if (feature === "summarize") title = inputs.text;
  else if (feature === "plan") title = `${inputs.subject} (${inputs.studyTime})`;
  else title = inputs.topic;
  title = title.replace(/\s+/g, " ").trim();
  return title.length > 100 ? title.slice(0, 97) + "..." : title;
}

// Saving must NEVER break the answer. If it fails, we just report saved: false.
async function saveToHistory({ userId, feature, config, body, resultType, result, weakTopicNames }) {
  if (!isDbReady()) {
    return { saved: false, saveNote: "Not saved: the database is offline." };
  }
  try {
    const inputs = {};
    for (const name of config.inputFields) {
      // optional fields (such as the learning goal) are saved only when they were filled in
      if (typeof body[name] === "string" && body[name].trim() !== "") {
        inputs[name] = body[name].trim();
      }
    }
    if (weakTopicNames && weakTopicNames.length > 0) {
      inputs.weakTopics = weakTopicNames.join(", ");
    }
    const level = Object.hasOwn(LEVEL_NOTES, feature) ? getLevel(body) || "" : "";

    const item = await HistoryItem.create({
      userId,
      feature,
      level,
      title: makeTitle(feature, inputs),
      inputs,
      resultType,
      result,
    });

    // Keep only the newest items for this user
    const count = await HistoryItem.countDocuments({ userId });
    if (count > MAX_HISTORY_PER_USER) {
      const old = await HistoryItem.find({ userId })
        .sort({ createdAt: -1 })
        .skip(MAX_HISTORY_PER_USER)
        .select("_id")
        .lean();
      await HistoryItem.deleteMany({ _id: { $in: old.map((o) => o._id) } });
    }

    return { saved: true, historyId: item._id };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] History save failed: ${err.message}`);
    return { saved: false, saveNote: "Could not save this result to your history." };
  }
}

// ---------- 8. Routes ----------
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: dbStatus(),
    backupAi: process.env.OPENAI_API_KEY ? "configured" : "not configured",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/history", historyRouter);
app.use("/api/progress", progressRouter);
app.use("/api/english", createEnglishRouter(aiService, Type)); // logged-in students only (checked inside)

app.post("/api/generate", optionalAuth, async (req, res) => {
  try {
    const feature = req.body?.feature;

    // Identify the selected feature
    if (typeof feature !== "string" || !Object.hasOwn(FEATURES, feature)) {
      throw new ValidationError("Unknown feature selected.");
    }
    const config = FEATURES[feature];
    let body = req.body;

    // Study plan only: personalise with the student's weak topics (logged-in users, opt-in)
    let personalization = null;
    if (feature === "plan" && req.body.useWeakTopics === true) {
      personalization = await preparePersonalization(req.userId);
    }

    // Quiz only: adaptive practice from the student's own quiz history (logged-in users, opt-in)
    let adaptive = null;
    if (feature === "quiz" && req.body.adaptive === true) {
      adaptive = await prepareAdaptive(req.userId, typeof req.body.topic === "string" ? req.body.topic : "", req.body);
      if (adaptive.levelOverride) body = { ...req.body, level: adaptive.levelOverride };
    }

    // Validate input + build the prompt for THIS feature
    const prompt = config.buildPrompt(body, {
      weakTopics: personalization ? personalization.weakTopics : [],
      adaptive: adaptive ? adaptive.extras : undefined,
    });

    // Ask the AI (Gemini first, OpenAI only as a backup)
    const { text } = await aiService.generate({
      contents: prompt,
      systemInstruction: config.systemInstruction,
      generationConfig: config.generationConfig,
    });
    if (!text || text.trim() === "") {
      throw new BadResponseError("The AI returned an empty response. Please try again.");
    }

    // Quiz -> validated JSON object, everything else -> cleaned text
    const resultType = feature === "quiz" ? "quiz" : "text";
    const result = feature === "quiz" ? parseQuiz(text) : cleanText(text);
    const payload = { feature, type: resultType, result };

    if (personalization) {
      payload.personalization = personalization.info;
    }
    if (adaptive) {
      payload.adaptive = adaptive.info;
    }

    // Logged-in students: also save the result to their learning history
    if (req.userId) {
      Object.assign(
        payload,
        await saveToHistory({
          userId: req.userId,
          feature,
          config,
          body,
          resultType,
          result,
          weakTopicNames: personalization && personalization.info.used ? personalization.info.topics : [],
        })
      );
    } else if (req.tokenProblem) {
      // A login token was sent but it is invalid or expired
      Object.assign(payload, {
        saved: false,
        sessionExpired: true,
        saveNote: "Your login expired, so this was not saved. Please log in again.",
      });
    }

    return res.json(payload);
  } catch (err) {
    // Log details on the server only; never send them to the browser
    console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`);
    const { status, message } = toUserError(err);
    res.status(status).json({ error: message });
  }
});

// Visual learning: turns an explanation into a flowchart or concept map (structured data).
// Works for guests too. Diagrams are NOT saved to the history.
app.post("/api/visual", async (req, res) => {
  try {
    const context = getText(req.body?.context, "explanation text", 8000);
    const topic = getOptionalText(req.body?.topic, "topic", 300);

    const { text } = await aiService.generate({
      contents: buildVisualPrompt({ context, topic }),
      systemInstruction: VISUAL_SYSTEM_INSTRUCTION,
      generationConfig: { responseMimeType: "application/json", responseSchema: getVisualSchema(Type) },
    });
    if (!text || text.trim() === "") {
      throw new BadResponseError("The AI returned an empty response. Please try again.");
    }

    // Check the diagram carefully before the browser draws it
    const checked = validateDiagram(text);
    if (!checked.ok) {
      throw new BadResponseError(checked.message);
    }
    if (!checked.suitable) {
      return res.json({ type: "visual", suitable: false, reason: checked.reason });
    }
    return res.json({ type: "visual", suitable: true, diagram: checked.diagram });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ${err.name}: ${err.message}`);
    const { status, message } = toUserError(err);
    res.status(status).json({ error: message });
  }
});

// ---------- 9. Catch bad JSON / oversized bodies ----------
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request format." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Your input is too large." });
  }
  res.status(500).json({ error: "Server error. Please try again." });
});

connectDB(); // connects to MongoDB in the background (never blocks the app)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT} (model: ${MODEL})`);
});
