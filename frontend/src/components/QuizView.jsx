import { useRef, useState } from "react";

const LETTERS = ["A", "B", "C", "D"];

// Friendly feedback based on the score
function getFeedback(score, total) {
  const ratio = score / total;
  if (ratio === 1) return { emoji: "🏆", text: "Perfect score! You have mastered this topic." };
  if (ratio >= 0.8) return { emoji: "🌟", text: "Great job! Just a little revision needed." };
  if (ratio >= 0.6) return { emoji: "👍", text: "Good effort! Review the incorrect answers below." };
  return { emoji: "📚", text: "Keep practising. Read the explanations and try the quiz again." };
}

// onComplete(answerNumbers) is optional. It saves the attempt on the server and
// returns { score, total }. saveNote explains why saving is not possible (guest, etc.).
function QuizView({ questions, onComplete, saveNote }) {
  const [selected, setSelected] = useState(() => questions.map(() => null)); // chosen option index per question
  const [submitted, setSubmitted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true); // used in the review
  const [onlyIncorrect, setOnlyIncorrect] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle" }); // idle | saving | saved | error
  const topRef = useRef(null);
  const saveIdRef = useRef(0); // lets us ignore the answer of an old save request

  const total = questions.length;
  const answeredCount = selected.filter((s) => s !== null).length;
  const allAnswered = answeredCount === total;

  // isCorrect[i] is true when the chosen option matches the correct answer
  const isCorrect = questions.map(
    (q, i) => selected[i] !== null && q.options[selected[i]] === q.correctAnswer
  );
  const score = isCorrect.filter(Boolean).length;
  const incorrectCount = total - score;
  const feedback = getFeedback(score, total);

  function handleSelect(qIndex, optIndex) {
    if (submitted) return; // answers are locked after submitting
    setSelected((previous) => previous.map((v, i) => (i === qIndex ? optIndex : v)));
  }

  // Sends ONLY the chosen option numbers. The server decides the real score.
  async function saveAttempt() {
    if (!onComplete) return;
    const id = ++saveIdRef.current;
    setSaveState({ status: "saving" });
    try {
      const attempt = await onComplete(selected);
      if (id !== saveIdRef.current) return;
      setSaveState({ status: "saved", score: attempt.score, total: attempt.total });
    } catch (err) {
      if (id !== saveIdRef.current) return;
      setSaveState({ status: "error", message: err.message || "Could not save your score." });
    }
  }

  function handleSubmit() {
    if (!allAnswered) return;
    setSubmitted(true);
    setShowAnswers(true);
    setOnlyIncorrect(false);
    saveAttempt();

    // Scroll up so the student sees the score
    setTimeout(() => {
      if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function handleRetake() {
    saveIdRef.current += 1; // ignore any save that is still running
    setSaveState({ status: "idle" });
    setSelected(questions.map(() => null));
    setSubmitted(false);
    setShowAnswers(true);
    setOnlyIncorrect(false);
  }

  // Which questions to display (all, or only the incorrect ones during review)
  const visible = questions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => !(submitted && onlyIncorrect) || !isCorrect[i]);

  return (
    <div className="quiz" ref={topRef}>
      {/* Score card (after submitting) */}
      {submitted && (
        <div className="score-card">
          <div className="score-big">
            {score} / {total}
          </div>
          <div className="score-body">
            <p className="score-feedback">
              {feedback.emoji} {feedback.text}
            </p>
            <p className="score-sub">
              {Math.round((score / total) * 100)}% correct · {incorrectCount} to review
            </p>

            {/* Is the score saved to the student's progress? */}
            {onComplete ? (
              <>
                {saveState.status === "saving" && (
                  <p className="save-status saving">💾 Saving your score...</p>
                )}
                {saveState.status === "saved" && (
                  <p className="save-status saved">
                    ✔ Score saved to your progress ({saveState.score}/{saveState.total})
                  </p>
                )}
                {saveState.status === "error" && (
                  <p className="save-status error">
                    ⚠ Score not saved: {saveState.message}{" "}
                    <button type="button" className="link-btn" onClick={saveAttempt}>
                      Try again
                    </button>
                  </p>
                )}
              </>
            ) : (
              saveNote && <p className="save-status note">ℹ {saveNote}</p>
            )}

            <div className="buttons">
              <button type="button" className="btn primary small" onClick={handleRetake}>
                🔁 Retake Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quiz-toolbar">
        <span className="quiz-count">🎯 {total} Questions</span>

        {!submitted ? (
          <span className="quiz-progress">
            Answered {answeredCount} / {total}
          </span>
        ) : (
          <div className="quiz-actions">
            {incorrectCount > 0 && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setOnlyIncorrect(!onlyIncorrect)}
              >
                {onlyIncorrect ? "Show all questions" : `Review incorrect only (${incorrectCount})`}
              </button>
            )}
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setShowAnswers(!showAnswers)}
            >
              {showAnswers ? "🙈 Hide Answers" : "👀 Show Answers"}
            </button>
          </div>
        )}
      </div>

      {visible.map(({ q, i }) => (
        <article className="quiz-question" key={i}>
          <div className="q-head">
            <span className="q-number">{i + 1}</span>
            <p className="q-text">{q.question}</p>
            {submitted && showAnswers && (
              <span className={isCorrect[i] ? "pill ok" : "pill bad"}>
                {isCorrect[i] ? "Correct" : "Incorrect"}
              </span>
            )}
          </div>

          <ul className="options" role="radiogroup" aria-label={`Options for question ${i + 1}`}>
            {q.options.map((option, optIndex) => {
              const chosen = selected[i] === optIndex;
              const isRightOption = option === q.correctAnswer;

              let className = "option";
              let tag = null;
              let tagClass = "tick";

              if (!submitted) {
                className += chosen ? " selectable selected" : " selectable";
              } else if (showAnswers) {
                if (isRightOption) {
                  className += " correct";
                  tag = chosen ? "✔ Your answer" : "✔ Correct";
                } else if (chosen) {
                  className += " wrong";
                  tag = "✖ Your answer";
                  tagClass = "tick bad";
                }
              } else if (chosen) {
                className += " selected";
                tag = "Your answer";
              }

              return (
                <li
                  key={optIndex}
                  className={className}
                  role="radio"
                  aria-checked={chosen}
                  tabIndex={submitted ? -1 : 0}
                  onClick={() => handleSelect(i, optIndex)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(i, optIndex);
                    }
                  }}
                >
                  <span className="opt-letter">{LETTERS[optIndex]}</span>
                  <span className="opt-text">{option}</span>
                  {tag && <span className={tagClass}>{tag}</span>}
                </li>
              );
            })}
          </ul>

          {submitted && showAnswers && (
            <div className="explanation">
              <span className="exp-icon">💡</span>
              <p>
                <strong>Explanation:</strong> {q.explanation}
              </p>
            </div>
          )}
        </article>
      ))}

      {/* Submit (before submitting) */}
      {!submitted && (
        <div className="quiz-submit">
          <button
            type="button"
            className="btn primary"
            onClick={handleSubmit}
            disabled={!allAnswered}
          >
            ✅ Submit Answers
          </button>
          {!allAnswered && <span className="quiz-hint">Answer all questions to submit.</span>}
        </div>
      )}
    </div>
  );
}

export default QuizView;