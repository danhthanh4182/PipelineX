// Builds a channel's brand kit from <pack>/brand/brand.json: the mark (SVG), wordmarks for light and dark
// backgrounds, the YouTube avatar (800x800), banner (2560x1440, words inside the 1546x423 safe area), watermark
// (150x150) and the site icons. Words are drawn as outlines from the font files named in brand.json (Inter, SIL OFL 1.1),
// so the files look the same everywhere and no font is shipped.
//
//   node scripts/brand.ts packs/finance        writes packs/finance/brand/ and packs/finance/brand/youtube/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const pack = path.resolve(process.argv[2] ?? "packs/finance");
const dir = path.join(pack, "brand");
const cfg = JSON.parse(readFileSync(path.join(dir, "brand.json"), "utf8")) as {
  name: [string, string]; tagline: string; bannerLine?: string;
  colors: { ground: string; accent: string; accentOnLight?: string; muted: string; inkLight: string; inkDark: string };
  fonts: { regular: string; medium: string; bold: string };
};
const font = (file: string) => opentype.parse(readFileSync(file.replace(/^~/, process.env.HOME ?? "")).buffer as ArrayBuffer);
const fonts = { regular: font(cfg.fonts.regular), medium: font(cfg.fonts.medium), bold: font(cfg.fonts.bold) };
const C = cfg.colors;

/** Text as an SVG path starting at (x, baseline y); returns the path and its advance width. */
function text(words: string, f: opentype.Font, size: number, x: number, y: number, fill: string, tracking = 0) {
  let cx = x;
  const parts: string[] = [];
  for (const glyph of f.stringToGlyphs(words)) {
    parts.push(glyph.getPath(cx, y, size).toPathData(2));
    cx += (glyph.advanceWidth ?? 0) * (size / f.unitsPerEm) + tracking;
  }
  return { svg: `<path fill="${fill}" d="${parts.join("")}"/>`, width: cx - x - tracking };
}
const width = (words: string, f: opentype.Font, size: number, tracking = 0) => text(words, f, size, 0, 0, "#000", tracking).width;

/** The mark on a 160 grid: three candlesticks rising inside code brackets. */
const markInner = (bars = C.muted) => `
  <path d="M40 58 L28 80 L40 102" fill="none" stroke="${C.accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M120 58 L132 80 L120 102" fill="none" stroke="${C.accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="58" y1="84" x2="58" y2="112" stroke="${bars}" stroke-width="3" stroke-linecap="round"/><rect x="51" y="90" width="14" height="16" rx="2" fill="${bars}"/>
  <line x1="80" y1="66" x2="80" y2="104" stroke="${bars}" stroke-width="3" stroke-linecap="round"/><rect x="73" y="72" width="14" height="24" rx="2" fill="${bars}"/>
  <line x1="102" y1="44" x2="102" y2="92" stroke="${C.accent}" stroke-width="3" stroke-linecap="round"/><rect x="95" y="50" width="14" height="32" rx="2" fill="${C.accent}"/>`;
const markCircle = (size: number, x = 0, y = 0) => `<g transform="translate(${x} ${y}) scale(${size / 160})"><circle cx="80" cy="80" r="80" fill="${C.ground}"/>${markInner()}</g>`;
const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;

/** Mark + name on one line, height 160; `ink` is the colour of the first word, `accent` of the second. */
function wordmark(ink: string, accent = C.accent) {
  const size = 92, gap = 34, x0 = 160 + gap;
  const a = text(cfg.name[0], fonts.medium, size, x0, 113, ink, -1.5);
  const b = text(cfg.name[1], fonts.bold, size, x0 + a.width + 22, 113, accent, -1.5);
  return svg(Math.ceil(x0 + a.width + 22 + b.width + 4), 160, markCircle(160) + a.svg + b.svg);
}

mkdirSync(path.join(dir, "youtube"), { recursive: true });
const files: Record<string, string> = {
  "mark.svg": svg(160, 160, markCircle(160)),
  // Square with rounded corners for app icons and the favicon (browsers do not crop to a circle).
  // The drawing fills the square and its strokes are heavier, so it still reads at 16-32 pixels.
  "icon.svg": svg(512, 512, `<rect width="512" height="512" rx="112" fill="${C.ground}"/><g transform="translate(256 256) scale(4.1) translate(-80 -78)">${markInner().replace(/stroke-width="7"/g, 'stroke-width="10"').replace(/stroke-width="3"/g, 'stroke-width="5"')}</g>`),
  "wordmark.svg": wordmark(C.inkLight, C.accentOnLight ?? C.accent),
  "wordmark-dark.svg": wordmark(C.inkDark),
};

