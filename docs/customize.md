# Adapting AIHOT to Your Field

By default, this repository is configured as an "AI Industry" demo site: sample sources are public AI news feeds, and selection criteria reflect AIHOT's curation in the AI domain. To transform it into a news site for another domain (e.g. Legal, HR, Finance, Robotics, Biotech, Video Production), almost all changes reside in:
1. [`site/`](../site/): Brand name, copy, site UI, pages, and module activations.
2. [`industry/`](../industry/): Taxonomy categories, seed sources, prompt guidelines, and thresholds.

The core code (`packages/` and `apps/`) rarely needs modification.

---

## 1. Site Identity and Copy: `site/site.ts`

Each field exported in [`site/site.ts`](../site/site.ts) includes comments explaining its purpose:
- `SITE.name`: The visible name of your site.
- `SITE.organization.name`: Structured metadata for search engines.
- `SITE.crawlerName`: User-Agent identity used during HTTP scraping.
- `SITE.mcpPrefix`: Tool name prefix exposed over Model Context Protocol (MCP).
- `EDITION_TIMES`: Publication schedule (e.g. `08:00`) evaluated every 30 minutes.
- `NAV.hidden`: Hide unused navigation tabs (e.g. `["/hot"]` or `["/topics"]`).

## 2. Taxonomy, Tags, and Topics: `industry/taxonomy.ts` & `industry/topics.json`

[`industry/taxonomy.ts`](../industry/taxonomy.ts) defines:
- `CATEGORIES`: Core categories (`key`, label, description). Keys become URL query parameters and RSS paths (`/feed/category/<key>.xml`).
- `ITEM_TYPES`: Classification of articles (e.g. product launch, research paper, commentary).
- `CATEGORY_TAGS`, `TOPIC_TAGS`: Controlled vocabulary for tags.
- `ENTITIES`: Recognized companies or institutions.
- `IDENTITY_LEXICON`: Guardrail dictionary preventing models from hallucinating entities not mentioned in the source article. Set to `[]` if not required.

`industry/topics.json`: Topic pages displayed at `/topics` (organized by `company`, `field`, and `genre`).

## 3. Ingestion Sources: `industry/sources.json`

Seed sources loaded on first startup. Key attributes per source:
- `kind`: `rss`, `web_list` (CSS selector scraper), `json_list` (API endpoint), `x_search` (Twitter via SocialData), `mp_account` (WeChat articles via Dajiala), `external` (webhook / push).
- `tier`: `T1` (Official original), `T1_5` (Semi-official / verified corporate accounts), `T2` (Media / commentary / individual blogs), `EXCLUDE_MP` (Non-curated).
- `participation_mode`:
  - `editorial`: Enters selection scoring and public feeds.
  - `hot_signal`: Only contributes to event heat calculation without standalone curation.
  - `isolated`: Internal only; never exposed on public pages.
- `site_fulltext`: Whether to show full text in the reader UI (`false` by default).

## 4. Prompt Engineering: `industry/prompts/`

All prompts are plain Markdown files in `industry/prompts/`:

| Prompt File | Purpose |
|---|---|
| `prefilter.md` | Domain gatekeeper: determines whether an item belongs to the industry. |
| `selection-score.md` | Core rubric: 0–100 scoring based on 5 weighted dimensions and noise filters. |
| `structure.md` | Extracts categories, tags, entity mentions, and factual claims. |
| `content-understanding.md` | Generates headline, answer-first summary, and rationale for selected items. |
| `rules-domain.md` | Domain terminology translation and capitalization rules. |
| `mend-wording.md` | Enforces vocabulary corrections listed in `industry/wording.ts`. |
| `summarize-*.md` | Concise fallback summaries for non-curated items entering "All Updates". |
| `group-*.md` | Event clustering: compares pairs of reports to determine if they report the same event. |
| `story-digest.md` | Multi-source event synthesis for event overview pages. |
| `report-period.md` | Macro synthesis for weekly and monthly reports. |

Prompt versions are tracked by content hashes; updating a prompt affects only future incoming articles without invalidating past runs.
