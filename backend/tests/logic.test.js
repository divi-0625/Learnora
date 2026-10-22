import test from "node:test";
import assert from "node:assert/strict";
import { validateStart, validateRespond, computeStats } from "../english.js";
import { validateDocumentRequest } from "../documentTools.js";
import { stepLevel, analyzeTopic, buildAdaptiveOverview } from "../adaptiveLogic.js";
import { classifyGeminiError, createAiService } from "../aiService.js";

test("English practice accepts valid modes and rejects unknown modes", () => {
  assert.equal(validateStart({ mode: "everyday" }).ok, true);
  assert.equal(validateStart({ mode: "topic", durationSeconds: 60 }).ok, true);
  assert.equal(validateStart({ mode: "unknown" }).ok, false);
});

test("English response validation checks session ID and minimum answer length", () => {
  assert.equal(validateRespond({ mode: "everyday", sessionId: "a".repeat(24), response: "This is a useful answer", turns: [] }).ok, true);
  assert.equal(validateRespond({ mode: "everyday", sessionId: "bad", response: "This is a useful answer" }).ok, false);
  assert.equal(validateRespond({ mode: "everyday", sessionId: "a".repeat(24), response: "yes" }).ok, false);
});

test("text statistics count words", () => {
  assert.equal(computeStats("I think this is a clear answer.", { elapsedSeconds: 10 }).wordCount, 7);
});

test("document validator accepts text notes and rejects unsupported files", () => {
  const valid = validateDocumentRequest({
    action: "ask", fileName: "notes.txt", mimeType: "text/plain",
    text: "This is a long enough sample study note with more than thirty characters.",
    question: "What is this about?",
  });
  assert.equal(valid.ok, true);
  assert.equal(validateDocumentRequest({ action: "summarize", fileName: "virus.exe", text: "no" }).ok, false);
});

test("adaptive learning levels stay within their range", () => {
  assert.equal(stepLevel("beginner", -1), "beginner");
  assert.equal(stepLevel("intermediate", 1), "advanced");
  assert.equal(analyzeTopic([]), null);
  assert.equal(buildAdaptiveOverview([]).totalAttempts, 0);
});

test("Gemini error classification only marks eligible failures for fallback", () => {
  assert.equal(classifyGeminiError({ status: 429, message: "quota" }), "quota");
  assert.equal(classifyGeminiError({ status: 503, message: "unavailable" }), "temporary");
  assert.equal(classifyGeminiError({ status: 400, message: "bad input" }), "other");
});

test("AI service uses the mocked OpenAI fallback after a Gemini quota error", async () => {
  const logs = [];
  const service = createAiService({
    gemini: { models: { generateContent: async () => { throw Object.assign(new Error("quota"), { status: 429 }); } } },
    model: "test-model",
    env: { OPENAI_API_KEY: "fake-test-key", OPENAI_MODEL: "test-model" },
    fetchFn: async () => ({ ok: true, json: async () => ({ output_text: "backup answer" }) }),
    logger: { log: (message) => logs.push(message) },
  });
  const result = await service.generate({ contents: "test" });
  assert.equal(result.text, "backup answer");
  assert.equal(result.provider, "openai");
  assert.ok(logs.some((line) => line.includes("used as backup")));
});
