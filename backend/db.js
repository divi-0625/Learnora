import mongoose from "mongoose";

// Is the database connected right now? (1 means connected)
export function isDbReady() {
  return mongoose.connection.readyState === 1;
}

// Text status, used by the health check
export function dbStatus() {
  if (!process.env.MONGODB_URI) return "not configured";
  return isDbReady() ? "connected" : "disconnected";
}

let started = false;

// Connects in the background. If it fails, the rest of the app keeps working.
export function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.startsWith("your_") || uri.includes("<password>")) {
    console.warn(
      "MongoDB: MONGODB_URI is not set in backend/.env. Accounts and history are disabled."
    );
    return;
  }
  if (started) return;
  started = true;

  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected."));
  mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected."));

  attempt(uri);
}

async function attempt(uri) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000, // give up after 8 seconds
      bufferTimeoutMS: 3000,
    });
    console.log("MongoDB connected.");
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.name}: ${err.message}`);
    console.error(
      "Retrying in 15 seconds. The five learning features still work without the database."
    );
    setTimeout(() => attempt(uri), 15000);
  }
}