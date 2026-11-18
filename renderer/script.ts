// Step "script": the story -> a narrated video script whose scenes are split into beats, each with its own visual.
// With <dir>/dossier.json (step "dossier") the script is written from the fact sheet and every beat names the facts
// it uses; without one (or VIDEO_DOSSIER=off) from the reports' first VIDEO_MATERIAL_CHARS characters, as before.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env script.ts   (reads <dir>/story.json [+ dossier.json], writes <dir>/script.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chatJson, materialOf, numbersIn, outlet, readArticles, W, words } from "./lib.ts";

const articles = readArticles();
const useDossier = process.env.VIDEO_DOSSIER !== "off" && existsSync(`${W}/dossier.json`);
const dossier = useDossier ? JSON.parse(readFileSync(`${W}/dossier.json`, "utf8")) : null;
// The channel's style rules, approved by the editor (modules/video/backend/style.ts), when the pipeline wrote them.
const styleRules: string[] = existsSync(`${W}/style.json`) ? JSON.parse(readFileSync(`${W}/style.json`, "utf8")) : [];
const styleText = styleRules.length ? `\n\nChannel style rules (approved by the editor; facts rules above still win):\n${styleRules.map((r) => `- ${r}`).join("\n")}` : "";
const [minWords, maxWords] = (process.env.VIDEO_SCRIPT_WORDS || "430-500").split("-").map(Number) as [number, number];

const list = (title: string, rows: string[]) => (rows.length ? `${title}\n${rows.join("\n")}` : "");
const names = (ns: number[]) => ns.map((n) => `${n} ${articles[n - 1] ? outlet(articles[n - 1]!) : "?"}`).join(", ");
const dossierText = (d: any) => [
  `ANGLE: ${d.angle}`, `SUMMARY: ${d.summary}`,
  list("FACTS (id [reports that state it] text):", d.facts.map((f: any) => `${f.id} [${names(f.sources)}] (${f.kind}${f.date ? `, ${f.date}` : ""}) ${f.text}`)),
  list("QUOTES (verbatim; speaker; report):", d.quotes.map((q: any, i: number) => `Q${i + 1} "${q.text}" — ${q.speaker} [${names([q.source])}]`)),
  list("NUMBERS (as written; report):", d.numbers.map((x: any) => `${x.value} = ${x.what} [${names([x.source])}]`)),
  list("TIMELINE:", d.timeline.map((t: any) => `${t.date}: ${t.event} [${t.sources.join(",")}]`)),
  list("CONFLICTS (reports disagree; never pick one silently):", d.conflicts.map((c: any) => `- ${c.topic}: ${c.versions.map((v: any) => `${v.claim} [${names(v.sources)}]`).join(" | ")}`)),
  list("OPEN QUESTIONS:", d.open_questions.map((q: string) => `- ${q}`)),
  list("REPORTS:", articles.map((a, i) => `[${i + 1}] ${outlet(a)}, ${a.published_at.slice(0, 10)}: ${a.title}`)),
].filter(Boolean).join("\n\n");

const facts = dossier
  ? `Facts:
- Use ONLY the dossier. Every beat lists in "facts" the ids (F1, F2…) of the facts its narration states; a beat that states something no fact supports is not allowed.
- Attribute claims to their outlets ("according to The Verge"), and name ONLY an outlet listed on the fact you state. A sentence that combines facts names only outlets listed on all of them, or none. Never write "X told outlet Y" unless the fact says so.
- Allegations stay allegations.
- Where the dossier lists a CONFLICT, say that reports differ (or give the latest attributed figure with its date). Never mix versions silently.
- Use OPEN QUESTIONS for "what comes next", phrased as open ("it is not yet clear whether…"), not attributed to an outlet; do not speculate beyond them or about wider consequences.`
  : `Facts:
- Use ONLY facts stated in the material. Never invent numbers, quotes, dates or names. Attribute claims ("according to The Verge").
- When sources disagree (different figures at different times), say so or use the latest attributed figure. Never mix them silently.
- Allegations stay allegations. Neutral and precise.`;

const system = `You are the head writer of an English-language YouTube news channel about AI.
Write a narrated news explainer video${dossier ? " from the research dossier" : " from the source material"} only.

${facts}

Style: spoken English, short sentences, plain words, no markdown, no emojis. Each beat must add something new: never restate an earlier beat in softer words.

Structure: scenes = hook (15-20 s: the single most surprising fact and the question the video answers), 4-6 story scenes (what happened, background, reactions, what is disputed, what comes next), outro.
Every scene is split into 2-4 BEATS. A beat is 1-3 sentences of narration (about 5-12 seconds) with ONE visual.
Total narration ${minWords}-${maxWords} words. Change the visual type often; never use the same type more than twice in a row. Show each report as an "article" at most once.

Visual types (pick what best fits the beat):
- {"type":"article","source":n} show the headline of report n.${dossier ? ` Optional "quote": one of the QUOTES from report n, copied exactly.` : ` Optional "quote": a SHORT exact sentence fragment (max 20 words) copied verbatim from that article's excerpt.`}
- {"type":"quote","speaker":"Name, role","text":"..."} ${dossier ? "one of the QUOTES, copied exactly." : "a direct quote that appears verbatim in the material (inside quotation marks there). Max 25 words."}
- {"type":"stat","value":"$105B","label":"what the number is"} one striking number${dossier ? " from NUMBERS" : " from the material"}.
- {"type":"chart","title":"...","unit":"$","points":[{"label":"Oct 6","value":239.24},...]} only when there are at least 2 dated values of the same measure.
- {"type":"timeline","events":[{"date":"Nov 8","text":"max 8 words"},...]} 3-5 dated events.
- {"type":"photo","query":"..."} a real photo of a named person, company headquarters or product, e.g. "Jensen Huang", "Nvidia headquarters".
- {"type":"broll","query":"..."} a generic illustrative image or clip: 2-4 concrete, visible words, e.g. "server racks blue light", "courtroom gavel", "stock ticker screen". Never a person's name (use "photo"); never something whose mood clashes with the narration.
- {"type":"card"} the narration itself as large animated text: for a beat no picture can show honestly.

