// Videos made from stories: the rows the admin page lists and the pipeline (pipeline.ts) moves along.
import { sql, type Db } from "@aihot/backend/db";

export const STEPS = ["story", "background", "dossier", "script", "verify", "assets", "voice", "render", "thumbnail", "short", "shortvoice", "shortrender"] as const;
/** Steps after the long video: their failure is recorded but leaves the video ready (a Short failure skips the rest of the Short). */
export const EXTRAS: readonly Step[] = ["thumbnail", "short", "shortvoice", "shortrender"];
export type Step = (typeof STEPS)[number];
export type VideoStatus = "queued" | "running" | "ready" | "failed" | "approved" | "rejected";

export interface VideoRow {
  id: number;
  story_id: number | null;
  title: string;
  status: VideoStatus;
  step: Step | null;
  error: string | null;
  result: Record<string, Record<string, unknown>>;
  cost: string;
  duration_s: string | null;
  created_by: string;
  style: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
}

/** A video still running after this long is taken as stopped (the worker was restarted mid-step). */
export const STALE_MINUTES = 60;

export class VideoConflict extends Error {
  code = "conflict";
}

export async function listVideos(db: Db = sql, limit = 50): Promise<VideoRow[]> {
  return db<VideoRow[]>`SELECT * FROM video_jobs ORDER BY id DESC LIMIT ${limit}`;
}

export async function getVideo(id: number, db: Db = sql): Promise<VideoRow | null> {
  const [row] = await db<VideoRow[]>`SELECT * FROM video_jobs WHERE id = ${id}`;
  return row ?? null;
}

/** A new video for a story; a story already queued or being made is refused. */
export async function createVideo(storyId: number, createdBy: string, db: Db = sql, style: string | null = null): Promise<VideoRow> {
  const [story] = await db<{ id: number; title: string }[]>`SELECT id, title FROM stories WHERE id = ${storyId} AND merged_into IS NULL`;
  if (!story) throw new VideoConflict("This story does not exist or was merged into another.");
  const [busy] = await db`SELECT id FROM video_jobs WHERE story_id = ${storyId} AND status IN ('queued', 'running')`;
  if (busy) throw new VideoConflict(`Video #${busy.id} for this story is already in progress.`);
  const [row] = await db<VideoRow[]>`
    INSERT INTO video_jobs (story_id, title, created_by, style) VALUES (${storyId}, ${story.title}, ${createdBy}, ${style}) RETURNING *`;
  await db`UPDATE video_candidates SET status = 'selected' WHERE story_id = ${storyId}`;
  return row!;
}

/** Queue a video again from a step; only a video that is not queued or (recently) running. With force, also a video
 * left marked queued/running by a worker restart: allowed only when the job queue holds no live job for it. */
export async function requeueVideo(id: number, from: Step, db: Db = sql, force = false): Promise<VideoRow> {
  const orphaned = force && !(await hasLiveJob(id, db));
  if (force && !orphaned) throw new VideoConflict("This video's job is still queued or running; wait for it or stop the worker first.");
  const [row] = await db<VideoRow[]>`
    UPDATE video_jobs SET status = 'queued', step = ${from}, error = NULL, finished_at = NULL, updated_at = now()
    WHERE id = ${id} AND (${orphaned} OR status NOT IN ('queued', 'running') OR updated_at < now() - make_interval(mins => ${STALE_MINUTES}))
    RETURNING *`;
  if (!row) throw new VideoConflict("This video is queued or being made right now.");
  return row;
}

/** The reviewer's verdict on a finished video. */
export async function reviewVideo(id: number, status: "approved" | "rejected" | "ready", db: Db = sql): Promise<VideoRow> {
  const [row] = await db<VideoRow[]>`
    UPDATE video_jobs SET status = ${status}, updated_at = now()
    WHERE id = ${id} AND status IN ('ready', 'approved', 'rejected') RETURNING *`;
  if (!row) throw new VideoConflict("Only a finished video can be approved or rejected.");
  return row;
}

