// Pure helper functions for quiz scoring and progress calculations.
// No database code is here, so these functions are easy to test and explain.

export const WEAK_THRESHOLD = 70; // a topic is "weak" when its average score is below this percent
const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];
const FEATURE_IDS = ["ask", "explain", "summarize", "quiz", "plan"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "Operating   Systems " and "operating systems" count as the same topic
export function normalizeTopic(topic) {
  return String(topic ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function percent(score, total) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function nextLevel(level) {
  const i = LEVEL_ORDER.indexOf(level);
  if (i === -1) return "";
  return LEVEL_ORDER[Math.min(i + 1, LEVEL_ORDER.length - 1)];
}

// ---------- Quiz scoring (the server decides the score) ----------
// questions: the trusted quiz saved in the database
// answers: the option numbers chosen by the student (one per question)
export function scoreAnswers(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: "This quiz has no questions." };
  }
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return { ok: false, error: `Please send exactly ${questions.length} answers.` };
  }

  const results = [];
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i];
    if (!q || !Array.isArray(q.options) || !Number.isInteger(a) || a < 0 || a >= q.options.length) {
      return { ok: false, error: `Answer ${i + 1} is not valid.` };
    }
    const selected = q.options[a];
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) score += 1;
    results.push({
      question: String(q.question ?? ""),
      selected: String(selected ?? ""),
      correctAnswer: String(q.correctAnswer ?? ""),
      isCorrect,
    });
  }
  return { ok: true, score, total: questions.length, results };
}

// ---------- Topic performance ----------
// attempts: [{ topic, topicKey, level, score, total, createdAt }]
// Returns one row per topic, weakest first.
export function summarizeTopics(attempts) {
  const map = new Map();

  for (const a of attempts) {
    const key = a.topicKey || normalizeTopic(a.topic);
    if (!key) continue;
    const pct = percent(a.score, a.total);
    const time = new Date(a.createdAt).getTime();

    let t = map.get(key);
    if (!t) {
      t = { key, topic: a.topic, attempts: 0, sum: 0, best: 0, latest: 0, lastAt: 0, lastLevel: "" };
      map.set(key, t);
    }
    t.attempts += 1;
    t.sum += pct;
    t.best = Math.max(t.best, pct);
    if (time >= t.lastAt) {
      t.lastAt = time;
      t.topic = a.topic; // show the most recent spelling
      t.latest = pct;
      t.lastLevel = a.level || "";
    }
  }

  const rows = [...map.values()].map((t) => {
    const average = Math.round(t.sum / t.attempts);
    return {
      topic: t.topic,
      attempts: t.attempts,
      average,
      best: t.best,
      latest: t.latest,
      lastAt: new Date(t.lastAt).toISOString(),
      lastLevel: t.lastLevel,
      weak: average < WEAK_THRESHOLD,
    };
  });

  rows.sort((x, y) => x.average - y.average || y.lastAt.localeCompare(x.lastAt));
  return rows;
}

// Weak topics used to personalise a study plan (at most 5)
export function weakTopicsFrom(attempts) {
  return summarizeTopics(attempts)
    .filter((t) => t.weak)
    .slice(0, 5);
}

// ---------- Last 7 days ----------
// tzOffsetMinutes is the browser's Date.getTimezoneOffset() (for example -330 for India)
export function buildLast7Days(timestamps, tzOffsetMinutes, now) {
  const shift = (ms) => new Date(ms - tzOffsetMinutes * 60000);
  const counts = new Map();
  for (const ts of timestamps) {
    const key = shift(new Date(ts).getTime()).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = shift(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, label: WEEKDAYS[d.getUTCDay()], count: counts.get(key) || 0 });
  }
  return days;
}

// ---------- Suggested next step (no AI call, only stored data) ----------
function topicOfItem(item) {
  const inputs = item.inputs || {};
  if (item.feature === "quiz" || item.feature === "explain") return String(inputs.topic || "").trim();
  if (item.feature === "plan") return String(inputs.subject || "").trim();
  return "";
}

export function pickSuggestion(topics, items) {
  if (topics.length > 0) {
    const weakest = topics[0]; // sorted weakest first
    if (weakest.weak) {
      return {
        type: "revise",
        topic: weakest.topic,
        level: weakest.lastLevel,
        average: weakest.average,
        message: `Revise "${weakest.topic}". Your quiz average there is ${weakest.average}%.`,
      };
    }
    // Every topic is strong: suggest the one practised longest ago
    const oldest = [...topics].sort((a, b) => a.lastAt.localeCompare(b.lastAt))[0];
    const level = nextLevel(oldest.lastLevel);
    return {
      type: "advance",
      topic: oldest.topic,
      level,
      average: oldest.average,
      message: `Great work! Retake "${oldest.topic}"${level ? ` at ${level} level` : ""} to keep it fresh.`,
    };
  }

  // No quizzes yet: use the most recent topic from the history
  for (const item of items) {
    const topic = topicOfItem(item);
    if (topic) {
      return {
        type: "quiz-first",
        topic,
        level: item.level || "",
        message: `Test yourself: take a quiz on "${topic}".`,
      };
    }
  }

  return {
    type: "start",
    topic: "",
    level: "",
    message: "Take your first quiz to start tracking your progress.",
  };
}

// ---------- The whole dashboard ----------
// items: saved history items (newest first), attempts: quiz attempts (newest first)
export function buildSummary({ items, attempts, tzOffsetMinutes = 0, now = new Date() }) {
  const byFeature = Object.fromEntries(FEATURE_IDS.map((id) => [id, 0]));
  for (const item of items) {
    if (Object.hasOwn(byFeature, item.feature)) byFeature[item.feature] += 1;
  }

  const percents = attempts.map((a) => percent(a.score, a.total));
  const averageScore = percents.length
    ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)
    : null;

  // Oldest to newest, last 10 attempts
  const scoreTrend = [...attempts]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-10)
    .map((a) => ({
      date: new Date(a.createdAt).toISOString(),
      percent: percent(a.score, a.total),
      topic: a.topic,
      score: a.score,
      total: a.total,
    }));

  const timestamps = [...items.map((i) => i.createdAt), ...attempts.map((a) => a.createdAt)];
  const last7Days = buildLast7Days(timestamps, tzOffsetMinutes, now);

  const topics = summarizeTopics(attempts);

  const recent = [
    ...items.map((i) => ({
      kind: "item",
      feature: i.feature,
      title: i.title,
      level: i.level || "",
      at: new Date(i.createdAt).toISOString(),
    })),
    ...attempts.map((a) => ({
      kind: "quiz-attempt",
      feature: "quiz",
      title: a.topic,
      level: a.level || "",
      score: a.score,
      total: a.total,
      at: new Date(a.createdAt).toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return {
    totals: {
      activities: items.length,
      quizzesTaken: attempts.length,
      averageScore,
      activeDays: last7Days.filter((d) => d.count > 0).length,
      topicsPracticed: topics.length,
    },
    byFeature,
    last7Days,
    scoreTrend,
    topics,
    recent,
    suggestion: pickSuggestion(topics, items),
    weakThreshold: WEAK_THRESHOLD,
  };
}