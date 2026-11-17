# Event Grouping and Relation Evaluation

The site first recalls candidate facts from the past two weeks using headlines and summaries (comparing vector embeddings if an embedding service is configured, or text overlap otherwise). An LLM then evaluates the relation between reports, and determines whether a report brings genuinely new information compared to existing curated items (qualifying items rely on this check to enter curation; see [Selection and Calibration](selection.en.md)). Relation definitions and prompts reside in `industry/prompts/group-*.md`; the code entrypoints are in `packages/backend/src/events/relate.ts` and `group.ts`.

The four relations are:

- `SAME_OCCURRENCE`: The exact same real-world occurrence (e.g. official announcement and media reporting of the same launch).
- `SAME_STORY`: Not the same occurrence, but a direct follow-up or development of the same concrete event (e.g. post-launch benchmark reviews, availability, or official responses).
- `UNRELATED`: Distinct events, even if they share the same entity, product, or topic.
- `ROUNDUP`: One of the pieces is a multi-topic roundup or compilation.

## Evaluating Pairwise Relations with Labeled Gold Sets

`scripts/eval-relations.ts` evaluates model accuracy on pairwise report relations. It directly reuses the runtime `PAIR_SYSTEM`, `pairUser()`, `PairSchema`, and prompt versions, so changes to prompts are automatically reflected in the benchmark. It does not re-run candidate recall or write results back to event clustering.

Place labeled data under `.data/` (ignored by Git). `industry/relation-gold.example.jsonl` provides four mock examples. One JSON object per line:

```json
{"caseId":"release-001","a":{"title":"...","source":"...","firstParty":true,"publishedAt":"2026-09-01T09:00:00+08:00","summary":"..."},"b":{"title":"...","source":"...","firstParty":false,"publishedAt":"2026-09-01T09:20:00+08:00","summary":"..."},"samplingContext":{"benchmarkSplit":"development","samplingStratum":"same-release"},"gold":{"relation":"SAME_OCCURRENCE"}}
```

`a` and `b` may also carry an optional `frame` matching the internal `ReportView`:

```json
{"subject":"Acme","action":"Release","object":"Acme-2","occurredAt":"2026-09-01"}
```

Put ambiguous edge cases into `development`, and reserve a `benchmarkSplit: "holdout"` split for final verification. `samplingStratum` is an optional stratum label to diagnose which failure class occurs most often.

### Running

Configure your database and models as usual, then run:

```bash
node --env-file=.env scripts/eval-relations.ts \
  --gold .data/relation-gold.jsonl \
  --split development
```

By default, it uses the model configured for "Group Review": first checking runtime overrides in Admin -> Models, then `GROUP_REVIEW_MODEL`, then `site/models.ts` `DEFAULTS.groupReview`, and finally the default model. You can also explicitly benchmark multiple models:

```bash
node --env-file=.env scripts/eval-relations.ts \
  --gold .data/relation-gold.jsonl \
  --models default,deepseek-flash \
  --split development \
  --n 200 \
  --seed 7 \
  --thresholds 0.75,0.8
```

Available CLI arguments:

| Argument | Default | Description |
|---|---:|---|
| `--gold` | `.data/relation-gold.jsonl` | Labeled benchmark dataset (JSONL) |
| `--models` | Current "Group Review" model | Comma-separated list of model names |
| `--split` | `all` | `development`, `holdout`, or custom split name |
| `--n` | `200` | Maximum number of items to evaluate |
| `--seed` | `7` | Sampling random seed (consistent reproducibility) |
| `--concurrency` | `6` | Concurrent LLM requests |
| `--thresholds` | Production `STORY_REVIEW_MIN_CONFIDENCE,TIE_MIN_CONFIDENCE` | Confidence thresholds for linking two reports into the same event |

Full reports are saved to `.data/eval/relations-*.json`, containing:
- 4x4 confusion matrix of ground truth vs. predicted relations.
- Precision, Recall, F1, and sample counts per class.
- `coverage`: percentage of samples that returned valid structured JSON.
- `accuracy` and macro-F1 across the 4 classes.
- Error counts, token usage, latency, and receipt IDs.
