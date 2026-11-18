// YouTube thumbnail (1280×720 still): the video's main picture, two to five huge words, channel mark and topic.
// Rendered with `remotion still … Thumbnail` from the same timeline props as the video.
import { AbsoluteFill, Img, staticFile } from "remotion";
import { applyPalette, DEFAULT_BRAND, type Timeline } from "./NewsVideo";

const C = { bg: "#0b0f17", ink: "#ffffff", accent: "#36d399", hot: "#ff3b3b", yellow: "#ffd23f" };
const SANS = "Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

type Visual = { type: string; query?: string; asset?: { file: string; kind?: string } };

/** The picture that best says who or what the story is about: a named subject's photo first, then any still. */
export function mainPicture(t: Timeline): string | null {
  const visuals = t.scenes.flatMap((s) => s.beats.map((b) => b.visual as Visual));
  const still = (v: Visual) => v.asset && v.asset.kind !== "video";
  return (visuals.find((v) => v.type === "photo" && still(v)) ?? visuals.find(still))?.asset?.file ?? null;
}

/**
 * The thumbnail words: the script's own, else the title's main clause (before a colon or a linking word such as
 * "amid", "after", "as"), at most five words, never ending on a linking word.
 */
const LINKS = /^(amid|after|as|over|with|in|on|for|and|to|of|by|from|while|despite)$/i;
export function thumbWords(t: Timeline & { thumbnail_text?: string | null }): string {
  if (t.thumbnail_text?.trim()) return t.thumbnail_text.trim().split(/\s+/).slice(0, 5).join(" ");
  const words = t.title.split(/[:—–|]/)[0]!.trim().split(/\s+/);
  const stop = words.findIndex((w, i) => i >= 2 && LINKS.test(w));
  const main = (stop > 0 ? words.slice(0, stop) : words).slice(0, 5);
  while (main.length > 2 && LINKS.test(main[main.length - 1]!)) main.pop();
  return main.join(" ");
}

export const Thumbnail = (t: Timeline & { thumbnail_text?: string | null }) => {
  applyPalette(C, t.palette);
  const brand = t.brand ?? DEFAULT_BRAND;
  const pic = mainPicture(t);
  const words = thumbWords(t).toUpperCase().split(" ");
  // Two lines, the second in the highlight colour; long words get a smaller size so nothing is cut.
  const cut = Math.ceil(words.length / 2);
  const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")].filter(Boolean);
  const longest = Math.max(...lines.map((l) => l.length));
  const size = longest > 14 ? 92 : longest > 10 ? 112 : 132;
  const kicker = t.date ?? "";
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: SANS }}>
      {pic && (
        <AbsoluteFill style={{ left: "38%" }}>
          <Img src={staticFile(pic)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.15) contrast(1.08)" }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: `linear-gradient(90deg, ${C.bg} 0%, ${C.bg} 36%, rgba(11,15,23,0.85) 50%, rgba(11,15,23,0.15) 72%, transparent 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 18% 30%, ${C.accent}38, transparent 45%)` }} />
      <div style={{ position: "absolute", left: 56, top: 48, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: C.hot }} />
        <div style={{ color: C.ink, fontWeight: 900, fontSize: 34, letterSpacing: 5 }}>{brand.name.toUpperCase()}</div>
        <div style={{ background: C.accent, color: "#06110c", fontWeight: 900, fontSize: 24, letterSpacing: 3, padding: "4px 12px", borderRadius: 6 }}>{brand.label}</div>
      </div>
      <div style={{ position: "absolute", left: 56, bottom: 64, width: 760 }}>
        {kicker && (
          <div style={{ display: "inline-block", background: C.hot, color: C.ink, fontWeight: 900, fontSize: 28, letterSpacing: 3, padding: "6px 14px", borderRadius: 6, marginBottom: 18 }}>
            {kicker.toUpperCase()}
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ color: i === 1 ? C.yellow : C.ink, fontWeight: 900, fontSize: size, lineHeight: 0.98, letterSpacing: -2,
            textShadow: "0 6px 0 rgba(0,0,0,0.55), 0 0 40px rgba(0,0,0,0.6)", WebkitTextStroke: "2px rgba(0,0,0,0.35)" }}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
