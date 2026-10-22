import { useEffect, useRef, useState } from "react";

// Language the microphone listens for. Use "en-US" if your accent is recognised better.
const VOICE_LANG = "en-IN";

// Chrome and Edge provide this API. Firefox and Safari do not reliably support it.
function getRecognitionClass() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const ERROR_MESSAGES = {
  "not-allowed":
    "Microphone access is blocked. Allow the microphone in the browser address bar and try again.",
  "service-not-allowed":
    "Microphone access is blocked. Allow the microphone in the browser address bar and try again.",
  "no-speech": "No speech was detected. Click the mic and try again.",
  "audio-capture": "No microphone was found. Please check your microphone.",
  network: "Voice input needs an internet connection. Please check your network.",
};

function VoiceInputButton({ value, onChange, maxLength, disabled }) {
  const SpeechRecognition = getRecognitionClass();
  const supported = Boolean(SpeechRecognition);

  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null); // the active recognition object
  const baseTextRef = useRef(""); // text that was already in the field before speaking

  // Stop the microphone if this component disappears
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  // Stop listening if the form gets disabled (for example while loading)
  useEffect(() => {
    if (disabled && recognitionRef.current) recognitionRef.current.stop();
  }, [disabled]);

  function startListening() {
    setMessage("");

    const recognition = new SpeechRecognition();
    recognition.lang = VOICE_LANG;
    recognition.continuous = false; // stops after the student pauses
    recognition.interimResults = true; // show words while speaking

    baseTextRef.current = value.trim();

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i++) {
        spoken += event.results[i][0].transcript;
      }
      const base = baseTextRef.current;
      const combined = (base ? base + " " : "") + spoken.trim();
      onChange(maxLength ? combined.slice(0, maxLength) : combined);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return; // we stopped it on purpose
      setMessage(
        ERROR_MESSAGES[event.error] ||
          "Voice input failed. Please try again or type your input."
      );
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMessage("Could not start the microphone. Please try again.");
    }
  }

  function handleClick() {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop(); // finish and keep what was heard
    } else {
      startListening();
    }
  }

  // Browser without speech recognition: show a disabled button and a short note
  if (!supported) {
    return (
      <>
        <button
          type="button"
          className="mic-btn"
          disabled
          title="Voice input works in Chrome or Edge. You can still type."
        >
          🎤 Voice
        </button>
        <span className="mic-msg info">Voice input needs Chrome or Edge. You can still type.</span>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={listening ? "mic-btn listening" : "mic-btn"}
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={listening}
      >
        {listening ? "⏹ Listening... click to stop" : "🎤 Speak"}
      </button>
      {message && <span className="mic-msg">{message}</span>}
    </>
  );
}

export default VoiceInputButton;