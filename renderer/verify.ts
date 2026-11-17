// Step "verify": every sentence of the narration checked against the reports' full text.
// It does not change the script: it lists what is supported, partly supported or unsupported, for the reviewer
// (and as the measure when comparing ways of writing). Framing sentences ("Here's what we know.") are told apart.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env verify.ts   (reads <dir>/script.json + story.json, writes <dir>/verify.json)
import { readFileSync, writeFileSync } from "node:fs";
import { chatJson, materialOf, readArticles, splitSentences, W } from "./lib.ts";

const articles = readArticles();
const script = JSON.parse(readFileSync(`${W}/script.json`, "utf8"));

// Sentences, numbered in narration order, with where they sit.
const sentences: Array<{ id: string; scene: number; beat: number; text: string }> = [];
script.scenes.forEach((s: any, si: number) => s.beats.forEach((b: any, bi: number) => {
  for (const text of splitSentences(String(b.narration))) {
    if (text.trim()) sentences.push({ id: `S${sentences.length + 1}`, scene: si, beat: bi, text: text.trim() });
  }
}));

const system = `You are a fact-checker for a news video. Check each numbered sentence of the narration against the numbered reports ONLY (no outside knowledge).

Verdicts:
- "supported": every factual detail (who, what, when, numbers, attribution) is stated in at least one report.
- "partial": the gist is in the reports but a detail is wrong, missing, overstated, or a claim is presented as fact while the reports present it as an allegation or as one side's view.
- "unsupported": the reports do not state it, or contradict it.
- "framing": no factual claim (transitions, questions to the viewer, sign-offs), including a sentence that only says a future outcome is not known yet ("It is not yet clear whether the court will…") as long as it asserts no fact.

Return ONLY JSON: {"checks": [{"id": "S1", "verdict": "...", "sources": [n], "note": string (for partial/unsupported: what is wrong, max 25 words; else "")}]}
Check every sentence, in order.`;

const user = `Reports:\n\n${materialOf(articles, Number(process.env.VIDEO_DOSSIER_CHARS || 12000))}\n\nNarration:\n${sentences.map((s) => `${s.id}: ${s.text}`).join("\n")}`;
const { json, cost } = await chatJson(system, user, { temperature: 0, maxTokens: 40000 });

const byId = new Map((json.checks ?? []).map((c: any) => [c.id, c]));
const checks = sentences.map((s) => {
  const c: any = byId.get(s.id) ?? { verdict: "unchecked", sources: [], note: "the checker skipped it" };
  return { ...s, verdict: c.verdict, sources: c.sources ?? [], note: c.note ?? "" };
});
const count = (v: string) => checks.filter((c) => c.verdict === v).length;
const summary = { sentences: checks.length, supported: count("supported"), partial: count("partial"), unsupported: count("unsupported"), framing: count("framing"), unchecked: count("unchecked") };
writeFileSync(`${W}/verify.json`, JSON.stringify({ summary, checks }, null, 2));
for (const c of checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported")) console.log(`${c.verdict.toUpperCase()} ${c.id}: ${c.text}\n  -> ${c.note}`);
console.log(`RESULT ${JSON.stringify({ cost, ...summary })}`);
