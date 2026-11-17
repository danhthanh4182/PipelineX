// Step "dossier": the story's reports (full text) -> a fact sheet the script is written from.
// Every fact names its sources; quotes must appear verbatim and numbers must appear in the reports, or they are dropped.
// Where reports disagree, the dossier keeps each version with its source instead of picking one.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env dossier.ts   (reads <dir>/story.json, writes <dir>/dossier.json)
import { writeFileSync } from "node:fs";
import { chatJson, materialOf, numbersIn, outlet, readArticles, W, words } from "./lib.ts";

const CHARS = Number(process.env.VIDEO_DOSSIER_CHARS || 12000);
const articles = readArticles();

const system = `You are a research editor preparing a fact sheet for a news video about AI. Work ONLY from the numbered reports.

Rules:
- Every fact is one atomic, checkable statement, attributed ("according to X", "X said") when it is a claim rather than an established event.
- Every fact lists the report numbers that state it. Never list a report that does not state it.
- Allegations stay allegations. Do not merge different figures: if reports give different numbers, dates or descriptions for the same thing, put each version in "conflicts" with its sources.
- Quotes: copy the exact words from the report text, only text that appears inside quotation marks there. Max 40 words.
- Numbers: copy the figure as written in the report.
- "background": context the reports themselves give (earlier events, who someone is). No outside knowledge.
- Items marked BACKGROUND are earlier or official pages found for context: use them for background facts (kind "background"), never as reports of this story's new events.
- "open_questions": what the reports say is unknown or not yet decided.

Return ONLY JSON:
{"summary": string (3-4 neutral sentences),
 "angle": string (one sentence: why this matters to people following AI),
 "facts": [{"id": "F1", "text": string, "kind": "event"|"statement"|"number"|"allegation"|"background"|"reaction"|"next", "date": string|null, "sources": [n]}],
 "quotes": [{"speaker": "Name, role", "text": string, "source": n}],
 "numbers": [{"value": string, "what": string, "source": n}],
 "timeline": [{"date": string, "event": string (max 12 words), "sources": [n]}],
 "conflicts": [{"topic": string, "versions": [{"claim": string, "sources": [n]}]}],
 "open_questions": [string]}
Aim for 25-50 facts (never more than 50), ordered from most to least important. Keep each fact under 30 words.`;

const { json, text, cost, provider } = await chatJson(system, `Reports:\n\n${materialOf(articles, CHARS)}`, {
  maxTokens: 60000,
  check: (j) => { if (!Array.isArray(j.facts) || j.facts.length < 8) throw new Error(`fact sheet too thin (${Array.isArray(j.facts) ? j.facts.length : "no"} facts)`); },
});
writeFileSync(`${W}/dossier-raw.txt`, text);

// ── Checks against the reports themselves ──
const n = articles.length;
const textOf = (i: number) => { const a = articles[i - 1]; return a ? `${a.title} ${a.summary} ${a.body}` : ""; };
const validSources = (xs: unknown) => [...new Set((Array.isArray(xs) ? xs : []).map(Number).filter((i) => i >= 1 && i <= n))];
const dropped: string[] = [];

const facts = (json.facts ?? []).map((f: any, i: number) => ({ ...f, id: f.id || `F${i + 1}`, sources: validSources(f.sources) }))
  .filter((f: any) => (f.sources.length ? true : (dropped.push(`fact without source: ${f.text}`), false)));
const textWords = articles.map((_, i) => ` ${words(textOf(i + 1))} `); // padded: matches whole words only
const textNumbers = articles.map((_, i) => new Set(numbersIn(textOf(i + 1))));
/** The reports that contain it, the claimed one first; a right quote under a wrong number keeps its true source. */
const foundIn = (claimed: number, test: (i: number) => boolean) => [claimed, ...articles.map((_, i) => i + 1).filter((i) => i !== claimed)].filter((i) => i >= 1 && i <= n && test(i - 1));

const quotes = (json.quotes ?? []).flatMap((q: any) => {
  const w = words(String(q.text ?? ""));
  const hits = w.split(" ").length >= 2 ? foundIn(Number(q.source), (i) => textWords[i]!.includes(` ${w} `)) : [];
  if (!hits.length) { dropped.push(`quote not verbatim in any report: ${q.text}`); return []; }
  return [{ ...q, source: hits[0] }];
});
const numbers = (json.numbers ?? []).flatMap((x: any) => {
  const digits = numbersIn(String(x.value));
  const w = words(String(x.value ?? ""));
  const hits = foundIn(Number(x.source), (i) => (digits.length ? digits.every((d) => textNumbers[i]!.has(d)) : !!w && textWords[i]!.includes(` ${w} `)));
  if (!hits.length) { dropped.push(`number not in any report: ${x.value}`); return []; }
  return [{ ...x, source: hits[0] }];
});
const conflicts = (json.conflicts ?? []).map((c: any) => ({ ...c, versions: (c.versions ?? []).map((v: any) => ({ ...v, sources: validSources(v.sources) })) }))
  .filter((c: any) => c.versions.filter((v: any) => v.sources.length).length >= 2);

const dossier = {
  summary: json.summary ?? "", angle: json.angle ?? "",
  facts, quotes, numbers, conflicts,
  timeline: (json.timeline ?? []).map((t: any) => ({ ...t, sources: validSources(t.sources) })),
  open_questions: json.open_questions ?? [],
  sources: articles.map((a, i) => ({ n: i + 1, name: outlet(a), title: a.title, url: a.url, published_at: a.published_at, chars: a.body.length })),
  dropped,
};
writeFileSync(`${W}/dossier.json`, JSON.stringify(dossier, null, 2));
const used = new Set(facts.flatMap((f: any) => f.sources));
console.log(`facts ${facts.length}, quotes ${quotes.length}, numbers ${numbers.length}, conflicts ${conflicts.length}, timeline ${dossier.timeline.length}, open ${dossier.open_questions.length}`);
console.log(`reports used ${used.size}/${n}, dropped ${dropped.length}${dropped.length ? `:\n  ${dropped.join("\n  ")}` : ""}`);
console.log(`RESULT ${JSON.stringify({ cost, provider, facts: facts.length, quotes: quotes.length, conflicts: conflicts.length, reports: n, reportsUsed: used.size, dropped: dropped.length })}`);
