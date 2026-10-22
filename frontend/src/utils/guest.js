// Remembers that the visitor chose "Continue as Guest".
// This is ONLY a screen preference. It is not a login, it holds no secret,
// and it never gives access to saved data (the server still needs a valid login token).

const GUEST_KEY = "genai_edu_guest";

export function hasGuestPreference() {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuestPreference() {
  try {
    localStorage.setItem(GUEST_KEY, "1");
  } catch {
    /* storage not available: the choice just won't be remembered */
  }
}

export function clearGuestPreference() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}