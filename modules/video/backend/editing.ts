// Editing a made video's words from outside the pipeline (the editor MCP, editor-mcp.ts): read everything a reviewer
// needs, change narration, title, description or thumbnail words, and keep a history of every change in edits.json.
// An edited script is checked against the reports again at once (verify.ts), so the editor sees the new verdicts.
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, closeSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run, workDir } from "./pipeline.ts";
import { getVideo, VideoConflict } from "./videos.ts";
import { auditAgent } from "./operations.ts";

export type Variant = "long" | "short";
export interface EditEntry { at: string; actor: string; kind: "edit" | "review" | "remake" | "create"; detail: Record<string, unknown>; note?: string }

const file = (id: number, name: string) => path.join(workDir(id), name);
const readJson = <T>(id: number, name: string): T | null => (existsSync(file(id, name)) ? (JSON.parse(readFileSync(file(id, name), "utf8")) as T) : null);
const writeJson = (id: number, name: string, value: unknown) => {
  mkdirSync(workDir(id), { recursive: true });
  writeFileSync(file(id, name), JSON.stringify(value, null, 2));
};

export function editHistory(id: number): EditEntry[] {
  return readJson<EditEntry[]>(id, "edits.json") ?? [];
}

/** Kept in the video's own history and, for the whole site, in the admin's Audit Log. */
export function recordEdit(id: number, entry: Omit<EditEntry, "at">) {
  writeJson(id, "edits.json", [...editHistory(id), { at: new Date().toISOString(), ...entry }]);
  void auditAgent(entry.actor, `video.${entry.kind}`, `video:${id}`, entry.note ?? null, entry.detail).catch(() => {});
}

type Script = { title: string; description?: string; thumbnail_text?: string | null; scenes: Array<{ kind: string; kicker: string; headline: string; beats: Array<{ narration: string; visual: Record<string, unknown>; facts?: string[] }> }> };
type Verify = { summary: Record<string, number>; checks: Array<{ id: string; scene: number; beat: number; text: string; verdict: string; note: string; sources: number[] }> };

/** What a reviewer reads: the video, its research, both scripts with each beat numbered, the flagged sentences, the history. */
export async function videoForEditor(id: number) {
  const video = await getVideo(id);
  if (!video) return null;
  const script = readJson<Script>(id, "script-final.json") ?? readJson<Script>(id, "script.json");
  const short = readJson<Script>(id, "script-short.json");
  const dossier = readJson<any>(id, "dossier.json");
  const flagged = (v: Verify | null) => v?.checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported") ?? [];
  const beatsOf = (s: Script | null) => s?.scenes.flatMap((scene, si) => scene.beats.map((b, bi) => ({
    scene: si, beat: bi, sceneKicker: scene.kicker, narration: b.narration, visual: String(b.visual?.type ?? ""), facts: b.facts ?? [],
  }))) ?? [];
  return {
    video: { id: video.id, title: video.title, status: video.status, step: video.step, error: video.error, durationSeconds: video.duration_s, createdAt: video.created_at, style: video.style },
    long: script && { title: script.title, description: script.description ?? "", thumbnailText: script.thumbnail_text ?? null, beats: beatsOf(script) },
    longCheck: { summary: readJson<Verify>(id, "verify.json")?.summary ?? null, flagged: flagged(readJson<Verify>(id, "verify.json")) },
    short: short && { title: short.title, beats: beatsOf(short) },
    shortCheck: { summary: readJson<Verify>(id, "verify-short.json")?.summary ?? null, flagged: flagged(readJson<Verify>(id, "verify-short.json")) },
    research: dossier && {
      angle: dossier.angle, summary: dossier.summary,
      facts: (dossier.facts ?? []).map((f: any) => ({ id: f.id, kind: f.kind, text: f.text, sources: f.sources })),
      conflicts: dossier.conflicts ?? [], openQuestions: dossier.open_questions ?? [],
      sources: (dossier.sources ?? []).map((s: any) => ({ n: s.n, name: s.name, title: s.title, url: s.url })),
    },
    history: editHistory(id),
  };
}

export interface ScriptEdit { scene: number; beat: number; narration: string }

export type VisualChange = { type: "card" } | { type: "photo" | "broll"; query: string };

/**
 * Changes what one beat of the long video shows: kinetic text, a named subject's photo, or stock b-roll for a query.
 * Takes effect when the video is made again from step "assets" (pictures are searched again and checked).
 */
