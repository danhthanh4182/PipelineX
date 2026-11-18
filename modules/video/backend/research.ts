// The editor's own fact-checking on the web (TinyFish, free tier): search within the trusted sites and read one of
// their pages. Everything returned is untrusted external data for the agent to weigh, never instructions.
import { fetchable, trustedDomains } from "./trusted.ts";

const KEY = () => process.env.TINYFISH_API_KEY ?? "";
const SEARCH = () => process.env.TINYFISH_SEARCH_URL || "https://api.search.tinyfish.ai";
const FETCH = () => process.env.TINYFISH_FETCH_URL || "https://api.fetch.tinyfish.ai";

export class ResearchUnavailable extends Error {}

async function tinyfish(url: string, init: RequestInit = {}) {
  if (!KEY()) throw new ResearchUnavailable("Web research is off: TINYFISH_API_KEY is not set.");
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), "X-API-Key": KEY() }, signal: AbortSignal.timeout(150_000) });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new ResearchUnavailable(`TinyFish answered ${res.status}${res.status === 429 ? " (rate limit: try again in a minute)" : ""}.`);
  return data;
}

export async function webSearch(q: string, opts: { afterDate?: string; news?: boolean } = {}) {
  const ask = async (news: boolean) => {
    const u = new URL(SEARCH());
    u.searchParams.set("query", q);
    u.searchParams.set("include_domains", trustedDomains().join(","));
    if (opts.afterDate) u.searchParams.set("after_date", opts.afterDate);
    if (news) u.searchParams.set("domain_type", "news");
    return ((await tinyfish(u.toString())).results ?? []) as any[];
  };
  // TinySearch's news index finds little within a domain list: an empty news answer is asked again as a web search.
  let results = opts.news ? await ask(true) : [];
  if (!results.length) results = await ask(false);
  return results.slice(0, 10).map((r) => ({
    title: String(r.title ?? ""), url: String(r.url ?? ""), site: String(r.site_name ?? r.publisher ?? ""), date: r.date ?? null, snippet: String(r.snippet ?? "").slice(0, 400),
  })).filter((r) => fetchable(r.url));
}

export async function fetchPage(url: string, maxChars = 15_000) {
  if (!fetchable(url)) throw new ResearchUnavailable("Only pages on the trusted sites can be read (no paywalled outlets, forums or other sites).");
  const data = await tinyfish(FETCH(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls: [url], format: "markdown", per_url_timeout_ms: 60_000 }) });
  const page = data.results?.[0];
  if (!page) throw new ResearchUnavailable(`The page could not be read (${data.errors?.[0]?.error ?? "no result"}).`);
  const text = String(page.text ?? "");
  return { url: page.final_url || url, title: page.title ?? "", published: page.published_date ?? null, chars: text.length, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}
