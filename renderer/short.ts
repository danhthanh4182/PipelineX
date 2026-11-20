// Step "short": a vertical YouTube Short (about 45-60 s) from the same research as the long video. It is written from
// the dossier (falling back to the long script), and shows only pictures the long video already found and checked
// (by beat number), or text visuals (stat, quote, kinetic card). Quotes and numbers are grounded in the reports.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env short.ts   (reads script-final.json [+ dossier.json], writes script-short.json)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CHANNEL, chatJson, numbersIn, readArticles, readPreset, W, words } from "./lib.ts";

const preset = readPreset();

const articles = readArticles();
const long = JSON.parse(readFileSync(`${W}/script-final.json`, "utf8"));
const dossier = existsSync(`${W}/dossier.json`) ? JSON.parse(readFileSync(`${W}/dossier.json`, "utf8")) : null;

// The long video's beats that have a checked picture or a ready text visual, numbered for the writer.
const beats: any[] = long.scenes.flatMap((s: any) => s.beats);
const pictures = beats.map((b, i) => ({ i: i + 1, v: b.visual })).filter(({ v }) =>
  ((v.type === "photo" || v.type === "broll") && v.asset) || ["article", "stat", "quote", "chart", "timeline", "compare", "comparison", "code", "terminal"].includes(v.type));
const describe = (v: any) =>
  v.type === "photo" || v.type === "broll" ? `${v.asset?.kind === "video" ? "video clip" : "photo"}: ${v.query}`
  : v.type === "article" ? `headline card: ${v.name}, "${v.headline}"`
  : v.type === "stat" ? `big number: ${v.value} (${v.label})`
  : v.type === "quote" ? `quote card: ${v.speaker}`
  : v.type === "chart" ? `chart: ${v.title}`
  : v.type === "compare" || v.type === "comparison" ? `comparison: ${v.title ?? "comparison table"}`
  : v.type === "code" || v.type === "terminal" ? `code: ${v.title ?? "code snippet"}`
  : `timeline: ${(v.events ?? []).length} dates`;

const material = dossier
  ? `ANGLE: ${dossier.angle}\nSUMMARY: ${dossier.summary}\nFACTS:\n${dossier.facts.slice(0, 40).map((f: any) => `${f.id} ${f.text}`).join("\n")}\n` +
    (dossier.conflicts?.length ? `REPORTS DIFFER ON:\n${dossier.conflicts.map((c: any) => `- ${c.topic}`).join("\n")}\n` : "")
  : `LONG VIDEO NARRATION:\n${beats.map((b) => b.narration).join(" ")}`;

const system = `You write YouTube Shorts for an English news channel about ${CHANNEL.subject} (${CHANNEL.brand.name}). Turn the research into ONE vertical Short of 110-150 spoken words (45-60 seconds).

Rules:
- Facts only from the material; attribute claims ("according to The Verge"); allegations stay allegations; where reports differ, say so.
- Beat 1 is the hook: ${preset ? preset.short.hook : "the single most surprising fact in under 12 words"}. No greeting, no channel name.${preset ? `\n- Tone: ${preset.script.tone}.${preset.script.rules.map((r) => `\n- ${r}`).join("")}` : ""}
- 6-9 beats, each 1-2 short sentences (3-7 seconds). Plain spoken English, no emojis, no hashtags in narration.
- Last beat: one concrete takeaway attributed to a named source from the material (e.g. "Bloomberg reports...", "According to The Verge...") or a specific question from the facts, then a direct call to watch the full breakdown: "Watch the full breakdown linked below." or "Tap below for the full deep dive." Never make ungrounded generalizations, editorial judgments, or broad predictions about the future without direct source attribution.
- Every beat shows ONE visual:
  {"type":"reuse","beat":n} one of the PICTURES below (use each at most once), or
  {"type":"stat","value":"...","label":"..."} a number stated in the material, or
  {"type":"card"} the narration as big animated text.
  Prefer pictures; use "card" for at most 3 beats.

Return ONLY JSON: {"title": string (max 60 chars, no hashtags), "beats": [{"narration": string, "visual": {...}}]}`;

