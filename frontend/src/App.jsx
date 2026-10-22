import { useEffect, useState } from "react";
import { FEATURES } from "./features.js";
import FeatureTabs from "./components/FeatureTabs.jsx";
import InputForm from "./components/InputForm.jsx";
import ResultView from "./components/ResultView.jsx";
import HomePage from "./components/HomePage.jsx";
import WelcomePage from "./components/WelcomePage.jsx";
import AuthPage from "./components/AuthPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import DashboardPage from "./components/DashboardPage.jsx";
import EnglishPage from "./components/EnglishPage.jsx";
import AdaptivePage from "./components/AdaptivePage.jsx";
import DocumentPage from "./components/DocumentPage.jsx";
import {
  API_BASE,
  apiRequest,
  getToken,
  getStoredUser,
  saveSession,
  clearSession,
} from "./utils/api.js";
import { hasGuestPreference, setGuestPreference, clearGuestPreference } from "./utils/guest.js";

const API_URL = `${API_BASE}/api/generate`;
const LEVEL_IDS = ["beginner", "intermediate", "advanced"];

// Which screen to show first:
// - a saved login            -> home page
// - a remembered guest choice -> home page
// - a new visitor            -> welcome screen
function getInitialPage() {
  if (getToken() && getStoredUser()) return "home";
  if (hasGuestPreference()) return "home";
  return "welcome";
}

