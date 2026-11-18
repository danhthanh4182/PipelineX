// The publish kit: what the human editor pastes into YouTube for the long video and the Short — title, description
// with chapters, sources and picture credits, tags and hashtags. Drafted from the video's own files, editable by the
// agent or on the Videos page; nothing here publishes anything.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INTRO_SECONDS } from "./media.ts";
import { workDir } from "./pipeline.ts";

export interface PublishKit {
  long: { title: string; description: string; tags: string[] };
  short: { title: string; description: string; tags: string[] } | null;
  draftedAt: string;
  editedAt?: string;
}

const LIMITS = { title: 100, description: 5000, tags: 500 };
const read = <T>(id: number, name: string): T | null => {
  const p = path.join(workDir(id), name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** YouTube chapters: the first at 0:00, at least three, each at least 10 seconds long. */
export function chapters(scenes: Array<{ headline: string; start: number; duration: number }>, total: number): string[] {
  const marks = [{ at: 0, name: "Intro" }, ...scenes.map((s) => ({ at: INTRO_SECONDS + s.start, name: s.headline }))];
  const end = INTRO_SECONDS + total;
  const kept: typeof marks = [];
  for (const m of marks) {
    const next = marks[marks.indexOf(m) + 1]?.at ?? end;
    if (kept.length && next - m.at < 10) continue; // too short: folded into the previous chapter
    kept.push(m);
  }
  return kept.length >= 3 ? kept.map((m) => `${clock(m.at)} ${m.name}`) : [];
}

/**
 * Tags: the channel's own, then the title's words that look like names (companies, products, people). Titles are in
 * title case, so each capitalised word stands alone and common verbs and linking words are left out.
 */
const NOT_NAMES = /^(The|And|For|With|After|Amid|Over|Into|From|Says|Said|New|Names|Named|Launches|Releases|Ships|Sues|Gets|Adds|Wins|Faces|Plans|Leaves|Joins|Raises|Exit|Out|Back|Top|How|Why|What|Who|Its|Their)$/;
function tagsFor(title: string): string[] {
  const names = [...new Set(title.match(/\b[A-Z][A-Za-z0-9.+-]{2,}/g) ?? [])].filter((n) => !NOT_NAMES.test(n));
  const tags = ["AI news", "artificial intelligence", "tech news", ...names.slice(0, 8)];
  const out: string[] = [];
  for (const t of tags) if ([...out, t].join(",").length <= LIMITS.tags) out.push(t);
  return out;
}

const hashtags = (tags: string[]) => tags.slice(3, 6).map((t) => `#${t.replace(/[^A-Za-z0-9]/g, "")}`).filter((h) => h.length > 2);

export function draftKit(id: number): PublishKit | null {
  const script = read<{ title: string; description?: string; sources?: Array<{ name: string; title: string; url: string }> }>(id, "script-final.json");
  const timeline = read<{ total: number; scenes: Array<{ headline: string; start: number; duration: number }> }>(id, "timeline.json");
  if (!script || !timeline) return null;
  const short = read<{ title: string; scenes: Array<{ beats: Array<{ narration: string }> }> }>(id, "script-short.json");
  const credits = existsSync(path.join(workDir(id), "ATTRIBUTIONS.txt"))
    ? readFileSync(path.join(workDir(id), "ATTRIBUTIONS.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.replace(/^assets\/[^:]+:\s*/, "")) : [];
  const sources = script.sources ?? [];
  const tags = tagsFor(script.title);
  const chapterLines = chapters(timeline.scenes, timeline.total);
  const description = [
    script.description ?? "",
    chapterLines.length ? `Chapters:\n${chapterLines.join("\n")}` : "",
    sources.length ? `Sources:\n${sources.map((s) => `- ${s.name}: ${s.title} — ${s.url}`).join("\n")}` : "",
    credits.length ? `Picture credits:\n${credits.map((c) => `- ${c}`).join("\n")}` : "",
    "Researched, written and narrated with AI tools, then checked against the sources above. Corrections welcome in the comments.",
    hashtags(tags).concat("#AINews").join(" "),
  ].filter(Boolean).join("\n\n").slice(0, LIMITS.description);
  const shortTitle = short ? short.title.slice(0, LIMITS.title - 8).trim() + " #Shorts" : "";
  return {
    long: { title: script.title.slice(0, LIMITS.title), description, tags },
    short: short ? {
      title: shortTitle,
      description: [short.scenes[0]?.beats[0]?.narration ?? "", "Full story on our channel.",
        sources.length ? `Sources: ${sources.slice(0, 3).map((s) => s.name).join(", ")}` : "", "#Shorts #AINews"].filter(Boolean).join("\n\n"),
      tags,
    } : null,
    draftedAt: new Date().toISOString(),
  };
}

/** The saved kit, or a fresh draft (saved) when there is none yet or `redraft` is asked. */
export function publishKit(id: number, redraft = false): PublishKit | null {
  const saved = read<PublishKit>(id, "publish.json");
  if (saved && !redraft) return saved;
  const kit = draftKit(id);
  if (kit) writeFileSync(path.join(workDir(id), "publish.json"), JSON.stringify(kit, null, 2));
  return kit;
}

export type KitEdit = Partial<{ longTitle: string; longDescription: string; longTags: string[]; shortTitle: string; shortDescription: string }>;

/** Applies edits within YouTube's limits; returns the kit and what changed (before/after). */
export function editKit(id: number, edit: KitEdit) {
  const kit = publishKit(id);
  if (!kit) return null;
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const set = (key: string, before: unknown, after: unknown, apply: () => void) => { if (after !== undefined) { changes[key] = { before, after }; apply(); } };
  set("longTitle", kit.long.title, edit.longTitle?.slice(0, LIMITS.title), () => (kit.long.title = edit.longTitle!.slice(0, LIMITS.title)));
  set("longDescription", "(previous description)", edit.longDescription && "(new description)", () => (kit.long.description = edit.longDescription!.slice(0, LIMITS.description)));
  set("longTags", kit.long.tags, edit.longTags, () => (kit.long.tags = edit.longTags!.filter((t, i, a) => a.slice(0, i + 1).join(",").length <= LIMITS.tags)));
  if (kit.short) {
    set("shortTitle", kit.short.title, edit.shortTitle?.slice(0, LIMITS.title), () => (kit.short!.title = edit.shortTitle!.slice(0, LIMITS.title)));
    set("shortDescription", "(previous description)", edit.shortDescription && "(new description)", () => (kit.short!.description = edit.shortDescription!.slice(0, LIMITS.description)));
  }
  kit.editedAt = new Date().toISOString();
  writeFileSync(path.join(workDir(id), "publish.json"), JSON.stringify(kit, null, 2));
  return { kit, changes };
}
