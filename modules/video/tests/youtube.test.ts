import assert from "node:assert/strict";
import { test } from "node:test";

process.env.YOUTUBE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.YOUTUBE_CLIENT_SECRET = "test-secret";
const { connectUrl, finishConnect, publishPublic, youtubeStatus, YouTubeError } = await import("../backend/youtube.ts");

test("connecting asks Google for upload, manage and analytics access, offline, with a one-use state", async () => {
  const url = new URL(connectUrl("admin:1"));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.match(url.searchParams.get("scope")!, /youtube\.upload.*youtube\.force-ssl.*yt-analytics\.readonly/);
  assert.match(url.searchParams.get("redirect_uri")!, /\/api\/admin\/video\/youtube\/callback$/);
  const state = url.searchParams.get("state")!;
  await assert.rejects(finishConnect("code", state, "admin:2"), YouTubeError, "another admin's callback is refused");
  await assert.rejects(finishConnect("code", state, "admin:1"), YouTubeError, "a state works once");
  await assert.rejects(finishConnect("code", "made-up", "admin:1"), YouTubeError);
  const status = youtubeStatus();
  assert.equal(status.configured, true);
  assert.ok(!("refreshToken" in status), "the status never carries the token");
});

test("a video that was never uploaded cannot be published", async () => {
  await assert.rejects(publishPublic(987654, "admin:1"), /not on YouTube yet/);
});