// Banner: 2560x1440; TV shows it all, desktop the middle 2560x423, phones only the middle 1546x423.
{
  const W = 2560, H = 1440, cy = H / 2;
  const grid = Array.from({ length: 21 }, (_, i) => `<line x1="${i * 128}" y1="0" x2="${i * 128}" y2="${H}" stroke="#ffffff" stroke-opacity="0.035" stroke-width="2"/>`).join("")
    + Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 128 + 48}" x2="${W}" y2="${i * 128 + 48}" stroke="#ffffff" stroke-opacity="0.035" stroke-width="2"/>`).join("");
  // A faint rising line of candles across the full width (seen on TV and wide screens; never under the words).
  const candles = Array.from({ length: 34 }, (_, i) => {
    const x = 40 + i * 76, base = 1180 - i * 18 + (i % 3) * 40, h = 60 + (i % 4) * 26;
    const inSafe = x > 470 && x < 2090;
    return inSafe ? "" : `<line x1="${x + 14}" y1="${base - h - 30}" x2="${x + 14}" y2="${base + 30}" stroke="${C.muted}" stroke-opacity="0.22" stroke-width="4"/><rect x="${x}" y="${base - h}" width="28" height="${h}" rx="4" fill="${i % 5 === 4 ? C.accent : C.muted}" fill-opacity="${i % 5 === 4 ? 0.5 : 0.22}"/>`;
  }).join("");
  // The lockup (mark, name, one line under it) is scaled to fit the phone's safe area with a margin.
  const line = cfg.bannerLine ?? cfg.tagline;
  const fit = (scale: number) => {
    const nameSize = 132 * scale, mark = 220 * scale, gap = 44 * scale, space = 28 * scale, lineSize = 44 * scale;
    const aw = width(cfg.name[0], fonts.medium, nameSize, -2), bw = width(cfg.name[1], fonts.bold, nameSize, -2);
    const textW = Math.max(aw + space + bw, width(line, fonts.regular, lineSize, 0.5));
    return { nameSize, mark, gap, space, lineSize, aw, total: mark + gap + textW };
  };
  let L = fit(1);
  if (L.total > 1546 - 120) L = fit((1546 - 120) / L.total);
  const x0 = (W - L.total) / 2, tx = x0 + L.mark + L.gap;
  const a = text(cfg.name[0], fonts.medium, L.nameSize, tx, cy + L.nameSize * 0.12, C.inkDark, -2);
  const b = text(cfg.name[1], fonts.bold, L.nameSize, tx + L.aw + L.space, cy + L.nameSize * 0.12, C.accent, -2);
  const t = text(line, fonts.regular, L.lineSize, tx, cy + L.nameSize * 0.12 + L.lineSize * 1.75, C.muted, 0.5);
  // The bare mark (no disc): the banner's ground is already the brand colour.
  const markG = `<g transform="translate(${x0} ${cy - L.mark / 2 + 6}) scale(${L.mark / 160})">${markInner()}</g>`;
  files["youtube/banner.svg"] = svg(W, H, `<rect width="${W}" height="${H}" fill="${C.ground}"/>${grid}${candles}${markG}${a.svg}${b.svg}${t.svg}`);
}
files["youtube/watermark.svg"] = svg(150, 150, markCircle(150));

for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, name), body);

const png = (name: string, out: string, size: number) => sharp(Buffer.from(files[name]!), { density: Math.max(72, (72 * size) / 160) }).resize(size, size).png().toFile(path.join(dir, out));
await png("mark.svg", "youtube/avatar-800.png", 800);
await png("youtube/watermark.svg", "youtube/watermark-150.png", 150);
await sharp(Buffer.from(files["youtube/banner.svg"]!)).png({ compressionLevel: 9 }).toFile(path.join(dir, "youtube/banner-2560x1440.png"));
await sharp(Buffer.from(files["youtube/banner.svg"]!)).extract({ left: 507, top: 508, width: 1546, height: 423 }).png().toFile(path.join(dir, "youtube/banner-phone-preview.png"));
const icon = (size: number) => sharp(Buffer.from(files["icon.svg"]!), { density: Math.max(72, (72 * size) / 512) }).resize(size, size).png().toBuffer();
writeFileSync(path.join(dir, "icon.png"), await icon(512));
writeFileSync(path.join(dir, "icon-192.png"), await icon(192));
writeFileSync(path.join(dir, "apple-icon.png"), await sharp(await icon(512)).resize(180, 180).png().toBuffer());

// favicon.ico: an ICO container holding PNG images of 16, 32 and 48 pixels.
{
  const images = await Promise.all([16, 32, 48].map((s) => sharp(Buffer.from(files["icon.svg"]!)).resize(s, s).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const s = [16, 32, 48][i]!, e = 6 + 16 * i;
    header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6); header.writeUInt32LE(img.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  writeFileSync(path.join(dir, "favicon.ico"), Buffer.concat([header, ...images]));
}
console.log(`Brand kit written to ${path.relative(process.cwd(), dir)}: ${Object.keys(files).join(", ")}, PNGs and favicon.ico`);