export async function markStep(id: number, step: Step, db: Db = sql): Promise<void> {
  await db`UPDATE video_jobs SET status = 'running', step = ${step}, started_at = coalesce(started_at, now()), updated_at = now() WHERE id = ${id}`;
}

export async function recordStep(id: number, step: Step, result: Record<string, unknown>, db: Db = sql): Promise<void> {
  const cost = Number(result.cost ?? 0) || 0;
  const duration = typeof result.duration === "number" ? result.duration : null;
  await db`
    UPDATE video_jobs SET result = result || ${db.json({ [step]: result } as never)}, cost = cost + ${cost},
      duration_s = coalesce(${duration}, duration_s), updated_at = now()
    WHERE id = ${id}`;
}

export async function finishVideo(id: number, error: string | null, db: Db = sql): Promise<void> {
  await db`
    UPDATE video_jobs SET status = ${error ? "failed" : "ready"}, error = ${error}, finished_at = now(), updated_at = now(),
      step = CASE WHEN ${error}::text IS NULL THEN NULL ELSE step END
    WHERE id = ${id}`;
}

/** Candidates with the latest video made for each, for the admin page. */
export async function candidatesWithVideos(db: Db = sql) {
  return db<{ id: number; story_id: number; title: string; heat: string; sources: number; status: string; created_at: Date; video_id: number | null; video_status: VideoStatus | null }[]>`
    SELECT c.id, c.story_id, coalesce(s.title, c.title) AS title, c.heat, c.sources, c.status, c.created_at, v.id AS video_id, v.status AS video_status
    FROM video_candidates c
    LEFT JOIN stories s ON s.id = c.story_id
    LEFT JOIN LATERAL (SELECT id, status FROM video_jobs WHERE story_id = c.story_id ORDER BY id DESC LIMIT 1) v ON true
    ORDER BY c.created_at::date DESC, c.heat DESC, c.id DESC
    LIMIT 40`;
}

/** Sets a video's style; it applies from the next remake (from "script" for the words, "voice" for pace and look). */
export async function setStyle(id: number, style: string, db: Db = sql): Promise<VideoRow> {
  const [row] = await db<VideoRow[]>`UPDATE video_jobs SET style = ${style}, updated_at = now() WHERE id = ${id} AND status NOT IN ('queued', 'running') RETURNING *`;
  if (!row) throw new VideoConflict("This video is queued or being made right now, or does not exist.");
  return row;
}

/** What the style chooser reads of a story: each report's title and summary, and its category. */
export async function styleInputs(storyId: number, db: Db = sql) {
  return db<{ text: string; category: string | null }[]>`
    SELECT DISTINCT ON (a.id) concat_ws(' ', a.title, an.summary_zh, p.summary) AS text, p.category
    FROM facts f
    JOIN fact_articles fa ON fa.fact_id = f.id
    JOIN articles a ON a.id = fa.article_id
    LEFT JOIN publications p ON p.article_id = a.id
    LEFT JOIN analyses an ON an.article_id = a.id AND an.input_revision = a.revision
    WHERE f.story_id = ${storyId}
    ORDER BY a.id, an.id DESC`;
}

/** Videos a day, the automatic ones and the agent's together (VIDEO_DAILY_TARGET, default 3): few, well made. */
export const DAILY_TARGET = () => Math.max(1, Number(process.env.VIDEO_DAILY_TARGET || 3));

