// Which sites count as trustworthy for background research and fact-checking (the video's background step and the
// editor MCP's web tools): the monitored news sources' own sites plus the official sites of the companies, labs and
// agencies the channel covers; paywalled outlets are never fetched. Plain code (node:fs only): the renderer imports it too.
import { readFileSync } from "node:fs";

/** Outlets whose articles are behind a paywall: summary and link only, never fetched. */
export const PAYWALLED = ["bloomberg.com", "theinformation.com", "wsj.com", "ft.com", "nytimes.com", "economist.com", "businessinsider.com"];
/** Official sites of the companies and labs the channel covers, besides the monitored sources. */
export const OFFICIAL = ["openai.com", "anthropic.com", "blog.google", "deepmind.google", "research.google", "ai.meta.com", "about.fb.com", "blogs.microsoft.com",
  "news.microsoft.com", "nvidianews.nvidia.com", "blogs.nvidia.com", "machinelearning.apple.com", "x.ai", "mistral.ai", "huggingface.co",
  "aws.amazon.com", "aboutamazon.com", "arxiv.org", "reuters.com", "apnews.com", "sec.gov", "ftc.gov", "oag.ca.gov", "whitehouse.gov", "commerce.gov"];
/** Feed hosts that are aggregators or mirrors, not the outlet itself. */
const NOT_OUTLETS = new Set(["hnrss.org", "news.google.com", "raw.githubusercontent.com", "github.com", "feeds.feedburner.com", "rsshub.app"]);
const KEEP_FULL_HOST = /\.(substack|beehiiv|ghost)\.(com|io)$/;
/** User-written or non-article parts of trusted sites: forums, communities, podcasts, app listings, help pages. */
export const NOT_ARTICLES = /^(discuss|forum|forums|community|communities|podcasts?|apps|support|help|status|jobs|careers|shop|store)\./;

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
/** The domain to search within: the host minus feed-only prefixes, the full host for newsletter platforms. */
const siteOf = (host: string) => (KEEP_FULL_HOST.test(host) ? host : host.replace(/^(feeds?|rss|www)\./, ""));
export const paywalled = (url: string) => PAYWALLED.some((d) => hostOf(url) === d || hostOf(url).endsWith(`.${d}`));

export function trustedDomains(): string[] {
  const sources = JSON.parse(readFileSync(new URL("../../../industry/sources.json", import.meta.url), "utf8"));
  const hosts = (sources.sources ?? sources).flatMap((s: any) => [s.config?.feedUrl, s.config?.url, s.config?.siteUrl].filter(Boolean).map(hostOf));
  return [...new Set([...hosts.filter((h: string) => h && !NOT_OUTLETS.has(h)).map(siteOf), ...OFFICIAL])].filter((d) => !PAYWALLED.includes(d));
}


/** Forum and comment sections that live under a trusted site's own address (Ars Technica's /civis/, …). */
export const NOT_ARTICLE_PATHS = /\/(civis|forums?|community|discuss|comments)(\/|$)/i;

/** Whether a page may be fetched: a trusted site (or a subdomain of one), not paywalled, not a forum or listing. */
export function fetchable(url: string, domains = trustedDomains()): boolean {
  const host = hostOf(url);
  if (!host || paywalled(url) || NOT_ARTICLES.test(host) || !/^https?:/.test(url)) return false;
  try { if (NOT_ARTICLE_PATHS.test(new URL(url).pathname)) return false; } catch { return false; }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}
