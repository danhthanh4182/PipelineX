// Makes one video: story material -> script (LLM) -> pictures (Pixabay/Commons/Openverse, vision-checked) ->
// voice (edge-tts) -> render (Remotion). Each step is a program in renderer/, run with the video's work
// directory; each prints a last line "RESULT {json}" that is kept in video_jobs.result.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "@aihot/backend/config";
import { finishVideo, getVideo, markStep, recordStep, STEPS, storyMaterial, type Step } from "./videos.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const RENDERER = process.env.VIDEO_RENDERER_DIR || path.join(ROOT, "renderer");
export const WORK_ROOT = process.env.VIDEO_WORK_DIR || path.join(ROOT, ".data", "videos");

export const workDir = (id: number) => path.join(WORK_ROOT, String(id));
export const videoFile = (id: number) => path.join(workDir(id), "video.mp4");

const MINUTE = 60_000;
const LIMITS: Record<Exclude<Step, "story">, number> = { dossier: 10 * MINUTE, script: 10 * MINUTE, verify: 10 * MINUTE, assets: 20 * MINUTE, voice: 15 * MINUTE, render: 40 * MINUTE };

function command(step: Exclude<Step, "story">, dir: string): [string, string[]] {
  // Node reads the app's .env and the renderer's own (PIXABAY_API_KEY); the worker's env already carries the app's.
  const node = (file: string): [string, string[]] => [process.execPath, ["--env-file-if-exists=.env", file]];
  switch (step) {
    case "dossier": return node("dossier.ts");
    case "script": return node("script.ts");
    case "verify": return node("verify.ts");
    case "assets": return node("assets.ts");
    case "voice": return [path.join(RENDERER, ".venv", "bin", "python"), ["tts.py"]];
    case "render": return [path.join(RENDERER, "node_modules", ".bin", "remotion"), [
      "render", "src/index.ts", "NewsVideo", path.join(dir, "video.mp4"), `--props=${path.join(dir, "timeline.json")}`,
      `--public-dir=${path.join(dir, "public")}`, "--codec", "h264", "--crf", "20", "--concurrency", process.env.VIDEO_RENDER_CONCURRENCY || "4"]];
  }
}

