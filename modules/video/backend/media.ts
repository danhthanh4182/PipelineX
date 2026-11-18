// Pictures of a made video for a reviewer that can see: the thumbnail and one frame from the middle of each beat
// (long video or Short), each with what is spoken over it, so mismatched pictures and covered text can be spotted.
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { shortFile, thumbnailFile, videoFile, workDir } from "./pipeline.ts";

/** Seconds of the long video's branded opening before the first scene (renderer/src/NewsVideo.tsx INTRO). */
export const INTRO_SECONDS = 3;

type Timeline = { scenes: Array<{ kicker: string; start: number; beats: Array<{ narration: string; start: number; duration: number; visual: { type: string; query?: string } }> }> };

/** One JPEG frame (at most 640 px wide) at `at` seconds, as base64. */
function frame(file: string, at: number, width = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", ["-v", "error", "-ss", at.toFixed(2), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"],
      { encoding: "buffer", maxBuffer: 8 * 1024 * 1024, timeout: 30_000 }, (error, stdout) => (error ? reject(error) : resolve(Buffer.from(stdout).toString("base64"))));
  });
}

export interface Frame { scene: number; beat: number; at: number; kicker: string; visual: string; narration: string; jpeg: string }

/** Frames from evenly spread beats (at most `max`), from the long video or the Short. */
export async function videoFrames(id: number, variant: "long" | "short", max: number): Promise<Frame[] | null> {
  const file = variant === "short" ? shortFile(id) : videoFile(id);
  const timelinePath = path.join(workDir(id), variant === "short" ? "timeline-short.json" : "timeline.json");
  if (!existsSync(file) || !existsSync(timelinePath)) return null;
  const timeline = JSON.parse(readFileSync(timelinePath, "utf8")) as Timeline;
  const offset = variant === "short" ? 0 : INTRO_SECONDS;
  const beats = timeline.scenes.flatMap((s, si) => s.beats.map((b, bi) => ({ s, si, b, bi })));
  const step = Math.max(1, beats.length / max);
  const picked = Array.from({ length: Math.min(max, beats.length) }, (_, k) => beats[Math.floor(k * step)]!);
  return Promise.all(picked.map(async ({ s, si, b, bi }) => {
    const at = offset + s.start + b.start + Math.min(b.duration / 2, 4);
    return { scene: si, beat: bi, at: Math.round(at * 10) / 10, kicker: s.kicker, visual: b.visual.query ? `${b.visual.type}: ${b.visual.query}` : b.visual.type,
      narration: b.narration, jpeg: await frame(file, at, variant === "short" ? 360 : 640) };
  }));
}

export async function thumbnailImage(id: number): Promise<string | null> {
  return existsSync(thumbnailFile(id)) ? frame(thumbnailFile(id), 0, 640) : null;
}
