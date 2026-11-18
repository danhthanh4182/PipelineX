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
- Packs: `packs/<type>/` (see `packs/README.md`); type `ai` is the main checkout's `industry/`.

## Decisions (keep them unless the owner changes them)

| Decision | Why |
|---|---|
| **Free LLM models only**: `pipelinex-chain` = NVIDIA API → OpenRouter `:free` → OrcaRouter free → `LLM_*` (a `:free` model). Never add a paid model to the chain or to `VIDEO_PROVIDERS` without asking. | The owner wants cost near zero; a paid fallback silently spent $0.41 on 2026-11-17. |
| A paid model is planned only for a future **orchestrator** role (editorial decisions: pick stories, plan, final QA). Not built. | Low volume, high impact. |
| **Antigravity is the editor/operator** through the editor MCP (`/api/admin/video/mcp`, direct local connections + `VIDEO_EDITOR_TOKEN`). It cannot publish, change sources, settings, keys or models. Every action is logged (video `edits.json` + Audit Log). | The owner wants the local agent to take part, with guardrails. |
| **A human publishes.** No YouTube upload automation yet; when built, publishing stays a human click. | Public and hard to undo. |
| **One channel = one type, chosen at creation**; changing type means a new channel. Each channel has its own sources. | Clear identity per channel; no mixing old and new data. |
| **Facts are grounded**: dossier (facts with outlets) → script cites facts → sentence-by-sentence verify against full report text; quotes/numbers re-checked by words. Allegations attributed. | Accuracy; A/B on 3 stories: errors 6.0% → 2.2%. |
| **Video style per story** (`modules/video/backend/styles.ts`): news, launch, product, finance, investigation, crime, war, explainer, analysis — chosen from the story, changeable by editor/agent. Crime and war are **sensitive**: no graphic words or pictures, every figure attributed, no victims' or private names, presumption of innocence. | Different stories need different structure, tone and look; YouTube sensitive-topic policy. |
| **Pictures**: Wikimedia Commons / Openverse / Pixabay (free licences), checked by a vision model against the spoken words and mood; never paywalled article images. | Copyright and relevance. |
| **Trusted sites only** for background research and web checks (TinyFish free tier); paywalled outlets are never fetched. | Reliability, copyright. |
| **Keys**: the owner pastes keys into `.env` files; agents never copy keys from pages or echo them. | Owner's security rule. |
| Node 24 (not 26); `COLLECT_ENABLED`/`MODEL_CALLS_ENABLED` are explicit switches. | AIHOT requirements. |

## Status (2026-11-18)

Done: AI channel running (39 sources, free model chain, auto video daily 09:30 Shanghai); video module with
background research, dossier, fact-check, styles, thumbnail, Short, publish kit; editor MCP with 22 tools
(list/get/edit/remake/review videos, stories and make_video, system_status, retry_failed_articles, look_at_video,
web_search/fetch_page, publish kit, style guide, list_styles/set_video_style); multi-channel tooling (tested with a
throwaway channel, then removed).

Open items:
- **Finance pack** (in progress, see below), then World, then Crime packs.
- Unified studio: one admin page and one MCP across all channels (today each channel has its own).
- Azure Speech key (voice code ready; edge-tts is unlicensed for commercial use and throttles).
- OrcaRouter key is rejected as invalid (chain skips it).
- ~20 failed articles from the old OpenRouter key limit (`retry_failed_articles`); `events.group` job failures to look at.
- Music: add tracks to `renderer/music/<mood>/` (neutral, upbeat, calm, serious, somber, curious).
- Longer videos (10–15 min): decide single deep story vs multi-story bulletin.
- YouTube publishing automation (later; human click).

## Finance pack — work in progress

Feeds checked on 2026-11-18 (HTTP status, items, latest date). For the owner to approve before use:

- Working, recent: CNBC (markets, finance, earnings), MarketWatch top stories, Seeking Alpha market news, Axios,
  Reuters via Google News query, Federal Reserve (press, speeches), SEC press releases, ECB press releases, CoinDesk,
  Decrypt, The Block, Cointelegraph, Wolf Street, Abnormal Returns, The Big Picture (Ritholtz), Kiplinger,
  Google News queries ("Federal Reserve", "stock market") as heat signals.
- Working but **paywalled** (summary + link only, never fetched): Bloomberg Markets, FT Markets, WSJ Markets, The Economist.
- Stale: MarketWatch market pulse (2025), Calculated Risk (Jan 2026), Apricitas (Sep 2026).
- Not usable (404/403/blocked): Yahoo Finance, Investing.com, AP Business, BLS, US Treasury, IMF, Fortune feed URL, hnrss finance query.

Still to do for the pack: owner approves sources and channel name; categories (e.g. markets, macro & central banks,
companies & earnings, crypto, policy & regulation, analysis); finance prefilter and selection-score prompts; finance
video styles (e.g. markets wrap, earnings, crypto, macro); `channel.json`; create the channel and make a first video.

## How to work here

- Code: `eval/aihot/` (branch `pipelinex`; AIHOT upstream remote `upstream`). Renderer: `eval/aihot/renderer/`.
  Channels: `PipelineX/channels/<name>/`. Research notes: `PipelineX/RESEARCH-PROCESS.md`, `EVAL-AIHOT.md`.
- Run: `npm run dev:api`, `npm run dev:worker`, `npm run dev:web` (Node 24: `~/.nvm/versions/node/v24.15.0/bin`).
- Check: `npm run typecheck`; `DATABASE_URL=postgres://$USER@127.0.0.1:5432/pipelinex_test npm test`;
  `npm run build -w @aihot/web && npm run test:web`. Module tests live in `modules/video/tests/`.
- Log every engine change in `FORK_CHANGES.md`; keep site/industry-specific work in `site/`, `industry/`, `packs/`,
  `modules/`. Never commit `.env`, keys or `.data/`.
