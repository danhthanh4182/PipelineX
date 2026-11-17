import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export const FPS = 30;

type Word = { text: string; start: number; end: number };
type Visual = Record<string, any> & { type: string };
type Beat = { narration: string; visual: Visual; audio: string; start: number; duration: number; words: Word[] };
type Scene = { kind: string; kicker: string; headline: string; start: number; duration: number; beats: Beat[] };
export type Timeline = { title: string; total: number; scenes: Scene[]; sources?: unknown[] };

const C = { bg: "#0b0f17", panel: "#141b2b", paper: "#f7f5ef", ink: "#f4f6fb", dark: "#111317", dim: "#8b95a8", accent: "#36d399", hot: "#ff5c5c", line: "#1f2838" };
const SANS = "Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'New York', Georgia, 'Times New Roman', serif";
const BRAND: Record<string, string> = { "The Verge": "#5200ff", TechCrunch: "#0a9e01", "MIT Technology Review": "#e3122c" };

const useSpring = (delay = 0) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 200 } });
};
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const Grid = () => {
  const f = useCurrentFrame();
  const shift = (f * 0.4) % 80;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: "80px 80px", backgroundPosition: `${shift}px ${shift}px`, opacity: 0.5 }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${35 + 10 * Math.sin(f / 90)}% 40%, rgba(54,211,153,0.14), transparent 55%)` }} />
    </AbsoluteFill>
  );
};

// ── Visual beats ─────────────────────────────────────────────────────────────

/** Full-bleed photo with a slow Ken Burns move and an on-screen credit. */
const PhotoBeat = ({ v, frames, index }: { v: Visual; frames: number; index: number }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, frames], [0, 1], { extrapolateRight: "clamp" });
  const dir = index % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {v.asset.kind === "video" ? (
        // Stock clip: muted, slight push-in, looped if shorter than the beat.
        <Loop durationInFrames={Math.max(1, Math.floor((v.asset.duration ?? 10) * FPS))}>
          <OffthreadVideo src={staticFile(v.asset.file)} muted style={{ width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${1.02 + 0.04 * p})` }} />
        </Loop>
      ) : (
        <Img src={staticFile(v.asset.file)} style={{ width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${1.06 + 0.08 * p}) translateX(${dir * (p - 0.5) * 40}px)` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.75) 100%)" }} />
      <div style={{ position: "absolute", right: 40, bottom: 28, color: "rgba(255,255,255,0.75)", fontFamily: SANS, fontSize: 18 }}>
        {v.asset.kind === "video" ? "Video" : "Photo"}: {v.asset.credit} · {v.asset.license}
      </div>
    </AbsoluteFill>
  );
};

/** A news article as a paper card: outlet, date, headline and an optional highlighted quote. */
const ArticleBeat = ({ v }: { v: Visual }) => {
  const enter = useSpring();
  const hl = useSpring(20);
  const brand = BRAND[v.name] ?? C.hot;
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1360, background: C.paper, borderRadius: 18, padding: "56px 72px", boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          transform: `translateY(${(1 - enter) * 80}px) rotate(${(1 - enter) * -2}deg)`, opacity: enter }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: SANS }}>
            <div style={{ background: brand, color: "white", fontWeight: 900, fontSize: 30, padding: "6px 16px", borderRadius: 6 }}>{v.name}</div>
            <div style={{ color: "#5c6170", fontSize: 26 }}>{fmtDate(v.date)}</div>
          </div>
          <div style={{ marginTop: 30, fontFamily: SERIF, fontWeight: 700, fontSize: 64, lineHeight: 1.12, color: C.dark }}>{v.headline}</div>
          {v.quote && (
            <div style={{ marginTop: 34, fontFamily: SERIF, fontSize: 38, lineHeight: 1.4, color: "#2a2d35" }}>
              <span style={{ backgroundImage: `linear-gradient(transparent 55%, rgba(54,211,153,0.55) 55%)`,
                backgroundSize: `${hl * 100}% 100%`, backgroundRepeat: "no-repeat" }}>“{v.quote}”</span>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A direct quote, revealed word by word, with the speaker. */
const QuoteBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const words = String(v.text).split(/\s+/);
  const shown = Math.ceil(interpolate(f, [8, Math.min(frames * 0.6, 90)], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const by = useSpring(20);
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "0 200px", justifyContent: "center", fontFamily: SERIF }}>
        <div style={{ color: C.accent, fontSize: 220, lineHeight: 0.6, height: 110 }}>“</div>
        <div style={{ color: C.ink, fontSize: 72, lineHeight: 1.2, fontWeight: 600 }}>
          {words.map((w, i) => <span key={i} style={{ opacity: i < shown ? 1 : 0.12 }}>{w} </span>)}
        </div>
        <div style={{ marginTop: 44, fontFamily: SANS, color: C.dim, fontSize: 36, opacity: by }}>— {v.speaker}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** One big number, counted up, with its label. */
const StatBeat = ({ v }: { v: Visual }) => {
  const f = useCurrentFrame();
  const m = String(v.value).match(/^(\D*)([\d,.]+)(.*)$/);
  const target = m ? Number(m[2].replace(/,/g, "")) : 0;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const cur = interpolate(f, [0, 36], [0, target], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const text = m ? `${m[1]}${cur.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}` : v.value;
  const lab = useSpring(14);
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: SANS, textAlign: "center" }}>
        <div style={{ color: C.accent, fontSize: 230, fontWeight: 900, letterSpacing: -6 }}>{text}</div>
        <div style={{ color: C.ink, fontSize: 52, fontWeight: 600, maxWidth: 1300, opacity: lab, transform: `translateY(${(1 - lab) * 30}px)` }}>{v.label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Bars that grow to each value, with the change between first and last. */
const ChartBeat = ({ v }: { v: Visual }) => {
  const pts = v.points as Array<{ label: string; value: number }>;
  const max = Math.max(...pts.map((p) => p.value));
  const change = (pts[pts.length - 1].value - pts[0].value) / pts[0].value * 100;
  const badge = useSpring(40);
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "170px 200px 210px", fontFamily: SANS }}>
        <div style={{ color: C.ink, fontSize: 56, fontWeight: 800 }}>{v.title}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 120, marginTop: 40, paddingLeft: 40 }}>
          {pts.map((p, i) => <Bar key={i} p={p} max={max} unit={v.unit} delay={i * 12} last={i === pts.length - 1 && change < 0} />)}
          <div style={{ alignSelf: "center", opacity: badge, transform: `scale(${0.8 + 0.2 * badge})`, background: change < 0 ? C.hot : C.accent,
            color: "white", fontSize: 64, fontWeight: 900, padding: "18px 34px", borderRadius: 16 }}>
            {change > 0 ? "+" : ""}{change.toFixed(0)}%
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const Bar = ({ p, max, unit, delay, last }: { p: { label: string; value: number }; max: number; unit?: string; delay: number; last: boolean }) => {
  const g = useSpring(delay);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", width: 260 }}>
      <div style={{ color: C.ink, fontSize: 48, fontWeight: 800, opacity: g, marginBottom: 14 }}>{unit === "$" ? "$" : ""}{p.value}{unit && unit !== "$" ? unit : ""}</div>
      <div style={{ width: "100%", height: `${(p.value / max) * 75 * g}%`, background: last ? C.hot : C.accent, borderRadius: "12px 12px 0 0" }} />
      <div style={{ color: C.dim, fontSize: 34, marginTop: 16 }}>{p.label}</div>
    </div>
  );
};

/** Dated events appearing one after another on a line. */
const TimelineBeat = ({ v, frames }: { v: Visual; frames: number }) => {
  const f = useCurrentFrame();
  const ev = v.events as Array<{ date: string; text: string }>;
  const step = Math.max(10, Math.min(30, (frames * 0.6) / ev.length));
  const line = interpolate(f, [0, step * ev.length], [0, 100], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ position: "relative", height: 360 }}>
          <div style={{ position: "absolute", top: 120, left: 0, height: 6, width: `${line}%`, background: C.accent, borderRadius: 3 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {ev.map((e, i) => {
              const s = spring({ frame: f - i * step, fps: FPS, config: { damping: 200 } });
              return (
                <div key={i} style={{ width: `${90 / ev.length}%`, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
                  <div style={{ color: C.accent, fontSize: 40, fontWeight: 900, height: 90 }}>{e.date}</div>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: C.accent, border: `6px solid ${C.bg}`, marginTop: 8 }} />
                  <div style={{ color: C.ink, fontSize: 36, fontWeight: 600, marginTop: 34, lineHeight: 1.25 }}>{e.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Fallback when no fitting picture was found: the scene headline as a bold card. */
const CardBeat = ({ scene }: { scene: Scene }) => {
  const s = useSpring();
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ color: C.ink, fontSize: 104, fontWeight: 900, lineHeight: 1.05, maxWidth: 1500, opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
          {scene.headline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Overlays ────────────────────────────────────────────────────────────────

const Header = ({ at, total }: { at: number; total: number }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 40, left: 64, right: 64, display: "flex", alignItems: "center", gap: 16, fontFamily: SANS }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: C.hot, opacity: 0.6 + 0.4 * Math.sin(f / 6) }} />
      <div style={{ color: C.ink, fontWeight: 800, fontSize: 24, letterSpacing: 3, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>PIPELINEX</div>
      <div style={{ color: "#c6ccd8", fontSize: 22, letterSpacing: 2, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>AI NEWS</div>
      <div style={{ flex: 1 }} />
      <div style={{ width: 300, height: 6, background: "rgba(255,255,255,0.18)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (at / total) * 100)}%`, height: "100%", background: C.accent }} />
      </div>
    </div>
  );
};

