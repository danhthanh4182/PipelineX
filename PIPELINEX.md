# PipelineX — direction for agents

Read this before working on PipelineX. It records what we are building, what has been decided (and why), where things
stand and what comes next. Technical changes to the AIHOT engine are logged in `FORK_CHANGES.md` (Vietnamese).
The owner reads and writes Vietnamese; code, comments, commits and video content are English.

## Goal

Automated English YouTube news channels: every day each channel turns its news into a fact-checked long video
(target 10–15 min; today ~3–5 min), a vertical Short (45–60 s) and a thumbnail, with a publish kit (titles,
description with chapters and sources, tags). A human publishes; an AI agent (Antigravity, through the editor MCP)
helps run and edit.

**Channels (all English, each with its own sources):** AI & technology (running), Finance & markets (in progress),
World / conflict, Crime.

## Architecture

```
AIHOT engine (fork of KKKKhazix/AIHOT, MIT)         one checkout per channel (git worktree, branch channel/<name>)
  collect RSS → prefilter → score → structure        industry/ = the channel type's pack (packs/<type>/)
  → group into stories → publications                own database, ports, editor token; keys via .env.shared
            │
            ▼
modules/video (shared code)                          renderer/ (one copy, shared by all channels)
  candidates, video_jobs, queue video.make             story → background (TinyFish) → dossier → script →
  /admin/videos (in the main admin menu)               verify → assets → voice → render → thumbnail →
  editor MCP for local agents                          short → shortvoice → shortrender
```

- Channel profile: `industry/channel.json` (type, subject, audience, brand, tags, trusted official sites, paywalled
  outlets, allowed video styles, category → style map). Prompts, title cards, thumbnails and publish kits read it.
- Channel tooling: `npm run channel -- create <name> --type <type> [--title T] | list | start | stop | update | remove <name> --yes | types`.
- Packs: `packs/<type>/` (see `packs/README.md`): `ai`, `finance`. The main checkout runs `finance` (its `industry/` = `packs/finance/`).

## Decisions (keep them unless the owner changes them)

| Decision | Why |
|---|---|
| **Free LLM models only**: `pipelinex-chain` = NVIDIA API → OpenRouter `:free` → OrcaRouter free → `LLM_*` (a `:free` model). Never add a paid model to the chain or to `VIDEO_PROVIDERS` without asking. | The owner wants cost near zero; a paid fallback silently spent $0.41 on 2026-11-17. |
| A paid model is planned only for a future **orchestrator** role (editorial decisions: pick stories, plan, final QA). Not built. | Low volume, high impact. |
| **Antigravity is the editor/operator** through the editor MCP (`/api/admin/video/mcp`, direct local connections + `VIDEO_EDITOR_TOKEN`). It cannot publish, change sources, settings, keys or models. Every action is logged (video `edits.json` + Audit Log). | The owner wants the local agent to take part, with guardrails. |
| **The system scores and selects articles, never an agent.** Agents may list stuck articles and send them back through AIHOT's analysis (`retry_failed_articles`); when the script step stalls an agent may write a video script (`rescue_video_script`), which is still fact-checked from `verify`. A tool that wrote agent scores into `analyses` was removed on 2026-11-18. | Selection uses the channel's own prompts, two independent scores, thresholds and receipts; an agent's score bypasses all of it. |
| **A human publishes.** No YouTube upload automation yet; when built, publishing stays a human click. | Public and hard to undo. |
| **One channel = one type, chosen at creation**; changing type means a new channel. Each channel has its own sources. | Clear identity per channel; no mixing old and new data. |
| **Facts are grounded**: dossier (facts with outlets) → script cites facts → sentence-by-sentence verify against full report text; quotes/numbers re-checked by words. Allegations attributed. | Accuracy; A/B on 3 stories: errors 6.0% → 2.2%. |
| **Video style per story** (`modules/video/backend/styles.ts`): news, launch, product, finance, investigation, crime, war, explainer, analysis — chosen from the story, changeable by editor/agent. Crime and war are **sensitive**: no graphic words or pictures, every figure attributed, no victims' or private names, presumption of innocence. | Different stories need different structure, tone and look; YouTube sensitive-topic policy. |
| **Pictures**: Wikimedia Commons / Openverse / Pixabay (free licences), checked by a vision model against the spoken words and mood; never paywalled article images. | Copyright and relevance. |
| **Trusted sites only** for background research and web checks (TinyFish free tier); paywalled outlets are never fetched. | Reliability, copyright. |
| **Keys**: the owner pastes keys into `.env` files; agents never copy keys from pages or echo them. | Owner's security rule. |
| Node 24 (not 26); `COLLECT_ENABLED`/`MODEL_CALLS_ENABLED` are explicit switches. | AIHOT requirements. |

## Status (2026-11-18)

