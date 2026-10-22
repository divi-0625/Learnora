import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../utils/api.js";
import VoiceInputButton from "./VoiceInputButton.jsx";
import SpeakButton from "./SpeakButton.jsx";

const MODES = [
  { id: "everyday", title: "Everyday Conversation", description: "Practise natural conversations about college, hobbies, travel and daily life.", icon: "☕" },
  { id: "interview", title: "Interview Practice", description: "Prepare for fresher interviews and internship questions.", icon: "💼" },
  { id: "group", title: "Group Discussion", description: "Build confidence expressing and supporting your opinions.", icon: "👥" },
  { id: "topic", title: "Speak on a Topic", description: "Organise your ideas and practise a short speech.", icon: "🎙️" },
];

function Rating({ title, value }) {
  return <div className="english-rating"><div><strong>{title}</strong><span>{value?.rating ?? "—"}/5</span></div><p>{value?.comment || "No feedback available."}</p></div>;
}

export default function EnglishPage({ user, onLogin }) {
  const [mode, setMode] = useState("everyday");
  const [topic, setTopic] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setHistoryLoading(true);
    apiRequest("/api/english/history", { auth: true })
      .then((data) => { if (!cancelled) setPracticeHistory(Array.isArray(data.items) ? data.items : []); })
      .catch((err) => { if (!cancelled) setHistoryError(err.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [user, feedback?.practiceId]);

  async function startPractice(event) {
    event?.preventDefault();
    if (!user) { onLogin(); return; }
    setLoading(true); setError(""); setFeedback(null); setTurns([]); setResponse("");
    try {
      const data = await apiRequest("/api/english/start", {
        method: "POST", auth: true,
        body: { mode, topic: topic.trim(), ...(mode === "topic" ? { durationSeconds: Number(durationSeconds) } : {}) },
      });
      setSession({ ...data, mode, topic: topic.trim(), durationSeconds: mode === "topic" ? Number(durationSeconds) : null });
      setTurns([{ role: "coach", text: data.message }]);
      startedAt.current = Date.now();
    } catch (err) {
      if (err.status === 401) { setError("Please sign in again to use English Communication."); }
      else setError(err.message);
    } finally { setLoading(false); }
  }

  async function sendResponse(event) {
    event.preventDefault();
    const answer = response.trim();
    if (!session || !answer) return;
    setLoading(true); setError("");
    const prompt = [...turns].reverse().find((t) => t.role === "coach")?.text || "";
    try {
      const data = await apiRequest("/api/english/respond", {
        method: "POST", auth: true,
        body: {
          mode: session.mode, topic: session.topic, durationSeconds: session.durationSeconds,
          sessionId: session.sessionId, response: answer, turns, prompt,
          elapsedSeconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : null,
        },
      });
      const nextTurns = [...turns, { role: "student", text: answer }];
      if (data.nextMessage) nextTurns.push({ role: "coach", text: data.nextMessage });
      setTurns(nextTurns);
      setFeedback(data);
      setResponse("");
      startedAt.current = Date.now();
    } catch (err) {
      if (err.status === 401) setError("Your session may have expired. Please sign in again.");
      else setError(err.message);
    } finally { setLoading(false); }
  }

  function resetPractice() { setSession(null); setTurns([]); setFeedback(null); setResponse(""); setError(""); }

  if (!user) return <section className="page-panel"><div className="page-heading"><span className="eyebrow">COMMUNICATION SKILLS</span><h1>English Communication</h1><p>Build confidence through guided practice and supportive feedback.</p></div><div className="empty-state"><div className="empty-state-icon">🔐</div><h2>Sign in to practise</h2><p>English Communication sessions and feedback are available to registered students.</p><button className="btn primary" onClick={onLogin}>Sign in / Create account</button></div></section>;

  return <div className="page-panel english-page">
    <div className="page-heading"><span className="eyebrow">COMMUNICATION SKILLS</span><h1>English Communication</h1><p>Practise at your pace. Get specific feedback and a clearer version of your answer.</p></div>
    {!session ? <>
      <div className="english-mode-grid">
        {MODES.map((item) => <button type="button" key={item.id} className={`english-mode-card ${mode === item.id ? "selected" : ""}`} onClick={() => setMode(item.id)}>
          <span className="english-mode-icon">{item.icon}</span><strong>{item.title}</strong><span>{item.description}</span><span className="mode-select">{mode === item.id ? "Selected ✓" : "Choose mode →"}</span>
        </button>)}
      </div>
      <form className="card english-start-form" onSubmit={startPractice}>
        <label htmlFor="english-topic">Topic or preferred subject <span className="muted">(optional)</span></label>
        <input id="english-topic" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} placeholder={mode === "interview" ? "e.g. Software engineering internship" : mode === "group" ? "e.g. Is online learning effective?" : "e.g. College life, hobbies, technology"} />
        {mode === "topic" && <div className="field"><label htmlFor="english-duration">Practice duration</label><select id="english-duration" value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))}><option value={30}>30 seconds</option><option value={60}>1 minute</option><option value={120}>2 minutes</option></select></div>}
        {error && <div className="error-card"><span>⚠️</span><p>{error}</p></div>}
        <button className="btn primary" type="submit" disabled={loading}>{loading ? "Preparing your practice…" : "Start practice →"}</button>
      </form>
    </> : <>
      <div className="english-session-top"><div><span className="eyebrow">{MODES.find((m) => m.id === session.mode)?.title}</span><h2>{session.topic || "Guided practice"}</h2><p>Write naturally. Your feedback is based on the text of your response.</p></div><button type="button" className="btn secondary" onClick={resetPractice}>End practice</button></div>
      <div className="english-chat card">
        {turns.map((turn, i) => <div className={`chat-turn ${turn.role}`} key={`${i}-${turn.role}`}><span className="chat-avatar">{turn.role === "coach" ? "✦" : "You"}</span><div className="chat-bubble"><strong>{turn.role === "coach" ? "Learnora Coach" : "Your response"}</strong><p>{turn.text}</p>{turn.role === "coach" && <SpeakButton text={turn.text} />}</div></div>)}
        {session.hints?.length > 0 && turns.length === 1 && <div className="english-hints"><strong>Helpful hints</strong><ul>{session.hints.map((hint, i) => <li key={i}>{hint}</li>)}</ul></div>}
      </div>
      {feedback?.feedback && <section className="card feedback-panel">
        <div className="feedback-title"><div><span className="eyebrow">YOUR FEEDBACK</span><h2>You're making progress</h2></div><div className="practice-score"><strong>{feedback.feedback.score}</strong><span>/100</span><small>Practice score</small></div></div>
        <div className="english-rating-grid"><Rating title="Clarity" value={feedback.feedback.clarity}/><Rating title="Grammar" value={feedback.feedback.grammar}/><Rating title="Vocabulary" value={feedback.feedback.vocabulary}/></div>
        {feedback.feedback.fluencyNotes && <div className="feedback-note"><strong>Text-based fluency notes</strong><p>{feedback.feedback.fluencyNotes}</p></div>}
        {feedback.feedback.improvedVersion && <div className="improved-answer"><strong>✨ A clearer version</strong><p>{feedback.feedback.improvedVersion}</p><SpeakButton text={feedback.feedback.improvedVersion}/></div>}
        {feedback.feedback.suggestions?.length > 0 && <div className="feedback-note"><strong>Try next time</strong><ul>{feedback.feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
        {feedback.feedback.encouragement && <p className="encouragement">{feedback.feedback.encouragement}</p>}
        {feedback.stats && <div className="english-stats"><div><strong>{feedback.stats.wordCount}</strong><span>Words</span></div><div><strong>{feedback.stats.sentenceCount}</strong><span>Sentences</span></div><div><strong>{feedback.stats.fillerCount}</strong><span>Filler words</span></div>{feedback.stats.approxWordsPerMinute != null && <div><strong>{feedback.stats.approxWordsPerMinute}</strong><span>Approx. words/min</span></div>}</div>}
        <p className="save-status note">{feedback.saved ? "✓ Practice result saved to your account." : (feedback.saveNote || "This practice result could not be saved.")}</p>
        <p className="muted small-note">This is an AI-generated practice score based on text, not an official proficiency test.</p>
      </section>}
      {error && <div className="error-card"><span>⚠️</span><p>{error}</p></div>}
      {(session.mode !== "topic" || !feedback) && <form className="card english-response-form" onSubmit={sendResponse}>
        <label htmlFor="english-response">Your response</label>
        <textarea id="english-response" rows={4} maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write your answer here, or use the microphone…" disabled={loading}/>
        <div className="response-actions"><VoiceInputButton value={response} onChange={setResponse} maxLength={2000} disabled={loading}/><span className="muted">{response.length}/2000</span><button className="btn primary" type="submit" disabled={loading || response.trim().split(/\s+/).filter(Boolean).length < 3}>{loading ? "Reviewing…" : "Send response →"}</button></div>
        <p className="muted small-note">Please use at least a short sentence so the coach can give useful feedback.</p>
      </form>}
      {session.mode === "topic" && feedback && <button className="btn primary" onClick={resetPractice}>Finish and choose another practice</button>}
    </>}
    {!session && <section className="english-history-section"><div className="section-heading-row"><div><span className="eyebrow">YOUR PRACTICE LOG</span><h2>Recent English practice</h2></div><button type="button" className="btn secondary small" onClick={() => { setHistoryError(""); setHistoryLoading(true); apiRequest("/api/english/history", { auth: true }).then((data) => setPracticeHistory(Array.isArray(data.items) ? data.items : [])).catch((err) => setHistoryError(err.message)).finally(() => setHistoryLoading(false)); }}>Refresh</button></div>
      {historyLoading ? <div className="card history-loading">Loading practice history…</div> : historyError ? <div className="error-card"><span>⚠️</span><p>{historyError}</p></div> : practiceHistory.length === 0 ? <div className="card history-empty"><p>Your completed practice sessions will appear here.</p></div> : <div className="english-history-list">{practiceHistory.map((item) => <article className="card english-history-item" key={item.id}><div><strong>{MODES.find((m) => m.id === item.mode)?.title || item.mode}</strong><p>{item.topic || item.prompt || "Practice session"}</p><small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small>{item.snippet && <p className="history-snippet">{item.snippet}</p>}</div><div className="history-score"><strong>{item.score ?? "—"}</strong><span>/100</span></div></article>)}</div>}
    </section>}
  </div>;
}
