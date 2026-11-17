// Picks hot stories (events) that have enough independent reports to carry a 10–15 minute video.
import { sql, type Db } from "@aihot/backend/db";

export const MIN_SOURCES = Number(process.env.VIDEO_MIN_SOURCES || 3);

export async function pickCandidates(db: Db = sql, limit = 10): Promise<number> {
  const rows = await db`
    WITH heat AS (
      SELECT story_id, max(heat) AS heat
      FROM story_heat_hourly
      WHERE hour > now() - interval '48 hours'
      GROUP BY story_id
    ), reports AS (
      SELECT f.story_id, count(DISTINCT a.source_id) AS sources
      FROM facts f
      JOIN fact_articles fa ON fa.fact_id = f.id
      JOIN articles a ON a.id = fa.article_id
      GROUP BY f.story_id
    )
    INSERT INTO video_candidates (story_id, title, heat, sources)
    SELECT s.id, s.title, h.heat, r.sources
    FROM stories s
    JOIN heat h ON h.story_id = s.id
    JOIN reports r ON r.story_id = s.id
    WHERE s.merged_into IS NULL AND r.sources >= ${MIN_SOURCES}
    ORDER BY h.heat DESC
    LIMIT ${limit}
    ON CONFLICT (story_id) DO NOTHING
    RETURNING id`;
  return rows.length;
}

export async function listCandidates(db: Db = sql) {
  return db`SELECT id, story_id, title, heat, sources, status, created_at FROM video_candidates ORDER BY heat DESC, id DESC LIMIT 50`;
}
