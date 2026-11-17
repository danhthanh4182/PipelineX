import { Composition } from "remotion";
import { NewsVideo, FPS, INTRO, OUTRO, type Timeline } from "./NewsVideo";
import sample from "./timeline.json";

// The timeline comes in as input props (--props=<work dir>/timeline.json); the sample is for the studio.
export const Root = () => (
  <Composition id="NewsVideo" component={NewsVideo} fps={FPS} width={1920} height={1080} durationInFrames={FPS}
    defaultProps={sample as unknown as Timeline}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil((INTRO + props.total + OUTRO) * FPS) })} />
);
