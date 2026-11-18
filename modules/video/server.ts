// PipelineX video module: picks candidate stories, makes videos from them in the worker, and gives the
// admin page (/admin/videos) its data, commands and the rendered files. Plugs into AIHOT without touching the engine.
import { createReadStream, statSync } from "node:fs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { ServerModule } from "@aihot/backend/modules";
import { defineQueue } from "@aihot/backend/modules";
import { enqueueOn } from "@aihot/backend/jobs/queue";
import { actorOf, sessionPrincipal, type AdminPrincipal } from "@aihot/backend/admin/auth";
import { config } from "@aihot/backend/config";
import { pickCandidates } from "./backend/candidates.ts";
import { registerEditorMcp } from "./backend/editor-mcp.ts";
import { editHistory, recordEdit } from "./backend/editing.ts";
import { captionsSrt, editKit, publishKit } from "./backend/publishing.ts";
import { decideRule, StyleConflict, styleGuide } from "./backend/style.ts";
import { STYLE_KEYS, STYLES } from "./backend/styles.ts";
import { makeVideo, shortFile, thumbnailFile, videoFile, videoFiles } from "./backend/pipeline.ts";
import { autoPick, candidatesWithVideos, createVideo, getVideo, listVideos, requeueVideo, reviewVideo, setStyle, STEPS, VideoConflict, type Step } from "./backend/videos.ts";

export const AUTO_ENABLED = () => process.env.VIDEO_AUTO_ENABLED === "true";

export const makeQueue = defineQueue<{ id: number; from: Step }>({
  name: "video.make",
  // One video at a time: rendering takes the machine's cores. A failed step is retried by hand from the admin page.
  options: { policy: "standard", retryLimit: 0, expireInSeconds: 2 * 3600 },
  worker: { batchSize: 1, pollingIntervalSeconds: 5 },
  run: async ([job]) => {
    if (job) await makeVideo(job.id, job.from);
  },
});

async function enqueue(id: number, from: Step) {
  await enqueueOn(makeQueue, { id, from });
}

type Handler = (req: FastifyRequest, reply: FastifyReply, admin: AdminPrincipal) => Promise<unknown>;

/** The engine admin's session; commands also need its CSRF token (as apps/api's adminHandler). */
function guarded(fn: Handler) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store");
    const admin = await sessionPrincipal(req.headers.cookie);
    if (!admin) return reply.code(401).send({ error: "unauthorized", detail: "Sign in to the admin first." });
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers["x-csrf-token"] !== admin.csrf) {
      return reply.code(403).send({ error: "forbidden", detail: "Missing or stale CSRF token." });
    }
    try {
      return await fn(req, reply, admin);
    } catch (error) {
      if (error instanceof VideoConflict || error instanceof StyleConflict) return reply.code(409).send({ error: "conflict", detail: error.message });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: "invalid_request", detail: error.issues.map((i) => i.message).join("; ") });
      req.log.error({ err: error }, "video admin error");
      return reply.code(500).send({ error: "internal_error", detail: String((error as Error).message).slice(0, 300) });
    }
  };
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** A rendered file, with byte ranges so the browser can seek; `download` asks the browser to save it. */
function sendVideo(req: FastifyRequest, reply: FastifyReply, file: string, type = "video/mp4") {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return reply.code(404).send({ error: "not_found", detail: "This video has not been rendered." });
  }
  reply.header("Content-Type", type).header("Accept-Ranges", "bytes");
  const name = (req.query as Record<string, string> | undefined)?.download;
  if (name && /^[\w.-]{1,80}$/.test(name)) reply.header("Content-Disposition", `attachment; filename="${name}"`);
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return reply.code(416).header("Content-Range", `bytes */${size}`).send();
    reply.code(206).header("Content-Range", `bytes ${start}-${end}/${size}`).header("Content-Length", end - start + 1);
    return reply.send(createReadStream(file, { start, end }));
  }
  reply.header("Content-Length", size);
  return reply.send(createReadStream(file));
}

