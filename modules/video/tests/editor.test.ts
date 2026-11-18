import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { sql } from "@aihot/backend/db";
import { config } from "@aihot/backend/config";

// Each video's files go to a scratch folder; the modules read it when they load.
process.env.VIDEO_WORK_DIR = mkdtempSync(path.join(tmpdir(), "pipelinex-editor-"));
process.env.VIDEO_EDITOR_TOKEN = "t".repeat(32);
const { editHistory, editScript } = await import("../backend/editing.ts");
const { admitted } = await import("../backend/editor-mcp.ts");
const { createVideo, finishVideo, markStep } = await import("../backend/videos.ts");

const script = (title: string) => ({
  title, description: "Old description.", thumbnail_text: "OLD WORDS",
  scenes: [{ kind: "hook", kicker: "WHAT HAPPENED", headline: "H", beats: [{ narration: "First sentence.", visual: { type: "card" } }, { narration: "Second sentence.", visual: { type: "card" } }] }],
});

async function madeVideo() {
  const [story] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title) VALUES (gen_random_uuid(), 'Editor test') RETURNING id`;
  const video = await createVideo(story!.id, "test");
  const dir = path.join(process.env.VIDEO_WORK_DIR!, String(video.id));
  mkdirSync(dir, { recursive: true });
  for (const name of ["script.json", "script-final.json"]) writeFileSync(path.join(dir, name), JSON.stringify(script("Old title")));
  writeFileSync(path.join(dir, "timeline.json"), JSON.stringify({ title: "Old title", thumbnail_text: "OLD WORDS", total: 10, scenes: [] }));
  return { video, dir };
}

test("an edit changes both long scripts and the timeline's title words, and is kept in the history", async () => {
  const { video, dir } = await madeVideo();
  await assert.rejects(editScript(video.id, "editor-mcp", { variant: "long", edits: [{ scene: 0, beat: 0, narration: "New first." }] }), /being made/);
  await markStep(video.id, "render");
  await finishVideo(video.id, null);

  await assert.rejects(editScript(video.id, "editor-mcp", { variant: "long", edits: [{ scene: 0, beat: 9, narration: "Nowhere." }] }), /no scene 0, beat 9/);
  const out = await editScript(video.id, "editor-mcp", {
    variant: "long", edits: [{ scene: 0, beat: 1, narration: "According to the filing, a second sentence." }],
    title: "New title", thumbnailText: "NEW WORDS", note: "attribution",
  });
  assert.equal(out.changed, 3);
  for (const name of ["script.json", "script-final.json"]) {
    const s = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
    assert.deepEqual([s.title, s.thumbnail_text, s.scenes[0].beats[0].narration, s.scenes[0].beats[1].narration],
      ["New title", "NEW WORDS", "First sentence.", "According to the filing, a second sentence."]);
  }
  const timeline = JSON.parse(readFileSync(path.join(dir, "timeline.json"), "utf8"));
  assert.deepEqual([timeline.title, timeline.thumbnail_text], ["New title", "NEW WORDS"], "the thumbnail is redrawn with the new words");
  const [entry] = editHistory(video.id);
  assert.equal(entry!.kind, "edit");
  assert.equal(entry!.note, "attribution");
  assert.deepEqual(entry!.detail.beats, [{ scene: 0, beat: 1, before: "Second sentence.", after: "According to the filing, a second sentence." }]);
});

test("the editor answers only a direct local connection with the token", () => {
  const port = Number(config.apiPort);
  const req = (headers: Record<string, string>, address = "127.0.0.1") => ({ headers, socket: { remoteAddress: address } }) as never;
  const good = { host: `127.0.0.1:${port}`, authorization: `Bearer ${"t".repeat(32)}` };
  assert.equal(admitted(req(good)), null);
  assert.equal(admitted(req({ ...good, authorization: "Bearer wrong" })), "unauthorized");
  assert.equal(admitted(req(good, "10.0.0.7")), "forbidden", "another machine");
  assert.equal(admitted(req({ ...good, via: "1.1 pipelinex-web" })), "forbidden", "through the web server");
  assert.equal(admitted(req({ ...good, "x-forwarded-for": "1.2.3.4" })), "forbidden");
  assert.equal(admitted(req({ ...good, origin: "https://example.com" })), "forbidden", "from a browser page");
  assert.equal(admitted(req({ ...good, host: "127.0.0.1:3000" })), port === 3000 ? null : "forbidden", "the web server's port");
  const saved = process.env.VIDEO_EDITOR_TOKEN;
  process.env.VIDEO_EDITOR_TOKEN = "";
  try { assert.equal(admitted(req(good)), "disabled"); } finally { process.env.VIDEO_EDITOR_TOKEN = saved; }
});