Return ONLY JSON:
{"title": string (YouTube title, max 70 chars),
 "thumbnail_text": string (2-5 punchy words for the thumbnail, true to the story, no question marks, no claims the video does not support, e.g. "NVIDIA CEO OUT"),
 "description": string (2-3 sentences),
 "scenes": [{"kind": "hook"|"story"|"outro", "kicker": string (2-4 words, e.g. "WHAT HAPPENED"),
   "headline": string (max 60 chars),
   "beats": [{"narration": string, ${dossier ? `"facts": ["F1"], ` : ""}"visual": {...}}]}]}`;

const systemWithStyle = system + styleText;
const material = dossier ? `Dossier:\n\n${dossierText(dossier)}` : `Material:\n\n${materialOf(articles, Number(process.env.VIDEO_MATERIAL_CHARS || 3000))}`;
const { json, text, cost, provider } = await chatJson(systemWithStyle, material, {
  temperature: 0.4,
  check: (j) => {
    const beats = Array.isArray(j.scenes) ? j.scenes.flatMap((s: any) => (Array.isArray(s.beats) ? s.beats : [])) : [];
    if (beats.length < 8 || beats.some((b: any) => typeof b.narration !== "string" || !b.visual?.type)) throw new Error(`script unusable (${beats.length} beats)`);
    if (dossier && beats.filter((b: any) => Array.isArray(b.facts) && b.facts.length).length < beats.length / 2) throw new Error("most beats name no dossier facts");
  },
});
writeFileSync(`${W}/script-raw.txt`, text);

// ── Grounding checks: anything shown on screen as a quote or number must be in the reports. ──
const reportText = (a: (typeof articles)[number]) => `${a.title} ${a.summary} ${a.body}`;
const corpus = ` ${words(articles.map(reportText).join(" "))} `;
const corpusNumbers = new Set(numbersIn(articles.map(reportText).join(" ")));
const verbatim = (hay: string, needle: string) => words(needle).length > 0 && ` ${words(hay)} `.includes(` ${words(needle)} `);
const knownFacts = new Set((dossier?.facts ?? []).map((f: any) => f.id));
const dropped: string[] = [];
let unfounded = 0;
for (const scene of json.scenes) {
  for (const beat of scene.beats) {
    const v = beat.visual ?? {};
    if (dossier) {
      beat.facts = (Array.isArray(beat.facts) ? beat.facts : []).filter((id: string) => knownFacts.has(id));
      if (!beat.facts.length && scene.kind === "story") unfounded++;
    }
    if (v.type === "article") {
      const a = articles[v.source - 1];
      if (!a) { beat.visual = { type: "broll", query: "news headlines" }; dropped.push(`article #${v.source} missing`); continue; }
      if (v.quote && !verbatim(a.body + " " + a.summary, v.quote)) { dropped.push(`article quote: ${v.quote}`); delete v.quote; }
      Object.assign(v, { name: outlet(a), headline: a.title, date: a.published_at, url: a.url });
    }
    if (v.type === "quote" && !corpus.includes(` ${words(v.text ?? "")} `)) {
      dropped.push(`quote: ${v.text}`);
      // A person's name as stock search finds random pictures: look for their photo, else the beat shows kinetic text.
      beat.visual = v.speaker ? { type: "photo", query: String(v.speaker).split(",")[0] } : { type: "card" };
    }
    if (v.type === "stat" && !numbersIn(String(v.value)).every((n) => corpusNumbers.has(n))) {
      dropped.push(`stat: ${v.value}`); beat.visual = { type: "broll", query: "stock ticker screen" };
    }
    if (v.type === "chart" && !(v.points?.length >= 2 && v.points.every((p: any) => corpusNumbers.has(String(p.value))))) {
      dropped.push(`chart: ${v.title}`); beat.visual = { type: "broll", query: "stock ticker screen" };
    }
  }
}
json.sources = articles.map((a, i) => ({ n: i + 1, name: outlet(a), url: a.url, title: a.title }));
json.mode = dossier ? "dossier" : "material";
writeFileSync(`${W}/script.json`, JSON.stringify(json, null, 2));
const beats = json.scenes.flatMap((s: any) => s.beats);
const wordCount = beats.reduce((n: number, b: any) => n + b.narration.split(/\s+/).length, 0);
console.log(`mode: ${json.mode}\ntitle: ${json.title}\nscenes: ${json.scenes.length}, beats: ${beats.length}, words: ${wordCount}${dossier ? `, story beats without facts: ${unfounded}` : ""}`);
console.log(`visuals: ${beats.map((b: any) => b.visual.type).join(" ")}\ndropped (not grounded): ${dropped.length ? dropped.join(" | ") : "none"}`);
console.log(`RESULT ${JSON.stringify({ cost, provider, mode: json.mode, title: json.title, words: wordCount, beats: beats.length, dropped: dropped.length, unfounded })}`);
