import { useEffect, useRef, useState } from "react";
import { cleanForSpeech, splitIntoChunks, isSpeechOutputSupported } from "../utils/speech.js";

function SpeakButton({ text }) {
  const supported = isSpeechOutputSupported();
  const [status, setStatus] = useState("idle"); // "idle" | "speaking" | "paused"
  const [message, setMessage] = useState("");
  const runRef = useRef(0); // identifies the current "play". Old plays are ignored.

  // Stop speaking when the text changes or this button leaves the screen
  useEffect(() => {
    setStatus("idle");
    setMessage("");
    return () => {
      runRef.current += 1;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [text, supported]);

  function stop() {
    runRef.current += 1; // makes callbacks from the old play do nothing
    window.speechSynthesis.cancel();
    setStatus("idle");
  }

  function play() {
    setMessage("");
    const chunks = splitIntoChunks(cleanForSpeech(text));
    if (chunks.length === 0) return;

    window.speechSynthesis.cancel();
    const runId = ++runRef.current;
    let index = 0;

    // Speak one piece, and when it ends, speak the next one
    function speakNext() {
      if (runId !== runRef.current) return; // this play was stopped
      if (index >= chunks.length) {
        setStatus("idle");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      index += 1;
      utterance.onend = speakNext;
      utterance.onerror = (event) => {
        if (runId !== runRef.current) return;
        if (event.error === "canceled" || event.error === "interrupted") return;
        setStatus("idle");
        setMessage("Could not play audio in this browser.");
      };
      window.speechSynthesis.speak(utterance);
    }

    setStatus("speaking");
    speakNext();
  }

  function pause() {
    window.speechSynthesis.pause();
    setStatus("paused");
  }

  function resume() {
    window.speechSynthesis.resume();
    setStatus("speaking");
  }

  // Browser without text-to-speech
  if (!supported) {
    return (
      <div className="speak-controls">
        <button type="button" className="speak-btn" disabled title="Not supported in this browser">
          🔊 Listen
        </button>
        <span className="speak-msg info">Listening is not supported in this browser.</span>
      </div>
    );
  }

  return (
    <div className="speak-controls">
      {status === "idle" && (
        <button type="button" className="speak-btn" onClick={play}>
          🔊 Listen
        </button>
      )}
      {status === "speaking" && (
        <>
          <button type="button" className="speak-btn" onClick={pause}>
            ⏸ Pause
          </button>
          <button type="button" className="speak-btn stop" onClick={stop}>
            ⏹ Stop
          </button>
        </>
      )}
      {status === "paused" && (
        <>
          <button type="button" className="speak-btn" onClick={resume}>
            ▶ Resume
          </button>
          <button type="button" className="speak-btn stop" onClick={stop}>
            ⏹ Stop
          </button>
        </>
      )}
      {message && <span className="speak-msg">{message}</span>}
    </div>
  );
}

export default SpeakButton;