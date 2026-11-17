import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "@aihot/backend/db";
import { listCandidates, pickCandidates } from "../backend/candidates.ts";

test("picks hot stories reported by enough sources, once", async () => {
  const [story] = await sql`INSERT INTO stories (public_id, title) VALUES (gen_random_uuid(), 'Test event') RETURNING id`;
  await sql`INSERT INTO story_heat_hourly (story_id, hour, heat, participants) VALUES (${story.id}, date_trunc('hour', now()), 42, 3)`;
  const [fact] = await sql`INSERT INTO facts (public_id, story_id, title) VALUES (gen_random_uuid()::text, ${story.id}, 'Test fact') RETURNING id`;
  for (const i of [0, 1, 2]) {
    const id = `video-test-${i}`;
    await sql`INSERT INTO sources (id, name, kind, tier) VALUES (${id}, ${"Video test " + i}, 'rss', 'T2') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO articles (id, source_id, identity_key, url, title, discovered_at, timeline_at)
      VALUES (${id}, ${id}, ${id}, ${"https://example.com/" + id}, 'Report', now(), now())`;
    await sql`INSERT INTO fact_articles (fact_id, article_id) VALUES (${fact.id}, ${id})`;
  }
  assert.ok((await pickCandidates()) >= 1);
  assert.equal(await pickCandidates(), 0);
  assert.ok((await listCandidates()).some((c) => c.story_id === story.id));
});
