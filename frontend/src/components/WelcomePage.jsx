// The first screen for new visitors: two equally clear choices.
function WelcomePage({ features, onSignIn, onGuest }) {
  return (
    <div className="welcome">
      <div className="welcome-orb orb-a" aria-hidden="true"></div>
      <div className="welcome-orb orb-b" aria-hidden="true"></div>
      <div className="welcome-orb orb-c" aria-hidden="true"></div>

      <main className="welcome-main">
        <div className="welcome-brand brand">
          <span className="brand-logo">🎓</span>
          <span className="brand-name">Learnora</span>
        </div>

        <h1>Welcome to Your AI Learning Companion</h1>
        <p className="welcome-sub">Learn smarter. Understand better. Prepare confidently.</p>

        <div className="welcome-choices">
          <button type="button" className="choice-card" onClick={onSignIn}>
            <span className="choice-icon" aria-hidden="true">
              🔐
            </span>
            <span className="choice-title">Sign In / Create Account</span>
            <span className="choice-desc">
              Save your learning history and track your progress.
            </span>
            <span className="choice-cta">
              Continue <span aria-hidden="true">→</span>
            </span>
          </button>

          <button type="button" className="choice-card" onClick={onGuest}>
            <span className="choice-icon" aria-hidden="true">
              🚀
            </span>
            <span className="choice-title">Continue as Guest</span>
            <span className="choice-desc">
              Use all five learning features without registering.
            </span>
            <span className="choice-cta">
              Continue <span aria-hidden="true">→</span>
            </span>
          </button>
        </div>

        <ul className="welcome-features" aria-label="Learning features">
          {features.map((feature) => (
            <li key={feature.id}>
              <span aria-hidden="true">{feature.icon}</span> {feature.title}
            </li>
          ))}
        </ul>

        <p className="welcome-note">
          Guests can use all five features. Saved history and progress need an account.
        </p>
      </main>
    </div>
  );
}

export default WelcomePage;