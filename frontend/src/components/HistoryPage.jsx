import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api.js";
import ResultView from "./ResultView.jsx";

const INPUT_LABELS = {
  question: "Question",
  topic: "Topic",
  text: "Study material",
  subject: "Subject",
  studyTime: "Study time",
  goal: "Learning goal",
  weakTopics: "Weak topics used",
};

const DEFAULT_STUDY_TIME = "1 hour per day for 5 days";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function capitalize(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

function HistoryPage({ features, onUnauthorized, onGoHome, onPrefill }) {
  const [filter, setFilter] = useState(""); // "" = all features
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // change it to reload the list

  const [openId, setOpenId] = useState(null); // item being viewed
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [busy, setBusy] = useState(false); // true while deleting

  function featureInfo(id) {
    return features.find((f) => f.id === id) || { icon: "📄", title: id, fields: [] };
  }

  // Load the list (when the filter changes or after a delete)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const query = filter ? `?feature=${encodeURIComponent(filter)}` : "";
    apiRequest(`/api/history${query}`, { auth: true })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          onUnauthorized();
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
  }, [filter, reloadKey]);

  // Load one full item when it is opened
  useEffect(() => {
    if (openId === null) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    apiRequest(`/api/history/${openId}`, { auth: true })
      .then((data) => {
        if (!cancelled) setDetail(data.item);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          onUnauthorized();
          return;
        }
        setDetailError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  async function handleDelete(id) {
    if (!window.confirm("Delete this item from your history?")) return;
    setBusy(true);
    try {
      await apiRequest(`/api/history/${id}`, { method: "DELETE", auth: true });
      if (openId === id) setOpenId(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(err.message);
      setDetailError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // "Use again": open the same feature with the original input filled in
  function useAgain() {
    const info = featureInfo(detail.feature);
    const values = {};
    for (const field of info.fields) {
      if (typeof detail.inputs?.[field.name] === "string") {
        values[field.name] = detail.inputs[field.name];
      }
    }
    onPrefill({ featureId: detail.feature, values, level: detail.level || undefined });
  }

  // Quiz only: open the study plan with this quiz topic filled in
  function revisionPlan() {
    const topic = String(detail.inputs?.topic || detail.title || "").slice(0, 200);
    onPrefill({
      featureId: "plan",
      values: {
        subject: topic,
        studyTime: DEFAULT_STUDY_TIME,
        goal: `Improve my quiz score in ${topic}`.slice(0, 200),
      },
      level: detail.level || undefined,
      useWeakTopics: true,
    });
  }

  // ---------- Detail view: one saved item ----------
  if (openId !== null) {
    const info = detail ? featureInfo(detail.feature) : null;

    return (
      <div className={detail ? `theme-${detail.feature}` : ""}>
        <div className="history-detail-top">
          <button type="button" className="btn secondary small" onClick={() => setOpenId(null)}>
            ← Back to history
          </button>
          {detail && (
            <>
              <button type="button" className="btn secondary small" onClick={useAgain}>
                ↻ Use again
              </button>
              {detail.feature === "quiz" && (
                <button type="button" className="btn secondary small" onClick={revisionPlan}>
                  📅 Revision plan
                </button>
              )}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => handleDelete(detail.id)}
                disabled={busy}
              >
                🗑 Delete
              </button>
            </>
          )}
        </div>

        {detailLoading && <div className="card history-loading">Loading...</div>}

        {detailError && (
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            <div>
              <strong>Oops!</strong>
              <p>{detailError}</p>
            </div>
          </div>
        )}

        {detail && (
          <>
            <section className="feature-banner">
              <span className="banner-icon">{info.icon}</span>
              <div className="banner-text">
                <h1>{info.title}</h1>
                <p>
                  {detail.level ? `${capitalize(detail.level)} level · ` : ""}
                  {formatDate(detail.createdAt)}
                </p>
              </div>
            </section>

            <section className="card history-inputs">
              {Object.entries(detail.inputs || {}).map(([name, value]) => (
                <div className="history-input-row" key={name}>
                  <span className="history-input-label">{INPUT_LABELS[name] || name}</span>
                  <p className="history-input-value">{value}</p>
                </div>
              ))}
            </section>

            <ResultView
              key={detail.id}
              result={{
                type: detail.resultType,
                result: detail.result,
                feature: detail.feature,
                historyId: detail.id, // lets a quiz opened from history record new attempts
              }}
              topic={detail.title}
            />
          </>
        )}
      </div>
    );
  }

  // ---------- List view ----------
  return (
    <div>
      <section className="feature-banner">
        <span className="banner-icon">📚</span>
        <div className="banner-text">
          <h1>My Learning History</h1>
          <p>Your saved questions, explanations, summaries, quizzes and study plans.</p>
        </div>
      </section>

      <div className="history-toolbar">
        <button
          type="button"
          className={filter === "" ? "chip active" : "chip"}
          onClick={() => setFilter("")}
        >
          All
        </button>
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "chip active" : "chip"}
            onClick={() => setFilter(f.id)}
          >
            {f.icon} {f.title}
          </button>
        ))}
      </div>

      {loading && <div className="card history-loading">Loading your history...</div>}

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

      {!loading && !error && items.length === 0 && (
        <div className="card history-empty">
          <span className="big">📭</span>
          <p>
            {filter
              ? "Nothing saved for this feature yet."
              : "No saved activity yet. Use any feature while logged in and it will appear here."}
          </p>
          <button type="button" className="btn primary" onClick={onGoHome}>
            Start learning
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="history-list">
          {items.map((item) => {
            const info = featureInfo(item.feature);
            return (
              <div
                key={item.id}
                className={`history-item theme-${item.feature}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(item.id);
                  }
                }}
              >
                <span className="history-icon">{info.icon}</span>
                <div className="history-main">
                  <p className="history-title">{item.title}</p>
                  <p className="history-meta">
                    {info.title}
                    {item.level ? ` · ${capitalize(item.level)}` : ""} · {formatDate(item.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="history-delete"
                  aria-label="Delete this item"
                  title="Delete"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;