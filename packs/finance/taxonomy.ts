// Finance & markets taxonomy (PipelineX finance pack): categories, tag vocabulary, entity directory and the
// anti-hallucination dictionary. Models tag items with this vocabulary; topics.json groups by tags; filter bars by category.

/**
 * Categories shown across the web UI and used to pick a video style (channel.json styles.byCategory).
 * key: external identity in URLs and APIs (never change in production).
 */
export const CATEGORIES = [
  { key: "markets", tagColor: "blue", label: "Markets", feedLabel: "Markets", section: "Markets", guide: "Moves in stocks, indices, bonds, currencies and commodities and their stated causes: sell-offs, rallies, records, volatility, sector rotation. A single company's results belong to companies." },
  { key: "macro", tagColor: "orange", label: "Economy", feedLabel: "Economy & Central Banks", section: "Economy & Central Banks", guide: "Central bank decisions and speeches, inflation, jobs, growth, trade and fiscal data, government budgets and tariffs as economic events." },
  { key: "companies", tagColor: "turquoise", label: "Companies", feedLabel: "Companies & Earnings", section: "Companies & Earnings", guide: "Earnings, guidance, layoffs, leadership changes, mergers and acquisitions, IPOs, buybacks, bankruptcies and major company decisions." },
  { key: "crypto", tagColor: "violet", label: "Crypto", feedLabel: "Crypto", section: "Crypto", guide: "Bitcoin, Ethereum and other digital assets, stablecoins, exchanges, ETFs, hacks and crypto regulation." },
  { key: "policy", tagColor: "red", label: "Regulation", feedLabel: "Regulation & Enforcement", section: "Regulation & Enforcement", guide: "Financial regulation, enforcement actions, fines, lawsuits, fraud cases, bank failures and supervision." },
  { key: "money", tagColor: "green", label: "Your Money", feedLabel: "Personal Finance", section: "Your Money", guide: "Rates, mortgages, savings, retirement, taxes and prices as they change ordinary people's decisions; reusable money practices.", commentary: true },
  { key: "opinion", tagColor: "purple", label: "Analysis", feedLabel: "Analysis", section: "Analysis", guide: "Analyses, forecasts, strategist and investor views, interviews and commentary.", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/** Primary release metric for briefings: finance has no headline "release" kind. */
export const RELEASE: { category: string; tag: string; unit: string } | null = null;

/** Common terms periodic summaries may use without a citation. */
export const PLAIN_TERMS: readonly string[] = ["gdp", "cpi", "ceo", "ipo", "etf", "fed", "ecb", "eps", "s&p"];

/** Item types extracted during content understanding (selection-score.md weights them). */
export const ITEM_TYPES = ["market_move", "earnings", "macro_policy", "corporate_deal", "regulation_legal", "crypto_event", "opinion_analysis", "explainer"] as const;

// ── Tag Vocabularies ─────────────────────────────────────────────────────────────

/** Primary category tags: the first tag of every item must be one of these. */
export const CATEGORY_TAGS = [
  "Market Move", "Earnings", "Central Bank", "Economic Data", "Deal / M&A", "IPO / Listing", "Regulation / Enforcement", "Lawsuit / Fraud",
  "Crypto", "Personal Finance", "Opinion / Analysis", "Other",
] as const;

/** Topic tags. */
export const TOPIC_TAGS = [
  "Stocks", "Bonds", "Rates", "Inflation", "Jobs", "Housing", "Banks", "Tech Stocks", "Energy", "Commodities", "Currencies", "Trade / Tariffs",
  "Bitcoin", "Ethereum", "Stablecoins", "Private Equity", "AI Trade",
] as const;

/** Entity tags (institutions and the most watched companies). */
export const ENTITY_TAGS = ["Federal Reserve", "ECB", "SEC", "US Treasury", "Nvidia", "Apple", "Microsoft", "Tesla", "JPMorgan", "Berkshire Hathaway", "BlackRock"] as const;

/** Canonical mapping for synonyms. */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "markets": "Market Move", "market": "Market Move", "stocks": "Stocks", "equities": "Stocks",
  "earnings": "Earnings", "results": "Earnings", "fed": "Central Bank", "central bank": "Central Bank", "rates": "Rates", "interest rates": "Rates",
  "economy": "Economic Data", "data": "Economic Data", "cpi": "Inflation", "inflation": "Inflation", "jobs": "Jobs", "employment": "Jobs",
  "m&a": "Deal / M&A", "merger": "Deal / M&A", "acquisition": "Deal / M&A", "ipo": "IPO / Listing",
  "regulation": "Regulation / Enforcement", "enforcement": "Regulation / Enforcement", "fraud": "Lawsuit / Fraud", "lawsuit": "Lawsuit / Fraud",
  "crypto": "Crypto", "bitcoin": "Bitcoin", "btc": "Bitcoin", "ethereum": "Ethereum", "eth": "Ethereum", "stablecoin": "Stablecoins",
  "personal finance": "Personal Finance", "opinion": "Opinion / Analysis", "analysis": "Opinion / Analysis",
};

// ── Entities & Anti-Hallucination Lexicon ────────────────────────────────────────

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  fed: { name: "Federal Reserve", displayTag: "Federal Reserve", aliases: ["Federal Reserve", "the Fed", "FOMC"], orgNames: ["Federal Reserve", "Board of Governors of the Federal Reserve System"] },
  ecb: { name: "European Central Bank", displayTag: "ECB", aliases: ["ECB", "European Central Bank"], orgNames: ["European Central Bank"] },
  sec: { name: "SEC", displayTag: "SEC", aliases: ["SEC", "Securities and Exchange Commission"], orgNames: ["U.S. Securities and Exchange Commission"] },
  treasury: { name: "US Treasury", displayTag: "US Treasury", aliases: ["Treasury Department", "US Treasury"], orgNames: ["U.S. Department of the Treasury"] },
  nvidia: { name: "Nvidia", displayTag: "Nvidia", aliases: ["Nvidia", "NVDA"], orgNames: ["NVIDIA"] },
  apple: { name: "Apple", displayTag: "Apple", aliases: ["Apple", "AAPL"], orgNames: ["Apple"] },
  microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "MSFT"], orgNames: ["Microsoft"] },
  tesla: { name: "Tesla", displayTag: "Tesla", aliases: ["Tesla", "TSLA"], orgNames: ["Tesla"] },
  jpmorgan: { name: "JPMorgan Chase", displayTag: "JPMorgan", aliases: ["JPMorgan", "JPMorgan Chase", "JPM"], orgNames: ["JPMorgan Chase"] },
  berkshire: { name: "Berkshire Hathaway", displayTag: "Berkshire Hathaway", aliases: ["Berkshire Hathaway", "Berkshire"], orgNames: ["Berkshire Hathaway"] },
  blackrock: { name: "BlackRock", displayTag: "BlackRock", aliases: ["BlackRock", "iShares"], orgNames: ["BlackRock"] },
};

