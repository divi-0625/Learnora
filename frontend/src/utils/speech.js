// Helper functions for the "Listen" feature (voice output)

// Is text-to-speech available in this browser?
export function isSpeechOutputSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

// The AI text uses "- " bullets and CAPITAL headings. Make it sound natural:
// remove the bullet signs and add a full stop after lines so there is a short pause.
export function cleanForSpeech(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s+/, "").trim())
    .filter((line) => line !== "")
    .map((line) => (/[.!?:;]$/.test(line) ? line : line + "."))
    .join(" ");
}

// Some browsers stop speaking very long text. So we speak it in small pieces.
export function splitIntoChunks(text, maxLength = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [];
  const chunks = [];
  let current = "";

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if ((current + " " + sentence).trim().length <= maxLength) {
      current = (current + " " + sentence).trim();
      continue;
    }

    if (current) chunks.push(current);
    current = "";

    if (sentence.length > maxLength) {
      // A very long sentence: cut it on spaces
      let part = "";
      for (const word of sentence.split(" ")) {
        if ((part + " " + word).trim().length > maxLength) {
          if (part) chunks.push(part);
          part = word;
        } else {
          part = (part + " " + word).trim();
        }
      }
      current = part;
    } else {
      current = sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}