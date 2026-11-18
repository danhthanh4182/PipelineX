// Real data for charts (run by step "background"): series the story is about, from public sources only.
// - FRED (Federal Reserve Bank of St. Louis), FRED_API_KEY: rates, inflation, jobs, growth, yields, oil, the dollar.
//   Series FRED marks as copyrighted by their owner (stock indices from S&P, Dow Jones, Nasdaq…) are never used.
// - SEC EDGAR company facts (US government data, public domain), SEC_USER_AGENT ("Name email", SEC's rule):
//   quarterly revenue, net income and diluted EPS of the listed companies the story names.
// Each series becomes (1) a BACKGROUND item every later step reads (dossier, script, fact-check: the numbers are
// sourced) and (2) an entry of <dir>/data.json the script's "chart" beats take their points from, exactly.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { W, type Article } from "./lib.ts";

export interface DataSeries { id: string; title: string; unit: string; source: string; url: string; points: Array<{ label: string; value: number }> }

const FRED_KEY = process.env.FRED_API_KEY ?? "";
const SEC_UA = process.env.SEC_USER_AGENT ?? "";

/** FRED series the story's words call for. `yoy`: shown as the change from a year earlier (price indexes). */
const FRED_SERIES: ReadonlyArray<{ re: RegExp; id: string; title: string; unit: string; yoy?: boolean; diff?: boolean }> = [
  { re: /\b(fed(eral)? funds|rate (cut|hike|increase|decrease)s?|interest rates?|fomc|policy rate)\b/i, id: "FEDFUNDS", title: "Federal funds rate", unit: "%" },
  { re: /\b(cpi|inflation|consumer prices?)\b/i, id: "CPIAUCSL", title: "Consumer prices, change from a year earlier", unit: "%", yoy: true },
  { re: /\b(core inflation|core cpi)\b/i, id: "CPILFESL", title: "Core consumer prices, change from a year earlier", unit: "%", yoy: true },
  { re: /\b(pce)\b/i, id: "PCEPI", title: "PCE prices, change from a year earlier", unit: "%", yoy: true },
  { re: /\b(unemployment|jobless rate)\b/i, id: "UNRATE", title: "Unemployment rate", unit: "%" },
  { re: /\b(payrolls?|jobs report|hiring|nonfarm)\b/i, id: "PAYEMS", title: "Jobs added per month (thousands)", unit: "K", diff: true },
  { re: /\b(10-year|treasury yields?|bond yields?)\b/i, id: "DGS10", title: "10-year Treasury yield", unit: "%" },
  { re: /\b(mortgage rates?)\b/i, id: "MORTGAGE30US", title: "30-year mortgage rate", unit: "%" },
  { re: /\b(gdp|economic growth|recession)\b/i, id: "A191RL1Q225SBEA", title: "Real GDP growth (annualized)", unit: "%" },
  { re: /\b(oil prices?|crude|wti)\b/i, id: "DCOILWTICO", title: "WTI crude oil, $ a barrel", unit: "$" },
  { re: /\b(dollar index|strong dollar|weak dollar)\b/i, id: "DTWEXBGS", title: "US dollar index (broad)", unit: "" },
];

