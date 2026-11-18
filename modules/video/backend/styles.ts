// Video styles: how a video is written, paced and dressed for its kind of story. Chosen automatically from the
// story's reports (categories and words), changeable by the agent or the editor. Plain data with no imports: the
// renderer reads it too (through style-preset.json in each video's folder).

export type StyleKey = "news" | "launch" | "product" | "finance" | "markets" | "earnings" | "macro" | "crypto" | "investigation" | "crime" | "war" | "explainer" | "analysis";

export interface VideoStyle {
  key: StyleKey;
  label: string;
  /** What kind of story it is for (shown to the editor and the agent). */
  for: string;
  script: {
    /** The scene plan, replacing the default one. */
    structure: string;
    tone: string;
    /** Extra rules for the writer (and the Short writer). */
    rules: string[];
    /** Concrete b-roll ideas that suit the kind of story. */
    broll: string[];
  };
  short: { hook: string };
  /** Extra conditions for the picture check (assets.ts). */
  pictureRules: string[];
  visual: { accent: string; accent2: string; kicker: string };
  voice: { rate: string; shortRate: string };
  /** Music folder under renderer/music/ (falls back to renderer/music/*.mp3). */
  music: string;
  /** Sensitive topics (YouTube: violence, crime): stricter words and pictures, no shock in thumbnails. */
  sensitive?: true;
}

const SENSITIVE_WORDS = [
  "No sensational or graphic language; describe violence factually and briefly, never in detail.",
  "Every casualty, damage or crime figure is attributed to who reports it, with its date; figures from parties to a conflict or case are named as theirs.",
  "Do not name victims, minors or private individuals; public officials and organisations may be named.",
];
const SENSITIVE_PICTURES = [
  "no blood, wounds, bodies, injured or distressed people, weapons being fired at people, executions, or children",
  "no picture that could be mistaken for showing the actual events of this story unless it is credited as such",
];

