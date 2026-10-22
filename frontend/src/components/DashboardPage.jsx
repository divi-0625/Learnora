import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api.js";

const DEFAULT_STUDY_TIME = "1 hour per day for 5 days";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function capitalize(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

// ---------- Small pieces ----------
function StatCard({ icon, value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

// The "what should I do next" card (calculated from saved data, no AI call)
function SuggestionCard({ suggestion, onQuiz, onPlan }) {
  const { type, topic, level, message } = suggestion;

  return (
    <section className="dash-suggest">
      <span className="suggest-icon">💡</span>
      <div className="suggest-body">
        <p className="suggest-title">Suggested next step</p>
        <p className="suggest-text">{message}</p>

        <div className="suggest-actions">
          {type === "revise" && (
            <>
              <button
                type="button"
                className="btn primary small"
                onClick={() => onPlan(topic, level, true)}
              >
                📅 Create revision plan
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => onQuiz(topic, level)}
              >
                🎯 Quiz me again
              </button>
            </>
          )}
          {type === "advance" && (
            <button
              type="button"
              className="btn primary small"
              onClick={() => onQuiz(topic, level)}
            >
              🎯 Quiz me again
            </button>
          )}
          {type === "quiz-first" && (
            <button
              type="button"
              className="btn primary small"
              onClick={() => onQuiz(topic, level)}
            >
              🎯 Take a quiz on this topic
            </button>
          )}
          {type === "start" && (
            <button type="button" className="btn primary small" onClick={() => onQuiz("", "")}>
              🎯 Take your first quiz
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Bars: activity in the last 7 days (the last bar is today)
function ActivityChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="bars" role="img" aria-label="Learning activity for each of the last 7 days">
      {days.map((d, i) => (
        <div
          className={i === days.length - 1 ? "bar-col today" : "bar-col"}
          key={d.date}
          title={`${d.date}: ${d.count} activit${d.count === 1 ? "y" : "ies"}`}
        >
          <span className="bar-count">{d.count > 0 ? d.count : ""}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ height: d.count > 0 ? `${Math.max(8, (d.count / max) * 100)}%` : "0%" }}
            />
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Line chart (SVG): the score of the last attempts, oldest to newest
function TrendChart({ points }) {
  const W = 320;
  const H = 160;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const x = (i) => (points.length === 1 ? padL + innerW / 2 : padL + (innerW * i) / (points.length - 1));
  const y = (percent) => padT + innerH * (1 - percent / 100);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.percent).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      className="trend"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Line chart of your recent quiz scores"
    >
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line className="trend-grid" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
          <text className="trend-axis" x={padL - 6} y={y(v) + 3} textAnchor="end">
            {v}%
          </text>
        </g>
      ))}

      {/* The 70% line: below it a topic counts as weak */}
      <line className="trend-threshold" x1={padL} x2={W - padR} y1={y(70)} y2={y(70)} />

      {points.length > 1 && <path className="trend-line" d={path} fill="none" />}

      {points.map((p, i) => (
        <circle
          key={i}
          className={p.percent < 70 ? "trend-dot weak" : "trend-dot"}
          cx={x(i)}
          cy={y(p.percent)}
          r="4.5"
        >
          <title>{`${p.topic}: ${p.score}/${p.total} (${p.percent}%) on ${formatShortDate(p.date)}`}</title>
        </circle>
      ))}

      {points.length === 1 ? (
        <text className="trend-axis" x={W / 2} y={H - 6} textAnchor="middle">
          {formatShortDate(points[0].date)}
        </text>
      ) : (
        <>
          <text className="trend-axis" x={padL} y={H - 6}>
            {formatShortDate(points[0].date)}
          </text>
          <text className="trend-axis" x={W - padR} y={H - 6} textAnchor="end">
            {formatShortDate(points[points.length - 1].date)}
          </text>
        </>
      )}
    </svg>
  );
}

// How many saved items each feature has
function FeatureBreakdown({ byFeature, features }) {
  const max = Math.max(1, ...features.map((f) => byFeature[f.id] || 0));

  return (
    <div className="feat-list">
      {features.map((f) => {
        const count = byFeature[f.id] || 0;
        return (
          <div className={`feat-row theme-${f.id}`} key={f.id}>
            <span className="feat-name">
              {f.icon} {f.title}
            </span>
            <div className="feat-track">
              <div className="feat-fill" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="feat-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// Quiz performance per topic, weakest first
function TopicList({ topics, onQuiz, onPlan }) {
  return (
    <div className="topic-list">
      {topics.map((t) => (
        <div className={t.weak ? "topic-row weak" : "topic-row"} key={t.topic}>
          <div className="topic-top">
            <span className="topic-name">{t.topic}</span>
            <span className={t.weak ? "pill bad" : "pill ok"}>
              {t.average}% average{t.weak ? " · needs revision" : ""}
            </span>
          </div>

          <div className="topic-track">
            <div className="topic-fill" style={{ width: `${t.average}%` }} />
          </div>

          <p className="topic-meta">
            {t.attempts} attempt{t.attempts === 1 ? "" : "s"} · best {t.best}% · latest {t.latest}%
          </p>

          <div className="topic-actions">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => onQuiz(t.topic, t.lastLevel)}
            >
              🎯 Quiz again
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => onPlan(t.topic, t.lastLevel, t.weak)}
            >
              📅 Revision plan
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentList({ recent, features }) {
  return (
    <ul className="recent-list">
      {recent.map((r, i) => {
        const info = features.find((f) => f.id === r.feature) || { icon: "📄", title: r.feature };
        const isAttempt = r.kind === "quiz-attempt";
        const percent = isAttempt && r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;

        return (
          <li className={`recent-row theme-${r.feature}`} key={i}>
            <span className="recent-icon">{info.icon}</span>
            <div className="recent-main">
              <p className="recent-title">{isAttempt ? `Quiz attempt: ${r.title}` : r.title}</p>
              <p className="recent-meta">
                {info.title}
                {r.level ? ` · ${capitalize(r.level)}` : ""} · {formatDate(r.at)}
              </p>
            </div>
            {isAttempt && (
              <span className={percent < 70 ? "pill bad" : "pill ok"}>
                {r.score}/{r.total}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- The dashboard content (data is already loaded) ----------
function DashboardView({ data, features, onPrefill, onGoHome, onGoHistory }) {
  const { totals, suggestion } = data;
  const isEmpty = totals.activities === 0 && totals.quizzesTaken === 0;

  // Opens the Quiz form with the topic and level filled in (nothing is submitted)
  function quizAgain(topic, level) {
    onPrefill({
      featureId: "quiz",
      values: topic ? { topic } : {},
      level: level || undefined,
    });
  }

  // Opens the Study Plan form with the subject, time and goal filled in (nothing is submitted)
  function revisionPlan(topic, level, weak) {
    onPrefill({
      featureId: "plan",
      values: {
        subject: topic,
        studyTime: DEFAULT_STUDY_TIME,
        goal: `Improve my quiz score in ${topic}`.slice(0, 200),
      },
      level: level || undefined,
      useWeakTopics: Boolean(weak),
    });
  }

  if (isEmpty) {
    return (
      <div className="card history-empty">
        <span className="big">📭</span>
        <p>
          No learning data yet. Use any feature while logged in, take a quiz, and your progress
          will appear here.
        </p>
        <button type="button" className="btn primary" onClick={onGoHome}>
          Start learning
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="dash-stats">
        <StatCard icon="🗂️" value={totals.activities} label="Saved activities" />
        <StatCard icon="🎯" value={totals.quizzesTaken} label="Quizzes taken" />
        <StatCard
          icon="⭐"
          value={totals.averageScore === null ? "–" : `${totals.averageScore}%`}
          label="Average quiz score"
        />
        <StatCard icon="🔥" value={`${totals.activeDays}/7`} label="Active days this week" />
      </div>

      <SuggestionCard suggestion={suggestion} onQuiz={quizAgain} onPlan={revisionPlan} />

      <section className="dash-card dash-full">
        <h3>Topic performance</h3>
        <p className="dash-sub">
          Weakest topics first. A topic needs revision when its average quiz score is below{" "}
          {data.weakThreshold}%.
        </p>
        {data.topics.length === 0 ? (
          <p className="dash-empty">Take a quiz to see how you are doing in each topic.</p>
        ) : (
          <TopicList topics={data.topics} onQuiz={quizAgain} onPlan={revisionPlan} />
        )}
      </section>

      <div className="dash-grid">
        <section className="dash-card">
          <h3>Activity this week</h3>
          <p className="dash-sub">Each saved item or quiz attempt counts as one activity.</p>
          <ActivityChart days={data.last7Days} />
        </section>

        <section className="dash-card">
          <h3>Quiz score trend</h3>
          <p className="dash-sub">
            Your last {Math.min(data.scoreTrend.length, 10) || 10} quiz attempts. The dashed line is{" "}
            {data.weakThreshold}%.
          </p>
          {data.scoreTrend.length === 0 ? (
            <p className="dash-empty">Take a quiz to see your score trend.</p>
          ) : (
            <>
              <TrendChart points={data.scoreTrend} />
              {data.scoreTrend.length === 1 && (
                <p className="dash-sub">Take more quizzes to see a trend.</p>
              )}
            </>
          )}
        </section>
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <h3>Saved items by feature</h3>
          <p className="dash-sub">What you have saved in your history.</p>
          <FeatureBreakdown byFeature={data.byFeature} features={features} />
        </section>

        <section className="dash-card">
          <h3>Recent activity</h3>
          <p className="dash-sub">Your latest saved items and quiz attempts.</p>
          {data.recent.length === 0 ? (
            <p className="dash-empty">Nothing yet.</p>
          ) : (
            <RecentList recent={data.recent} features={features} />
          )}
          <div className="buttons dash-more">
            <button type="button" className="btn secondary small" onClick={onGoHistory}>
              📚 Open My History
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------- The page: loads the data, handles loading and errors ----------
function DashboardPage({ features, onPrefill, onUnauthorized, onGoHome, onGoHistory }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // change it to load again

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    // tz lets the server count "days" in the student's own timezone
    apiRequest(`/api/progress/summary?tz=${new Date().getTimezoneOffset()}`, { auth: true })
      .then((summary) => {
        if (!cancelled) setData(summary);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          onUnauthorized(); // the login expired
          return;
        }
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return (
    <div>
      <section className="feature-banner">
        <span className="banner-icon">📈</span>
        <div className="banner-text">
          <h1>My Progress</h1>
          <p>See how you are learning and what to study next.</p>
        </div>
      </section>

      {loading && <div className="card history-loading">Loading your progress...</div>}

      {error && (
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <div>
            <strong>Oops!</strong>
            <p>{error}</p>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <DashboardView
          data={data}
          features={features}
          onPrefill={onPrefill}
          onGoHome={onGoHome}
          onGoHistory={onGoHistory}
        />
      )}
    </div>
  );
}

export default DashboardPage;