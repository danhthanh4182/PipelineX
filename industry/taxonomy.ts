// Industry classification taxonomy: categories, tag vocabulary, entity directory,
// and anti-hallucination dictionary.
// Models tag items according to this vocabulary; topics.json groups by tags; filter bars group by category.

/**
 * Categories shown across the web UI (filter bars, card badges, RSS feeds).
 * key: external identity in URLs and APIs (never change in production).
 * section: section title in daily briefings.
 * guide: instructions for structuring models defining boundaries between categories.
 * commentary: marks tutorial/opinion categories (relegated to quick-bites on follow-up).
 * tagColor: badge color name for notifications.
 * feedLabel: display title in category RSS feeds.
 */
export const CATEGORIES = [
  { key: "ai-models", tagColor: "indigo", label: "Models", feedLabel: "AI Models", section: "Model Releases", guide: "Releases, version upgrades, open weights, capabilities, or pricing changes of models themselves, as well as benchmark standings. Publishing a benchmark run is not a new benchmark release, nor a tutorial." },
  { key: "ai-products", tagColor: "turquoise", label: "Products", feedLabel: "AI Products", section: "Product Releases", guide: "Launches and updates of usable AI products, features, applications, tools, APIs, platforms, and engineering components. Inference frameworks, operator libraries, or hardware adapters released by model labs remain products, not models." },
  { key: "industry", tagColor: "orange", label: "Industry", feedLabel: "Industry News", section: "Industry News", guide: "Business operations, fundraising, acquisitions, leadership moves, partnerships, litigation, policy regulations, and genuine security incidents/investigations." },
  { key: "paper", tagColor: "violet", label: "Research", feedLabel: "Research Papers", section: "Research & Papers", guide: "Academic papers, technical reports, new benchmarks, or research datasets centered on new methodologies, experimental design, and discoveries. Systematic red-teaming experiments belong to research." },
  { key: "tip", tagColor: "green", label: "Guides", feedLabel: "Guides", section: "Guides & Opinions", guide: "Reproducible workflows, prompts, tool usage, engineering post-mortems, and technical walk-throughs. The focus is on reusable practices.", commentary: true },
  { key: "opinion", tagColor: "purple", label: "Opinions", feedLabel: "Opinions", section: "Guides & Opinions", guide: "Analyses, architectural judgments, editorial claims, market forecasts, commentary, or expert interviews.", commentary: true },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/** Primary release metric for briefings ("N new models"). */
export const RELEASE: { category: string; tag: string; unit: string } | null = { category: "ai-models", tag: "Model Release", unit: " new models" };

/** Industry common terms that periodic summaries can mention without explicit article citations. */
export const PLAIN_TERMS: readonly string[] = ["ai", "api", "llm", "gpu", "agi", "ceo", "ipo"];

/** Item types extracted during content understanding. */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── Tag Vocabularies ─────────────────────────────────────────────────────────────

/** Primary category tags: the first tag of every item must be one of these. */
export const CATEGORY_TAGS = [
  "Product Update", "Model Release", "Research / Paper", "Open Source / Repo", "Tutorial / Practice", "Trends", "Opinion / Analysis", "Benchmark / Evaluation", "Safety / Alignment", "Industry News", "Policy / Regulation",
  "Non-AI / Tool", "Other",
] as const;

/** Topic tags. */
export const TOPIC_TAGS = [
  "Agent", "Coding", "Reasoning", "Multimodal", "Audio", "Video", "Image Gen", "RAG", "On-Device", "Data / Training", "Search", "Deployment / Infra", "Open Source", "Embodied AI", "MCP / Tool Calling",
] as const;

/** Entity tags (companies, organizations, platforms). */
export const ENTITY_TAGS = ["OpenAI", "Anthropic", "DeepSeek", "DeepMind", "Google", "Meta", "Microsoft", "xAI", "Hugging Face", "GitHub", "arXiv"] as const;

/** Canonical mapping for synonyms or legacy Chinese tags. */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  // English synonyms
  "product": "Product Update", "products": "Product Update", "release": "Model Release", "models": "Model Release",
  "paper": "Research / Paper", "papers": "Research / Paper", "research": "Research / Paper",
  "tutorial": "Tutorial / Practice", "tutorials": "Tutorial / Practice", "guide": "Tutorial / Practice", "guides": "Tutorial / Practice",
  "open-source": "Open Source / Repo", "repo": "Open Source / Repo", "github": "Open Source / Repo",
  "benchmarks": "Benchmark / Evaluation", "eval": "Benchmark / Evaluation", "evals": "Benchmark / Evaluation",
  "safety": "Safety / Alignment", "alignment": "Safety / Alignment",
  "news": "Industry News", "policy": "Policy / Regulation", "regulation": "Policy / Regulation",
  "coding": "Coding", "reasoning": "Reasoning", "multimodal": "Multimodal", "audio": "Audio", "video": "Video",
  "image-gen": "Image Gen", "on-device": "On-Device", "data": "Data / Training", "training": "Data / Training",
  "search": "Search", "infra": "Deployment / Infra", "deployment": "Deployment / Infra",
  "embodied": "Embodied AI", "mcp": "MCP / Tool Calling", "opinion": "Opinion / Analysis", "trends": "Trends",
};

