import { Composition, Still } from "remotion";
import { NewsVideo, FPS, INTRO, OUTRO, type Timeline } from "./NewsVideo";
import { Thumbnail } from "./Thumbnail";
import { ShortVideo, SHORT_TAIL } from "./ShortVideo";
import sample from "./timeline.json";

// The timeline comes in as input props (--props=<work dir>/timeline.json); the sample is for the studio.
export const Root = () => (
  <>
    <Composition id="NewsVideo" component={NewsVideo} fps={FPS} width={1920} height={1080} durationInFrames={FPS}
      defaultProps={sample as unknown as Timeline}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil((INTRO + props.total + OUTRO) * FPS) })} />
    <Composition id="ShortVideo" component={ShortVideo} fps={FPS} width={1080} height={1920} durationInFrames={FPS}
      defaultProps={sample as unknown as Timeline}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil((props.total + SHORT_TAIL) * FPS) })} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} defaultProps={sample as unknown as Timeline} />
  </>
);
