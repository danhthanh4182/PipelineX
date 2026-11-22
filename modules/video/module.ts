// PipelineX video module: its admin page. Plain data, read by every process and by the web build.
import { defineModule } from "@aihot/contracts/modules";

export const videoModule = defineModule({
  name: "video",
  // In the engine's back office, at the top of its sidebar: the page used every day.
  pages: [
    { path: "videos", file: "web/videos.tsx", admin: true, nav: "Videos", shell: "engine", group: "Production" },
    { path: "lexicon", file: "web/lexicon.tsx", admin: true, nav: "Lexicon", shell: "engine", group: "Production" },
    { path: "voice", file: "web/voice.tsx", admin: true, nav: "Voice", shell: "engine", group: "Production" },
  ],
});