// ── Entities & Anti-Hallucination Lexicon ────────────────────────────────────────

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  "world-labs": { name: "World Labs", displayTag: null, aliases: ["World Labs"] },
  "thinking-machines": { name: "Thinking Machines Lab", displayTag: null, aliases: ["Thinking Machines"] },
  amd: { name: "AMD", displayTag: null, aliases: ["AMD", "Advanced Micro Devices"] },
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT", "Sora", "Codex", "GPT"], orgNames: ["OpenAI"], otherNames: ["OpenAI Developers"] },
  anthropic: { name: "Anthropic", displayTag: "Anthropic", aliases: ["Anthropic", "Claude"], orgNames: ["Anthropic"], otherNames: ["Claude Code"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "DeepMind", "Gemini"], orgNames: ["Google DeepMind", "Google Research", "Google", "DeepMind"], otherNames: ["Google AI", "Google Labs", "Google Cloud"] },
  deepseek: { name: "DeepSeek", displayTag: "DeepSeek", aliases: ["DeepSeek"], orgNames: ["DeepSeek"] },
  qwen: { name: "Qwen", displayTag: null, aliases: ["Qwen", "Alibaba"], orgNames: ["Qwen Team", "Qwen", "Alibaba"], otherNames: ["Alibaba Cloud"] },
  kimi: { name: "Moonshot AI / Kimi", displayTag: null, aliases: ["Kimi", "Moonshot"], orgNames: ["Moonshot AI", "Kimi"] },
  minimax: { name: "MiniMax", displayTag: null, aliases: ["MiniMax"], orgNames: ["MiniMax"] },
  zhipu: { name: "Zhipu GLM", displayTag: null, aliases: ["Zhipu", "GLM", "Z.ai"], orgNames: ["Zhipu AI", "Zhipu", "Z.ai"], otherNames: ["Zhipu"] },
  xai: { name: "xAI", displayTag: "xAI", aliases: ["xAI", "Grok"], orgNames: ["SpaceX Super Intelligence", "SpaceXAI", "SpaceXSI", "xAI"], otherNames: ["Grok Bot"] },
  meta: { name: "Meta", displayTag: "Meta", aliases: ["Meta", "Llama"], orgNames: ["Meta Superintelligence Labs", "Meta AI", "Meta"], otherNames: ["AI at Meta", "Muse"] },
  microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "Copilot"], orgNames: ["Microsoft Research", "Microsoft AI", "Microsoft"] },
  nvidia: { name: "NVIDIA", displayTag: null, aliases: ["NVIDIA"], orgNames: ["NVIDIA"] },
  "hugging-face": { name: "Hugging Face", displayTag: "Hugging Face", aliases: ["Hugging Face"], orgNames: ["Hugging Face", "HuggingFace"] },
  cursor: { name: "Cursor", displayTag: null, aliases: ["Cursor", "Anysphere"], orgNames: ["Cursor"] },
  openrouter: { name: "OpenRouter", displayTag: null, aliases: ["OpenRouter"], orgNames: ["OpenRouter"] },
};