export const STYLES: Record<StyleKey, VideoStyle> = {
  news: {
    key: "news", label: "News", for: "General news and announcements; the default.",
    script: {
      structure: "hook (15-20 s: the most important fact and why it matters), 4-5 story scenes (what happened, background, reactions, what comes next), outro",
      tone: "clear, neutral, brisk", rules: [], broll: ["newsroom screens", "city skyline", "office workers laptops"],
    },
    short: { hook: "the single most important fact, in under 12 words" },
    pictureRules: [], visual: { accent: "#36d399", accent2: "#ff5c5c", kicker: "#36d399" },
    voice: { rate: "+4%", shortRate: "+10%" }, music: "neutral",
  },
  launch: {
    key: "launch", label: "Model launch", for: "A new AI model, version or open weights; benchmark results.",
    script: {
      structure: "hook (what was released and the headline capability), what is new, the numbers (benchmarks, context, price) with their source, how it compares with named rivals, who can use it and how, limits and open questions, outro",
      tone: "energetic but precise", rules: ["Give every benchmark number with what it measures and who reported it; never call a model 'the best' unless a source does."],
      broll: ["data center servers", "glowing circuit board", "code on screen"],
    },
    short: { hook: "what the new model can do that the old one could not" },
    pictureRules: [], visual: { accent: "#4c8dff", accent2: "#36d399", kicker: "#4c8dff" },
    voice: { rate: "+6%", shortRate: "+12%" }, music: "upbeat",
  },
  product: {
    key: "product", label: "Product", for: "A new AI product, feature, app or API.",
    script: {
      structure: "hook (what you can now do), what it does, who gets it and when, how to try it, what it costs, limits and concerns, outro",
      tone: "practical, friendly", rules: ["Say plainly where and to whom it is available, as the sources state."],
      broll: ["person using smartphone", "laptop screen app", "hands typing keyboard"],
    },
    short: { hook: "what viewers can now do, in under 12 words" },
    pictureRules: [], visual: { accent: "#2ec4b6", accent2: "#ffd23f", kicker: "#2ec4b6" },
    voice: { rate: "+5%", shortRate: "+10%" }, music: "upbeat",
  },
  finance: {
    key: "finance", label: "Finance", for: "Funding, valuations, IPOs, acquisitions, earnings, stock moves.",
    script: {
      structure: "hook (the headline number and what it means), the numbers with dates and sources, why it happened, who gains and who loses, market reaction, what to watch next, outro",
      tone: "calm, measured, numerate",
      rules: ["Every figure carries its currency, date and source; distinguish reported, expected and rumoured numbers.", "This is not investment advice: never tell viewers to buy or sell."],
      broll: ["stock ticker screen", "trading floor", "city financial district"],
    },
    short: { hook: "the headline number and who it is for" },
    pictureRules: [], visual: { accent: "#f5b700", accent2: "#36d399", kicker: "#f5b700" },
    voice: { rate: "+3%", shortRate: "+8%" }, music: "calm",
  },
  markets: {
    key: "markets", label: "Markets", for: "Moves in stocks, bonds, rates, currencies and commodities (finance channels).",
    script: {
      structure: "hook (the move, its size and when, attributed), what moved and by how much, why (the causes sources give, attributed), who gains and who loses, what traders and strategists say, what to watch next (data, decisions, levels sources name), outro",
      tone: "brisk, clear, numerate",
      rules: ["Every move carries its size, its time (close, intraday, premarket) and the index or asset; causes are attributed, never asserted.", "This is not investment advice: never tell viewers to buy or sell."],
      broll: ["stock ticker screen", "trading floor", "financial district skyline"],
    },
    short: { hook: "the move and its size, in under 12 words" },
    pictureRules: [], visual: { accent: "#22c55e", accent2: "#ef4444", kicker: "#22c55e" },
    voice: { rate: "+5%", shortRate: "+10%" }, music: "upbeat",
  },
  earnings: {
    key: "earnings", label: "Earnings", for: "A company's results, guidance or profit warning (finance channels).",
    script: {
      structure: "hook (the headline result against expectations, attributed), the numbers (revenue, profit, guidance) with periods and whose estimates, what drove them, the stock's reaction with its time, what management said, risks and what to watch next quarter, outro",
      tone: "precise, matter-of-fact",
      rules: ["Say whose estimates a beat or miss is measured against; revenue is not profit; guidance is the company's own forecast.", "This is not investment advice: never tell viewers to buy or sell."],
      broll: ["company headquarters exterior", "stock ticker screen", "factory production line"],
    },
    short: { hook: "beat or miss, by how much, and how the stock reacted" },
    pictureRules: [], visual: { accent: "#38bdf8", accent2: "#f5b700", kicker: "#38bdf8" },
    voice: { rate: "+4%", shortRate: "+10%" }, music: "calm",
  },
  macro: {
    key: "macro", label: "Economy", for: "Central bank decisions, inflation, jobs, growth, tariffs and fiscal policy (finance channels).",
    script: {
      structure: "hook (the decision or the number, attributed and dated), what was decided or reported against expectations, why it matters for prices, rates and jobs, how markets reacted, what officials said, what it means for ordinary people's money (rates, mortgages, savings) as sources describe it, what comes next (next meeting or release), outro",
      tone: "calm, clear, explanatory",
      rules: ["Name the rate or measure exactly (federal funds rate, core CPI y/y); basis points are not percent.", "Effects on viewers' money are only as sources describe them; never advise."],
      broll: ["federal reserve building", "grocery store prices", "city street shoppers"],
    },
    short: { hook: "the decision or number and what it means for your money" },
    pictureRules: [], visual: { accent: "#f59e0b", accent2: "#38bdf8", kicker: "#f59e0b" },
    voice: { rate: "+2%", shortRate: "+8%" }, music: "calm",
  },
  crypto: {
    key: "crypto", label: "Crypto", for: "Bitcoin, Ethereum and other digital assets, ETFs, exchanges, hacks and rules (finance channels).",
    script: {
      structure: "hook (the move or event, attributed), what happened with numbers and times, why (causes sources give), what regulators, exchanges or issuers said, the risks, what to watch next, outro",
      tone: "energetic but skeptical",
      rules: ["Prices are volatile: every price carries its time and source.", "Never promote a token or tell viewers to buy; flag unverified claims and hacks as reported."],
      broll: ["bitcoin coin closeup", "crypto trading chart screen", "server racks blue light"],
    },
    short: { hook: "the move or event and its size, attributed" },
    pictureRules: [], visual: { accent: "#f7931a", accent2: "#8b5cf6", kicker: "#f7931a" },
    voice: { rate: "+5%", shortRate: "+10%" }, music: "upbeat",
  },
  investigation: {
    key: "investigation", label: "Investigation", for: "Lawsuits, regulation and policy, security incidents, scandals, official probes.",
    script: {
      structure: "hook (the allegation or decision, attributed), what is alleged or decided and by whom, the evidence each side gives, a timeline of events, what each party says, what is still unknown, what happens next (hearings, deadlines), outro",
      tone: "serious, careful, even-handed",
      rules: ["Allegations are always attributed ('the complaint alleges', 'according to'); give the accused party's response when the sources have it.", "Separate established facts from claims in every scene."],
      broll: ["courtroom gavel", "government building", "server room security"],
    },
    short: { hook: "the allegation, attributed to who makes it" },
    pictureRules: [], visual: { accent: "#e5484d", accent2: "#f5b700", kicker: "#e5484d" },
    voice: { rate: "+1%", shortRate: "+6%" }, music: "serious",
  },
  crime: {
    key: "crime", label: "Crime", for: "Crimes and arrests: fraud, scams, deepfake abuse, hacking charges, criminal cases.",
    script: {
      structure: "hook (what happened, attributed to police, prosecutors or court records), what is alleged and against whom, how it was discovered, the legal status (charged, convicted, appeal), how people can protect themselves, outro",
      tone: "sober, factual, respectful",
      rules: ["A person charged is innocent until convicted: say 'charged with' or 'accused of', never that they did it, unless a court has ruled.", ...SENSITIVE_WORDS],
      broll: ["police car lights", "courthouse exterior", "laptop with padlock"],
    },
    short: { hook: "what happened, attributed, and why it matters to viewers" },
    pictureRules: SENSITIVE_PICTURES, visual: { accent: "#ff6b3d", accent2: "#c9d1d9", kicker: "#ff6b3d" },
    voice: { rate: "+0%", shortRate: "+5%" }, music: "serious", sensitive: true,
  },
  war: {
    key: "war", label: "War & conflict", for: "War, armed conflict, military use of AI, sanctions and export controls tied to conflict.",
    script: {
      structure: "hook (what happened, attributed and dated), the situation on the ground as sources report it, who says what (each side named), the role of AI or technology, international reactions, what is unverified, what comes next, outro",
      tone: "grave, restrained, strictly neutral",
      rules: ["Report each side's claims as theirs; say when a claim cannot be independently verified.", "Never take sides or use loaded terms beyond the sources' own attributed words.", ...SENSITIVE_WORDS],
      broll: ["world map", "government building flags", "satellite dish"],
    },
    short: { hook: "what happened, attributed and dated, without graphic detail" },
    pictureRules: SENSITIVE_PICTURES, visual: { accent: "#8b9bb4", accent2: "#e5484d", kicker: "#8b9bb4" },
    voice: { rate: "-2%", shortRate: "+4%" }, music: "somber", sensitive: true,
  },
  explainer: {
    key: "explainer", label: "Research explainer", for: "Research papers, technical reports, new benchmarks and datasets.",
    script: {
      structure: "hook (the question the research answers), why it matters, how they did it (one plain analogy), what they found with numbers, limits and caveats from the paper or reporters, what it could change, outro",
      tone: "curious, clear, patient",
      rules: ["Explain one technical idea with an everyday analogy, labelled as an analogy.", "Say whether results are peer-reviewed or a preprint when the sources say so."],
      broll: ["scientist laboratory", "whiteboard equations", "neural network visualization"],
    },
    short: { hook: "the surprising finding, in plain words" },
    pictureRules: [], visual: { accent: "#9b6dff", accent2: "#36d399", kicker: "#9b6dff" },
    voice: { rate: "+2%", shortRate: "+8%" }, music: "curious",
  },
  analysis: {
    key: "analysis", label: "Analysis", for: "Opinion, interviews, forecasts, guides and practices.",
    script: {
      structure: "hook (the claim or question), the main argument and who makes it, the evidence given, the strongest counter-view from the sources, what it means for viewers, outro",
      tone: "thoughtful, balanced",
      rules: ["Every opinion is attributed to its author; the channel takes no side of its own."],
      broll: ["person thinking at desk", "conference stage speaker", "notebook and coffee"],
    },
    short: { hook: "the boldest claim, attributed to who makes it" },
    pictureRules: [], visual: { accent: "#c9d1d9", accent2: "#36d399", kicker: "#c9d1d9" },
    voice: { rate: "+3%", shortRate: "+8%" }, music: "calm",
  },
};

