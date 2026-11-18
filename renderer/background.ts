// Step "background" (optional, TinyFish): before the dossier, (1) fetch the full text of the story's reports that
// came with only a few lines, unless the outlet is paywalled, and (2) search trusted sites for context the reports
// lack (earlier events, official announcements, reactions) and fetch the best pages. Found pages are written to
// <dir>/background.json and read with the reports by every later step (lib.ts readArticles), marked as background.
// Without TINYFISH_API_KEY, or when TinyFish fails, it records why and the video goes on without it.
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env background.ts
import { readFileSync, writeFileSync } from "node:fs";
import { CHANNEL, chatJson, outlet, W, type Article } from "./lib.ts";
import { hostOf, NOT_ARTICLE_PATHS, NOT_ARTICLES, paywalled, trustedDomains } from "../modules/video/backend/trusted.ts";

const KEY = process.env.TINYFISH_API_KEY ?? "";
const SEARCH = process.env.TINYFISH_SEARCH_URL || "https://api.search.tinyfish.ai";
const FETCH = process.env.TINYFISH_FETCH_URL || "https://api.fetch.tinyfish.ai";
const MAX_QUERIES = 6, MAX_PAGES = 8, PAGE_CHARS = 8000, SHORT = 1000;

async function tinyfish(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), "X-API-Key": KEY }, signal: AbortSignal.timeout(150_000) });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`TinyFish ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

async function fetchPages(urls: string[]) {
  const pages: Array<{ url: string; title: string; text: string; published: string; site: string }> = [];
  const errors: string[] = [];
  for (let i = 0; i < urls.length; i += 10) {
    const data = await tinyfish(FETCH, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: urls.slice(i, i + 10), format: "markdown", per_url_timeout_ms: 60_000 }) });
    for (const r of data.results ?? []) pages.push({ url: r.final_url || r.url, title: r.title ?? "", text: String(r.text ?? ""), published: r.published_date ?? "", site: hostOf(r.final_url || r.url) });
    for (const e of data.errors ?? []) errors.push(`${hostOf(e.url)}: ${e.error}`);
  }
  return { pages, errors };
}

const result: Record<string, unknown> = { filled: 0, searched: 0, added: 0 };
const finish = (note?: string) => {
  if (note) { result.skipped = note; console.log(`background skipped: ${note}`); }
  console.log(`RESULT ${JSON.stringify(result)}`);
};

if (!KEY) {
  writeFileSync(`${W}/background.json`, "[]");
  finish("TINYFISH_API_KEY is not set");
} else {
  try {
    const story: Article[] = JSON.parse(readFileSync(`${W}/story.json`, "utf8"));

    // (1) Full text for reports that came with only a few lines (open sites only).
    const short = story.filter((a) => a.body.length < SHORT && !paywalled(a.url));
    if (short.length) {
      const { pages, errors } = await fetchPages(short.map((a) => a.url));
      for (const a of short) {
        const page = pages.find((p) => hostOf(p.url) === hostOf(a.url) && p.text.length > a.body.length + 500);
        if (page) { a.body = page.text.slice(0, 12000); (result.filled as number)++; }
      }
      if (errors.length) result.fillErrors = errors.slice(0, 5);
      writeFileSync(`${W}/story.json`, JSON.stringify(story, null, 2));
    }

    // (2) Context the reports lack: a few searches within trusted sites, then the best new pages.
    const { json, cost } = await chatJson(`You plan background research for a news video about ${CHANNEL.subject}. From the reports' headlines and summaries, write at most ${MAX_QUERIES} web search queries for context the reports themselves do not give: the earlier events this story builds on, the official announcement or filing behind it, named people's or companies' prior statements, and what is scheduled next. Each query 3-10 words, specific (names, products, dates), in English. Return ONLY JSON: {"queries": [{"q": string, "why": string}]}`,
      story.map((a, i) => `[${i + 1}] ${outlet(a)}, ${a.published_at.slice(0, 10)}: ${a.title}\n${a.summary}`).join("\n\n"), { maxTokens: 4000 });
    result.cost = cost;
    const queries: string[] = (json.queries ?? []).map((q: any) => String(q.q ?? "").trim()).filter(Boolean).slice(0, MAX_QUERIES);
    const domains = trustedDomains();
    const have = new Set(story.map((a) => a.url.split("?")[0]));
    const picked: Array<{ url: string; query: string }> = [];
    for (const q of queries) {
      const u = new URL(SEARCH);
      u.searchParams.set("query", q);
      u.searchParams.set("include_domains", domains.join(","));
      const data = await tinyfish(u.toString(), {});
      (result.searched as number)++;
      for (const r of (data.results ?? []).slice(0, 4)) {
        const url = String(r.url ?? "").split("#")[0]!;
        if (!url || paywalled(url) || NOT_ARTICLES.test(hostOf(url)) || NOT_ARTICLE_PATHS.test(new URL(url).pathname) || have.has(url.split("?")[0]!) || picked.some((p) => p.url === url)) continue;
        picked.push({ url, query: q });
        if (picked.filter((p) => p.query === q).length >= 2) break;
      }
      if (picked.length >= MAX_PAGES) break;
    }
    const { pages, errors } = picked.length ? await fetchPages(picked.slice(0, MAX_PAGES).map((p) => p.url)) : { pages: [], errors: [] };
    const background: Article[] = pages.filter((p) => p.text.length >= 800).map((p) => ({
      title: p.title || p.url, source: `${p.site} (background)`, url: p.url, published_at: p.published || "",
      headline: p.title, summary: "", body: p.text.slice(0, PAGE_CHARS), background: true,
    }));
    writeFileSync(`${W}/background.json`, JSON.stringify(background, null, 2));
    result.added = background.length;
    result.queries = queries;
    if (errors.length) result.fetchErrors = errors.slice(0, 5);
    console.log(`filled ${result.filled} short report(s); ${queries.length} searches; added ${background.length} background page(s): ${background.map((b) => hostOf(b.url)).join(", ")}`);
    finish();
  } catch (error) {
    writeFileSync(`${W}/background.json`, "[]");
    finish(`failed: ${(error as Error).message.slice(0, 300)}`);
  }
}