export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "openai", name: "OpenAI", patterns: [/openai|chatgpt|\bgpt-?[o\d]|\bsora\b|\bcodex\b/i] },
  { id: "anthropic", name: "Anthropic", patterns: [/anthropic|\bclaude\b/i, /\b(?:opus|sonnet|haiku)\s*\d+(?:[.\-]\d+)*\b/i, /\bfable\s*\d+(?:[.\-]\d+)*\b|\bmythos\b/i] },
  { id: "google", name: "Google / Gemini", patterns: [/google|deepmind|\bgemini\b|notebooklm|\bveo\s?\d|\bAlphaFold\b|\bAMIE\b/i] },
  { id: "deepseek", name: "DeepSeek", patterns: [/deepseek/i] },
  { id: "xai", name: "xAI / Grok", patterns: [/\bxai\b|\bgrok\b/i] },
  { id: "meta", name: "Meta / Llama", patterns: [/\bMeta\b/, /\bmeta\s?ai\b|\bllama\b/i] },
  { id: "microsoft", name: "Microsoft / Copilot", patterns: [/microsoft|copilot/i] },
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|\bnemotron\b|\bnemo\b|\bblackwell\b|\brubin(?:\s+ultra)?\b|\bcuda\b/i] },
  { id: "qwen", name: "Qwen", patterns: [/\bqwen/i] },
  { id: "hugging-face", name: "Hugging Face", patterns: [/hugging\s?face/i] },
  { id: "cursor", name: "Cursor", patterns: [/\bCursor\b/] },
  { id: "kimi", name: "Moonshot AI / Kimi", patterns: [/\bkimi\b|\bmoonshot\s?ai\b/i] },
  { id: "openrouter", name: "OpenRouter", patterns: [/openrouter/i] },
  { id: "minimax", name: "MiniMax", patterns: [/minimax/i] },
  { id: "zhipu", name: "Zhipu GLM", patterns: [/\bglm-?[4-9]/i, /zhipu/i] },
  { id: "hunyuan", name: "Tencent Hunyuan", patterns: [/hunyuan/i] },
  { id: "doubao", name: "ByteDance Doubao", patterns: [/doubao|bytedance/i] },
  { id: "mistral", name: "Mistral", patterns: [/mistral/i] },
  { id: "perplexity", name: "Perplexity", patterns: [/\bPerplexity\b/] },
  { id: "runway", name: "Runway", patterns: [/\brunway\b/i] },
  { id: "suno", name: "Suno", patterns: [/\bsuno\b/i] },
  { id: "midjourney", name: "Midjourney", patterns: [/midjourney/i] },
  { id: "stability-ai", name: "Stability AI", patterns: [/stability\s?ai/i] },
  { id: "elevenlabs", name: "ElevenLabs", patterns: [/eleven\s?labs/i] },
  { id: "vllm", name: "vLLM", patterns: [/\bvllm\b/i] },
  { id: "ollama", name: "Ollama", patterns: [/\bollama\b/i] },
  { id: "windsurf", name: "Windsurf", patterns: [/windsurf/i] },
  { id: "devin", name: "Devin", patterns: [/\bdevin\b/i] },
  { id: "manus", name: "Manus", patterns: [/\bmanus\b/i] },
  { id: "apple", name: "Apple AI", patterns: [/\bapple\s?(intelligence|silicon|ai)\b/i] },
  { id: "amazon", name: "Amazon / AWS", patterns: [/amazon|\baws\b/i] },
  { id: "baidu", name: "Baidu ERNIE", patterns: [/baidu|\bernie\s?bot\b/i] },
];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "openai", domains: ["openai.com"] },
  { entityId: "anthropic", domains: ["anthropic.com", "claude.com"] },
  { entityId: "google", domains: ["deepmind.google", "ai.google", "blog.google"] },
  { entityId: "deepseek", domains: ["deepseek.com"] },
  { entityId: "xai", domains: ["x.ai"] },
  { entityId: "meta", domains: ["ai.meta.com"] },
  { entityId: "microsoft", domains: ["microsoft.com"] },
  { entityId: "nvidia", domains: ["nvidia.com"] },
  { entityId: "qwen", domains: ["qwen.ai"] },
  { entityId: "cursor", domains: ["cursor.com"] },
  { entityId: "openrouter", domains: ["openrouter.ai"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "meta", pattern: /@AIatMeta\b/i },
  { entityId: "zhipu", pattern: /\bZhipu(?:\s+AI\b|['’]s\b)/i },
];