// The channel's style rules, approved by the editor (modules/video/backend/style.ts), when the pipeline wrote them.
const styleRules: string[] = existsSync(`${W}/style.json`) ? JSON.parse(readFileSync(`${W}/style.json`, "utf8")) : [];
const styleText = styleRules.length ? `\n\nChannel style rules (approved by the editor; facts rules above still win):\n${styleRules.map((r) => `- ${r}`).join("\n")}` : "";
const user = `${material}\nPICTURES (beat number: what it shows):\n${pictures.map(({ i, v }) => `${i}: ${describe(v)}`).join("\n")}`;
const { json, cost, provider } = await chatJson(system + styleText, user, {
  temperature: 0.5, maxTokens: 12000,
  check: (j) => {
    const n = (j.beats ?? []).map((b: any) => String(b.narration ?? "")).join(" ").split(/\s+/).filter(Boolean).length;
    if (!Array.isArray(j.beats) || j.beats.length < 4 || n < 70 || n > 200) throw new Error(`short unusable (${j.beats?.length ?? 0} beats, ${n} words)`);
  },
});

// ── Resolve reused pictures; ground numbers in the reports; anything unfit becomes a kinetic card. ──
const corpusNumbers = new Set(numbersIn(articles.map((a) => `${a.title} ${a.summary} ${a.body}`).join(" ")));
const corpus = ` ${words(articles.map((a) => `${a.title} ${a.summary} ${a.body}`).join(" "))} `;
const used = new Set<number>();
const out = (json.beats as any[]).map((b) => {
  const v = b.visual ?? {};
  let visual: any = { type: "card" };
  if (v.type === "reuse" && pictures.some((p) => p.i === Number(v.beat)) && !used.has(Number(v.beat))) {
    used.add(Number(v.beat));
    visual = structuredClone(beats[Number(v.beat) - 1].visual);
    if (visual.type === "quote" && !corpus.includes(` ${words(visual.text ?? "")} `)) visual = { type: "card" };
  } else if (v.type === "stat" && numbersIn(String(v.value)).length && numbersIn(String(v.value)).every((x) => corpusNumbers.has(x))) {
    visual = { type: "stat", value: v.value, label: v.label };
  }
  return { narration: String(b.narration).trim(), visual };
});

const short = {
  title: json.title, description: long.description, sources: long.sources, thumbnail_text: null,
  mainTitle: long.title,
  mainVideo: { title: long.title, description: long.description },
  scenes: [{ kind: "short", kicker: long.scenes[0]?.kicker ?? CHANNEL.brand.label, headline: json.title, beats: out }],
};
writeFileSync(`${W}/script-short.json`, JSON.stringify(short, null, 2));
const wordCount = out.reduce((n, b) => n + b.narration.split(/\s+/).length, 0);
console.log(`short: ${out.length} beats, ${wordCount} words, pictures reused ${used.size}, cards ${out.filter((b) => b.visual.type === "card").length}`);

// The Short's sentences are checked against the reports like the long video's (verify-short.json).
let check: Record<string, unknown> = {};
try {
  const log = execFileSync(process.execPath, ["--env-file-if-exists=.env", "verify.ts"], { env: { ...process.env, VIDEO_VARIANT: "short" }, encoding: "utf8", timeout: 600_000 });
  process.stdout.write(log);
  check = JSON.parse(log.split("\n").find((l) => l.startsWith("RESULT "))?.slice(7) ?? "{}");
} catch (error) {
  check = { error: (error as Error).message.slice(0, 200) };
}
console.log(`RESULT ${JSON.stringify({ cost: cost + Number(check.cost ?? 0), provider, beats: out.length, words: wordCount, reused: used.size,
  supported: check.supported, partial: check.partial, unsupported: check.unsupported })}`);