/** Runs one program; resolves with the parsed RESULT line, rejects with the end of its output. */
function run(step: Exclude<Step, "story">, dir: string): Promise<Record<string, unknown>> {
  const [bin, args] = command(step, dir);
  const log = path.join(dir, "log.txt");
  appendFileSync(log, `\n=== ${step} ${new Date().toISOString()}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: RENDERER, env: { ...process.env, VIDEO_WORKDIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    let result: Record<string, unknown> | null = null;
    const take = (chunk: Buffer) => {
      const text = chunk.toString();
      appendFileSync(log, text);
      tail = (tail + text).slice(-4000);
      for (const line of text.split("\n")) if (line.startsWith("RESULT ")) result = JSON.parse(line.slice(7));
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => child.kill("SIGTERM"), LIMITS[step]);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      // Remotion prints no RESULT line: a clean exit is enough.
      if (code === 0) resolve(result ?? {});
      else reject(new Error(`${step} ${signal ? `stopped (${signal}, limit ${LIMITS[step] / MINUTE} min)` : `exited ${code}`}: ${lastLines(tail)}`));
    });
  });
}

const lastLines = (text: string) => text.trim().split("\n").filter((l) => !/^\s+at /.test(l)).slice(-6).join("\n").slice(-800);

/** The story's reports as the script step reads them. */
async function writeStory(storyId: number, dir: string): Promise<Record<string, unknown>> {
  const rows = await storyMaterial(storyId);
  const usable = rows.filter((r) => r.body.length > 200 || (r.summary?.length ?? 0) > 80);
  if (usable.length < 2) throw new Error(`story: only ${usable.length} report(s) with enough text; a video needs at least 2`);
  writeFileSync(path.join(dir, "story.json"), JSON.stringify(usable.map((r) => ({
    title: r.title, source: r.source, url: r.url, published_at: r.published_at?.toISOString() ?? "",
    headline: r.headline ?? r.title, summary: r.summary ?? "", body: r.body,
  })), null, 2));
  return { reports: usable.length };
}

/** Runs a video's steps from `from` on; the row records each step, its cost and the outcome. */
export async function makeVideo(id: number, from: Step = "story"): Promise<void> {
  const video = await getVideo(id);
  if (!video) return;
  const dir = workDir(id);
  mkdirSync(dir, { recursive: true });
  let step: Step = from;
  try {
    if (!config.modelCallsEnabled) throw new Error("MODEL_CALLS_ENABLED is not true: the script and picture checks call paid models.");
    for (step of STEPS.slice(STEPS.indexOf(from))) {
      await markStep(id, step);
      if (step === "story") {
        if (!video.story_id) throw new Error("story: the story was deleted");
        await recordStep(id, step, await writeStory(video.story_id, dir));
      } else if (step === "verify") {
        // The fact-check informs the reviewer; a failed check does not stop the video.
        await recordStep(id, step, await run(step, dir).catch((error: Error) => ({ error: error.message.slice(0, 300) })));
      } else {
        await recordStep(id, step, await run(step, dir));
      }
    }
    await finishVideo(id, null);
  } catch (error) {
    await finishVideo(id, (error as Error).message.slice(0, 1500));
  }
}

/** What the admin page shows of a video's files: its script, picture credits and the end of its log. */
export function videoFiles(id: number) {
  const dir = workDir(id);
  const read = (name: string) => (existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), "utf8") : null);
  const script = JSON.parse(read("script-final.json") ?? read("script.json") ?? "null") as null | {
    title: string; description: string; sources?: Array<{ n: number; name: string; url: string; title: string }>;
    scenes: Array<{ kind: string; kicker: string; headline: string; beats: Array<{ narration: string; visual: { type: string; [k: string]: unknown } }> }>;
  };
  const dossier = JSON.parse(read("dossier.json") ?? "null") as null | {
    angle: string; summary: string; facts: unknown[]; quotes: unknown[]; open_questions: string[];
    conflicts: Array<{ topic: string; versions: Array<{ claim: string; sources: number[] }> }>;
  };
  const verify = JSON.parse(read("verify.json") ?? "null") as null | {
    summary: Record<string, number>; checks: Array<{ id: string; text: string; verdict: string; note: string; sources: number[] }>;
  };
  return {
    dossier: dossier && { angle: dossier.angle, summary: dossier.summary, facts: dossier.facts.length, quotes: dossier.quotes.length,
      conflicts: dossier.conflicts, openQuestions: dossier.open_questions },
    verify: verify && { summary: verify.summary, flagged: verify.checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported") },
    script: script && {
      title: script.title, description: script.description, sources: script.sources ?? [],
      scenes: script.scenes.map((s) => ({ kind: s.kind, kicker: s.kicker, headline: s.headline,
        beats: s.beats.map((b) => ({ narration: b.narration, visual: b.visual.type, detail: visualDetail(b.visual) })) })),
    },
    credits: (read("ATTRIBUTIONS.txt") ?? "").split("\n").filter(Boolean),
    log: (read("log.txt") ?? "").split("\n").slice(-40).join("\n"),
    hasVideo: existsSync(videoFile(id)),
  };
}

function visualDetail(v: Record<string, unknown>): string {
  if (v.type === "photo" || v.type === "broll") return String(v.query ?? "");
  if (v.type === "article") return String(v.name ?? "");
  if (v.type === "quote") return String(v.speaker ?? "");
  if (v.type === "stat") return `${v.value ?? ""} ${v.label ?? ""}`.trim();
  if (v.type === "chart") return String(v.title ?? "");
  return "";
}
