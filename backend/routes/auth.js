import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { isDbReady } from "../db.js";
import { authConfigured, signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Used so a login for an unknown email takes about as long as a real one
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Every auth route needs the JWT secret and a working database
router.use((req, res, next) => {
  if (!authConfigured()) {
    return res
      .status(503)
      .json({ error: "Accounts are not configured on the server (JWT_SECRET is missing)." });
  }
  if (!isDbReady()) {
    return res.status(503).json({
      error:
        "The database is not connected right now. You can still use the features as a guest. Please try again shortly.",
    });
  }
  next();
});

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    // Only accept plain strings (this also blocks "NoSQL injection" objects)
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Name, email and password are required." });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 50) {
      return res.status(400).json({ error: "Name must be 2 to 50 characters." });
    }
    if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: "Password must be 8 to 72 characters." });
    }

    if (await User.findOne({ email: cleanEmail })) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash });

    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    console.error(`[${new Date().toISOString()}] Signup error: ${err.message}`);
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    // Same message for "no such user" and "wrong password"
    if (!user || !passwordOk) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Login error: ${err.message}`);
    res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

// GET /api/auth/me  (checks the token and returns the user)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: "Account not found. Please log in again." });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Me error: ${err.message}`);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;