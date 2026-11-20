// Step "script": the story -> a narrated video script whose scenes are split into beats, each with its own visual.
// With <dir>/dossier.json (step "dossier") the script is written from the fact sheet and every beat names the facts
// it uses; without one (or VIDEO_DOSSIER=off) from the reports' first VIDEO_MATERIAL_CHARS characters, as before.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env script.ts   (reads <dir>/story.json [+ dossier.json], writes <dir>/script.json)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CHANNEL, chatJson, materialOf, numbersIn, outlet, readArticles, readPreset, W, words } from "./lib.ts";

const preset = readPreset();

const articles = readArticles();
const useDossier = process.env.VIDEO_DOSSIER !== "off" && existsSync(`${W}/dossier.json`);
const dossier = useDossier ? JSON.parse(readFileSync(`${W}/dossier.json`, "utf8")) : null;
// The channel's style rules, approved by the editor (modules/video/backend/style.ts), when the pipeline wrote them.
const styleRules: string[] = existsSync(`${W}/style.json`) ? JSON.parse(readFileSync(`${W}/style.json`, "utf8")) : [];
const styleText = styleRules.length ? `\n\nChannel style rules (approved by the editor; facts rules above still win):\n${styleRules.map((r) => `- ${r}`).join("\n")}` : "";
// About 7-8 minutes of narration by default: long enough to explain, and past YouTube's 8 minutes for mid-roll ads.
const [minWords, maxWords] = (process.env.VIDEO_SCRIPT_WORDS || "1100-1250").split("-").map(Number) as [number, number];
const beatsPerScene = maxWords > 700 ? "3-6" : "2-4";
// Real data series (step "background", data.ts): charts take their points from here, exactly.
const data: Array<{ id: string; title: string; unit: string; source: string; points: Array<{ label: string; value: number }> }> =
  existsSync(`${W}/data.json`) ? JSON.parse(readFileSync(`${W}/data.json`, "utf8")) : [];
const dataText = data.length ? `\n\nDATA SERIES (official data; a "chart" beat names one by id and shows it exactly):\n${data.map((d) => `${d.id} ${d.title} [${d.source}]: ${d.points.map((p) => `${p.label} ${p.value}`).join(", ")}`).join("\n")}` : "";

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

const system = `You are the head writer of an English-language YouTube news channel about ${CHANNEL.subject} (${CHANNEL.brand.name}).
Write a narrated news explainer video${dossier ? " from the research dossier" : " from the source material"} only.

${facts}

Style: spoken English, short sentences, plain words, no markdown, no emojis. Each beat must add something new: never restate an earlier beat in softer words.

Structure: scenes = ${preset ? preset.script.structure : "hook (15-20 s: the single most surprising fact and the question the video answers), 4-6 story scenes (what happened, background, reactions, what is disputed, what comes next), outro"}.${preset ? `
Tone: ${preset.script.tone}.${preset.script.rules.length ? `\nRules for this kind of story:\n${preset.script.rules.map((r) => `- ${r}`).join("\n")}` : ""}
B-roll that suits it (when nothing more specific fits): ${preset.script.broll.join(", ")}.` : ""}
Every scene is split into ${beatsPerScene} BEATS. A beat is 1-3 sentences of narration (about 5-12 seconds) with ONE visual.
Total narration ${minWords}-${maxWords} words. Change the visual type often; never use the same type more than twice in a row. Show each report as an "article" at most once.
Pictures first: at least 60% of the beats are "photo" or "broll" (people, places, products and concrete scenes the narration is about); viewers leave a video of text. Use "stat", "quote", "article", "timeline", "chart", "flow", "versus" and "gauge" only where the exact words or numbers matter (one of the graphics is better than a plain card), and "card" only when no picture can show the beat honestly.

Visual types (pick what best fits the beat):
- {"type":"article","source":n} show the headline of report n.${dossier ? ` Optional "quote": one of the QUOTES from report n, copied exactly.` : ` Optional "quote": a SHORT exact sentence fragment (max 20 words) copied verbatim from that article's excerpt.`}
- {"type":"quote","speaker":"Name, role","text":"...","perspective":"defense"|"prosecution"|"analyst"|"official"} ${dossier ? "one of the QUOTES, copied exactly." : "a direct quote that appears verbatim in the material (inside quotation marks there). Max 25 words."} Optional "perspective" labels contrasting views and triggers dynamic vocal perspective cues.
- {"type":"stat","value":"$105B","label":"what the number is"} one striking number${dossier ? " from NUMBERS" : " from the material"}.
- {"type":"chart","data":"D1"} a chart of one of the DATA SERIES (when given): use one wherever a series shows the trend the narration talks about (rates, prices, jobs, revenue), and say in the narration what the chart shows, with its source. Otherwise {"type":"chart","title":"...","unit":"$","points":[{"label":"Oct 6","value":239.24},...]} only when there are at least 2 dated values of the same measure. (Style rule [2d6d2b81]: when a dossier/material has 2+ dated numeric values of a metric, generate a dynamic animated SVG chart instead of a plain text card).
- {"type":"timeline","events":[{"date":"Nov 8","text":"max 8 words"},...]} 3-5 dated events.
- {"type":"flow","title":"HOW IT SPREADS","steps":["Fed raises rates","Mortgage rates climb","Home sales slow"]} a cause-and-effect chain of 3-5 steps (max 6 words each) that the sources describe; the beat's facts must support every step.
- {"type":"versus","label":"Q3 revenue","left":{"name":"Expected","value":"$109.1B"},"right":{"name":"Reported","value":"$115.8B"}} two figures to compare (estimate vs actual, this year vs last, company vs rival), both from the material.
- {"type":"gauge","label":"Inflation vs the Fed's goal","value":3.0,"target":2.0,"unit":"%","targetLabel":"Fed goal"} one value against a target or limit, both from the material.
- {"type":"photo","query":"..."} a real photo of a named person, company headquarters or product, e.g. "Jensen Huang", "Nvidia headquarters".
- {"type":"broll","query":"..."} a generic illustrative image or clip: 2-4 concrete, visible words, e.g. "server racks blue light", "courtroom gavel", "stock ticker screen". Never a person's name (use "photo"); never something whose mood clashes with the narration.
- {"type":"card"} the narration itself as large animated text: for a beat no picture can show honestly.

