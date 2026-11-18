import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "@aihot/backend/db";
import { autoPick, createVideo, finishVideo, markStep, recordStep, requeueVideo, reviewVideo, VideoConflict } from "../backend/videos.ts";

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

test("the daily automatic video takes the hottest new candidate, once a day", async () => {
  await sql`UPDATE video_candidates SET status = 'skipped'`;
  await sql`DELETE FROM video_jobs WHERE created_by = 'auto'`;
  const cool = await story("Cool story");
  const hot = await story("Hot story");
  await sql`INSERT INTO video_candidates (story_id, title, heat, sources) VALUES (${cool}, 'Cool story', 5, 3), (${hot}, 'Hot story', 50, 4)`;
  const first = await autoPick();
  assert.equal(first?.story_id, hot);
  assert.equal(await autoPick(), null, "one automatic video a day");
  const [c] = await sql`SELECT status FROM video_candidates WHERE story_id = ${hot}`;
  assert.equal(c!.status, "selected");
});
