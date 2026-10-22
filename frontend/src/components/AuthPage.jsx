import { useState } from "react";
import { apiRequest } from "../utils/api.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage({ onSuccess, onBack }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  function handleChange(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;

    // Simple checks first (the backend checks again)
    if (isSignup && (name.length < 2 || name.length > 50)) {
      setError("Please enter your name (2 to 50 characters).");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (isSignup && (password.length < 8 || password.length > 72)) {
      setError("Password must be 8 to 72 characters.");
      return;
    }
    if (!isSignup && password === "") {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: isSignup ? { name, email, password } : { email, password },
      });
      onSuccess(data); // { token, user }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand brand">
        <span className="brand-logo">🎓</span>
        <span className="brand-name">GenAI Educational Assistant</span>
      </div>

      <div className="card auth-card">
        <h1 className="auth-title">{isSignup ? "Create your account" : "Welcome back!"}</h1>
        <p className="auth-sub">
          {isSignup
            ? "Sign up to save your learning history."
            : "Log in to see your saved learning history."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={!isSignup ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("login")}
            disabled={loading}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={isSignup ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("signup")}
            disabled={loading}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                maxLength={50}
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "Your password"}
              maxLength={72}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-card">
              <span className="error-icon">⚠️</span>
              <div>
                <p>{error}</p>
              </div>
            </div>
          )}

          <div className="auth-actions">
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? "Please wait..." : isSignup ? "Create account" : "Log in"}
            </button>
            <button type="button" className="btn secondary" onClick={onBack} disabled={loading}>
              Continue as guest
            </button>
          </div>
        </form>

        <p className="auth-note">
          Guests can use all five learning features. Only logged-in students get saved history.
        </p>
      </div>
    </div>
  );
}

export default AuthPage;