Return ONLY JSON:
{"title": string (YouTube title, max 70 chars),
 "thumbnail_text": string (2-5 punchy words for the thumbnail, true to the story, no question marks, no claims the video does not support, e.g. "NVIDIA CEO OUT"),
 "description": string (2-3 sentences),
 "scenes": [{"kind": "hook"|"story"|"outro", "kicker": string (2-4 words, e.g. "WHAT HAPPENED"),
   "headline": string (max 60 chars),
   "beats": [{"narration": string, ${dossier ? `"facts": ["F1"], ` : ""}"perspective"?: string, "voice"?: string, "visual": {...}}]}]}`;

const systemWithStyle = system + styleText;
const material = (dossier ? `Dossier:\n\n${dossierText(dossier)}` : `Material:\n\n${materialOf(articles, Number(process.env.VIDEO_MATERIAL_CHARS || 3000))}`) + dataText;
// A 7-8 minute script is long JSON, and reasoning models think first: give the answer room (the dossier step's ceiling).
const { json, text, cost, provider } = await chatJson(systemWithStyle, material, {
  temperature: 0.4, maxTokens: 60000,
  check: (j) => {
    const beats = Array.isArray(j.scenes) ? j.scenes.flatMap((s: any) => (Array.isArray(s.beats) ? s.beats : [])) : [];
    if (beats.length < 8 || beats.some((b: any) => typeof b.narration !== "string" || !b.visual?.type)) throw new Error(`script unusable (${beats.length} beats)`);
    if (dossier && beats.filter((b: any) => Array.isArray(b.facts) && b.facts.length).length < beats.length / 2) throw new Error("most beats name no dossier facts");
  },
});
writeFileSync(`${W}/script-raw.txt`, text);

// ── Editing pass: a second read by an editor, as a newsroom does. It keeps every fact and source, and makes the script
// worth watching to the end: a hook that earns the click, why it matters to the viewer, numbers given scale and
// comparison (only figures already in the material), clean transitions, the target length. A failed or worse edit
// keeps the draft.
let edited = false;
const countWords = (j: any) => (j.scenes ?? []).flatMap((sc: any) => sc.beats ?? []).reduce((n: number, b: any) => n + String(b.narration ?? "").split(/\s+/).length, 0);
const draftWords = countWords(json);
try {
  const editor = `You are the executive editor of ${CHANNEL.brand.name}, a YouTube channel about ${CHANNEL.subject} for ${CHANNEL.audience}. Improve this draft script so a viewer stays to the end, without adding anything the material does not support.

Edit for:
- The hook (first 15-20 seconds): open with the most surprising concrete fact and the question the video answers. No "In this video", no greetings.
- Why it matters: a beat or scene that says plainly what this means for the viewer's money, job or prices, as the sources put it.
- Numbers with scale: every big number gets a comparison or context the material gives (versus last quarter, last year, expectations, a familiar quantity). Never a figure that is not in the material or the DATA SERIES.
- Flow: each beat leads to the next; one idea per beat; short spoken sentences; no repeated points.
- Length: ${minWords}-${maxWords} words of narration in all (now ${draftWords}). Expand with substance from the material (background, reactions, what comes next, open questions), never with filler.
- Keep: the JSON schema, every "facts" id on the beats that use them${dossier ? " (only ids from the dossier)" : ""}, the visual types and their rules, at least 60% "photo"/"broll" beats, attributions ("according to…"), allegations as allegations.

