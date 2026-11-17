# Selection and Calibration

## How an Item Becomes Curated (The 7-Step Pipeline)

1. **Ingestion**: Duplicate URLs and hashes are dropped. If an article only has a title or snippet, the full article text is fetched according to source rules. Video pages use provided transcripts or text rather than treating player HTML as content. Items without a trustworthy publication date are held back until an accurate date is resolved (preventing backfill spam).
2. **Pre-screening** (`industry/prompts/prefilter.md`): Asks whether this item belongs to the industry domain. Wide recall; only blocks clear false positives. `BLOCK` items never appear on public pages; `PASS` and uncertain `UNKNOWN` proceed to scoring.
3. **Scoring** (`industry/prompts/selection-score.md`): The same item is scored twice independently on a 0–100 scale. **The sum of the two scores must be ≥ 2 × Threshold**. The threshold depends on the source tier (`T1`, `T1_5`, `T2`). Qualifying items still must pass Step 6 deduplication. The score shown on the page is the floor average of the two scores.
4. **Structuring** (`industry/prompts/structure.md`): Runs concurrently with scoring. Assigns taxonomy categories and tags, identifies the subject entity, determines whether the piece is single-topic news or a multi-topic roundup, and extracts core facts (who, did what, to what, when, caveats, citations).
5. **Writing Headlines & Summaries**: Executed after structuring:
   - Items selected or near the selection threshold (average score > `understandFloor`) have headlines, answer-first summaries, and reading recommendations written via `industry/prompts/content-understanding.md`.
   - Remaining items get concise summaries via `industry/prompts/summarize-*.md` and enter "All Updates" (`/all`).
   - Pure link/media X posts preserve their original media and links without calling translation/writing models.
   - Any sensitive or disallowed terms listed in `industry/wording.ts` are reworded via `industry/prompts/mend-wording.md`.
6. **Clustering & Deduplication** (`industry/prompts/group-*.md`):
   - Multiple reports of the same event are clustered into one **Event**. The event page presents a synthesis (`industry/prompts/story-digest.md`), and the trending tab (`/hot`) ranks by event heat.
   - Deduplication: The model verifies whether a candidate report repeats an already curated story and whether it introduces genuinely new factual details.
   - Representative reporting: When multiple articles report on the same event, only one representative article appears in public feeds/APIs (T1 official first, then verified T1.5 accounts, then full-text/high-scoring/earliest articles).
7. **Daily, Weekly, and Monthly Briefings**:
   - **Daily Briefing**: Generated daily (default 08:00) covering the preceding 24 hours. Compiled entirely by deterministic rules (no LLM call required). Takes the top authoritative article from each event, ranks up to 12 main stories + 10 quick news bites.
   - **Weekly / Monthly Reports**: Compiled from daily briefings. The LLM (`industry/prompts/report-period.md`) writes only the macro overview and one-sentence section lead-ins without modifying or hallucinating underlying items.

## Selection Thresholds (`industry/selection.ts`)

```ts
export const SELECTION = {
  thresholds: { T1: 60, T1_5: 65, T2: 76 },   // Average of 2 scores must reach this
  classes: {                                  // Specific source classes can raise threshold
    ecosystem: { label: "Ecosystem & Infra", threshold: 70 },
    leaderboard: { label: "Benchmarks", threshold: 76 },
  },
  understandFloor: 50,                        // Below threshold but above this gets full summary
  browseFloor: 40,                            // Minimum score to appear in /all browsing
};
```

- **T1 (Official first-hand)**: Lowest threshold (60) because first-hand announcements have inherent authority.
- **T1_5 (Semi-official / Corporate channels)**: Medium threshold (65).
- **T2 (Media / Individual blogs)**: Highest threshold (76) to filter out commentary noise and rewrites.
- **`browseFloor`**: Setting to `0` displays all collected articles in `/all`.

## Calibration Workflow

1. Prepare a gold test set of 100–200 labeled real items (`.data/gold.jsonl`) marked `{"shouldSelect": true/false}`.
2. Run `scripts/eval-selection.ts` to simulate pre-screening and scoring.
3. Adjust thresholds and prompt weights to achieve desired precision and recall.