export const videoServer: ServerModule = {
  name: "video",
  queues: [makeQueue as never],
  schedules: [
    { name: "video-pick-candidates", cron: "*/10 * * * *", missed: "skip", run: () => pickCandidates() },
    // Shanghai 09:30 = 01:30 UTC: after the 08:00 daily edition, so the day's stories are grouped.
    { name: "video-daily", cron: "30 9 * * *", missed: "once", when: AUTO_ENABLED, run: async () => {
      const video = await autoPick();
      if (video) await enqueue(video.id, "story");
      return { video: video?.id ?? null };
    } },
  ],
  http(app) {
    // The editor MCP for a local AI agent (Antigravity…): direct local connections with VIDEO_EDITOR_TOKEN only.
    registerEditorMcp(app, makeQueue);

    app.get("/api/admin/video/overview", guarded(async (_req, _reply, admin) => ({
      csrf: admin.csrf,
      auto: AUTO_ENABLED(),
      modelCalls: config.modelCallsEnabled,
      steps: STEPS,
      candidates: await candidatesWithVideos(),
      style: await styleGuide(),
      styles: STYLE_KEYS.map((k) => ({ key: k, label: STYLES[k].label, for: STYLES[k].for, sensitive: !!STYLES[k].sensitive })),
      videos: await listVideos(),
    })));

    app.get("/api/admin/video/videos/:id", guarded(async (req, reply) => {
      const { id } = idParam.parse(req.params);
      const video = await getVideo(id);
      if (!video) return reply.code(404).send({ error: "not_found", detail: "No such video." });
      const done = video.status === "ready" || video.status === "approved" || video.status === "rejected";
      return { video, ...videoFiles(id), history: editHistory(id), publish: done ? publishKit(id) : null };
    }));

    app.get("/api/admin/video/videos/:id/video.mp4", guarded(async (req, reply) => sendVideo(req, reply, videoFile(idParam.parse(req.params).id))));
    app.get("/api/admin/video/videos/:id/short.mp4", guarded(async (req, reply) => sendVideo(req, reply, shortFile(idParam.parse(req.params).id))));
    app.get("/api/admin/video/videos/:id/captions.srt", guarded(async (req, reply) => {
      const { id } = idParam.parse(req.params);
      const variant = z.object({ variant: z.enum(["long", "short"]).default("long") }).parse(req.query).variant;
      const srt = captionsSrt(id, variant);
      if (!srt) return reply.code(404).send({ error: "not_found", detail: "No timeline for this video yet." });
      return reply.header("Content-Type", "application/x-subrip; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="video-${id}${variant === "short" ? "-short" : ""}.srt"`).send(srt);
    }));
    app.get("/api/admin/video/videos/:id/thumbnail.jpg", guarded(async (req, reply) => sendVideo(req, reply, thumbnailFile(idParam.parse(req.params).id), "image/jpeg")));

    app.post("/api/admin/video/videos", guarded(async (req, _reply, admin) => {
      const { storyId } = z.object({ storyId: z.coerce.number().int().positive() }).parse(req.body);
      const video = await createVideo(storyId, actorOf(admin));
      await enqueue(video.id, "story");
      return { video };
    }));

    app.post("/api/admin/video/videos/:id/retry", guarded(async (req) => {
      const { id } = idParam.parse(req.params);
      const { from } = z.object({ from: z.enum(STEPS) }).parse(req.body);
      const video = await requeueVideo(id, from);
      await enqueue(id, from);
      return { video };
    }));

    app.post("/api/admin/video/videos/:id/publish-kit", guarded(async (req, _reply, admin) => {
      const { id } = idParam.parse(req.params);
      const input = z.object({
        redraft: z.boolean().optional(),
        longTitle: z.string().trim().min(10).max(100).optional(), longDescription: z.string().trim().min(50).max(5000).optional(),
        longTags: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
        titleOptions: z.array(z.string().trim().min(10).max(100)).min(1).max(3).optional(),
        shortTitle: z.string().trim().min(5).max(100).optional(), shortDescription: z.string().trim().min(10).max(5000).optional(),
      }).parse(req.body);
      if (input.redraft) return { publish: publishKit(id, true) };
      const { redraft: _r, ...edit } = input;
      const out = editKit(id, edit);
      if (!out) throw new VideoConflict("This video is not finished yet.");
      recordEdit(id, { actor: actorOf(admin), kind: "edit", detail: { variant: "publish", kit: out.changes } });
      return { publish: out.kit };
    }));

    app.post("/api/admin/video/videos/:id/style", guarded(async (req, _reply, admin) => {
      const { id } = idParam.parse(req.params);
      const { style } = z.object({ style: z.enum(STYLE_KEYS as [string, ...string[]]) }).parse(req.body);
      const before = (await getVideo(id))?.style ?? null;
      const video = await setStyle(id, style);
      recordEdit(id, { actor: actorOf(admin), kind: "edit", detail: { variant: "style", style: { before, after: style } } });
      return { video };
    }));

    app.post("/api/admin/video/style/:rule", guarded(async (req, _reply, admin) => {
      const rule = z.object({ rule: z.string().regex(/^[a-f0-9-]{4,40}$/) }).parse(req.params).rule;
      const { status } = z.object({ status: z.enum(["active", "rejected", "retired"]) }).parse(req.body);
      return { rule: await decideRule(actorOf(admin), rule, status) };
    }));

    app.post("/api/admin/video/videos/:id/review", guarded(async (req) => {
      const { id } = idParam.parse(req.params);
      const { status } = z.object({ status: z.enum(["approved", "rejected", "ready"]) }).parse(req.body);
      return { video: await reviewVideo(id, status) };
    }));
  },
};
