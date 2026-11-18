# Channel type packs

A PipelineX channel is one checkout of this repository (`npm run channel -- create <name> --type <type>`). Its type is
chosen once, at creation; its `industry/` folder is then this pack (type `ai` uses the main checkout's own `industry/`).

A pack has the same files as `industry/` (see `docs/customize.en.md`):

| File | What it decides |
|---|---|
| `channel.json` | The channel profile: type, subject and audience (used in every video prompt), brand (name, label, tagline), YouTube tags and hashtags, trusted official sites, paywalled outlets, allowed video styles and the category → style map |
| `sources.json` | The news sources the channel collects |
| `taxonomy.ts` | Categories, item types, tags, entities |
| `topics.json` | Topic pages |
| `selection.ts` | Selection thresholds |
| `wording.ts` | Words the site avoids |
| `prompts/*.md` | Prefilter (what belongs to the channel), selection score (what is worth a story), structure, writing, grouping |
| `site/` (optional) | Files copied over the checkout's `site/` (e.g. `site.ts` with the channel's name and copy) |

Rules (AGENTS.md): a human decides the channel's name, sources, what counts as signal or noise, and its categories.
Selection thresholds are calibrated on labelled examples, not guessed.
