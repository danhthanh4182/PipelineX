// Step 4a prototype: fetch freely licensed images for "photo" and "broll" beats, with attribution.
// photo -> Wikimedia Commons first (named people, places, products), then Openverse.
// broll -> Pixabay video clip first, then Pixabay photo, Openverse, Commons (Pixabay needs PIXABAY_API_KEY).
// Every candidate is checked by a vision model before use (right subject, a real photo, nothing misleading).
// Only licenses that allow commercial reuse and modification: CC0, Public domain, CC BY, CC BY-SA.
// Pixabay content: Pixabay Content License (free commercial use, no attribution required; we credit anyway).
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env assets.ts   (reads <dir>/script.json, writes <dir>/script-final.json and <dir>/public/assets)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chat, readPreset } from "./lib.ts";

const preset = readPreset();

const UA = "PipelineX-prototype/0.1 (automated news video research)";
const OK_LICENSE = /^(cc0|cc[- ]?by(-sa)?( \d\.\d)?|public domain|pd)/i;
const W = process.env.VIDEO_WORKDIR ?? "work";
const script = JSON.parse(readFileSync(`${W}/script.json`, "utf8"));
mkdirSync(`${W}/public/assets`, { recursive: true });

type Cand = { url: string; thumb: string; credit: string; license: string; sourceUrl: string; width: number; height: number;
  kind?: "image" | "video"; duration?: number };
const PIXABAY = process.env.PIXABAY_API_KEY ?? "";
/** A fetch that never throws: a source that does not answer (DNS, connect timeout…) is skipped, not fatal. */
async function get(url: string | URL, headers: Record<string, string>, timeoutMs = 30_000): Promise<Response | null> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    console.log(`  no answer from ${new URL(String(url)).hostname}: ${(error as Error).message.slice(0, 80)}`);
    return null;
  }
}
const strip = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const used = new Set<string>();
let cost = 0;

