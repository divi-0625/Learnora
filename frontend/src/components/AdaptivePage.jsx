import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api.js";

const STATUS = {
  needs_revision: { title: "Needs revision", icon: "↻", tone: "needs-revision" },
  not_enough_data: { title: "More practice needed", icon: "◷", tone: "not-enough-data" },
  steady: { title: "Steady progress", icon: "→", tone: "steady" },
  improving: { title: "Improving", icon: "↗", tone: "improving" },
  strong: { title: "Strong performance", icon: "✦", tone: "strong" },
};

export default function AdaptivePage({ user, onLogin, onQuiz, onExplain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    apiRequest("/api/progress/adaptive", { auth: true }).then((result) => {
      if (!cancelled) setData(result);
    }).catch((err) => {
      if (cancelled) return;
      if (err.status === 401) setError("Your session has expired. Please sign in again.");
      else setError(err.message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return <section className="page-panel"><div className="page-heading"><span className="eyebrow">PERSONALISED LEARNING</span><h1>Adaptive Learning</h1><p>Recommendations based on your own quiz attempts.</p></div><div className="empty-state"><div className="empty-state-icon">🔐</div><h2>Sign in to view your learning insights</h2><button className="btn primary" onClick={onLogin}>Sign in</button></div></section>;

  return <div className="page-panel"><div className="page-heading"><span className="eyebrow">PERSONALISED LEARNING</span><h1>Adaptive Learning</h1><p>Learnora reviews your saved quiz attempts and suggests what to practise next.</p></div>
    {loading && <div className="card loading-card"><div className="spinner"/> Analysing your quiz history…</div>}
    {error && <div className="error-card"><span>⚠️</span><p>{error}</p><button className="btn secondary small" onClick={() => window.location.reload()}>Try again</button></div>}
    {!loading && !error && data && <>
      <div className="adaptive-summary card"><div><span className="eyebrow">YOUR LEARNING DATA</span><h2>{data.totalAttempts || 0} saved quiz attempts</h2><p>{data.message || "Your recommendations update as you complete more quizzes."}</p></div><div className="adaptive-summary-icon">✦</div></div>
      {!data.hasData || !data.topics?.length ? <div className="empty-state card"><div className="empty-state-icon">🎯</div><h2>Start with a quiz</h2><p>Take quizzes, then repeat a quiz on the same topic to unlock personalised recommendations.</p><button className="btn primary" onClick={() => onQuiz("", "")}>Take a quiz</button></div> : <div className="adaptive-topic-list">{data.topics.map((item) => {
        const status = STATUS[item.status] || STATUS.steady;
        return <article className="card adaptive-topic" key={item.topicKey || item.topic}><div className="adaptive-topic-head"><div><span className={`status-pill ${status.tone}`}>{status.icon} {status.title}</span><h2>{item.topic}</h2></div><div className="adaptive-average"><strong>{item.average}%</strong><span>average</span></div></div><p>{item.message}</p><div className="adaptive-metrics"><span>Attempts <strong>{item.attempts}</strong></span><span>Latest <strong>{item.latest}%</strong></span>{item.previous != null && <span>Previous <strong>{item.previous}%</strong></span>}<span>Level <strong>{item.currentLevel}</strong></span></div>
          {item.recentMissed?.length > 0 && <div className="missed-list"><strong>Topics to revisit</strong><ul>{item.recentMissed.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
          {item.repeatedQuestions?.length > 0 && <div className="missed-list"><strong>Repeatedly missed questions</strong><ul>{item.repeatedQuestions.map((q, i) => <li key={i}>{q.question} <span className="muted">({q.count} times)</span></li>)}</ul></div>}
          <div className="adaptive-actions">{item.simplerExplanation && <button className="btn secondary small" onClick={() => onExplain(item.topic)}>Explain this simply</button>}<button className="btn primary small" onClick={() => onQuiz(item.topic, item.recommendedLevel || item.currentLevel, true)}>Practise this topic →</button></div>
        </article>;
      })}</div>}
    </>}
  </div>;
}