Done: the main checkout (:3000) switched from AI to the **finance** pack on 2026-11-18 at the owner's request (AI data backed up in `PipelineX/backups/ai-channel-20261118/`, AI pack kept in `packs/ai/`); free model chain, auto video daily 09:30 Shanghai; video module with
background research, dossier, fact-check, styles, thumbnail, Short, publish kit; Remotion rendering optimized with Apple Silicon hardware acceleration, bundle caching, and default concurrency 4 (6 in the main .env); rich motion design (ambient lighting, comparison beats, code terminal beats, frosted glass captions, high-contrast thumbnails); editor MCP with 25 tools (list/get/edit/remake/review videos, rescue_video_script, stories and make_video, system_status, retry_failed_articles, list_stalled_articles, look_at_video, web_search/fetch_page, publish kit, style guide, list_styles/set_video_style); multi-channel tooling (tested with a
throwaway channel, then removed).

Open items:
- World and Crime packs (Finance is running, see below); a real name for the finance channel (owner's shortlist: Market Decoded, Basis Point, Plain Money, The Ticker Desk, Signal Over Noise).
- Two finance sites run now: main checkout :3000 and channel `markets` :3010 (same pack). Owner to decide whether to keep both.
- Unified studio: one admin page and one MCP across all channels (today each channel has its own).
- Azure Speech key (voice code ready; edge-tts is unlicensed for commercial use and throttles — it failed a whole video's voice step twice on 2026-11-18).
- OrcaRouter key is rejected as invalid (chain skips it).
- Music: add tracks to `renderer/music/<mood>/` (neutral, upbeat, calm, serious, somber, curious).
- Longer videos (10–15 min): decide single deep story vs multi-story bulletin.
- YouTube publishing automation (later; human click).

## Finance channel — running (2026-11-18)

- Channel `markets` (type `finance`, "PipelineX Markets", placeholder name until the owner picks one): checkout
  `PipelineX/channels/markets/`, web :3010, api :3011, database `pipelinex_markets`. Start/stop with
  `npm run channel -- start|stop markets`.
- Pack `packs/finance/`: 32 sources after the 2026-11-18 review on real yields (750 articles, 67 selected).
  Official (T1): Fed press + speeches, SEC, ECB, BEA, BLS and US Treasury (via Google News), Bank of England, CFTC,
  NY Fed Liberty Street. News with free text: CNBC markets/finance/earnings/economy, MarketWatch, Axios, Kiplinger,
  BBC Business, Guardian Business, NPR Business, NerdWallet, Wolf Street; crypto CoinDesk, Decrypt. Heat signals only
  (not analysed; count outlets for hot stories): Bloomberg, FT, WSJ, Economist, Reuters and AP via Google News, Google
  News "Federal Reserve"/"stock market". Dropped: Seeking Alpha, Abnormal Returns, The Big Picture, The Block,
  Cointelegraph (noise or ~0 selected). 7 categories, 8 item types, finance prompts (no investment advice).
  Channel `markets` still has the first 25 (its pack is its own; apply the review there by hand if kept).
- Finance video styles: markets, earnings, macro, crypto (chosen by category; investigation only on legal words).
- First video (#1, Nvidia earnings, style earnings): 4 min + Short + thumbnail, fact-check 27/30 supported, 0 wrong, $0.
- Selection taste fixed once on real scores: a large move with a stated cause is an event; evergreen advice
  (Kiplinger-style tips) is not news. Thresholds are still the AI channel's: calibrate on labelled finance items.
- Engine tests that typed AI categories now read `CATEGORIES` from the pack, so `npm run typecheck` passes on any pack.

Next packs: `world`, then `crime` (same steps: sources checked and approved by the owner, taxonomy, prompts,
channel.json, site.ts, styles).

## How to work here

- Code: `eval/aihot/` (branch `pipelinex`; AIHOT upstream remote `upstream`). Renderer: `eval/aihot/renderer/`.
  Channels: `PipelineX/channels/<name>/`. Plans and research notes: `eval/aihot/docs/pipelinex/` (PLAN, SPEC, RESEARCH, RESEARCH-PROCESS, EVAL-AIHOT; the copies in `PipelineX/` are symlinks).
- Run: `npm run dev:api`, `npm run dev:worker`, `npm run dev:web` (Node 24: `~/.nvm/versions/node/v24.15.0/bin`).
- Check: `npm run typecheck`; `DATABASE_URL=postgres://$USER@127.0.0.1:5432/pipelinex_test npm test`;
  `npm run build -w @aihot/web && npm run test:web`. Module tests live in `modules/video/tests/`.
- Log every engine change in `FORK_CHANGES.md`; keep site/industry-specific work in `site/`, `industry/`, `packs/`,
  `modules/`. Never commit `.env`, keys or `.data/`.