export const STYLE_KEYS = Object.keys(STYLES) as StyleKey[];

/** Words in a story's titles and summaries that point to a style, strongest first. */
const SIGNALS: Array<[StyleKey, RegExp]> = [
  ["war", /\b(war|wars|warfare|invasion|airstrikes?|missiles?|drone strikes?|military|troops|ceasefire|front ?line|armed conflict|ukraine|gaza|hamas|hezbollah|pentagon|defen[cs]e ministry)\b/i],
  ["crime", /\b(arrest(ed)?|charged|indict(ed|ment)|convicted|sentenced|scam(mers?)?|police|prosecutors?|extortion|money laundering|criminal|deepfake (porn|abuse)|ransomware gang)\b/i],
  ["investigation", /\b(lawsuit|sues?|sued|court|judge|ruling|regulat(e|es|ed|or|ors|ion|ions)|antitrust|ftc|sec probe|probe|investigat(e|es|ed|ion|ions)|attorney general|subpoena|breach|hack(ed|ing)?|security incident|scandal|fine[ds]?|ban(s|ned)?|export (controls?|rules?|curbs|restrictions)|sanctions?|licen[cs]e rule|lawmakers|congress|senate|legislation|bill|white house|commerce department|resign(s|ed|ation)?|ousted|ouster|fired|affair|spy|espionage|allegations?|alleged(ly)?|whistleblower)\b/i],
  ["finance", /\b(ipo|valuation|funding|raises?|raised|series [a-f]|acquisitions?|acquires?|merger|earnings|revenue|profit|shares|stock|market cap|investors?|billion|trillion)\b/i],
];
/** Legal and enforcement words only: a finance channel's tariff or budget story is economy, not an investigation. */
const LEGAL = /\b(lawsuit|sues?|sued|court|judge|ruling|indict(ed|ment)|charged|fraud|probe|investigat(e|es|ed|ion|ions)|subpoena|settle(s|d|ment)|fine[ds]?|penalt(y|ies)|enforcement|whistleblower|bank failure|collapsed?)\b/i;

