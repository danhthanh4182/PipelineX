// Shared by the renderer's steps: the work directory, the story's reports, one LLM call, and text checks.
import { existsSync, readFileSync } from "node:fs";

export const W = process.env.VIDEO_WORKDIR ?? "work";

export type Article = { title: string; source: string; url: string; published_at: string; headline: string; summary: string; body: string; background?: boolean };

/** The story's reports, then the background pages step "background" found (if any), numbered together. */
export const readArticles = (): Article[] => [
  ...JSON.parse(readFileSync(`${W}/story.json`, "utf8")),
  ...(existsSync(`${W}/background.json`) ? JSON.parse(readFileSync(`${W}/background.json`, "utf8")) : []),
];
export const outlet = (a: Article) => a.source.replace(/\s*·.*$/, "");

/**
 * The providers to try, in order (VIDEO_PROVIDERS, default "nvidia,openrouter-free,orcarouter,openrouter"): each is <NAME>_BASE_URL, <NAME>_API_KEY
 * and <NAME>_MODEL, the last defaulting to Nemotron's id there. Unconfigured ones are skipped; with none configured,
 * the app's LLM_* is used. A provider that throttles, fails, times out or refuses the key hands the call to the next.
 */
const DEFAULT_MODEL: Record<string, string> = {
  nvidia: "nvidia/nemotron-3.5-super-vl-120b-a12b", openrouter: "nvidia/nemotron-3.5-super-vl", orcarouter: "deepseek/deepseek-v4.1-flash-free",
};
/** Providers whose default model cannot read images: calls with an image skip them. */
const TEXT_ONLY = new Set(["orcarouter"]);
export function providers() {
  const list = (process.env.VIDEO_PROVIDERS || "nvidia,openrouter-free,orcarouter,openrouter").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean).flatMap((name) => {
    // "<provider>-free" is that provider's free variant of the same model (OpenRouter's ":free" ids).
    const base = name.replace(/-free$/, "");
    const env = (k: string) => process.env[`${base.toUpperCase()}_${k}`];
    const model = (env("MODEL") || DEFAULT_MODEL[base]) + (name.endsWith("-free") ? ":free" : "");
    return env("BASE_URL") && env("API_KEY") && model ? [{ name, base: env("BASE_URL")!, key: env("API_KEY")!, model, vision: !TEXT_ONLY.has(base) }] : [];
  });
  if (list.length) return list;
  return [{ name: "llm", base: process.env.LLM_BASE_URL ?? "", key: process.env.LLM_API_KEY ?? "", model: process.env.VIDEO_SCRIPT_MODEL || process.env.LLM_MODEL || "", vision: true }];
}

type Message = { role: "system" | "user"; content: string | Array<Record<string, unknown>> };

/** One chat call through the provider chain; returns the answer, its cost (0 where the provider reports none) and who answered. */
export async function chat(messages: Message[], opts: { maxTokens?: number; temperature?: number; json?: boolean; reasoning?: number; timeoutMs?: number; accept?: (text: string) => void } = {}) {
  const errors: string[] = [];
  const image = messages.some((m) => Array.isArray(m.content) && m.content.some((part) => part.type === "image_url"));
  for (const p of providers().filter((p) => !image || p.vision)) {
    try {
      const res = await fetch(`${p.base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model, temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 30000, messages,
          ...(opts.json === false ? {} : { response_format: { type: "json_object" } }),
          // OpenRouter's reasoning budget; other providers reason within max_tokens.
          ...(p.name.startsWith("openrouter") && opts.reasoning !== 0 ? { reasoning: { max_tokens: opts.reasoning ?? Number(process.env.LLM_REASONING_TOKENS || 6000) } } : {}),
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 600_000),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length") throw new Error("output truncated (finish_reason=length)");
      const text: string = choice?.message?.content ?? "";
      if (!text.trim()) throw new Error("empty answer");
      // An answer that does not do the job (empty fact sheet, no scenes…) is a failure of this provider too.
      opts.accept?.(text);
      return { text, cost: Number(data.usage?.cost ?? 0), provider: p.name };
    } catch (error) {
      errors.push(`${p.name}: ${(error as Error).message}`);
      console.error(`provider ${p.name} failed, ${errors.length < providers().length ? "trying the next" : "no more providers"}: ${(error as Error).message.slice(0, 200)}`);
    }
  }
  throw new Error(`every provider failed: ${errors.join(" | ").slice(0, 900)}`);
}

/** One chat call that must answer JSON; returns the parsed object, the raw text, its cost and the provider. */
const parseJson = (text: string) => JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

/**
 * One chat call that must answer JSON; `check` throws when the parsed answer is not usable, which hands the call to
 * the next provider. Returns the parsed object, the raw text, its cost and the provider.
 */
export async function chatJson(system: string, user: string, opts: { maxTokens?: number; temperature?: number; check?: (json: any) => void } = {}) {
  const { text, cost, provider } = await chat([{ role: "system", content: system }, { role: "user", content: user }], {
    ...opts, accept: (t) => { const json = parseJson(t); opts.check?.(json); },
  });
  return { json: parseJson(text), text, cost, provider };
}

/** Lower-case, quotes and runs of spaces removed: for "does this text appear verbatim" checks. */
export const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’'`]/g, "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
/** Only the words: for verbatim checks that ignore punctuation and spacing ("justice," == "justice."). */
export const words = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}%$]+/gu, " ").trim();

/** The numbers in a text, without thousands separators ("115,000" -> "115000"). */
export const numbersIn = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));

/** The reports as numbered material for a prompt, each body cut to `chars`. */
export const materialOf = (articles: Article[], chars: number) => articles.map((a, i) =>
  `[${i + 1}] ${outlet(a)}${a.background ? " — BACKGROUND (earlier/official context, not a report on this story)" : ""} — ${a.published_at}\nHeadline: ${a.title}\nSummary: ${a.summary}\nText: ${a.body.slice(0, chars)}`).join("\n\n");

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
