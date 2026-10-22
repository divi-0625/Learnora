// Adaptive learning: uses the student's REAL saved quiz attempts (nothing is invented).
// Pure functions, no database code.

import { normalizeTopic, percent } from "./progressLogic.js";

export const LEVELS = ["beginner", "intermediate", "advanced"];

export function stepLevel(level, direction) {
  const i = LEVELS.indexOf(level);
  const start = i === -1 ? 1 : i; // unknown level counts as intermediate
  const next = Math.min(LEVELS.length - 1, Math.max(0, start + direction));
  return LEVELS[next];
}

const questionKey = (text) => String(text ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const shorten = (text, max = 160) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};

// attempts: [{ topic, topicKey, level, score, total, createdAt, results: [{ question, isCorrect }] }]
// Returns the analysis of ONE topic (attempts of that topic only), or null when there are none.
export function analyzeTopic(topicAttempts) {
  if (!topicAttempts.length) return null;

  const sorted = [...topicAttempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const percents = sorted.map((a) => percent(a.score, a.total));
  const n = sorted.length;
  const latestAttempt = sorted[n - 1];
  const latest = percents[n - 1];
  const previous = n >= 2 ? percents[n - 2] : null;
  const average = Math.round(percents.reduce((s, p) => s + p, 0) / n);
  const currentLevel = latestAttempt.level || "intermediate";
  const topic = latestAttempt.topic;

  // Questions the student got wrong: how often, and in the latest attempt
  const missCounts = new Map();
  for (const attempt of sorted) {
    for (const r of attempt.results || []) {
      if (r && r.isCorrect === false) {
        const key = questionKey(r.question);
        if (!key) continue;
        const entry = missCounts.get(key) || { question: shorten(r.question), count: 0 };
        entry.count += 1;
        missCounts.set(key, entry);
      }
    }
  }
  const repeatedQuestions = [...missCounts.values()]
    .filter((q) => q.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const recentMissed = (latestAttempt.results || [])
    .filter((r) => r && r.isCorrect === false && questionKey(r.question))
    .map((r) => shorten(r.question))
    .slice(0, 3);

  const base = {
    topic,
    topicKey: normalizeTopic(topic),
    attempts: n,
    average,
    latest,
    previous,
    currentLevel,
    recommendedLevel: currentLevel,
    levelChange: "same",
    simplerExplanation: false,
    repeatedQuestions,
    recentMissed,
  };

  // Not enough history: never claim a trend from a single quiz
  if (n < 2) {
    return {
      ...base,
      status: "not_enough_data",
      canPersonalize: false,
      message: `Only 1 quiz on "${topic}" so far (${latest}%). Take at least one more to unlock personalised recommendations.`,
    };
  }

  const bothBelow60 = latest < 60 && previous < 60;
  const bothBelow70 = latest < 70 && previous < 70;
  const bothAtLeast80 = latest >= 80 && previous >= 80;

  if (bothBelow70) {
    const down = bothBelow60;
    return {
      ...base,
      status: "needs_revision",
      canPersonalize: true,
      recommendedLevel: down ? stepLevel(currentLevel, -1) : currentLevel,
      levelChange: down && stepLevel(currentLevel, -1) !== currentLevel ? "down" : "same",
      simplerExplanation: (latest + previous) / 2 < 65,
      message: `Your last two quizzes on "${topic}" were ${previous}% and ${latest}%. ${
        down ? "Let's go back to the basics with a simpler explanation and an easier quiz." : "A focused revision quiz should help."
      }`,
    };
  }
  if (bothAtLeast80) {
    const up = stepLevel(currentLevel, 1);
    return {
      ...base,
      status: "strong",
      canPersonalize: true,
      recommendedLevel: up,
      levelChange: up !== currentLevel ? "up" : "same",
      message:
        up !== currentLevel
          ? `You scored ${previous}% and ${latest}% on "${topic}". Ready for a slightly harder (${up}) quiz.`
          : `You scored ${previous}% and ${latest}% at the highest level on "${topic}". Great mastery! Keep it fresh with occasional revision.`,
    };
  }
  if (latest - previous >= 10) {
    return {
      ...base,
      status: "improving",
      canPersonalize: true,
      message: `Improving on "${topic}": ${previous}% → ${latest}%. Practise a little more at the ${currentLevel} level before moving up.`,
    };
  }
  return {
    ...base,
    status: "steady",
    canPersonalize: true,
    message: `Steady progress on "${topic}" (${previous}% → ${latest}%). Keep practising at the ${currentLevel} level.`,
  };
}

const STATUS_ORDER = { needs_revision: 0, not_enough_data: 1, steady: 2, improving: 3, strong: 4 };

// The whole "Adaptive learning" panel
export function buildAdaptiveOverview(attempts) {
  if (!attempts.length) {
    return {
      hasData: false,
      totalAttempts: 0,
      topics: [],
      message: "No quiz history yet. Take a few quizzes (try at least two on the same topic) and Learnora will start suggesting what to revise.",
    };
  }
  const groups = new Map();
  for (const a of attempts) {
    const key = a.topicKey || normalizeTopic(a.topic);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const topics = [...groups.values()]
    .map(analyzeTopic)
    .filter(Boolean)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.average - b.average);

  const personalised = topics.filter((t) => t.canPersonalize).length;
  return {
    hasData: true,
    totalAttempts: attempts.length,
    topics: topics.slice(0, 8),
    message:
      personalised === 0
        ? "You have started quizzing. Take a second quiz on any topic to unlock personalised recommendations."
        : "",
  };
}

// What the quiz generator should focus on (the student's own missed questions)
export function focusQuestions(analysis) {
  if (!analysis) return [];
  const source = analysis.repeatedQuestions.length
    ? analysis.repeatedQuestions.map((q) => q.question)
    : analysis.recentMissed;
  return source.slice(0, 5);
}