const UA = "MarketDecoded-research/1.0";
async function getJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(30_000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
const month = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

async function fredSeries(spec: (typeof FRED_SERIES)[number]): Promise<DataSeries | null> {
  const base = "https://api.stlouisfed.org/fred";
  const info = await getJson(`${base}/series?series_id=${spec.id}&api_key=${FRED_KEY}&file_type=json`);
  const meta = info?.seriess?.[0];
  if (!meta || /copyright/i.test(String(meta.notes ?? ""))) return null; // owner-copyrighted data: not ours to show
  const weekly = /daily|weekly/i.test(String(meta.frequency ?? ""));
  const obs = await getJson(`${base}/series/observations?series_id=${spec.id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${spec.yoy ? 30 : 400}${weekly ? "&frequency=m&aggregation_method=avg" : ""}`);
  const rows = ((obs?.observations ?? []) as Array<{ date: string; value: string }>).filter((o) => o.value !== ".").map((o) => ({ date: o.date, v: Number(o.value) })).reverse();
  if (rows.length < 3) return null;
  let points: Array<{ label: string; value: number }>;
  if (spec.yoy) points = rows.slice(12).map((r, i) => ({ label: month(r.date), value: round((r.v / rows[i]!.v - 1) * 100, 1) }));
  else if (spec.diff) points = rows.slice(1).map((r, i) => ({ label: month(r.date), value: Math.round(r.v - rows[i]!.v) }));
  else points = rows.map((r) => ({ label: month(r.date), value: round(r.v, 2) }));
  points = points.slice(spec.id.startsWith("A191") ? -8 : -12);
  return { id: "", title: spec.title, unit: spec.unit, source: `FRED, Federal Reserve Bank of St. Louis (${spec.id}; ${meta.title})`, url: `https://fred.stlouisfed.org/series/${spec.id}`, points };
}

/** SEC company facts: the last 8 quarters of a few figures, from 10-Q / 10-K filings. */
async function secSeries(cik: string, name: string): Promise<DataSeries[]> {
  const facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { "user-agent": SEC_UA });
  if (!facts) return [];
  const gaap = facts.facts?.["us-gaap"] ?? {};
  const out: DataSeries[] = [];
  const pick = (tags: string[], title: string, unit: "USD" | "USD/shares") => {
    for (const tag of tags) {
      const units = gaap[tag]?.units?.[unit] as Array<{ fp: string; frame?: string; val: number; end: string; start?: string }> | undefined;
      // Quarterly values carry a calendar frame like CY2025Q3 (one 3-month period each).
      const quarters = (units ?? []).filter((u) => /^CY\d{4}Q\d$/.test(u.frame ?? "")).sort((a, b) => a.end.localeCompare(b.end));
      const seen = new Map<string, number>();
      for (const q of quarters) seen.set(q.frame!, q.val);
      const rows = [...seen].slice(-8);
      if (rows.length >= 4) {
        const billions = unit === "USD";
        out.push({ id: "", title: `${name}: ${title}${billions ? " ($ billions)" : " ($)"}`, unit: "$", source: `SEC EDGAR filings (${tag})`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
          points: rows.map(([frame, val]) => ({ label: frame.replace(/^CY(\d{4})Q(\d)$/, "Q$2 $1"), value: billions ? round(val / 1e9, 2) : round(val, 2) })) });
        return;
      }
    }
  };
  pick(["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], "quarterly revenue", "USD");
  pick(["NetIncomeLoss"], "quarterly net income", "USD");
  pick(["EarningsPerShareDiluted"], "diluted earnings per share", "USD/shares");
  return out;
}

/** Companies the story names, matched to SEC's ticker list by ticker or by the company's own name. */
async function companiesIn(text: string): Promise<Array<{ cik: string; name: string }>> {
  const list = await getJson("https://www.sec.gov/files/company_tickers.json", { "user-agent": SEC_UA });
  if (!list) return [];
  const found: Array<{ cik: string; name: string; hits: number }> = [];
  for (const c of Object.values(list) as Array<{ cik_str: number; ticker: string; title: string }>) {
    const short = c.title.replace(/,?\s+(inc|corp|corporation|co|company|ltd|plc|holdings?|group)\.?$/i, "").replace(/\s+(inc|corp)\.?$/i, "").trim();
    if (short.length < 4) continue;
    const byName = new RegExp(`\\b${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const byTicker = c.ticker.length >= 3 ? new RegExp(`\\b${c.ticker}\\b`, "g") : null;
    const hits = (text.match(byName)?.length ?? 0) + (byTicker ? text.match(byTicker)?.length ?? 0 : 0);
    if (hits >= 2) found.push({ cik: String(c.cik_str).padStart(10, "0"), name: short, hits });
  }
  return found.sort((a, b) => b.hits - a.hits).slice(0, 2);
}

/** Finds and saves the story's data series; returns what it did, for the step's RESULT line. */
export async function addData(): Promise<Record<string, unknown>> {
  const story: Article[] = JSON.parse(readFileSync(path.join(W, "story.json"), "utf8"));
  const text = story.map((a) => `${a.title} ${a.summary} ${a.body.slice(0, 4000)}`).join(" ");
  const series: DataSeries[] = [];
  const skipped: string[] = [];
  if (FRED_KEY) {
    for (const spec of FRED_SERIES.filter((s) => s.re.test(text)).slice(0, 3)) { const s = await fredSeries(spec); if (s) series.push(s); }
  } else skipped.push("FRED_API_KEY is not set");
  if (SEC_UA) {
    for (const c of await companiesIn(text)) series.push(...(await secSeries(c.cik, c.name)).slice(0, 2));
  } else skipped.push("SEC_USER_AGENT is not set");
  series.forEach((s, i) => (s.id = `D${i + 1}`));
  writeFileSync(path.join(W, "data.json"), JSON.stringify(series, null, 2));
  // Every later step reads them as background pages, so the numbers spoken over a chart are sourced.
  const bgFile = path.join(W, "background.json");
  const background: Article[] = existsSync(bgFile) ? JSON.parse(readFileSync(bgFile, "utf8")) : [];
  for (const s of series) background.push({
    title: `${s.id}: ${s.title}`, source: `${s.source.split(" (")[0]} (data)`, url: s.url, published_at: "", headline: s.title, summary: "",
    body: `${s.title}, ${s.source}. Values: ${s.points.map((p) => `${p.label}: ${p.value}${s.unit === "%" ? "%" : ""}`).join("; ")}.`, background: true,
  });
  writeFileSync(bgFile, JSON.stringify(background, null, 2));
  console.log(`data: ${series.length} series${series.length ? ` (${series.map((s) => s.title).join("; ")})` : ""}${skipped.length ? `; skipped: ${skipped.join(", ")}` : ""}`);
  return { series: series.length, ...(skipped.length ? { dataSkipped: skipped } : {}) };
}
