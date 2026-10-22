// Left sidebar shown on the feature pages, the progress page and the history page
function FeatureTabs({
  features,
  selectedId,
  activePage,
  user,
  onSelect,
  onHome,
  onDashboard,
  onHistory,
  onLogin,
  onLogout,
  onEnglish,
  onAdaptive,
  onDocuments,
  disabled,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-logo">🎓</span>
        <span className="brand-name">Learnora</span>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className="nav-item"
          onClick={onHome}
          disabled={disabled}
        >
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        {features.map((feature) => {
          const isActive = activePage === "feature" && feature.id === selectedId;
          return (
            <button
              key={feature.id}
              type="button"
              className={
                isActive
                  ? `nav-item theme-${feature.id} active`
                  : `nav-item theme-${feature.id}`
              }
              onClick={() => onSelect(feature.id)}
              disabled={disabled}
            >
              <span className="nav-icon">{feature.icon}</span>
              <span>{feature.title}</span>
            </button>
          );
        })}

        <button type="button" className={activePage === "english" ? "nav-item active" : "nav-item"} onClick={onEnglish} disabled={disabled}>
          <span className="nav-icon">🎙️</span><span>English Communication</span>
        </button>
        <button type="button" className={activePage === "adaptive" ? "nav-item active" : "nav-item"} onClick={onAdaptive} disabled={disabled}>
          <span className="nav-icon">✦</span><span>Adaptive Learning</span>
        </button>
        <button type="button" className={activePage === "document" ? "nav-item active" : "nav-item"} onClick={onDocuments} disabled={disabled}>
          <span className="nav-icon">📄</span><span>Study Materials</span>
        </button>

        <button
          type="button"
          className={activePage === "dashboard" ? "nav-item active" : "nav-item"}
          onClick={onDashboard}
          disabled={disabled}
        >
          <span className="nav-icon">📈</span>
          <span>Progress</span>
        </button>

        <button
          type="button"
          className={activePage === "history" ? "nav-item active" : "nav-item"}
          onClick={onHistory}
          disabled={disabled}
        >
          <span className="nav-icon">📚</span>
          <span>My History</span>
        </button>
      </nav>

      <div className="sidebar-user">
        {user ? (
          <>
            <span className="sidebar-user-name">👤 {user.name}</span>
            <button type="button" className="sidebar-link" onClick={onLogout} disabled={disabled}>
              Logout
            </button>
          </>
        ) : (
          <button type="button" className="sidebar-link" onClick={onLogin} disabled={disabled}>
            🔐 Login / Sign up
          </button>
        )}
      </div>

      <div className="sidebar-note">📚 Keep learning, keep growing!</div>
    </aside>
  );
}

export default FeatureTabs;