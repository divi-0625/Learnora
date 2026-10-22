// Visual learning: asks Gemini for a simple diagram as structured data,
// then checks it carefully before it is sent to the browser.
// The browser draws it with React and CSS (no HTML from the AI is ever inserted).

export const DIAGRAM_TYPES = ["flowchart", "conceptmap"];

const MAX_TITLE = 100;
const MAX_LABEL = 60;
const MAX_DETAIL = 160;
const MAX_REASON = 200;

export const VISUAL_SYSTEM_INSTRUCTION =
  "You turn a study explanation into a simple diagram for a student. " +
  "Use ONLY the information in the text you are given. Choose exactly ONE diagram type: " +
  "'flowchart' for a process, algorithm, sequence or life cycle (3 to 8 ordered steps), or " +
  "'conceptmap' for a concept with related parts, types or ideas (one central idea with 3 to 6 branches). " +
  "For a flowchart, put the steps in order in 'items' and leave 'center' empty. " +
  "For a concept map, put the central idea in 'center' and the branches in 'items'. " +
  "Every label must be short (maximum 6 words) and every detail must be one short sentence. " +
  "If the text is not suitable for a diagram (for example a greeting, an opinion, simple arithmetic or a single fact), " +
  "set 'suitable' to false, explain why in one short sentence in 'reason', set 'diagramType' to 'none' and leave the other fields empty. " +
  "Write plain text only. Do not use markdown.";

// "Type" comes from the @google/genai package (passed in from server.js)
export function getVisualSchema(Type) {
  return {
    type: Type.OBJECT,
    properties: {
      suitable: { type: Type.BOOLEAN, description: "true only if the text suits a diagram" },
      reason: { type: Type.STRING, description: "why no diagram is possible (empty when suitable)" },
      diagramType: { type: Type.STRING, description: "flowchart, conceptmap or none" },
      title: { type: Type.STRING, description: "short diagram title" },
      center: { type: Type.STRING, description: "central idea (concept map only)" },
      items: {
        type: Type.ARRAY,
        description: "ordered steps (flowchart) or branches (concept map)",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            detail: { type: Type.STRING },
          },
          required: ["label", "detail"],
        },
      },
    },
    required: ["suitable", "reason", "diagramType", "title", "center", "items"],
  };
}

export function buildVisualPrompt({ context, topic }) {
  let prompt = "";
  if (topic) prompt += `Topic or question the student asked:\n"""\n${topic}\n"""\n\n`;
  prompt += `Study explanation:\n"""\n${context}\n"""\n\nCreate the diagram for this explanation.`;
  return prompt;
}

// Removes control characters, extra spaces and very long text
function clean(value, max) {
  if (typeof value !== "string") return "";
  let text = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > max) text = text.slice(0, max - 1).trimEnd() + "…";
  return text;
}

const UNREADABLE = "The AI returned the diagram in an unreadable format. Please try again.";
const INCOMPLETE = "The AI returned an incomplete diagram. Please try again.";

// Returns one of:
//   { ok: false, message }                 -> the AI response was unusable
//   { ok: true, suitable: false, reason }  -> the topic does not suit a diagram
//   { ok: true, suitable: true, diagram }  -> a checked diagram, safe to draw
export function validateDiagram(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/```json|```/g, "").trim());
  } catch {
    return { ok: false, message: UNREADABLE };
  }

  if (!data || typeof data !== "object" || typeof data.suitable !== "boolean") {
    return { ok: false, message: INCOMPLETE };
  }

  if (data.suitable === false) {
    return {
      ok: true,
      suitable: false,
      reason: clean(data.reason, MAX_REASON) || "This topic is not suitable for a diagram.",
    };
  }

  const type = typeof data.diagramType === "string" ? data.diagramType.trim().toLowerCase() : "";
  if (!DIAGRAM_TYPES.includes(type) || !Array.isArray(data.items)) {
    return { ok: false, message: INCOMPLETE };
  }

  const items = [];
  for (const raw of data.items) {
    const label = clean(raw?.label, MAX_LABEL);
    if (!label) return { ok: false, message: INCOMPLETE };
    items.push({ label, detail: clean(raw?.detail, MAX_DETAIL) });
  }

  const [min, max] = type === "flowchart" ? [3, 8] : [3, 6];
  if (items.length < min || items.length > max) {
    return { ok: false, message: INCOMPLETE };
  }

  const title = clean(data.title, MAX_TITLE);
  if (!title) return { ok: false, message: INCOMPLETE };

  const diagram = { type, title, items };
  if (type === "conceptmap") {
    const center = clean(data.center, MAX_LABEL);
    if (!center) return { ok: false, message: INCOMPLETE };
    diagram.center = center;
  }
  return { ok: true, suitable: true, diagram };
}