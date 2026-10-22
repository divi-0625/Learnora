import LevelSelector from "./LevelSelector.jsx";
import VoiceInputButton from "./VoiceInputButton.jsx";

function InputForm({
  feature,
  values,
  onChange,
  onSubmit,
  onClear,
  loading,
  level,
  onLevelChange,
  user,
  useWeakTopics,
  onUseWeakTopicsChange,
}) {
  return (
    <form onSubmit={onSubmit} className="form">
      {feature.fields.map((field) => {
        const value = values[field.name] || "";

        return (
          <div className="field" key={field.name}>
            <div className="field-head">
              <label htmlFor={field.name}>
                {field.label}
                {field.optional && <span className="optional-tag">optional</span>}
              </label>

              {/* Microphone button (only for fields marked voice: true in features.js) */}
              {field.voice && (
                <VoiceInputButton
                  value={value}
                  onChange={(text) => onChange(field.name, text)}
                  maxLength={field.maxLength}
                  disabled={loading}
                />
              )}
            </div>

            {/* Conditional rendering: textarea or single-line input */}
            {field.type === "textarea" ? (
              <>
                <textarea
                  id={field.name}
                  rows={field.name === "text" ? 9 : 4}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  value={value}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  disabled={loading}
                />
                <span className="counter">
                  {value.length} / {field.maxLength}
                </span>
              </>
            ) : (
              <input
                id={field.name}
                type="text"
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
                disabled={loading}
              />
            )}
          </div>
        );
      })}

      {/* Learning level (only for features that use it) */}
      {feature.usesLevel && (
        <LevelSelector value={level} onChange={onLevelChange} disabled={loading} />
      )}

      {/* Personalisation with weak topics (study plan only) */}
      {feature.supportsWeakTopics && (
        <div className="check-field">
          {user ? (
            <label className="check-label">
              <input
                type="checkbox"
                checked={useWeakTopics}
                onChange={(e) => onUseWeakTopicsChange(e.target.checked)}
                disabled={loading}
              />
              <span>
                🎯 Focus on my weak topics <small>(uses your past quiz results)</small>
              </span>
            </label>
          ) : (
            <p className="check-hint">🔒 Log in to personalize your plan with your quiz results.</p>
          )}
        </div>
      )}

      <div className="buttons">
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Please wait..." : `✨ ${feature.buttonText}`}
        </button>
        <button type="button" className="btn secondary" onClick={onClear} disabled={loading}>
          Clear
        </button>
      </div>
    </form>
  );
}

export default InputForm;