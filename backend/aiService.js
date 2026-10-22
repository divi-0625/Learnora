// ONE place for every AI request.
// Gemini is always tried first. OpenAI is only a backup, used when Gemini hits a real
// quota / rate limit or has a temporary server problem. Exactly one backup attempt, never a loop.
// All keys stay here on the server. Logs contain only the provider and an error category.

const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"; // change with OPENAI_MODEL in backend/.env
const OPENAI_TIMEOUT_MS = 60000;

// "quota"     -> Gemini says we are over the limit (HTTP 429 / RESOURCE_EXHAUSTED)
// "temporary" -> Gemini is overloaded or unreachable right now (HTTP 5xx, network problem)
// "other"     -> anything else (bad input, bad key, model not found, programming errors): NO fallback
export function classifyGeminiError(err) {
  const status = typeof err?.status === "number" ? err.status : typeof err?.code === "number" ? err.code : null;
  const text = `${err?.message || ""} ${err?.cause?.code || ""}`;

  if ([400, 401, 403, 404, 413, 422].includes(status)) return "other";
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(text)) return "quota";
  if ([500, 502, 503, 504].includes(status) || /\bUNAVAILABLE\b|overloaded|DEADLINE_EXCEEDED/i.test(text)) return "temporary";
  if (status === null && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(text)) return "temporary";
  return "other";
}

export class AllProvidersFailedError extends Error {
  constructor(categories) {
    super("Gemini and the backup provider both failed");
    this.name = "AllProvidersFailedError";
    this.categories = categories; // { gemini: "...", openai: "..." }
  }
}

// The Gemini schema uses upper-case types (OBJECT, STRING). OpenAI's JSON mode wants a normal JSON Schema.
export function toJsonSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (schema && typeof schema === "object") {
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
      out[key] = key === "type" && typeof value === "string" ? value.toLowerCase() : toJsonSchema(value);
    }
    return out;
  }
  return schema;
}

// Gemini "parts" -> OpenAI Responses API content items
function toOpenAiContent(contents) {
  if (typeof contents === "string") return [{ type: "input_text", text: contents }];
  const parts = Array.isArray(contents) ? contents : [contents];
  return parts.map((part) => {
    if (typeof part === "string") return { type: "input_text", text: part };
    if (part?.inlineData?.data) {
      return {
        type: "input_file",
        filename: "document.pdf",
        file_data: `data:${part.inlineData.mimeType || "application/pdf"};base64,${part.inlineData.data}`,
      };
    }
    return { type: "input_text", text: String(part?.text ?? "") };
  });
}

function openAiErrorCategory(status) {
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 404 || status === 422) return "bad_request";
  if (status >= 500) return "server";
  return "unknown";
}

export function createAiService({
  gemini,
  model,
  env = process.env,
  fetchFn = globalThis.fetch,
  logger = console,
} = {}) {
  const log = (provider, outcome) => logger.log(`[${new Date().toISOString()}] [AI] provider=${provider} outcome=${outcome}`);

  async function callGemini({ systemInstruction, contents, generationConfig }) {
    // Controlled test switch (ignored in production): pretend Gemini failed, without using any real quota
    const forced = env.AI_TEST_FORCE_GEMINI_ERROR;
    if (forced && env.NODE_ENV !== "production") {
      log("gemini", `simulated-error:${forced}`);
      throw Object.assign(new Error("Simulated Gemini error (test mode)"), { status: Number(forced) || 500 });
    }
    const response = await gemini.models.generateContent({
      model,
      contents,
      config: { systemInstruction, ...(generationConfig || {}) },
    });
    return response.text;
  }

  async function callOpenAi({ systemInstruction, contents, generationConfig }) {
    const apiKey = env.OPENAI_API_KEY;
    const wantsJson = generationConfig?.responseMimeType === "application/json";

    let instructions = systemInstruction || "";
    if (wantsJson) {
      instructions +=
        "\n\nRespond with ONLY one valid JSON object (no markdown, no code fences)." +
        (generationConfig.responseSchema
          ? ` It must follow this JSON Schema: ${JSON.stringify(toJsonSchema(generationConfig.responseSchema))}`
          : "");
    }

    const body = {
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      instructions,
      input: [{ role: "user", content: toOpenAiContent(contents) }],
      store: false, // do not keep the request on OpenAI's side
    };
    if (wantsJson) body.text = { format: { type: "json_object" } };
    if (env.OPENAI_REASONING_EFFORT) body.reasoning = { effort: env.OPENAI_REASONING_EFFORT };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    let res;
    try {
      res = await fetchFn(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw Object.assign(new Error("OpenAI request failed"), { category: err?.name === "AbortError" ? "timeout" : "network" });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw Object.assign(new Error(`OpenAI returned HTTP ${res.status}`), { category: openAiErrorCategory(res.status) });
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw Object.assign(new Error("OpenAI sent unreadable data"), { category: "bad_response" });
    }
    if (typeof data.output_text === "string" && data.output_text) return data.output_text;
    const text = (data.output || [])
      .filter((item) => item?.type === "message")
      .flatMap((item) => item.content || [])
      .filter((c) => c?.type === "output_text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("");
    return text;
  }

  // Same shape as the old direct Gemini call. Returns { text, provider }.
  async function generate(request) {
    try {
      const text = await callGemini(request);
      log("gemini", "ok");
      return { text, provider: "gemini" };
    } catch (err) {
      const category = classifyGeminiError(err);
      if (category === "other") {
        log("gemini", "error:other (no fallback)");
        throw err;
      }
      log("gemini", `error:${category}`);

      if (!env.OPENAI_API_KEY) {
        log("openai", "not-configured (no fallback)");
        throw err; // the original error gives the usual friendly message
      }

      try {
        const text = await callOpenAi(request);
        log("openai", "ok (used as backup)");
        return { text, provider: "openai" };
      } catch (backupErr) {
        const backupCategory = backupErr?.category || "unknown";
        log("openai", `error:${backupCategory}`);
        throw new AllProvidersFailedError({ gemini: category, openai: backupCategory });
      }
    }
  }

  return { generate };
}
