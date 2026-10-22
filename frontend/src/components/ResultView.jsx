import { useEffect, useRef, useState } from "react";
import QuizView from "./QuizView.jsx";
import SpeakButton from "./SpeakButton.jsx";
import DiagramView from "./DiagramView.jsx";
import { apiRequest, getToken } from "../utils/api.js";

const DIAGRAM_FEATURES = ["ask", "explain"]; // features that get the "Show as diagram" button
const MAX_CONTEXT = 8000; // must match the backend limit

// The quiz and its score saving
function QuizSection({ result }) {
  const questions = result.result.questions;
  const historyId = result.historyId; // set when the quiz was saved to the student's history

  let onComplete;
  let saveNote = "";

  if (historyId) {
    // Send ONLY the chosen option numbers. The server works out the score.
    onComplete = async (answers) => {
      const data = await apiRequest("/api/progress/quiz-attempts", {
        method: "POST",
        auth: true,
        body: { historyId, answers },
      });
      return data.attempt;
    };
  } else if (!getToken()) {
    saveNote = "Log in to save your quiz scores and track your progress.";
  } else {
    saveNote = "This quiz was not saved to your history, so its score cannot be saved.";
  }

  // The key makes React start a fresh quiz when a new quiz arrives
  const key = questions.map((q) => q.question).join("|") + (historyId || "");
  return <QuizView key={key} questions={questions} onComplete={onComplete} saveNote={saveNote} />;
}

function ResultView({ result, topic }) {
  const isText = result.type === "text";
  const text = isText ? result.result : "";
  const canDiagram = isText && DIAGRAM_FEATURES.includes(result.feature);

  const [diagram, setDiagram] = useState({ status: "idle" }); // idle | loading | ready | unsuitable | error
  const [showDiagram, setShowDiagram] = useState(true);
  const requestRef = useRef(0); // lets us ignore the answer of an old diagram request

  // A new answer clears the old diagram and cancels any request still running
  useEffect(() => {
    requestRef.current += 1;
    setDiagram({ status: "idle" });
    setShowDiagram(true);
    return () => {
      requestRef.current += 1;
    };
  }, [text]);

  async function generateDiagram() {
    const id = ++requestRef.current;
    setDiagram({ status: "loading" });
    setShowDiagram(true);
    try {
      const data = await apiRequest("/api/visual", {
        method: "POST",
        body: {
          context: text.slice(0, MAX_CONTEXT),
          topic: topic ? topic.slice(0, 300) : undefined,
        },
      });
      if (id !== requestRef.current) return;
      if (data.suitable) {
        setDiagram({ status: "ready", diagram: data.diagram });
      } else {
        setDiagram({ status: "unsuitable", reason: data.reason });
      }
    } catch (err) {
      if (id !== requestRef.current) return;
      setDiagram({ status: "error", message: err.message });
    }
  }

  // Label and action of the diagram button
  let diagramButton = null;
  if (canDiagram) {
    if (diagram.status === "loading") {
      diagramButton = (
        <button type="button" className="speak-btn" disabled>
          🧩 Drawing...
        </button>
      );
    } else if (diagram.status === "ready") {
      diagramButton = (
        <button type="button" className="speak-btn" onClick={() => setShowDiagram(!showDiagram)}>
          🧩 {showDiagram ? "Hide diagram" : "Show diagram"}
        </button>
      );
    } else {
      diagramButton = (
        <button type="button" className="speak-btn" onClick={generateDiagram}>
          🧩 Show as diagram
        </button>
      );
    }
  }

  const personalization = result.personalization;

  return (
    <section className="result">
      <div className="result-header">
        <span className="result-badge">✨</span>
        <h3>AI Response</h3>

        {/* Action buttons and notes for this result */}
        <div className="result-actions">
          {result.saved === true && <span className="save-pill ok">✔ Saved to history</span>}
          {result.saved === false && (
            <span className="save-pill warn">⚠ {result.saveNote || "Not saved"}</span>
          )}
          {personalization && personalization.used && (
            <span className="save-pill ok">🎯 Personalized for: {personalization.topics.join(", ")}</span>
          )}
          {personalization && !personalization.used && (
            <span className="save-pill warn">🎯 {personalization.note}</span>
          )}
          {diagramButton}
          {isText && <SpeakButton text={result.result} />}
        </div>
      </div>

      {result.type === "quiz" ? (
        <QuizSection result={result} />
      ) : (
        <div className="result-text">{result.result}</div>
      )}

      {/* Diagram (only after the student asks for it) */}
      {canDiagram && diagram.status !== "idle" && (
        <div className="diagram-panel">
          {diagram.status === "loading" && (
            <div className="diagram-loading">
              <span className="spinner"></span>
              <span>Drawing your diagram...</span>
            </div>
          )}

          {diagram.status === "unsuitable" && (
            <p className="diagram-note">🧩 {diagram.reason}</p>
          )}

          {diagram.status === "error" && (
            <div className="diagram-error">
              <p>⚠ {diagram.message}</p>
              <button type="button" className="btn secondary small" onClick={generateDiagram}>
                Try again
              </button>
            </div>
          )}

          {diagram.status === "ready" && showDiagram && <DiagramView diagram={diagram.diagram} />}
        </div>
      )}
    </section>
  );
}

export default ResultView;