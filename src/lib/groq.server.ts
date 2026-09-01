const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Calls Groq and requires strict JSON output.
 * Throws on transport/parse failure so callers can fall back to a
 * "needs manual review" state instead of silently dropping the record.
 */
export async function groqJson<T>(system: string, user: string): Promise<T> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user.slice(0, 24000) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[groq] request failed", res.status, detail.slice(0, 500));
    throw new Error(`Groq request failed with status ${res.status}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");

  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(content.slice(start, end + 1)) as T;
    }
    throw new Error("Groq returned malformed JSON");
  }
}

/** Extract plain text from a PDF or DOCX buffer. */
export async function extractDocumentText(
  bytes: ArrayBuffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    // Browser build avoids Node-only filesystem paths in the worker runtime.
    const mammoth = await import("mammoth/mammoth.browser.js");
    const runner = (mammoth as unknown as { default?: unknown }).default ?? mammoth;
    const { value } = await (
      runner as { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }
    ).extractRawText({ arrayBuffer: bytes });
    return value.trim();
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return new TextDecoder().decode(bytes).trim();
  }
  throw new Error("Unsupported file type. Upload a PDF or DOCX file.");
}

export const KEYWORD_WEIGHT = 0.4;
export const SEMANTIC_WEIGHT = 0.6;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.\-_/]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bjs\b/g, "javascript")
    .trim();

/** Deterministic overlap of required skills against parsed resume skills. */
export function keywordScore(required: string[], resumeSkills: string[], resumeText: string) {
  if (required.length === 0) return { score: 0, matched: [], missing: [] };
  const haystack = normalize(`${resumeSkills.join(" ")} ${resumeText}`);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of required) {
    const needle = normalize(skill);
    if (needle && haystack.includes(needle)) matched.push(skill);
    else missing.push(skill);
  }
  return {
    score: Math.round((matched.length / required.length) * 100),
    matched,
    missing,
  };
}
