// Shared by the renderer's steps: the work directory, the story's reports, one LLM call, and text checks.
import { readFileSync } from "node:fs";

export const W = process.env.VIDEO_WORKDIR ?? "work";

export type Article = { title: string; source: string; url: string; published_at: string; headline: string; summary: string; body: string };

export const readArticles = (): Article[] => JSON.parse(readFileSync(`${W}/story.json`, "utf8"));
export const outlet = (a: Article) => a.source.replace(/\s*·.*$/, "");

/** One chat call that must answer JSON; returns the parsed object, the raw text and its cost. */
export async function chatJson(system: string, user: string, opts: { model?: string; maxTokens?: number; temperature?: number } = {}) {
  const base = (process.env.LLM_BASE_URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: opts.model || process.env.VIDEO_SCRIPT_MODEL || process.env.LLM_MODEL, temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 30000, reasoning: { max_tokens: Number(process.env.LLM_REASONING_TOKENS || 6000) },
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(600_000),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`LLM ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  const text: string = data.choices?.[0]?.message?.content ?? "";
  if (data.choices?.[0]?.finish_reason === "length") throw new Error("LLM output truncated (finish_reason=length)");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { json, text, cost: Number(data.usage?.cost ?? 0) };
}

/** Lower-case, quotes and runs of spaces removed: for "does this text appear verbatim" checks. */
export const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’'`]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
/** Only the words: for verbatim checks that ignore punctuation and spacing ("justice," == "justice."). */
export const words = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}%$]+/gu, " ").trim();

/** The numbers in a text, without thousands separators ("115,000" -> "115000"). */
export const numbersIn = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));

/** The reports as numbered material for a prompt, each body cut to `chars`. */
export const materialOf = (articles: Article[], chars: number) => articles.map((a, i) =>
  `[${i + 1}] ${outlet(a)} — ${a.published_at}\nHeadline: ${a.title}\nSummary: ${a.summary}\nText: ${a.body.slice(0, chars)}`).join("\n\n");

/** Sentence ends: [.!?] then a space and a capital, but not "U.S. officials", "Mr. Huang", "Inc. said" (decimals have no space). */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?]["”’)]*\s+(?=["“(]?[A-Z0-9])/g)) {
    const before = text.slice(start, m.index! + 1);
    if (/(\b[A-Z]\.|\b(?:Mr|Mrs|Ms|Dr|Jr|Sr|St|Inc|Corp|Co|Ltd|vs|No|Gov|Sen|Rep|Gen|Lt|Col)\.)$/.test(before)) continue;
    out.push(text.slice(start, m.index! + m[0].length).trim());
    start = m.index! + m[0].length;
  }
  if (text.slice(start).trim()) out.push(text.slice(start).trim());
  return out;
}
