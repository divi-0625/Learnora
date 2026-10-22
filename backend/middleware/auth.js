import jwt from "jsonwebtoken";

// Is the JWT secret set properly?
export function authConfigured() {
  const secret = process.env.JWT_SECRET;
  return Boolean(secret && secret.length >= 32 && !secret.startsWith("your_"));
}

// Creates a signed login token that contains the user's id
export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    algorithm: "HS256",
  });
}

// Reads "Authorization: Bearer <token>" from the request
function readToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

// For routes that also work for guests. Sets req.userId when a valid token is sent.
export function optionalAuth(req, res, next) {
  req.userId = null;
  req.tokenProblem = false;

  const token = readToken(req);
  if (!token || !authConfigured()) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.userId = payload.sub;
  } catch {
    req.tokenProblem = true; // expired or invalid token: treat as a guest
  }
  next();
}

// For routes that need a logged-in user
export function requireAuth(req, res, next) {
  if (!authConfigured()) {
    return res.status(503).json({ error: "Accounts are not configured on the server." });
  }
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Please log in." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}