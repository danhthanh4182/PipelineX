// Step 4a prototype: fetch freely licensed images for "photo" and "broll" beats, with attribution.
// photo -> Wikimedia Commons first (named people, places, products), then Openverse.
// broll -> Pixabay video clip first, then Pixabay photo, Openverse, Commons (Pixabay needs PIXABAY_API_KEY).
// Every candidate is checked by a vision model before use (right subject, a real photo, nothing misleading).
// Only licenses that allow commercial reuse and modification: CC0, Public domain, CC BY, CC BY-SA.
// Pixabay content: Pixabay Content License (free commercial use, no attribution required; we credit anyway).
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env assets.ts   (reads <dir>/script.json, writes <dir>/script-final.json and <dir>/public/assets)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const UA = "PipelineX-prototype/0.1 (automated news video research)";
const OK_LICENSE = /^(cc0|cc[- ]?by(-sa)?( \d\.\d)?|public domain|pd)/i;
const W = process.env.VIDEO_WORKDIR ?? "work";
const script = JSON.parse(readFileSync(`${W}/script.json`, "utf8"));
mkdirSync(`${W}/public/assets`, { recursive: true });

type Cand = { url: string; thumb: string; credit: string; license: string; sourceUrl: string; width: number; height: number;
  kind?: "image" | "video"; duration?: number };
const PIXABAY = process.env.PIXABAY_API_KEY ?? "";
const strip = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const used = new Set<string>();
let cost = 0;

async function commons(query: string): Promise<Cand[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  const params: Record<string, string> = { action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "1920", origin: "*" };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { "user-agent": UA, "api-user-agent": UA } });
  const body = await res.json().catch(() => null) as any;
  if (!res.ok || !body) { console.log(`  commons ${res.status}`); return []; }
  const pages = Object.values(body.query?.pages ?? {}) as any[];
  pages.sort((a, b) => a.index - b.index);
  const out: Cand[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    const license = strip(m.LicenseShortName?.value);
    if (!ii || !OK_LICENSE.test(license) || used.has(ii.url)) continue;
    if (ii.width < 900 || ii.width / ii.height < 0.6) continue; // skip tiny and very tall images
    const big = ii.thumburl ?? ii.url;
    out.push({ url: big, thumb: big.replace("/1920px-", "/960px-"), credit: strip(m.Artist?.value) || "Unknown", license,
      sourceUrl: ii.descriptionurl, width: ii.thumbwidth ?? ii.width, height: ii.thumbheight ?? ii.height });
  }
  return out;
}

async function openverse(query: string): Promise<Cand[]> {
  const u = new URL("https://api.openverse.org/v1/images/");
  const params: Record<string, string> = { q: query, license_type: "commercial,modification", aspect_ratio: "wide", size: "large", page_size: "20", mature: "false" };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { "user-agent": UA } });
  if (!res.ok) return [];
  const out: Cand[] = [];
  for (const r of ((await res.json().catch(() => null)) as any)?.results ?? []) {
    const license = `${r.license === "cc0" || r.license === "pdm" ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()}`} ${r.license_version ?? ""}`.trim();
    if (used.has(r.url) || !(r.width >= 1000)) continue;
    out.push({ url: r.url, thumb: r.thumbnail ?? r.url, credit: r.creator || "Unknown", license, sourceUrl: r.foreign_landing_url, width: r.width, height: r.height });
  }
  return out;
}

/** Pixabay stock clips (videos=true) or photos. Skips AI-generated and low-quality items. */
async function pixabay(query: string, videos: boolean): Promise<Cand[]> {
  if (!PIXABAY) return [];
  const u = new URL(videos ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/");
  const params: Record<string, string> = { key: PIXABAY, q: query.slice(0, 100), safesearch: "true", per_page: "20", order: "popular",
    ...(videos ? { video_type: "film" } : { image_type: "photo", orientation: "horizontal", min_width: "1600" }) };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { "user-agent": UA } });
  if (!res.ok) { console.log(`  pixabay ${res.status}`); return []; }
  const out: Cand[] = [];
  for (const h of ((await res.json().catch(() => null)) as any)?.hits ?? []) {
    if (h.isAiGenerated || h.isLowQuality) continue;
    const credit = `${h.user} on Pixabay`, license = "Pixabay License";
    if (videos) {
      const f = h.videos?.small?.url && h.videos.small.width >= 1920 ? h.videos.small : h.videos?.tiny;
      if (!f?.url || used.has(f.url) || h.duration < 5 || f.width / f.height < 1.6) continue;
      out.push({ url: f.url, thumb: f.thumbnail || h.videos.tiny?.thumbnail, credit, license, sourceUrl: h.pageURL,
        width: f.width, height: f.height, kind: "video", duration: h.duration });
    } else {
      if (!h.largeImageURL || used.has(h.largeImageURL)) continue;
      out.push({ url: h.largeImageURL, thumb: h.webformatURL, credit, license, sourceUrl: h.pageURL, width: h.imageWidth, height: h.imageHeight });
    }
  }
  return out;
}

/** Vision check: does the picture really show the query, and is it fit for a neutral news video on this story? */
async function fits(c: Cand, query: string, kind: string, context: string, narration: string): Promise<boolean> {
  const base = (process.env.LLM_BASE_URL ?? "").replace(/\/$/, "");
  const wanted = kind === "photo" ? `"${query}" as the main subject` : `something a viewer would recognise as "${query}"`;
  const what = c.kind === "video" ? "still frame from a stock video clip" : kind === "photo" ? "photo of a specific subject" : "generic illustrative b-roll image";
  const prompt = `A ${what} is needed for a news video.
