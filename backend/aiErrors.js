// Shared error types and the friendly messages shown to students.

export class ValidationError extends Error {} // the student sent bad input
export class BadResponseError extends Error {} // the AI sent something unusable

// Turns any error into a safe, friendly message (never leaks keys or technical details)
export function toUserError(err) {
  if (err instanceof ValidationError) return { status: 400, message: err.message };
  if (err instanceof BadResponseError) return { status: 502, message: err.message };

  // Gemini and the backup provider both failed
  if (err?.name === "AllProvidersFailedError") {
    const bothQuota = err.categories?.gemini === "quota" && err.categories?.openai === "quota";
    if (bothQuota) {
      return { status: 429, message: "Too many requests or quota reached. Please wait a bit and try again." };
    }
    return { status: 503, message: "The AI service is busy right now. Please try again in a few minutes." };
  }

  const status = err?.status; // the Gemini SDK puts the HTTP status here
  const msg = String(err?.message || "");

  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg) || status === 401 || status === 403) {
    return { status: 500, message: "Server API key problem. Please contact the administrator." };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return { status: 429, message: "Too many requests or quota reached. Please wait a bit and try again." };
  }
  if (status === 404) {
    return { status: 500, message: "The configured AI model was not found. Check GEMINI_MODEL in the backend." };
  }
  if (status === 503 || status === 500) {
    return { status: 503, message: "The AI service is busy or unavailable. Please try again shortly." };
  }
  return { status: 500, message: "Something went wrong on the server. Please try again." };
}