Return ONLY the full edited script as JSON in the same schema.`;
  const out = await chatJson(editor + styleText, `${material}\n\nDRAFT SCRIPT:\n${JSON.stringify(json)}`, {
    temperature: 0.3, maxTokens: 60000,
    check: (j) => {
      const beats = Array.isArray(j.scenes) ? j.scenes.flatMap((sc: any) => (Array.isArray(sc.beats) ? sc.beats : [])) : [];
      if (beats.length < 8 || beats.some((b: any) => typeof b.narration !== "string" || !b.visual?.type)) throw new Error(`edit unusable (${beats.length} beats)`);
      if (dossier && beats.filter((b: any) => Array.isArray(b.facts) && b.facts.length).length < beats.length / 2) throw new Error("edit dropped the facts");
      if (countWords(j) < Math.min(draftWords, minWords * 0.8)) throw new Error(`edit is shorter (${countWords(j)} words)`);
    },
  });
  writeFileSync(`${W}/script-edit-raw.txt`, out.text);
  for (const k of Object.keys(json)) delete json[k];
  Object.assign(json, out.json);
  edited = true;
  console.log(`editing pass: ${draftWords} -> ${countWords(json)} words (${out.provider})`);
} catch (error) {
  console.log(`editing pass skipped, the draft stays: ${(error as Error).message.slice(0, 200)}`);
}

// Pictures first: a plain text card (no words of its own) becomes b-roll from the style's suggestions while fewer than
// 60% of the beats have a picture; assets.ts turns it back into a card if nothing fitting is found.
{
  const all = json.scenes.flatMap((sc: any) => sc.beats);
  const pictured = () => all.filter((b: any) => b.visual?.type === "photo" || b.visual?.type === "broll").length;
  const ideas: string[] = preset?.script.broll?.length ? preset.script.broll : ["city skyline at dusk", "busy office", "newspaper printing press"];
  let k = 0;
  for (const b of all) {
    if (pictured() >= all.length * 0.6) break;
    if (b.visual?.type === "card" && !b.visual.text && !b.visual.items) b.visual = { type: "broll", query: ideas[k++ % ideas.length] };
  }
}

// ── Grounding checks: anything shown on screen as a quote or number must be in the reports. ──
const reportText = (a: (typeof articles)[number]) => `${a.title} ${a.summary} ${a.body}`;
const corpus = ` ${words(articles.map(reportText).join(" "))} `;
const corpusNumbers = new Set(numbersIn(articles.map(reportText).join(" ")));
const corpusValues = new Set([...corpusNumbers].map(Number));
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
    if (v.type === "versus" && !(v.left?.value && v.right?.value && [v.left.value, v.right.value].every((x: string) => numbersIn(String(x)).length && numbersIn(String(x)).every((n) => corpusNumbers.has(n))))) {
      dropped.push(`versus: ${v.label}`); beat.visual = { type: "broll", query: "financial chart screen" }; continue;
    }
    if (v.type === "gauge" && !(Number.isFinite(Number(v.value)) && Number.isFinite(Number(v.target)) && [v.value, v.target].every((x) => corpusValues.has(Number(x))))) {
      dropped.push(`gauge: ${v.label}`); beat.visual = { type: "broll", query: "financial chart screen" }; continue;
    }
    if (v.type === "flow" && !(Array.isArray(v.steps) && v.steps.length >= 2 && v.steps.length <= 5 && v.steps.every((x: unknown) => typeof x === "string" && x.split(/\s+/).length <= 8))) {
      dropped.push(`flow: ${v.title ?? ""}`); beat.visual = { type: "card" }; continue;
    }
    if (v.type === "chart" && v.data) {
      const d = data.find((x) => x.id === v.data);
      if (d) { Object.assign(v, { title: d.title, unit: d.unit, source: d.source, points: d.points }); continue; }
      dropped.push(`chart data ${v.data} missing`); beat.visual = { type: "broll", query: "financial chart screen" }; continue;
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
console.log(`RESULT ${JSON.stringify({ cost, provider, mode: json.mode, title: json.title, words: wordCount, draftWords, edited, beats: beats.length, dropped: dropped.length, unfounded, charts: beats.filter((b: any) => b.visual.type === "chart").length })}`);