async function commons(query: string): Promise<Cand[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  const params: Record<string, string> = { action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "1920", origin: "*" };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await get(u, { "user-agent": UA, "api-user-agent": UA });
  const body = res && await res.json().catch(() => null) as any;
  if (!res?.ok || !body) { console.log(`  commons ${res?.status ?? "-"}`); return []; }
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
  const res = await get(u, { "user-agent": UA });
  if (!res?.ok) return [];
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
  const res = await get(u, { "user-agent": UA });
  if (!res?.ok) { console.log(`  pixabay ${res?.status ?? "-"}`); return []; }
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
(6) its mood fits what is spoken (no celebration, smiling crowds or luxury over a scandal, lawsuit or loss) and it does not suggest a person, brand or product the narration is not about${preset?.pictureRules.length ? `;\n(7) ${preset.pictureRules.join("; ")}` : ""}.
Reply with one word: YES or NO.`;
  // Send the picture itself: providers cannot always fetch Wikimedia/Openverse URLs.
  let pic = await get(c.thumb, { "user-agent": UA });
  if (!pic?.ok) pic = await get(c.url, { "user-agent": UA });
  if (!pic?.ok) { console.log(`  thumbnail ${pic?.status ?? "-"}`); return false; }
  const type = pic.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const dataUrl = `data:${type};base64,${Buffer.from(await pic.arrayBuffer()).toString("base64")}`;
  try {
    const { text, cost: spent } = await chat([{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
      { temperature: 0, maxTokens: 3000, json: false, reasoning: 1500, timeoutMs: 120_000 });
    cost += spent;
    return /^\s*yes/i.test(text);
  } catch (error) {
    console.log(`  vision check failed: ${(error as Error).message.slice(0, 160)}`);
    return false;
  }
}

// When nothing found for a beat's own query fits, try a few broader queries picked by what the beat is about, then
// give up (a text card). Every candidate costs a vision check, so a beat is checked at most MAX_CHECKS times.
const MAX_FALLBACKS = 2;
const MAX_CHECKS = 12;
const BROADER: ReadonlyArray<[RegExp, string[]]> = [
  [/\b(stocks?|shares|ticker|markets?|trad(e|ing|ers)|investors?|wall street|nasdaq|s&p|dow)\b/, ["stock market screen", "trading floor"]],
  [/\b(revenue|earnings|profit|results|quarter|forecast|guidance)\b/, ["financial chart screen", "business report charts"]],
  [/\b(fed|central bank|rates?|inflation|economy|jobs)\b/, ["federal reserve building", "us dollar bills"]],
  [/\b(bitcoin|crypto|ethereum|blockchain|token)\b/, ["cryptocurrency coins", "bitcoin chart screen"]],
  [/\b(pay(ment)?s?|wallet|checkout|shopping|purchase)\b/, ["contactless payment", "mobile payment"]],
  [/\b(apps?|software|smartphone|phone|users?)\b/, ["person using smartphone", "laptop screen app"]],
  [/\b(servers?|cloud|data cent(er|re)|chips?|gpus?|security|cyber|hack(ed|ers?)?)\b/, ["data center servers", "computer chip closeup"]],
  [/\b(ceo|chief|executive|founder|president|chair(man|woman)?|spokes(man|woman|person))\b/, ["business executive speaking", "corporate press conference"]],
  [/\b(headquarters|campus|offices?|company)\b/, ["modern office building exterior", "corporate office interior"]],
  [/\b(court|lawsuit|judge|regulators?|sec|probe|investigation)\b/, ["courthouse exterior", "legal documents desk"]],
];
function fallbackQueries(query: string, narration: string): string[] {
  const about = `${query} ${narration}`.toLowerCase();
  const broader = BROADER.filter(([re]) => re.test(about)).flatMap(([, qs]) => qs);
  // The query without words that rarely match free media (logos, titles).
  const plain = query.replace(/\b(app|application|logo|headquarters|ceo|vp|screen|official|photo)\b/gi, " ").replace(/\s+/g, " ").trim();
  return [...new Set([query, ...(plain.length > 2 ? [plain] : []), ...broader])].slice(0, 1 + MAX_FALLBACKS);
}

let n = 0, missing = 0;
for (const scene of script.scenes) for (const beat of scene.beats) {
  const v = beat.visual; const i = n++;
  if (v.type !== "photo" && v.type !== "broll") continue;

  const queries = fallbackQueries(v.query.trim(), beat.narration);
  let found: Cand | null = null, tried = 0;

  for (const query of queries) {
    if (tried >= MAX_CHECKS) break;
    const cands = v.type === "photo"
      ? [...(await commons(query)).slice(0, 4), ...(await openverse(query)).slice(0, 2)]
      : [...(await pixabay(query, true)).slice(0, 3), ...(await pixabay(query, false)).slice(0, 2),
         ...(await openverse(query)).slice(0, 2)]; // no Commons for b-roll: it surfaces real documents and private people
    if (cands.length === 0) continue;

    for (const c of cands.slice(0, query === v.query.trim() ? 8 : 4)) {
      if (tried >= MAX_CHECKS || used.has(c.url)) continue;
      tried++;
      if (await fits(c, query, v.type, script.title, beat.narration)) {
        found = c;
        used.add(c.url);
        break;
      }
    }
    if (found) {
      if (query !== v.query.trim()) console.log(`  (matched via fallback query "${query}")`);
      break;
    }
  }

  if (!found) { missing++; console.log(`beat ${i} ${v.type} "${v.query}": nothing fitting (${tried} checked across ${queries.length} queries) -> text card`); v.type = "card"; continue; }
  const ext = found.kind === "video" ? "mp4" : (found.url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const file = `assets/beat-${String(i).padStart(2, "0")}.${ext}`;
  const img = await get(found.url, { "user-agent": UA }, 120_000);
  if (!img?.ok) { missing++; console.log(`beat ${i}: download ${img?.status ?? "failed"}`); v.type = "card"; continue; }
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
