// PipelineX video module: its admin page. Plain data, read by every process and by the web build.
import { defineModule } from "@aihot/contracts/modules";

export const videoModule = defineModule({
  name: "video",
  pages: [{ path: "videos", file: "web/videos.tsx", admin: true, nav: "Videos" }],
});