/** Scene label: kicker + headline, shown for the first seconds of every scene. */
const LowerThird = ({ scene }: { scene: Scene }) => {
  const f = useCurrentFrame();
  const inn = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  const out = interpolate(f, [4.5 * FPS, 5 * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 64, top: 104, fontFamily: SANS, opacity: inn * out, transform: `translateX(${(1 - inn) * -60}px)` }}>
      <div style={{ display: "inline-block", background: scene.kind === "hook" ? C.hot : C.accent, color: "#06110c", fontWeight: 900,
        fontSize: 26, letterSpacing: 4, padding: "8px 18px", borderRadius: 6 }}>{scene.kicker.toUpperCase()}</div>
      <div style={{ marginTop: 10, background: "rgba(5,8,14,0.85)", color: C.ink, fontWeight: 800, fontSize: 40, padding: "10px 20px", borderRadius: 8 }}>
        {scene.headline}
      </div>
    </div>
  );
};

/** Captions: one line per speech phrase (break at pauses or after 7 words), the spoken word highlighted. */
const Captions = ({ words }: { words: Word[] }) => {
  const t = useCurrentFrame() / FPS;
  const groups: Word[][] = [];
  for (const w of words) {
    const cur = groups[groups.length - 1]; const prev = cur?.[cur.length - 1];
    if (!cur || cur.length >= 7 || (prev && w.start - prev.end > 0.18)) groups.push([w]); else cur.push(w);
  }
  const g = groups.find((grp) => t >= grp[0].start - 0.05 && t <= grp[grp.length - 1].end + 0.25);
  if (!g) return null;
  return (
    <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, display: "flex", justifyContent: "center", fontFamily: SANS }}>
      <div style={{ background: "rgba(5,8,14,0.82)", padding: "14px 28px", borderRadius: 14, maxWidth: 1500, textAlign: "center",
        fontSize: 44, fontWeight: 700, lineHeight: 1.25, color: C.ink }}>
        {g.map((w, i) => <span key={i} style={{ color: t >= w.start && t <= w.end + 0.08 ? C.accent : C.ink }}>{w.text} </span>)}
      </div>
    </div>
  );
};

