import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "@aihot/backend/db";
import { autoPick, createVideo, finishVideo, markStep, priorityOf, recordStep, requeueVideo, reviewVideo, VideoConflict, videosToday } from "../backend/videos.ts";

async function story(title: string) {
  const [row] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title) VALUES (gen_random_uuid(), ${title}) RETURNING id`;
  return row!.id;
}

test("a story gets one video in progress at a time, and a finished one can be reviewed", async () => {
  const id = await story("Video rules");
  const video = await createVideo(id, "test");
  assert.equal(video.status, "queued");
  await assert.rejects(createVideo(id, "test"), VideoConflict, "a second video while the first is queued");
  await assert.rejects(reviewVideo(video.id, "approved"), VideoConflict, "nothing to approve before it is made");
  await assert.rejects(requeueVideo(video.id, "script"), VideoConflict, "already queued");

  await markStep(video.id, "script");
  await recordStep(video.id, "script", { cost: 0.012, words: 450 });
  await recordStep(video.id, "voice", { duration: 201.4 });
  await finishVideo(video.id, null);
  const approved = await reviewVideo(video.id, "approved");
  assert.deepEqual([approved.status, Number(approved.cost), Number(approved.duration_s), approved.step], ["approved", 0.012, 201.4, null]);
  assert.deepEqual(Object.keys(approved.result).sort(), ["script", "voice"]);

  const again = await requeueVideo(video.id, "assets");
  assert.deepEqual([again.status, again.step], ["queued", "assets"]);
});

test("force restarts a video left running by a worker restart, but only when its job is gone", async () => {
  const video = await createVideo(await story("Video orphaned"), "test");
  await markStep(video.id, "render");
  await assert.rejects(requeueVideo(video.id, "render"), VideoConflict, "running recently: refused without force");
  const again = await requeueVideo(video.id, "render", sql, true);
  assert.deepEqual([again.status, again.step], ["queued", "render"]);
});

test("a failed step is kept with its error", async () => {
  const video = await createVideo(await story("Video failure"), "test");
  await markStep(video.id, "render");
  await finishVideo(video.id, "render exited 1: out of memory");
  const [row] = await sql`SELECT status, step, error FROM video_jobs WHERE id = ${video.id}`;
  assert.deepEqual({ ...row }, { status: "failed", step: "render", error: "render exited 1: out of memory" });
});

test("priority: heat 35, report quality 30, readable sources 20, freshness 15", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const hours = (h: number) => new Date(now - h * 3_600_000);
  assert.deepEqual(priorityOf({ heat: 50, quality: 80, readable: 6, latest: hours(2) }, 50, now), { total: 94, heat: 35, quality: 24, readable: 20, fresh: 15 });
  const old = priorityOf({ heat: 25, quality: 40, readable: 3, latest: hours(30) }, 50, now);
  assert.deepEqual([old.heat, old.quality, old.readable, old.fresh], [17.5, 12, 10, 7.5], "half the heat, 3 of 6 sources, half fresh at 30 h");
  assert.equal(priorityOf({ heat: 10, quality: null, readable: null, latest: hours(60) }, 50, now).fresh, 0, "nothing for a 2-day-old story");
});

test("automatic videos: the best candidate, one at a time, at most the daily target, never the same topic twice", async () => {
  await sql`UPDATE video_candidates SET status = 'skipped'`;
  await sql`DELETE FROM video_jobs`;
  process.env.VIDEO_DAILY_TARGET = "2";
  const add = async (title: string, heat: number, sources: number) => {
    const id = await story(title);
    await sql`INSERT INTO video_candidates (story_id, title, heat, sources) VALUES (${id}, ${title}, ${heat}, ${sources})`;
    return id;
  };
  await add("Cool story about tariffs", 5, 3);
  const top = await add("Nvidia earnings beat estimates", 60, 8);
  const twin = await add("Nvidia earnings: what analysts expect", 55, 6);
  const next = await add("Bitcoin falls below support", 50, 3);

  const first = await autoPick();
  assert.equal(first?.story_id, top, "the highest priority");
  assert.equal(await autoPick(), null, "nothing new while a video is being made");
  await finishVideo(first!.id, null);

  const second = await autoPick();
  assert.equal(second?.story_id, next, "the Nvidia follow-up shares the topic of today's video and is skipped");
  await finishVideo(second!.id, null);
  assert.equal(await autoPick(), null, "the daily target is reached");
  assert.equal(await videosToday(), 2);

  const [c] = await sql`SELECT status FROM video_candidates WHERE story_id = ${twin}`;
  assert.equal(c!.status, "new", "a skipped twin stays a candidate");
  delete process.env.VIDEO_DAILY_TARGET;
});