function App() {
  // ----- UI-only state: which page is showing ("welcome", "home", "feature", "login", "history" or "dashboard") -----
  const [page, setPage] = useState(getInitialPage);

  // ----- Login state (null = guest) -----
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  // ----- State: data that changes and makes the screen update -----
  const [selectedId, setSelectedId] = useState(FEATURES[0].id); // which feature is active
  const [values, setValues] = useState({}); // what the user typed, e.g. { question: "..." }
  const [level, setLevel] = useState("intermediate"); // learning level (kept when switching features)
  const [useWeakTopics, setUseWeakTopics] = useState(false); // study plan: focus on weak topics
  const [useAdaptive, setUseAdaptive] = useState(false); // quiz: adapt from saved quiz attempts
  const [loading, setLoading] = useState(false); // true while waiting for the backend
  const [error, setError] = useState(""); // error message to show (empty = no error)
  const [result, setResult] = useState(null); // response from the backend

  const feature = FEATURES.find((f) => f.id === selectedId);

  // When the app opens with a saved login, check that it is still valid
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    apiRequest("/api/auth/me", { auth: true })
      .then((data) => {
        saveSession(token, data.user);
        setUser(data.user);
        // A valid login never needs the welcome screen
        setPage((current) => (current === "welcome" ? "home" : current));
      })
      .catch((err) => {
        if (err.status === 401) {
          // The login expired or is invalid
          clearSession();
          setUser(null);
          // A visitor with no guest choice goes back to the welcome screen
          setPage((current) => (current === "home" && !hasGuestPreference() ? "welcome" : current));
        }
        // Other errors (server or database down): keep the saved login for now
      });
  }, []);

  function clearAll() {
    setValues({});
    setResult(null);
    setError("");
  }

  function handleSelectFeature(id) {
    setSelectedId(id);
    clearAll(); // start fresh when switching features
    setUseWeakTopics(false);
    setUseAdaptive(false);
    setPage("feature");
  }

  // Opens a feature with the form already filled in (used by Progress and History).
  // It does NOT submit the form, so no AI request is made until the student clicks the button.
  function handlePrefill({ featureId, values: newValues, level: newLevel, useWeakTopics: weak, adaptive }) {
    if (!FEATURES.some((f) => f.id === featureId)) return;
    setSelectedId(featureId);
    setValues(newValues || {});
    setResult(null);
    setError("");
    if (LEVEL_IDS.includes(newLevel)) setLevel(newLevel);
    setUseWeakTopics(Boolean(weak));
    setUseAdaptive(Boolean(adaptive));
    setPage("feature");
  }

  function handleGoHome() {
    clearAll();
    setPage("home");
  }

  function handleGoLogin() {
    clearAll();
    setPage("login");
  }

  // "Continue as Guest": remember the choice (a screen preference only, NOT a login)
  function handleChooseGuest() {
    setGuestPreference();
    clearAll();
    setPage("home");
  }

  // Guests are sent to the login screen instead of the history / progress screens
  function handleGoHistory() {
    clearAll();
    setPage(user ? "history" : "login");
  }

  function handleGoDashboard() {
    clearAll();
    setPage(user ? "dashboard" : "login");
  }

  function handleAuthSuccess(data) {
    saveSession(data.token, data.user);
    clearGuestPreference(); // this visitor now has an account
    setUser(data.user);
    clearAll();
    setPage("home");
  }

  // Logging out clears the login and returns to the welcome screen
  function handleLogout() {
    clearSession();
    clearGuestPreference();
    setUser(null);
    clearAll();
    setUseWeakTopics(false);
    setPage("welcome");
  }

  // Called by the history / progress screens when the server says the login is no longer valid
  function handleSessionExpired() {
    clearSession();
    setUser(null);
    setPage("login");
  }

  // Controlled inputs: React state is the single source of truth for each field
  function handleChange(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault(); // stop the browser from reloading the page
    setError("");
    setResult(null);

    // Frontend validation: every required field of this feature must be filled
    const body = { feature: selectedId };
    for (const field of feature.fields) {
      const value = (values[field.name] || "").trim();
      if (value === "") {
        if (field.optional) continue; // optional fields may stay empty
        setError(`Please enter ${field.label.toLowerCase()}.`);
        return;
      }
      body[field.name] = value;
    }

    // Send the learning level only for features that use it
    if (feature.usesLevel) {
      body.level = level;
    }

    // Study plan: ask the server to use the student's weak topics (logged-in students only)
    if (feature.supportsWeakTopics && user && useWeakTopics) {
      body.useWeakTopics = true;
    }

    if (feature.id === "quiz" && user && useAdaptive) {
      body.adaptive = true;
    }

    // If the student is logged in, the token lets the backend save this result
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setResult(data);

      // The server told us the saved login is no longer valid
      if (data.sessionExpired) {
        clearSession();
        setUser(null);
      }
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch throws TypeError when the server cannot be reached
        setError(
          "Cannot reach the server. Check that the backend is running on port 5000 and that you are online."
        );
      } else if (err instanceof SyntaxError) {
        setError("The server sent an unexpected response. Please try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false); // runs whether the request worked or failed
    }
  }

  // ----- Welcome screen (new visitors) -----
  if (page === "welcome") {
    return <WelcomePage features={FEATURES} onSignIn={handleGoLogin} onGuest={handleChooseGuest} />;
  }

  // ----- Login / signup page -----
  if (page === "login") {
    return <AuthPage onSuccess={handleAuthSuccess} onBack={handleChooseGuest} />;
  }

  // ----- Home page (no sidebar) -----
  if (page === "home") {
    return (
      <HomePage
        features={FEATURES}
        user={user}
        onSelect={handleSelectFeature}
        onLogin={handleGoLogin}
        onLogout={handleLogout}
        onHistory={handleGoHistory}
        onDashboard={handleGoDashboard}
        onEnglish={() => setPage(user ? "english" : "login")}
        onAdaptive={() => setPage(user ? "adaptive" : "login")}
        onDocuments={() => setPage("document")}
      />
    );
  }

  // The sidebar is shared by the feature, progress and history pages
  const sidebar = (
    <FeatureTabs
      features={FEATURES}
      selectedId={selectedId}
      activePage={page}
      user={user}
      onSelect={handleSelectFeature}
      onHome={handleGoHome}
      onDashboard={handleGoDashboard}
      onHistory={handleGoHistory}
      onLogin={handleGoLogin}
      onLogout={handleLogout}
      onEnglish={() => setPage(user ? "english" : "login")}
      onAdaptive={() => setPage(user ? "adaptive" : "login")}
      onDocuments={() => setPage("document")}
      disabled={loading}
    />
  );

  // ----- New learning modules -----
  if (["english", "adaptive", "document"].includes(page)) {
    return (
      <div className="layout">
        {sidebar}
        <div className="content">
          <main className="feature-page">
            {page === "english" && <EnglishPage user={user} onLogin={handleGoLogin} />}
            {page === "adaptive" && <AdaptivePage user={user} onLogin={handleGoLogin}
              onQuiz={(topic, level, adaptive = false) => handlePrefill({ featureId: "quiz", values: { topic }, level, adaptive })}
              onExplain={(topic) => handlePrefill({ featureId: "explain", values: { topic }, level: "beginner" })} />}
            {page === "document" && <DocumentPage />}
          </main>
          <footer className="footer">AI can make mistakes. Please verify important information.</footer>
        </div>
      </div>
    );
  }

  // ----- Progress dashboard (sidebar + charts) -----
  if (page === "dashboard") {
    return (
      <div className="layout">
        {sidebar}

        <div className="content">
          <main className="feature-page">
            <DashboardPage
              features={FEATURES}
              onPrefill={handlePrefill}
              onUnauthorized={handleSessionExpired}
              onGoHome={handleGoHome}
              onGoHistory={handleGoHistory}
            />
          </main>

          <footer className="footer">
            AI can make mistakes. Please verify important information.
          </footer>
        </div>
      </div>
    );
  }

  // ----- History page (sidebar + saved items) -----
  if (page === "history") {
    return (
      <div className="layout">
        {sidebar}

        <div className="content">
          <main className="feature-page">
            <HistoryPage
              features={FEATURES}
              onUnauthorized={handleSessionExpired}
              onGoHome={handleGoHome}
              onPrefill={handlePrefill}
            />
          </main>

          <footer className="footer">
            AI can make mistakes. Please verify important information.
          </footer>
        </div>
      </div>
    );
  }

  // ----- Feature page (sidebar + main content) -----
  return (
    <div className="layout">
      {sidebar}

      <div className="content">
        <main key={selectedId} className={`feature-page theme-${feature.id}`}>
          <section className="feature-banner">
            <span className="banner-icon">{feature.icon}</span>
            <div className="banner-text">
              <h1>{feature.title}</h1>
              <p>{feature.description}</p>
            </div>
          </section>

          <section className="card form-card">
            <InputForm
              feature={feature}
              values={values}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onClear={clearAll}
              loading={loading}
              level={level}
              onLevelChange={setLevel}
              user={user}
              useWeakTopics={useWeakTopics}
              onUseWeakTopicsChange={setUseWeakTopics}
            />
          </section>

          {loading && (
            <div className="loading-card">
              <div className="loading-row">
                <span className="spinner"></span>
                <span>Gemini is thinking...</span>
              </div>
              <div className="skeleton"></div>
              <div className="skeleton short"></div>
            </div>
          )}

          {error && (
            <div className="error-card">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Oops!</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {result && (
            <ResultView
              result={result}
              topic={values.question || values.topic || values.subject || ""}
            />
          )}
          {selectedId === "summarize" && <DocumentPage compact />}
        </main>

        <footer className="footer">
          AI can make mistakes. Please verify important information.
        </footer>
      </div>
    </div>
  );
}

export default App;