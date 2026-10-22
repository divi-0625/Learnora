import { useState } from "react";
import { apiRequest } from "../utils/api.js";

const ACTIONS = [
  { id: "summarize", title: "Summarize document", description: "Create an overview and key points." },
  { id: "ask", title: "Ask a question", description: "Get an answer grounded in the uploaded material." },
  { id: "explain", title: "Explain a section", description: "Understand a difficult passage in simple language." },
  { id: "revise", title: "Revision questions", description: "Generate practice questions with answers." },
];

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this file. Please try again."));
    reader.readAsDataURL(file);
  });
}

export default function DocumentPage({ compact = false }) {
  const [file, setFile] = useState(null);
  const [action, setAction] = useState("summarize");
  const [question, setQuestion] = useState("");
  const [section, setSection] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseFile(next) {
    setError(""); setResult(null);
    if (!next) { setFile(null); return; }
    const ext = next.name.split(".").pop().toLowerCase();
    if (!["pdf", "txt", "md", "markdown"].includes(ext)) { setFile(null); setError("Please choose a PDF, TXT, or Markdown file."); return; }
    if (ext === "pdf" && next.size > 5 * 1024 * 1024) { setFile(null); setError("PDF files must be 5 MB or smaller."); return; }
    if (ext !== "pdf" && next.size > 1_000_000) { setFile(null); setError("Please choose a smaller text file (maximum 1 MB for browser upload)."); return; }
    setFile(next);
  }

  async function processDocument(event) {
    event.preventDefault();
    if (!file) { setError("Choose a study document first."); return; }
    if (action === "ask" && question.trim().length < 3) { setError("Enter a question about your document."); return; }
    if (action === "explain" && section.trim().length < 3) { setError("Enter or paste the section you want explained."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let body = { action, fileName: file.name, mimeType: file.type || (ext === "pdf" ? "application/pdf" : "text/plain") };
      if (ext === "pdf") {
        const dataUrl = await readFile(file);
        body.data = dataUrl.split(",")[1] || "";
      } else {
        body.text = await file.text();
      }
      if (action === "ask") body.question = question.trim();
      if (action === "explain") body.section = section.trim();
      const response = await apiRequest("/api/document", { method: "POST", body });
      setResult(response.result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return <div className={compact ? "document-page document-page-compact" : "page-panel document-page"}>{!compact && <div className="page-heading"><span className="eyebrow">YOUR STUDY MATERIAL</span><h1>Study Material Assistant</h1><p>Upload a document to summarize it, ask questions, explain a section, or prepare for revision.</p></div>}{compact && <div className="document-compact-heading"><span className="eyebrow">OPTIONAL DOCUMENT TOOLS</span><h2>Study from a document</h2><p>Upload PDF, TXT or Markdown notes to ask questions, get a summary or make revision questions.</p></div>}
    <form className="card document-form" onSubmit={processDocument}>
      <div className="document-drop"><div className="upload-icon">↑</div><h2>Choose your study material</h2><p>PDF, TXT, or Markdown. PDF files up to 5 MB.</p><label className="btn secondary upload-label">Browse files<input type="file" accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown" onChange={(e) => chooseFile(e.target.files?.[0] || null)} /></label>{file && <div className="selected-file"><span>📄</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} KB</small></div><button type="button" className="icon-button" onClick={() => chooseFile(null)} aria-label="Remove selected file">×</button></div>}</div>
      <div className="field"><label htmlFor="document-action">What would you like to do?</label><div className="document-action-grid">{ACTIONS.map((item) => <button type="button" key={item.id} className={`document-action ${action === item.id ? "selected" : ""}`} onClick={() => { setAction(item.id); setResult(null); }}><strong>{item.title}</strong><span>{item.description}</span></button>)}</div></div>
      {action === "ask" && <div className="field"><label htmlFor="doc-question">Your question</label><textarea id="doc-question" rows={3} maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are the main concepts explained in this document?"/></div>}
      {action === "explain" && <div className="field"><label htmlFor="doc-section">Section to explain</label><textarea id="doc-section" rows={3} maxLength={1500} value={section} onChange={(e) => setSection(e.target.value)} placeholder="Paste the paragraph or section you want explained…"/></div>}
      {error && <div className="error-card"><span>⚠️</span><p>{error}</p></div>}
      <button className="btn primary" type="submit" disabled={loading || !file}>{loading ? "Reading your material…" : "Process study material →"}</button>
      <p className="muted small-note">Your uploaded file is sent to the backend for processing. This interface does not save the original file in your account.</p>
    </form>
    {result && <section className="card document-result"><span className="eyebrow">DOCUMENT RESULT</span>{result.readable === false ? <div className="error-card"><span>⚠️</span><p>{result.problem}</p></div> : <><h2>{ACTIONS.find((a) => a.id === result.action)?.title || "Your result"}</h2>{result.supported === false && <p className="save-status note">The document may not contain enough information to fully support this answer.</p>}<div className="document-answer">{result.answer}</div>{result.questions?.length > 0 && <div className="document-questions">{result.questions.map((q, i) => <article key={i}><strong>{i + 1}. {q.question}</strong><p>{q.answer}</p><small>Reference: {q.reference}</small></article>)}</div>}{result.references?.length > 0 && <div className="document-references"><strong>References in the document</strong><ul>{result.references.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}</>}</section>}
  </div>;
}
