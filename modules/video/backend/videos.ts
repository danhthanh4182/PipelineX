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
export async function createVideo(storyId: number, createdBy: string, db: Db = sql): Promise<VideoRow> {
  const [story] = await db<{ id: number; title: string }[]>`SELECT id, title FROM stories WHERE id = ${storyId} AND merged_into IS NULL`;
  if (!story) throw new VideoConflict("This story does not exist or was merged into another.");
  const [busy] = await db`SELECT id FROM video_jobs WHERE story_id = ${storyId} AND status IN ('queued', 'running')`;
  if (busy) throw new VideoConflict(`Video #${busy.id} for this story is already in progress.`);
  const [row] = await db<VideoRow[]>`
    INSERT INTO video_jobs (story_id, title, created_by) VALUES (${storyId}, ${story.title}, ${createdBy}) RETURNING *`;
  await db`UPDATE video_candidates SET status = 'selected' WHERE story_id = ${storyId}`;
  return row!;
}

/** Queue a video again from a step; only a video that is not queued or (recently) running. */
export async function requeueVideo(id: number, from: Step, db: Db = sql): Promise<VideoRow> {
  const [row] = await db<VideoRow[]>`
    UPDATE video_jobs SET status = 'queued', step = ${from}, error = NULL, finished_at = NULL, updated_at = now()
    WHERE id = ${id} AND (status NOT IN ('queued', 'running') OR updated_at < now() - make_interval(mins => ${STALE_MINUTES}))
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

/** The day's automatic video: the hottest candidate not made yet, once a day. */
export async function autoPick(db: Db = sql): Promise<VideoRow | null> {
  const [today] = await db`SELECT id FROM video_jobs WHERE created_by = 'auto' AND created_at > now() - interval '20 hours'`;
  if (today) return null;
  const [next] = await db<{ story_id: number }[]>`
    SELECT c.story_id FROM video_candidates c
    WHERE c.status = 'new' AND c.created_at > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM video_jobs v WHERE v.story_id = c.story_id)
    ORDER BY c.heat DESC LIMIT 1`;
  return next ? createVideo(next.story_id, "auto", db) : null;
}

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
    LIMIT 12`;
}