export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "fed", name: "Federal Reserve", patterns: [/federal reserve|\bthe fed\b|\bfomc\b|\bpowell\b/i] },
  { id: "ecb", name: "ECB", patterns: [/\becb\b|european central bank|\blagarde\b/i] },
  { id: "sec", name: "SEC", patterns: [/\bsec\b|securities and exchange commission/i] },
  { id: "treasury", name: "US Treasury", patterns: [/treasury (department|secretary)|\bus treasury\b/i] },
  { id: "nvidia", name: "Nvidia", patterns: [/nvidia|\bnvda\b/i] },
  { id: "apple", name: "Apple", patterns: [/\bapple\b|\baapl\b/i] },
  { id: "microsoft", name: "Microsoft", patterns: [/microsoft|\bmsft\b/i] },
  { id: "tesla", name: "Tesla", patterns: [/\btesla\b|\btsla\b/i] },
  { id: "jpmorgan", name: "JPMorgan Chase", patterns: [/jpmorgan|\bjpm\b|jamie dimon/i] },
  { id: "berkshire", name: "Berkshire Hathaway", patterns: [/berkshire|warren buffett/i] },
  { id: "blackrock", name: "BlackRock", patterns: [/blackrock|\bishares\b|larry fink/i] },
  { id: "bitcoin", name: "Bitcoin", patterns: [/\bbitcoin\b|\bbtc\b/i] },
  { id: "ethereum", name: "Ethereum", patterns: [/\bethereum\b|\beth\b|\bether\b/i] },
];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "fed", domains: ["federalreserve.gov"] },
  { entityId: "ecb", domains: ["ecb.europa.eu"] },
  { entityId: "sec", domains: ["sec.gov"] },
  { entityId: "treasury", domains: ["treasury.gov", "home.treasury.gov"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
