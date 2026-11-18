import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";

export const FPS = 30;

type Word = { text: string; start: number; end: number };
type Visual = Record<string, any> & { type: string };
type Beat = { narration: string; visual: Visual; audio: string; start: number; duration: number; words: Word[] };
type Scene = { kind: string; kicker: string; headline: string; start: number; duration: number; beats: Beat[] };
export type Palette = { accent: string; accent2: string; kicker: string };
export type Brand = { name: string; label: string; tagline: string };
export type Timeline = { title: string; total: number; scenes: Scene[]; sources?: Array<{ n: number; name: string; title?: string }>; music?: string | null; date?: string;
  style?: string; palette?: Palette | null; brand?: Brand };
/** The channel's brand on the cards (the timeline's, from industry/channel.json). */
export const DEFAULT_BRAND: Brand = { name: "PipelineX", label: "AI NEWS", tagline: "The AI news that matters, every day." };

/** Branded opening and the end card, around the narrated part (seconds). */
export const INTRO = 3;
export const OUTRO = 7;

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
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${35 + 10 * Math.sin(f / 90)}% 40%, ${C.accent}24, transparent 55%)` }} />
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

/** Spoken phrases split like the captions: a new one at a pause or after `max` words. */
const phrasesOf = (words: Word[], max = 7) => {
  const groups: Word[][] = [];
  for (const w of words) {
    const cur = groups[groups.length - 1]; const prev = cur?.[cur.length - 1];
    if (!cur || cur.length >= max || (prev && w.start - prev.end > 0.18)) groups.push([w]); else cur.push(w);
  }
  return groups;
};

/**
 * Kinetic text: the narration itself, large, phrase by phrase, each word lighting up as it is spoken. Used when a
 * beat has no picture (none fitted, or the same article was already shown), so the screen always says what is heard.
 */
const KineticBeat = ({ scene, beat }: { scene: Scene; beat: Beat }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const groups = phrasesOf(beat.words, 9);
  const gi = Math.max(0, groups.findIndex((g) => t <= g[g.length - 1]!.end + 0.25));
  const g = groups[gi] ?? groups[groups.length - 1] ?? [];
  const enter = spring({ frame: f - Math.round((g[0]?.start ?? 0) * FPS), fps: FPS, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ color: C.accent, fontSize: 30, fontWeight: 800, letterSpacing: 6, marginBottom: 28 }}>{scene.kicker.toUpperCase()}</div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.12, maxWidth: 1600, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
          {g.map((w, i) => (
            <span key={i} style={{ color: t >= w.start - 0.05 ? (t <= w.end + 0.1 ? C.accent : C.ink) : "rgba(244,246,251,0.22)" }}>{w.text} </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A slow push on graphic beats, so no frame stands still. */
const Push = ({ frames, children }: { frames: number; children: React.ReactNode }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, frames], [1, 1.045], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>;
};

/** Opening: channel mark, date and the video's title. */
const Intro = ({ title, date, brand }: { title: string; date?: string; brand: Brand }) => {
  const f = useCurrentFrame();
  const a = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  const b = spring({ frame: f - 10, fps: FPS, config: { damping: 200 } });
  const out = interpolate(f, [INTRO * FPS - 10, INTRO * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Grid />
      <AbsoluteFill style={{ padding: "0 160px", justifyContent: "center", fontFamily: SANS }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: a, transform: `translateX(${(1 - a) * -40}px)` }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: C.hot }} />
          <div style={{ color: C.ink, fontWeight: 900, fontSize: 44, letterSpacing: 8 }}>{brand.name.toUpperCase()}</div>
          <div style={{ color: C.dim, fontSize: 36, letterSpacing: 4 }}>{brand.label}{date ? ` · ${date}` : ""}</div>
        </div>
        <div style={{ marginTop: 40, color: C.ink, fontSize: 96, fontWeight: 900, lineHeight: 1.05, maxWidth: 1600, opacity: b, transform: `translateY(${(1 - b) * 40}px)` }}>{title}</div>
        <div style={{ marginTop: 48, height: 8, width: `${interpolate(f, [10, INTRO * FPS], [0, 100], { extrapolateRight: "clamp" })}%`, background: C.accent, borderRadius: 4 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** End card: the sources the video was made from, and the invitation to subscribe. */
const Outro = ({ sources, brand }: { sources: Array<{ n: number; name: string; title?: string }>; brand: Brand }) => {
  const f = useCurrentFrame();
  const a = spring({ frame: f, fps: FPS, config: { damping: 200 } });
  const outlets = [...new Set(sources.map((s) => s.name))];
  return (
    <AbsoluteFill>
      <Grid />
      <AbsoluteFill style={{ padding: "120px 160px", fontFamily: SANS, justifyContent: "center", opacity: a }}>
        <div style={{ color: C.accent, fontSize: 30, fontWeight: 800, letterSpacing: 6 }}>SOURCES</div>
        <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 16, maxWidth: 1600 }}>
          {outlets.map((o, i) => {
            const s = spring({ frame: f - 6 - i * 3, fps: FPS, config: { damping: 200 } });
            return <div key={o} style={{ color: C.ink, fontSize: 34, fontWeight: 600, padding: "10px 22px", borderRadius: 10, background: C.panel, border: `1px solid ${C.line}`, opacity: s }}>{o}</div>;
          })}
        </div>
        <div style={{ marginTop: 90, color: C.ink, fontSize: 84, fontWeight: 900 }}>{brand.tagline}</div>
        <div style={{ marginTop: 34, display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 18, background: C.hot, color: "white",
          fontSize: 44, fontWeight: 900, padding: "18px 40px", borderRadius: 14, transform: `scale(${1 + 0.03 * Math.sin(f / 8)})` }}>Subscribe</div>
        <div style={{ marginTop: 26, color: C.dim, fontSize: 30 }}>Links to every report are in the description.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Overlays ────────────────────────────────────────────────────────────────

const Header = ({ at, total, brand }: { at: number; total: number; brand: Brand }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 40, left: 64, right: 64, display: "flex", alignItems: "center", gap: 16, fontFamily: SANS }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: C.hot, opacity: 0.6 + 0.4 * Math.sin(f / 6) }} />
      <div style={{ color: C.ink, fontWeight: 800, fontSize: 24, letterSpacing: 3, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{brand.name.toUpperCase()}</div>
      <div style={{ color: "#c6ccd8", fontSize: 22, letterSpacing: 2, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{brand.label}</div>
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
  const groups = phrasesOf(words);
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

const BeatView = ({ scene, beat, index, at, total, repeat, brand }: { scene: Scene; beat: Beat; index: number; at: number; total: number; repeat: boolean; brand: Brand }) => {
  const frames = Math.round(beat.duration * FPS);
  const f = useCurrentFrame();
  // Enter: a short fade with a slight zoom-out, so cuts feel like moves rather than flashes.
  const enter = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const v = beat.visual;
  const kinetic = (v.type === "photo" || v.type === "broll") ? !v.asset : v.type === "card" || (v.type === "article" && repeat);
  const body = kinetic ? <KineticBeat scene={scene} beat={beat} />
    : v.type === "photo" || v.type === "broll" ? <PhotoBeat v={v} frames={frames} index={index} />
    : <Push frames={frames}>{
        v.type === "article" ? <ArticleBeat v={v} />
        : v.type === "quote" ? <QuoteBeat v={v} frames={frames} />
        : v.type === "stat" ? <StatBeat v={v} />
        : v.type === "chart" ? <ChartBeat v={v} />
        : v.type === "timeline" ? <TimelineBeat v={v} frames={frames} />
        : <KineticBeat scene={scene} beat={beat} />
      }</Push>;
  return (
    <AbsoluteFill style={{ opacity: enter, transform: `scale(${1.03 - 0.03 * enter})` }}>
      {body}
      <Header at={at + f / FPS} total={total} brand={brand} />
      {!kinetic && <Captions words={beat.words} />}
      <Audio src={staticFile(beat.audio)} />
    </AbsoluteFill>
  );
};

/**
 * The video's style colours (styles.ts, through the timeline). Every frame of one render uses the same timeline, so
 * setting the shared palette before drawing is safe.
 */
export function applyPalette(target: { accent: string; hot: string }, palette?: Palette | null) {
  target.accent = palette?.accent ?? "#36d399";
  target.hot = palette?.accent2 ?? "#ff5c5c";
}

export const NewsVideo = ({ scenes, total, title, sources = [], music, date, palette, brand = DEFAULT_BRAND }: Timeline) => {
  applyPalette(C, palette);
  let index = 0;
  const shown = new Set<string>();
  const end = Math.round((INTRO + total) * FPS);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence durationInFrames={INTRO * FPS}><Intro title={title} date={date} brand={brand} /></Sequence>
      <Sequence from={INTRO * FPS}>
        {scenes.map((s, si) => (
          <Sequence key={si} from={Math.round(s.start * FPS)} durationInFrames={Math.round(s.duration * FPS)}>
            {s.beats.map((b, bi) => {
              const i = index++;
              // The same article twice reads as a loop: its second showing becomes kinetic text.
              const key = b.visual.type === "article" ? String(b.visual.url ?? b.visual.headline) : "";
              const repeat = !!key && shown.has(key);
              if (key) shown.add(key);
              return (
                <Sequence key={bi} from={Math.round(b.start * FPS)} durationInFrames={Math.round(b.duration * FPS)}>
                  <BeatView scene={s} beat={b} index={i} at={s.start + b.start} total={total} repeat={repeat} brand={brand} />
                </Sequence>
              );
            })}
            {s.kind !== "outro" && <LowerThird scene={s} />}
          </Sequence>
        ))}
      </Sequence>
      <Sequence from={end}><Outro sources={sources} brand={brand} /></Sequence>
      {music && <Audio src={staticFile(music)} loop volume={(f) => interpolate(f, [0, 30, end, end + OUTRO * FPS - 30, end + OUTRO * FPS], [0, 0.07, 0.07, 0.16, 0], { extrapolateRight: "clamp" })} />}
    </AbsoluteFill>
  );
};
