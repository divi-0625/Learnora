import QuoteOfTheDay from "./QuoteOfTheDay.jsx";

// A small educational illustration (plain SVG, no image file and no extra package)
function HeroArt() {
  return (
    <svg viewBox="0 0 440 260" role="img" aria-label="Books, a graduation cap and a lightbulb" className="lhero-svg">
      <ellipse cx="220" cy="140" rx="200" ry="108" fill="#d8ebe8" />
      <ellipse cx="238" cy="130" rx="150" ry="80" fill="#f4faf9" opacity="0.75" />
      <ellipse cx="215" cy="228" rx="125" ry="10" fill="#245b61" opacity="0.12" />

      {/* books */}
      <rect x="110" y="186" width="210" height="34" rx="7" fill="#245b61" />
      <rect x="122" y="196" width="186" height="4" rx="2" fill="#78b8b0" opacity="0.8" />
      <rect x="300" y="192" width="16" height="22" rx="3" fill="#f4faf9" />
      <rect x="130" y="152" width="180" height="34" rx="7" fill="#78b8b0" />
      <rect x="142" y="162" width="150" height="4" rx="2" fill="#ffffff" opacity="0.8" />
      <rect x="292" y="158" width="14" height="22" rx="3" fill="#f4faf9" />
      <rect x="150" y="120" width="150" height="32" rx="7" fill="#d8ebe8" stroke="#245b61" strokeWidth="3" />
      <rect x="162" y="130" width="110" height="4" rx="2" fill="#245b61" opacity="0.5" />

      {/* graduation cap */}
      <path d="M187 100 v24 c0 12 76 12 76 0 v-24 l-38 16z" fill="#1b484d" />
      <polygon points="225,66 304,94 225,122 146,94" fill="#245b61" />
      <line x1="298" y1="97" x2="298" y2="130" stroke="#78b8b0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="298" cy="134" r="5" fill="#78b8b0" />

      {/* lightbulb */}
      <g>
        <circle cx="86" cy="92" r="27" fill="#ffffff" stroke="#245b61" strokeWidth="3" />
        <path d="M76 94 q10 -14 20 0" fill="none" stroke="#78b8b0" strokeWidth="3" strokeLinecap="round" />
        <rect x="75" y="116" width="22" height="11" rx="4" fill="#245b61" />
        <g stroke="#78b8b0" strokeWidth="3" strokeLinecap="round">
          <line x1="86" y1="50" x2="86" y2="42" />
          <line x1="52" y1="62" x2="46" y2="56" />
          <line x1="120" y1="62" x2="126" y2="56" />
          <line x1="44" y1="92" x2="36" y2="92" />
          <line x1="128" y1="92" x2="136" y2="92" />
        </g>
      </g>

      {/* chat bubble */}
      <rect x="320" y="40" width="102" height="62" rx="16" fill="#ffffff" stroke="#245b61" strokeWidth="3" />
      <polygon points="340,100 336,118 358,102" fill="#ffffff" stroke="#245b61" strokeWidth="3" strokeLinejoin="round" />
      <rect x="326" y="94" width="30" height="6" fill="#ffffff" />
      <rect x="336" y="56" width="68" height="7" rx="3.5" fill="#245b61" opacity="0.85" />
      <rect x="336" y="72" width="44" height="7" rx="3.5" fill="#78b8b0" />

      {/* sparkles */}
      <g fill="#78b8b0">
        <path d="M58 170 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
        <path d="M388 176 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5z" />
        <path d="M252 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
      </g>
    </svg>
  );
}

function HomePage({ features, user, onSelect, onLogin, onLogout, onHistory, onDashboard, onEnglish, onAdaptive, onDocuments }) {
  return (
    <div className="home">
      {/* Top navigation */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">🎓</span>
          <span className="brand-name">Learnora</span>
        </div>

        <nav className="topnav" aria-label="Main navigation">
          <button type="button" className="topnav-item active" aria-current="page">
            <span aria-hidden="true">🏠</span> Home
          </button>
          <button type="button" className="topnav-item" onClick={onDashboard}>
            <span aria-hidden="true">📈</span> Progress
          </button>
          <button type="button" className="topnav-item" onClick={onHistory}>
            <span aria-hidden="true">📚</span> History
          </button>
        </nav>

        <div className="topbar-right">
          {user ? (
            <>
              <div className="profile">
                <span className="avatar">🧑‍🎓</span>
                <span className="profile-text">
                  <strong>{user.name}</strong>
                  <small>Student</small>
                </span>
              </div>
              <button type="button" className="header-btn" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <button type="button" className="profile profile-btn" onClick={onLogin}>
              <span className="avatar">🧑‍🎓</span>
              <span className="profile-text">
                <strong>Sign in</strong>
                <small>Save your history</small>
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="home-main">
        {/* Hero */}
        <section className="lhero">
          <div className="lhero-text">
            <h1>Learn with clarity.</h1>
            <p>Your personal AI-powered study space.</p>
          </div>
          <div className="lhero-art" aria-hidden="true">
            <HeroArt />
          </div>
        </section>

        {/* Quote of the day: compact, right below the hero and above the feature cards */}
        <QuoteOfTheDay />

        {/* Five feature cards */}
        <section className="learn-section" aria-labelledby="learn-heading">
          <div className="learn-head">
            <h2 id="learn-heading">What would you like to learn?</h2>
            <p>Choose a feature below to get started with your AI learning journey.</p>
          </div>

          <div className="learn-grid">
            {features.map((feature) => (
              <button
                key={feature.id}
                type="button"
                className="learn-card"
                onClick={() => onSelect(feature.id)}
              >
                <span className="learn-icon">{feature.icon}</span>
                <span className="learn-title">{feature.title}</span>
                <span className="learn-desc">{feature.description}</span>
                <span className="learn-cta">
                  Start now <span className="arrow">→</span>
                </span>
              </button>
            ))}
          </div>
          <div className="english-feature-card">
            <div className="english-feature-visual"><span className="english-spark">✦</span><span className="english-mic">🎙️</span><span className="english-chat-dot">Aa</span></div>
            <div className="english-feature-copy"><span className="eyebrow">SPEAK WITH CONFIDENCE</span><h3>English Communication</h3><p>Practise everyday conversations, interviews, group discussions, and speaking on a topic with supportive AI feedback.</p><div className="english-feature-tags"><span>Conversation practice</span><span>Grammar feedback</span><span>Suggested improvements</span></div></div>
            <button type="button" className="btn primary" onClick={onEnglish}>Start practising <span aria-hidden="true">→</span></button>
          </div>
          <div className="home-extra-links">
            <button type="button" className="home-extra-link" onClick={onAdaptive}><span>✦</span><div><strong>Adaptive Learning</strong><small>Discover what to revise next using your quiz history.</small></div><span>→</span></button>
            <button type="button" className="home-extra-link" onClick={onDocuments}><span>▤</span><div><strong>Study Material Assistant</strong><small>Upload a PDF or text document to study from it.</small></div><span>→</span></button>
          </div>
        </section>
      </main>

      <footer className="footer">Learn • Grow • Achieve</footer>
    </div>
  );
}

export default HomePage;