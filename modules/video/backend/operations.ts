// What the editor MCP's operator tools read and do beyond one video: candidate and searchable stories, a story's
// reports, starting a video, the system's health and putting failed articles back into processing.
import { sql } from "@aihot/backend/db";
import { audit } from "@aihot/backend/audit";
import { requeueFailedArticles, runsOverview } from "@aihot/backend/admin/runs";
import { candidatesWithVideos, storyMaterial } from "./videos.ts";

export async function candidates() {
  return (await candidatesWithVideos()).sort((a, b) => b.priority.total - a.priority.total).map((c) => ({
    storyId: c.story_id, title: c.title, heat: Number(c.heat), sources: c.sources, readableSources: c.readable ?? 0, pickedAt: c.created_at,
    priority: c.priority,
    video: c.video_id ? { id: c.video_id, status: c.video_status } : null,
  }));
}

/** Stories (events) of the last `days` whose title matches, with how many outlets reported them. */
export async function searchStories(q: string, days: number) {
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return sql<{ storyId: number; title: string; sources: number; reports: number; lastReport: Date | null; videoId: number | null }[]>`
    SELECT s.id AS "storyId", s.title, count(DISTINCT a.source_id)::int AS sources, count(DISTINCT a.id)::int AS reports,
           max(a.discovered_at) AS "lastReport", (SELECT max(v.id) FROM video_jobs v WHERE v.story_id = s.id) AS "videoId"
    FROM stories s
    JOIN facts f ON f.story_id = s.id
    JOIN fact_articles fa ON fa.fact_id = f.id
    JOIN articles a ON a.id = fa.article_id
    WHERE s.merged_into IS NULL AND s.title ILIKE ${like} AND a.discovered_at > now() - make_interval(days => ${days})
    GROUP BY s.id ORDER BY max(a.discovered_at) DESC LIMIT 20`;
}

/** A story's reports as an editor weighs them: outlet, date, headline, summary, link (no full text). */
export async function story(storyId: number) {
  const [s] = await sql<{ id: number; title: string }[]>`SELECT id, title FROM stories WHERE id = ${storyId} AND merged_into IS NULL`;
  if (!s) return null;
  const reports = (await storyMaterial(storyId)).map((r) => ({
    outlet: r.source, publishedAt: r.published_at, title: r.title, summary: r.summary ?? "", url: r.url, chars: r.body.length,
  }));
  const videos = await sql<{ id: number; status: string; created_at: Date }[]>`SELECT id, status, created_at FROM video_jobs WHERE story_id = ${storyId} ORDER BY id DESC`;
  return { storyId: s.id, title: s.title, reports, videos };
}

/** The system at a glance, from the admin's Operations page plus the video module and the providers. */
export async function systemStatus() {
  const runs = await runsOverview();
  const [videos, articles, providers] = await Promise.all([
    sql<{ status: string; n: number }[]>`SELECT status, count(*)::int AS n FROM video_jobs GROUP BY 1 ORDER BY 1`,
    sql<{ state: string; n: number }[]>`SELECT processing_state AS state, count(*)::int AS n FROM articles WHERE discovered_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1`,
    sql<{ service: string; status: string; n: number; error: string | null }[]>`
      SELECT service, status, count(*)::int AS n, left((array_agg(error ORDER BY updated_at DESC) FILTER (WHERE error IS NOT NULL))[1], 160) AS error
      FROM receipts WHERE created_at > now() - interval '1 hour' GROUP BY 1, 2 ORDER BY 1, 2`,
  ]);
  return {
    checkedAt: runs.checkedAt,
    processes: runs.processes.map((p) => ({ role: p.role, alive: p.alive, at: p.at })),
    queues: runs.queues,
    failedJobs24h: runs.failedJobs.map((j) => ({ queue: j.name, failed: j.failed, last: j.last })),
    scheduledJobsFailing: runs.jobs.filter((j) => j.status === "failed").map((j) => ({ job: j.job, error: j.error, at: j.started_at })),
    laggingSources: runs.lagging.map((s) => ({ id: s.id, name: s.name, health: s.health, lastError: s.last_error })),
    articles7d: Object.fromEntries(articles.map((a) => [a.state, a.n])),
    failedArticleGroups: runs.errors.map((e) => ({ group: e.error, count: e.n, last: e.last })),
    retryingArticles: runs.retrying,
    providersLastHour: providers,
    videos: Object.fromEntries(videos.map((v) => [v.status, v.n])),
  };
}

export async function retryFailedArticles(group: string | null, reason: string, actor: string) {
  return requeueFailedArticles({ group, reason }, actor);
}

/** A trail in the admin's Audit Log for what the agent does, besides each video's own history. */
export async function auditAgent(actor: string, action: string, subject: string, reason: string | null, after: unknown) {
  await audit(actor, action, subject, reason, null, after);
}
