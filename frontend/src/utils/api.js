// Shared helpers for talking to the backend and remembering the login

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

const TOKEN_KEY = "genai_edu_token";
const USER_KEY = "genai_edu_user";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage not available: the login just won't be remembered */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

// Calls the backend. Returns the JSON data, or throws an Error with a friendly message.
// error.status is the HTTP status when the server answered.
export async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Check that the backend is running on port 5000 and that you are online."
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* the server sent no JSON */
  }

  if (!response.ok) {
    const error = new Error((data && data.error) || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}