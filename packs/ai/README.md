# Industry Domain Pack

Domain-specific knowledge: taxonomy, topics, seed sources, prompt rubrics, and selection thresholds. When adapting to another domain, customize this folder and [`site/`](../site/) (site identity, copy, branding, and pages). See [Adapting AIHOT to Your Field](../docs/customize.md).

| File | Content |
|---|---|
| `taxonomy.ts` | Categories, tags, entity directory, anti-hallucination dictionary, primary release metric (`RELEASE`). |
| `topics.json` | Topics catalog (`/topics`), read on site startup. |
| `sources.json` | Seed sources imported on initial boot. |
| `prompts/` | Prompt templates per pipeline step: pre-screen, score, write, structure, cluster, event synthesis, periodic briefings, translation. |
| `selection.ts` | Selection thresholds per source tier and class. |
| `gold.example.jsonl` | Example format for selection evaluation benchmark sets. |
| `relation-gold.example.jsonl` | Example format for pairwise event relation evaluation sets. |
| `story-digest-eval.example.jsonl` | Example format for event synthesis evaluation cases. |