export async function editVisual(id: number, actor: string, input: { scene: number; beat: number; visual: VisualChange; note?: string }) {
  const video = await getVideo(id);
  if (!video) throw new VideoConflict(`No video #${id}.`);
  if (video.status === "queued" || video.status === "running") throw new VideoConflict(`Video #${id} is being made; edit it when it is finished.`);
  const names = ["script.json", "script-final.json"];
  const scripts = names.map((n) => ({ n, s: readJson<Script>(id, n) })).filter((x): x is { n: string; s: Script } => !!x.s);
  // What the video shows now is in script-final.json (after pictures were found); script.json is the plan before it.
  const shown = (scripts.find((x) => x.n === "script-final.json") ?? scripts[0])?.s.scenes[input.scene]?.beats[input.beat];
  if (!shown) throw new VideoConflict(`There is no scene ${input.scene}, beat ${input.beat} in the long script.`);
  const before = { type: shown.visual?.type, query: shown.visual?.query ?? null };
  for (const { n, s } of scripts) {
    s.scenes[input.scene]!.beats[input.beat]!.visual = { ...input.visual };
    writeJson(id, n, s);
  }
  recordEdit(id, { actor, kind: "edit", detail: { variant: "long", visual: { scene: input.scene, beat: input.beat, before, after: input.visual } }, note: input.note });
  return { scene: input.scene, beat: input.beat, before, after: input.visual, next: "Remake from step 'assets' to find and check the new picture (the voice and render follow)." };
}

