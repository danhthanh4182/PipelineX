# Channel type packs

A PipelineX channel is one checkout of this repository (`npm run channel -- create <name> --type <type>`). Its type is
chosen once, at creation; its `industry/` folder is then this pack. The main checkout itself runs the `finance` pack
(since 2026-11-18); `packs/ai/` keeps the original AIHOT AI pack.

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

## Packs

| Type | Status | Notes |
|---|---|---|
| `ai` | ready | the original AIHOT AI pack (39 sources); the main checkout ran it until 2026-11-18 (backup: `PipelineX/backups/ai-channel-20261118/`) |
| `finance` | running (main checkout :3000; trial channel `markets` stopped) | 32 sources after the 2026-11-18 review (see FORK_CHANGES.md): 10 official, free full-text news (CNBC, Axios, BBC, Guardian, NPR, MarketWatch, Kiplinger, NerdWallet, Wolf Street), crypto CoinDesk/Decrypt, paywalled and title-only outlets as heat signals only; 7 categories; 8 item types; styles markets/earnings/macro/crypto; thresholds copied from AI, to calibrate |
| `world` | planned | |
| `crime` | planned | |