Story: ${context}
Wanted: "${query}".
Spoken over the picture: "${narration}"
Answer YES only if ALL hold: (1) the image clearly shows ${wanted};
(2) it is a photograph, not a chart, diagram, map, logo or text screenshot;
(3) no other recognisable public figure appears who could mislead viewers about the story;
(4) nothing offensive or unrelated dominates the picture;
(5) it is not a photo of a document, letter, sign or screen with legible text, and shows no private person's name or signature;
(6) its mood fits what is spoken (no celebration, smiling crowds or luxury over a scandal, lawsuit or loss) and it does not suggest a person, brand or product the narration is not about.
Reply with one word: YES or NO.`;
  // Send the picture itself: providers cannot always fetch Wikimedia/Openverse URLs.
  let pic = await fetch(c.thumb, { headers: { "user-agent": UA } });
  if (!pic.ok) pic = await fetch(c.url, { headers: { "user-agent": UA } });
  if (!pic.ok) { console.log(`  thumbnail ${pic.status}`); return false; }
  const type = pic.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const dataUrl = `data:${type};base64,${Buffer.from(await pic.arrayBuffer()).toString("base64")}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model: process.env.VISION_MODEL || process.env.LLM_MODEL, temperature: 0, max_tokens: 3000,
      reasoning: { max_tokens: 1500 },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }] }),
    signal: AbortSignal.timeout(120_000),
  });
  const d = await res.json().catch(() => ({})) as any;
  if (!res.ok) { console.log(`  vision error ${res.status}: ${JSON.stringify(d).slice(0, 160)}`); return false; }
  cost += d.usage?.cost ?? 0;
  return /^\s*yes/i.test(d.choices?.[0]?.message?.content ?? "");
}

let n = 0, missing = 0;
for (const scene of script.scenes) for (const beat of scene.beats) {
  const v = beat.visual; const i = n++;
  if (v.type !== "photo" && v.type !== "broll") continue;
  const cands = v.type === "photo" ? [...(await commons(v.query)).slice(0, 4), ...(await openverse(v.query)).slice(0, 2)]
    : [...(await pixabay(v.query, true)).slice(0, 3), ...(await pixabay(v.query, false)).slice(0, 2),
       ...(await openverse(v.query)).slice(0, 2)]; // no Commons for b-roll: it surfaces real documents and private people
  let found: Cand | null = null, tried = 0;
  for (const c of cands.slice(0, 8)) {
    tried++;
    if (await fits(c, v.query, v.type, script.title, beat.narration)) { found = c; used.add(c.url); break; }
  }
  if (!found) { missing++; console.log(`beat ${i} ${v.type} "${v.query}": nothing fitting (${tried} checked) -> text card`); v.type = "card"; continue; }
  const ext = found.kind === "video" ? "mp4" : (found.url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const file = `assets/beat-${String(i).padStart(2, "0")}.${ext}`;
  const img = await fetch(found.url, { headers: { "user-agent": UA } });
  if (!img.ok) { missing++; console.log(`beat ${i}: download ${img.status}`); v.type = "card"; continue; }
  writeFileSync(`${W}/public/${file}`, Buffer.from(await img.arrayBuffer()));
  v.asset = { file, credit: found.credit.slice(0, 80), license: found.license, sourceUrl: found.sourceUrl,
    kind: found.kind ?? "image", ...(found.duration ? { duration: found.duration } : {}) };
  console.log(`beat ${i} ${v.type.padEnd(5)} "${v.query}" -> ${found.kind ?? "image"} · ${found.license} · ${found.credit.slice(0, 40)} (${tried} checked)`);
}
writeFileSync(`${W}/script-final.json`, JSON.stringify(script, null, 2));
const credits = script.scenes.flatMap((s: any) => s.beats).map((b: any) => b.visual.asset).filter(Boolean)
  .map((a: any) => `${a.file}: ${a.credit}, ${a.license} — ${a.sourceUrl}`);
writeFileSync(`${W}/ATTRIBUTIONS.txt`, credits.join("\n") + "\n");
console.log(`assets: ${credits.length}, without image: ${missing}, vision cost: $${cost.toFixed(4)}`);
console.log(`RESULT ${JSON.stringify({ cost, assets: credits.length, missing })}`);
