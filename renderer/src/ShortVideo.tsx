// Vertical YouTube Short (1080×1920) from timeline-short.json: full-bleed pictures the long video already checked,
// big word-by-word captions in the middle, a progress bar, and a closing call to the full story.
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, Easing } from "remotion";
import { FPS, type Timeline } from "./NewsVideo";

/** Seconds the closing card stays after the last word. */
export const SHORT_TAIL = 1.5;

type Word = { text: string; start: number; end: number };
type Visual = Record<string, any> & { type: string };
type Beat = { narration: string; visual: Visual; audio: string; start: number; duration: number; words: Word[] };

const C = { bg: "#0b0f17", ink: "#ffffff", dim: "#aab3c5", accent: "#36d399", hot: "#ff3b3b", yellow: "#ffd23f", paper: "#f7f5ef", dark: "#111317" };
const SANS = "Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'New York', Georgia, 'Times New Roman', serif";

const Backdrop = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${30 + 8 * Math.sin(f / 70)}%, rgba(54,211,153,0.20), transparent 60%)` }} />
    </AbsoluteFill>
  );
};

const Picture = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, frames], [1.08, 1.18], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {v.asset.kind === "video" ? (
        <Loop durationInFrames={Math.max(1, Math.floor((v.asset.duration ?? 10) * FPS))}>
          <OffthreadVideo src={staticFile(v.asset.file)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
        </Loop>
      ) : (
        <Img src={staticFile(v.asset.file)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 45%, rgba(0,0,0,0.7) 100%)" }} />
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 120, color: "rgba(255,255,255,0.7)", fontFamily: SANS, fontSize: 22, textAlign: "center" }}>
        {v.asset.kind === "video" ? "Video" : "Photo"}: {v.asset.credit} · {v.asset.license}
      </div>
    </AbsoluteFill>
  );
};

const Article = ({ v }: { v: Visual }) => {
  const f = useCurrentFrame();
  const s = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 330 }}>
        <div style={{ width: 940, background: C.paper, borderRadius: 26, padding: "50px 54px", boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          transform: `translateY(${(1 - s) * 80}px) scale(${1 + 0.04 * interpolate(f, [0, 150], [0, 1], { extrapolateRight: "clamp" })})`, opacity: s }}>
          <div style={{ display: "inline-block", background: C.hot, color: "white", fontFamily: SANS, fontWeight: 900, fontSize: 34, padding: "6px 16px", borderRadius: 8 }}>{v.name}</div>
          <div style={{ marginTop: 28, fontFamily: SERIF, fontWeight: 700, fontSize: 66, lineHeight: 1.12, color: C.dark }}>{v.headline}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Stat = ({ v }: { v: Visual }) => {
  const f = useCurrentFrame();
  const m = String(v.value).match(/^(\D*)([\d,.]+)(.*)$/);
  const target = m ? Number(m[2]!.replace(/,/g, "")) : 0;
  const dec = m && m[2]!.includes(".") ? m[2]!.split(".")[1]!.length : 0;
  const cur = interpolate(f, [0, 30], [0, target], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const text = m ? `${m[1]}${cur.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}${m[3]}` : v.value;
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 420, padding: "420px 60px 0", textAlign: "center", fontFamily: SANS }}>
        <div style={{ color: C.accent, fontSize: String(text).length > 8 ? 150 : 210, fontWeight: 900, letterSpacing: -4 }}>{text}</div>
        <div style={{ color: C.ink, fontSize: 52, fontWeight: 700, marginTop: 10, lineHeight: 1.2 }}>{v.label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Quote = ({ v }: { v: Visual }) => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ padding: "360px 70px 0", fontFamily: SERIF }}>
      <div style={{ color: C.accent, fontSize: 200, lineHeight: 0.6, height: 100 }}>“</div>
      <div style={{ color: C.ink, fontSize: 64, lineHeight: 1.2, fontWeight: 600 }}>{v.text}</div>
      <div style={{ marginTop: 34, fontFamily: SANS, color: C.dim, fontSize: 38 }}>— {v.speaker}</div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/** Phrases like the captions: a new one after a pause or `max` words. */
const phrasesOf = (words: Word[], max: number) => {
  const groups: Word[][] = [];
  for (const w of words) {
    const cur = groups[groups.length - 1]; const prev = cur?.[cur.length - 1];
    if (!cur || cur.length >= max || (prev && w.start - prev.end > 0.18)) groups.push([w]); else cur.push(w);
  }
  return groups;
};

/** Big captions, 4 words at a time, the spoken word in yellow; on a text-only beat they sit higher and larger. */
const Captions = ({ words, center }: { words: Word[]; center: boolean }) => {
  const t = useCurrentFrame() / FPS;
  const g = phrasesOf(words, 4).find((grp) => t >= grp[0]!.start - 0.05 && t <= grp[grp.length - 1]!.end + 0.2);
  if (!g) return null;
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top: center ? 760 : 1180, textAlign: "center", fontFamily: SANS }}>
      <span style={{ fontSize: center ? 104 : 84, fontWeight: 900, lineHeight: 1.12, color: C.ink,
        textShadow: "0 6px 0 rgba(0,0,0,0.6), 0 0 30px rgba(0,0,0,0.8)", WebkitTextStroke: "3px rgba(0,0,0,0.55)" }}>
        {g.map((w, i) => <span key={i} style={{ color: t >= w.start && t <= w.end + 0.08 ? C.yellow : C.ink }}>{w.text.toUpperCase()} </span>)}
      </span>
    </div>
  );
};

const BeatView = ({ beat }: { beat: Beat }) => {
  const frames = Math.round(beat.duration * FPS);
  const f = useCurrentFrame();
  const enter = interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const v = beat.visual;
  const picture = (v.type === "photo" || v.type === "broll") && v.asset;
  const body = picture ? <Picture v={v} frames={frames} />
    : v.type === "article" ? <Article v={v} />
    : v.type === "stat" ? <Stat v={v} />
    : v.type === "quote" ? <Quote v={v} />
    : <Backdrop />;
  const textOnly = !picture && !["article", "stat", "quote"].includes(v.type);
  return (
    <AbsoluteFill style={{ opacity: enter, transform: `scale(${1.04 - 0.04 * enter})` }}>
      {body}
      <Captions words={beat.words} center={textOnly} />
      <Audio src={staticFile(beat.audio)} />
    </AbsoluteFill>
  );
};

export const ShortVideo = ({ scenes, total, music }: Timeline) => {
  const f = useCurrentFrame();
  const beats = scenes.flatMap((s) => s.beats.map((b) => ({ ...b, start: s.start + b.start }))) as Beat[];
  const end = Math.round(total * FPS);
  const cta = spring({ frame: f - end + 12, fps: FPS, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {beats.map((b, i) => (
        <Sequence key={i} from={Math.round(b.start * FPS)} durationInFrames={Math.round(b.duration * FPS) + (i === beats.length - 1 ? Math.round(SHORT_TAIL * FPS) : 0)}>
          <BeatView beat={b} />
        </Sequence>
      ))}
      {/* Brand and progress along the top. */}
      <div style={{ position: "absolute", top: 70, left: 50, right: 50, display: "flex", alignItems: "center", gap: 14, fontFamily: SANS }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: C.hot }} />
        <div style={{ color: C.ink, fontWeight: 900, fontSize: 32, letterSpacing: 5, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>PIPELINEX</div>
        <div style={{ background: C.accent, color: "#06110c", fontWeight: 900, fontSize: 22, letterSpacing: 3, padding: "3px 10px", borderRadius: 6 }}>AI NEWS</div>
      </div>
      <div style={{ position: "absolute", top: 40, left: 50, right: 50, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (f / Math.max(1, end)) * 100)}%`, height: "100%", background: C.accent }} />
      </div>
      {/* Closing call to the full story, over the last words. */}
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 260, opacity: cta, transform: `translateY(${(1 - cta) * 40}px)`, textAlign: "center", fontFamily: SANS }}>
        <div style={{ display: "inline-block", background: C.hot, color: "white", fontWeight: 900, fontSize: 52, padding: "18px 36px", borderRadius: 18 }}>Full story on PipelineX</div>
      </div>
      {music && <Audio src={staticFile(music)} loop volume={(fr) => interpolate(fr, [0, 15, end, end + SHORT_TAIL * FPS], [0, 0.06, 0.06, 0], { extrapolateRight: "clamp" })} />}
    </AbsoluteFill>
  );
};