const BeatView = ({ scene, beat, index, at, total }: { scene: Scene; beat: Beat; index: number; at: number; total: number }) => {
  const frames = Math.round(beat.duration * FPS);
  const f = useCurrentFrame();
  const fade = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const v = beat.visual;
  const body =
    v.type === "photo" || v.type === "broll" ? (v.asset ? <PhotoBeat v={v} frames={frames} index={index} /> : <CardBeat scene={scene} />)
    : v.type === "article" ? <ArticleBeat v={v} />
    : v.type === "quote" ? <QuoteBeat v={v} frames={frames} />
    : v.type === "stat" ? <StatBeat v={v} />
    : v.type === "chart" ? <ChartBeat v={v} />
    : v.type === "timeline" ? <TimelineBeat v={v} frames={frames} />
    : <CardBeat scene={scene} />;
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {body}
      <Header at={at + f / FPS} total={total} />
      <Captions words={beat.words} />
      <Audio src={staticFile(beat.audio)} />
    </AbsoluteFill>
  );
};

export const NewsVideo = ({ scenes, total }: Timeline) => {
  let index = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {scenes.map((s, si) => (
        <Sequence key={si} from={Math.round(s.start * FPS)} durationInFrames={Math.round(s.duration * FPS)}>
          {s.beats.map((b, bi) => {
            const i = index++;
            return (
              <Sequence key={bi} from={Math.round(b.start * FPS)} durationInFrames={Math.round(b.duration * FPS)}>
                <BeatView scene={s} beat={b} index={i} at={s.start + b.start} total={total} />
              </Sequence>
            );
          })}
          {s.kind !== "outro" && <LowerThird scene={s} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