/** The channel's own category -> style map (industry/channel.json styles.byCategory), passed in by the caller. */

/**
 * The style a story's reports call for: war or crime when a third of the reports are about it; else the stronger of
 * investigation and finance when a third are about it; else the reports' most common category; else plain news.
 */
export function chooseStyle(reports: Array<{ text: string; category: string | null }>, byCategory: Record<string, string> = {}, allowed: readonly string[] = STYLE_KEYS): { style: StyleKey; why: string } {
  if (!reports.length) return { style: "news", why: "no reports" };
  const share = (re: RegExp) => reports.filter((r) => re.test(r.text)).length;
  const enough = (hits: number) => hits >= 1 && hits / reports.length >= 1 / 3;
  const why = (style: StyleKey, hits: number) => `${hits} of ${reports.length} reports are about ${STYLES[style].label.toLowerCase()}`;
  // Sensitive topics first: their stricter rules must apply whenever a third of the coverage is about them.
  for (const [style, re] of SIGNALS.filter(([k]) => (k === "war" || k === "crime") && allowed.includes(k))) {
    const hits = share(re);
    if (enough(hits)) return { style, why: why(style, hits) };
  }
  // Then the stronger of investigation and finance (a scandal moves shares; a funding round can draw a probe). A channel
  // with finer finance styles (markets, earnings, macro, crypto) picks those by category instead of the generic finance one.
  const fineFinance = allowed.includes("markets");
  const ranked = SIGNALS.filter(([k]) => (k === "investigation" || (k === "finance" && !fineFinance)) && allowed.includes(k))
    .map(([style, re]) => ({ style, hits: share(style === "investigation" && fineFinance ? LEGAL : re) }))
    .filter((x) => enough(x.hits)).sort((a, b) => b.hits - a.hits);
  if (ranked[0]) return { style: ranked[0].style, why: why(ranked[0].style, ranked[0].hits) };
  const counts = new Map<string, number>();
  for (const r of reports) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  const mapped = top ? byCategory[top[0]] : undefined;
  const style = (mapped && mapped in STYLES && allowed.includes(mapped) ? mapped : "news") as StyleKey;
  return { style, why: top ? `most reports are in category ${top[0]}` : "no category" };
}