/** Image files an illustration may be: by their first bytes, not their name. */
function imageKind(file: string): "png" | "jpg" | "webp" | null {
  const fd = openSync(file, "r"); const head = Buffer.alloc(12); readSync(fd, head, 0, 12, 0); closeSync(fd);
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/**
 * Puts an AI-made illustration (made by the local agent's own image model) on one beat of the long video. It is
 * always labelled "AI illustration" on screen and in the credits, and is only for ideas no photo can show (a concept,
 * a process, a trend): never a realistic picture of a real person, place or event. Takes effect from step "voice".
 */
export async function addIllustration(id: number, actor: string, input: { scene: number; beat: number; file: string; prompt: string; model: string; note?: string }) {
  const video = await getVideo(id);
  if (!video) throw new VideoConflict(`No video #${id}.`);
  if (video.status === "queued" || video.status === "running") throw new VideoConflict(`Video #${id} is being made; add it when it is finished.`);
  if (!path.isAbsolute(input.file) || !existsSync(input.file) || !statSync(input.file).isFile()) throw new VideoConflict(`No image file at ${input.file} (give its absolute path).`);
  if (statSync(input.file).size > 12 * 1024 * 1024) throw new VideoConflict("The image is over 12 MB.");
  const kind = imageKind(input.file);
  if (!kind) throw new VideoConflict("The file is not a PNG, JPEG or WebP image.");
  const names = ["script.json", "script-final.json"];
  const scripts = names.map((n) => ({ n, s: readJson<Script>(id, n) })).filter((x): x is { n: string; s: Script } => !!x.s);
  const shown = (scripts.find((x) => x.n === "script-final.json") ?? scripts[0])?.s.scenes[input.scene]?.beats[input.beat];
  if (!shown) throw new VideoConflict(`There is no scene ${input.scene}, beat ${input.beat} in the long script.`);
  const rel = `assets/illustration-s${input.scene}b${input.beat}.${kind}`;
  mkdirSync(path.join(workDir(id), "public", "assets"), { recursive: true });
  copyFileSync(input.file, path.join(workDir(id), "public", rel));
  const before = { type: shown.visual?.type, query: shown.visual?.query ?? null };
  const visual = { type: "illustration", prompt: input.prompt, asset: { file: rel, credit: `AI illustration (${input.model})`, license: "AI-generated", sourceUrl: "", kind: "image" } };
  for (const { n, s } of scripts) {
    s.scenes[input.scene]!.beats[input.beat]!.visual = { ...visual } as never;
    writeJson(id, n, s);
  }
  recordEdit(id, { actor, kind: "edit", detail: { variant: "long", illustration: { scene: input.scene, beat: input.beat, before, model: input.model, prompt: input.prompt } }, note: input.note });
  return { scene: input.scene, beat: input.beat, before, file: rel, next: "Remake from step 'voice' to show it (the voice is reused; render follows)." };
}

/**
 * Applies edits to the long script (script.json and script-final.json, so a remake from any later step keeps them)
 * or the Short (script-short.json), records them, and checks the edited script against the reports again.
 */
export async function editScript(id: number, actor: string, input: {
  variant: Variant; edits: ScriptEdit[]; title?: string; description?: string; thumbnailText?: string; note?: string;
}) {
  const video = await getVideo(id);
  if (!video) throw new VideoConflict(`No video #${id}.`);
  if (video.status === "queued" || video.status === "running") throw new VideoConflict(`Video #${id} is being made; edit it when it is finished.`);
  const names = input.variant === "short" ? ["script-short.json"] : ["script.json", "script-final.json"];
  const scripts = names.map((n) => ({ n, s: readJson<Script>(id, n) })).filter((x): x is { n: string; s: Script } => !!x.s);
  if (!scripts.length) throw new VideoConflict(`Video #${id} has no ${input.variant} script yet.`);
  const changes: Array<Record<string, unknown>> = [];
  for (const e of input.edits) {
    const beat = scripts[0]!.s.scenes[e.scene]?.beats[e.beat];
    if (!beat) throw new VideoConflict(`There is no scene ${e.scene}, beat ${e.beat} in the ${input.variant} script.`);
    changes.push({ scene: e.scene, beat: e.beat, before: beat.narration, after: e.narration });
  }
  const meta: Record<string, unknown> = {};
  if (input.title !== undefined) meta.title = { before: scripts[0]!.s.title, after: input.title };
  if (input.description !== undefined && input.variant === "long") meta.description = { before: scripts[0]!.s.description ?? "", after: input.description };
  if (input.thumbnailText !== undefined && input.variant === "long") meta.thumbnailText = { before: scripts[0]!.s.thumbnail_text ?? null, after: input.thumbnailText };
  for (const { n, s } of scripts) {
    for (const e of input.edits) s.scenes[e.scene]!.beats[e.beat]!.narration = e.narration;
    if (input.title !== undefined) { s.title = input.title; if (input.variant === "short") s.scenes[0]!.headline = input.title; }
    if (input.description !== undefined && input.variant === "long") s.description = input.description;
    if (input.thumbnailText !== undefined && input.variant === "long") s.thumbnail_text = input.thumbnailText;
    writeJson(id, n, s);
  }
  // The thumbnail and the video's title card are drawn from the timeline: keep its title and words in step.
  const timelineName = input.variant === "short" ? "timeline-short.json" : "timeline.json";
  const timeline = readJson<Record<string, unknown>>(id, timelineName);
  if (timeline && (input.title !== undefined || input.thumbnailText !== undefined)) {
    if (input.title !== undefined) timeline.title = input.title;
    if (input.thumbnailText !== undefined && input.variant === "long") timeline.thumbnail_text = input.thumbnailText;
    writeJson(id, timelineName, timeline);
  }
  recordEdit(id, { actor, kind: "edit", detail: { variant: input.variant, beats: changes, ...meta }, note: input.note });

  // The edited words are checked against the reports now; the verdicts for the edited beats come back.
  const result = await run("verify", workDir(id), input.variant === "short" ? { VIDEO_VARIANT: "short" } : {}).catch((error: Error) => ({ error: error.message.slice(0, 300) }));
  const check = readJson<Verify>(id, input.variant === "short" ? "verify-short.json" : "verify.json");
  const edited = new Set(input.edits.map((e) => `${e.scene}:${e.beat}`));
  return {
    changed: changes.length + Object.keys(meta).length,
    check: "error" in result ? { error: result.error } : check?.summary ?? null,
    editedSentences: check?.checks.filter((c) => edited.has(`${c.scene}:${c.beat}`)).map((c) => ({ scene: c.scene, beat: c.beat, text: c.text, verdict: c.verdict, note: c.note })) ?? [],
    stillFlagged: check?.checks.filter((c) => c.verdict === "partial" || c.verdict === "unsupported").length ?? null,
    next: input.variant === "short"
      ? "Remake the Short from step 'shortvoice' to hear the new words."
      : "Remake from step 'voice' to record the new words (pictures are kept), or from 'thumbnail' if only the title or thumbnail words changed.",
  };
}
