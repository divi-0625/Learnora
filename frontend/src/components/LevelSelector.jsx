const LEVELS = [
  { id: "beginner", icon: "🌱", label: "Beginner", hint: "Simple words and basic examples" },
  { id: "intermediate", icon: "📘", label: "Intermediate", hint: "Core ideas with correct technical terms" },
  { id: "advanced", icon: "🚀", label: "Advanced", hint: "In-depth, technical and detailed" },
];

function LevelSelector({ value, onChange, disabled }) {
  const current = LEVELS.find((l) => l.id === value);

  return (
    <div className="level-field">
      <span className="level-label" id="level-label">
        Learning Level
      </span>

      <div className="level-options" role="radiogroup" aria-labelledby="level-label">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            role="radio"
            aria-checked={level.id === value}
            className={level.id === value ? "level-btn active" : "level-btn"}
            onClick={() => onChange(level.id)}
            disabled={disabled}
          >
            <span>{level.icon}</span>
            {level.label}
          </button>
        ))}
      </div>

      {current && <p className="level-hint">{current.hint}</p>}
    </div>
  );
}

export default LevelSelector;