// PipelineX video module (evaluation): plugs into AIHOT without touching the engine.
import type { ServerModule } from "@aihot/backend/modules";
import { sessionPrincipal } from "@aihot/backend/admin/auth";
import { listCandidates, pickCandidates } from "./backend/candidates.ts";

export const videoServer: ServerModule = {
  name: "video",
  schedules: [{ name: "video-pick-candidates", cron: "*/10 * * * *", missed: "skip", run: () => pickCandidates() }],
  http(app) {
    app.get("/api/admin/video/candidates", async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      if (!(await sessionPrincipal(req.headers.cookie))) return reply.code(401).send({ error: "unauthorized" });
      return { candidates: await listCandidates() };
    });
  },
};
