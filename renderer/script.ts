// Step 2 prototype (v2): story articles -> video script whose scenes are split into beats, each with its own visual.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env script.ts   (reads <dir>/story.json, writes <dir>/script.json)
import { readFileSync, writeFileSync } from "node:fs";

const W = process.env.VIDEO_WORKDIR ?? "work";

const articles = JSON.parse(readFileSync(`${W}/story.json`, "utf8")) as Array<{
  title: string; source: string; url: string; published_at: string; headline: string; summary: string; body: string;
}>;

const base = process.env.LLM_BASE_URL!;
const key = process.env.LLM_API_KEY!;
const model = process.env.VIDEO_SCRIPT_MODEL || process.env.LLM_MODEL!;

const material = articles.map((a, i) =>
  `[${i + 1}] ${a.source} — ${a.published_at}\nOriginal headline: ${a.title}\nSummary: ${a.summary}\nExcerpt: ${a.body}`).join("\n\n");

const system = `You are the head writer of an English-language YouTube news channel about AI.
Write a narrated news explainer video from the source material only.

Facts:
- Use ONLY facts stated in the material. Never invent numbers, quotes, dates or names. Attribute claims ("according to The Verge").
- When sources disagree (different figures at different times), say so or use the latest attributed figure. Never mix them silently.
- Allegations stay allegations. Neutral and precise.

Style: spoken English, short sentences, plain words, no markdown, no emojis.

Structure: scenes = hook (15-20 s), 4-5 story scenes (what happened, background, reactions, what comes next), outro.
Every scene is split into 2-4 BEATS. A beat is 1-3 sentences of narration (about 5-12 seconds) with ONE visual.
Total narration 430-500 words. Change the visual type often; never use the same type more than twice in a row.

Visual types (pick what best fits the beat):
- {"type":"article","source":n} show the headline of material article n. Optional "quote": a SHORT exact sentence fragment (max 20 words) copied verbatim from that article's excerpt.
- {"type":"quote","speaker":"Name, role","text":"..."} a direct quote that appears verbatim in the material (inside quotation marks there). Max 25 words.
- {"type":"stat","value":"$105B","label":"what the number is"} one striking number from the material.
- {"type":"chart","title":"...","unit":"$","points":[{"label":"Oct 6","value":239.24},...]} only when the material gives at least 2 dated values of the same measure.
- {"type":"timeline","events":[{"date":"Nov 8","text":"max 8 words"},...]} 3-5 dated events from the material.
- {"type":"photo","query":"..."} a real photo of a named person, company headquarters or product, e.g. "Jensen Huang", "Nvidia headquarters". Searched on Wikimedia Commons.
- {"type":"broll","query":"..."} a generic illustrative image, 2-4 plain words, e.g. "data center servers", "computer chip", "stock market screen".

Return ONLY JSON:
{"title": string (YouTube title, max 70 chars),
 "description": string (2-3 sentences),
 "scenes": [{"kind": "hook"|"story"|"outro", "kicker": string (2-4 words, e.g. "WHAT HAPPENED"),
   "headline": string (max 60 chars),
   "beats": [{"narration": string, "visual": {...}}]}]}`;

const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model, temperature: 0.4, max_tokens: 30000,
    reasoning: { max_tokens: Number(process.env.LLM_REASONING_TOKENS || 6000) },
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: `Material:\n\n${material}` }],
  }),
  signal: AbortSignal.timeout(400_000),
});
const data = await res.json() as any;
if (!res.ok) throw new Error(`LLM ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
const text: string = data.choices[0].message.content; writeFileSync(`${W}/script-raw.txt`, text); if (data.choices[0].finish_reason === "length") throw new Error("output truncated (finish_reason=length)");
const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

// ── Grounding checks: anything shown on screen as a quote or number must be in the material. ──
const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim();
const corpus = norm(articles.map((a) => `${a.title} ${a.summary} ${a.body}`).join(" "));
const numbersIn = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
const corpusNumbers = new Set(numbersIn(articles.map((a) => `${a.title} ${a.summary} ${a.body}`).join(" ")));
const dropped: string[] = [];
for (const scene of json.scenes) {
  for (const beat of scene.beats) {
    const v = beat.visual ?? {};
    if (v.type === "article") {
      const a = articles[v.source - 1];
      if (!a) { beat.visual = { type: "broll", query: "news headlines" }; dropped.push(`article #${v.source} missing`); continue; }
      if (v.quote && !norm(a.body + " " + a.summary).includes(norm(v.quote))) { dropped.push(`article quote: ${v.quote}`); delete v.quote; }
      Object.assign(v, { name: a.source.replace(/\s*·.*$/, ""), headline: a.title, date: a.published_at, url: a.url });
    }
    if (v.type === "quote" && !corpus.includes(norm(v.text))) {
      dropped.push(`quote: ${v.text}`);
      beat.visual = { type: "broll", query: v.speaker ? String(v.speaker).split(",")[0] : "press conference" };
    }
    if (v.type === "stat" && !numbersIn(v.value).every((n) => corpusNumbers.has(n))) {
      dropped.push(`stat: ${v.value}`); beat.visual = { type: "broll", query: "stock market screen" };
    }
    if (v.type === "chart" && !(v.points?.length >= 2 && v.points.every((p: any) => corpusNumbers.has(String(p.value))))) {
      dropped.push(`chart: ${v.title}`); beat.visual = { type: "broll", query: "stock market screen" };
    }
  }
}
json.sources = articles.map((a, i) => ({ n: i + 1, name: a.source.replace(/\s*·.*$/, ""), url: a.url, title: a.title }));
writeFileSync(`${W}/script.json`, JSON.stringify(json, null, 2));
const beats = json.scenes.flatMap((s: any) => s.beats);
const words = beats.reduce((n: number, b: any) => n + b.narration.split(/\s+/).length, 0);
const types = beats.map((b: any) => b.visual.type).join(" ");
console.log(`title: ${json.title}\nscenes: ${json.scenes.length}, beats: ${beats.length}, words: ${words}\nvisuals: ${types}\ndropped (not grounded): ${dropped.length ? dropped.join(" | ") : "none"}\ncost: $${data.usage?.cost}`);
console.log(`RESULT ${JSON.stringify({ cost: Number(data.usage?.cost ?? 0), title: json.title, words, beats: beats.length, dropped: dropped.length })}`);