/** Videos started today (Vietnam time), whoever started them; failed and rejected ones do not count. */
export async function videosToday(db: Db = sql): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM video_jobs
    WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND status NOT IN ('failed', 'rejected')`;
  return row?.n ?? 0;
}

/** Words that name what a story is about (for "is this the same story as a recent video?"). */
const topicWords = (title: string) => new Set((title.toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) ?? [])
  .filter((w) => !/^(says|said|after|amid|over|into|from|with|will|could|would|than|that|this|their|about|report|reports|news|first|ends?|ending|rules?|amid)$/.test(w)));

/**
 * One automatic video, when today's count is under DAILY_TARGET and nothing is being made: the best candidate of the
 * last 48 hours. Best = hottest, with a bonus for more independent sources (up to 8); a story sharing two or more
 * topic words with a video of the last 3 days is skipped (no second Nvidia video in a row).
 */
export async function autoPick(db: Db = sql): Promise<VideoRow | null> {
  if ((await videosToday(db)) >= DAILY_TARGET()) return null;
  const [busy] = await db`SELECT id FROM video_jobs WHERE status IN ('queued', 'running') LIMIT 1`;
  if (busy) return null;
  const recent = (await db<{ title: string }[]>`SELECT title FROM video_jobs WHERE created_at > now() - interval '3 days'`).map((r) => topicWords(r.title));
  const candidates = await db<{ story_id: number; title: string; heat: number; sources: number }[]>`
    SELECT c.story_id, c.title, c.heat::float AS heat, c.sources FROM video_candidates c
    WHERE c.status = 'new' AND c.created_at > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM video_jobs v WHERE v.story_id = c.story_id)
    ORDER BY c.heat * (1 + 0.1 * least(greatest(c.sources - 3, 0), 5)) DESC
    LIMIT 30`;
  const next = candidates.find((c) => {
    const words = topicWords(c.title);
    return !recent.some((r) => [...words].filter((w) => r.has(w)).length >= 2);
  });
  return next ? createVideo(next.story_id, "auto", db) : null;
}

/** Reports per video (VIDEO_MAX_REPORTS, default 20): more reports, a deeper dossier. */
const MAX_REPORTS = Math.min(40, Math.max(3, Number(process.env.VIDEO_MAX_REPORTS || 20)));

/** The story's reports as the script step reads them (one per article, oldest first). */
export async function storyMaterial(storyId: number, db: Db = sql) {
  return db<{ id: string; title: string; source: string; url: string; published_at: Date | null; headline: string | null; summary: string | null; body: string }[]>`
    SELECT x.* FROM (
      SELECT DISTINCT ON (a.id) a.id, a.title, s.name AS source, a.url, a.published_at,
        an.title_zh AS headline, an.summary_zh AS summary, left(coalesce(a.body_text, ''), 12000) AS body
      FROM facts f
      JOIN fact_articles fa ON fa.fact_id = f.id
      JOIN articles a ON a.id = fa.article_id
      JOIN sources s ON s.id = a.source_id
      LEFT JOIN analyses an ON an.article_id = a.id AND an.input_revision = a.revision
      WHERE f.story_id = ${storyId}
      ORDER BY a.id, an.id DESC
    ) x ORDER BY x.published_at NULLS LAST
    LIMIT ${MAX_REPORTS}`;
}

/** Whether pg-boss holds a live "video.make" job for this video: one waiting, or one running whose video moved to a
 * new step in the last FORCE_QUIET_MINUTES (every step updates the video). A worker killed mid-video leaves its job
 * "active" until it expires (2 hours); a quiet active job is taken to be such a leftover. */
export const FORCE_QUIET_MINUTES = 15;
async function hasLiveJob(id: number, db: Db): Promise<boolean> {
  const [queue] = await db<{ ok: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS ok`;
  if (!queue?.ok) return false; // no job queue yet (a fresh database before the worker first ran)
  const [row] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pgboss.job j
    WHERE j.name = 'video.make' AND j.data->>'id' = ${String(id)} AND (j.state IN ('created', 'retry')
      OR (j.state = 'active' AND EXISTS (SELECT 1 FROM video_jobs v WHERE v.id = ${id} AND v.updated_at > now() - make_interval(mins => ${FORCE_QUIET_MINUTES}))))`;
  return (row?.n ?? 0) > 0;
}
