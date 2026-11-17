# Agent Instructions (AIHOT Framework)

This is an industry trending news website framework: it ingests sources, screens and writes using LLMs, clusters events, generates daily/weekly/monthly reports, and serves them via Web, RSS, Public API, Agent Markdown, and MCP. The default configuration is a sample site for the AI industry. Read `README.md` first, then read the relevant documents in `docs/` according to your task.

## Most Common Task: Adapt to Another Industry

Follow the sequence in `docs/customize.md` (or `docs/customize.en.md`).
Site-specific settings reside in `site/`:
- Site branding & copy (`site.ts`)
- Model configuration per step (`models.ts`)
- Brand and Logo (`brand/`)
- Policy/terms pages (`pages/`)
- Static root assets (`public/`)
- Changelog (`changelog.json`)

Industry-specific domain knowledge resides in `industry/`:
- Taxonomy & category labels (`taxonomy.ts`)
- Topics directory (`topics.json`)
- Seed sources (`sources.json`)
- Prompt templates (`prompts/`)
- Selection thresholds (`selection.ts`)

Usually, you do NOT need to modify `apps/` or `packages/`. Custom features specific to this site that do not exist in the core framework should be implemented as modular extensions in `modules/` (see "Modules" in `docs/architecture.md`).

**Ask the human user directly instead of deciding for them:**
1. Site name and branding.
2. Target sources to monitor.
3. What counts as high-value signal vs. noise for the industry.
4. Taxonomy and category definitions.
5. Terms of service and privacy notice contents (`site/pages/`).

When modifying selection criteria, keep the original structure (item types, 5 weighted dimensions, noise suppression, security boundaries); only replace the domain-specific examples of signal vs. noise. Re-calibrate thresholds using user-labeled gold test sets (`docs/selection.md`), do not guess numbers subjectively.

## Running and Verification

- Node.js 24 executes TypeScript directly; the backend requires no build step.
- npm workspaces: `apps/*`, `packages/*`, `industry`, `site`, `modules/*`.
- Local running and Docker instructions are in `docs/deploy.md`.
- After making changes, always run at least:
  ```bash
  npm run typecheck
  DATABASE_URL=postgres://127.0.0.1:5432/<name>_test npm test   # DB name must end with _test or _ci; automatically creates and runs migrations
  npm run build -w @aihot/web && npm run test:web
  node scripts/smoke.ts --base http://localhost:3000             # After running the server
  ```
- Some tests in `tests/` use AI-specific categories, tags, and companies as examples. Update these mocks to match your new industry after changing `industry/taxonomy.ts`.

## Core Invariant Rules

1. **Frontend-Backend Separation**: `apps/web` only reads `apps/api` via HTTP. Database access, LLM calls, and secret keys remain strictly on the backend.
2. **Unified Publication Layer**: All public endpoints read from `packages/backend/src/publication/`. Any new public exit must follow this layer.
3. **No LLM Calls on Page Requests**: Reader page loads never trigger model calls. LLM calls happen exclusively within asynchronous worker jobs.
4. **Paid Requests Have Receipts**: Every paid request (LLM, X/Twitter, WeChat, Jina) logs a receipt (`providers/receipts.ts`) with budget circuit-breakers. Never bypass this.
5. **Safety Switches Default to Disabled**: Switches only enable when explicitly set to `true`. Keep them `false` during development: `COLLECT_ENABLED`, `MODEL_CALLS_ENABLED`, `FEISHU_*_ENABLED`, `DINGTALK_CONTENT_PUSH_ENABLED`, `INDEXNOW_SUBMIT_ENABLED`, `BAIDU_PUSH_ENABLED`. Tests keep pushes disabled and mock external services locally.
6. **Summary by Default**: Sources display summary and original link only (`site_fulltext` off by default). Only enable full text when explicitly permitted by the source.
7. **Anonymous Public Data**: Admin and visitors see identical public content. Admin dashboard (`/admin`) requires admin session.
8. **Clean Deprecation**: When retiring or replacing a feature, delete its code, tests, documentation, and stored state (tables, crons, settings, env vars in `.env.example`) in the same commit.
9. **Database Migrations**: Placed under `database/migrations/` (or `modules/<name>/migrations/`). Executed and tracked by full filename order. Starting from `0055`, each file contains only one online-executable statement. Indexes use `CONCURRENTLY IF NOT EXISTS`.
10. **Never commit `.env`, secret keys, or `.data/`**.
11. **Do not use the AIHOT name or logo in production**.

## Contributing & PR Rules

- **Only accept universal improvements**: Site-specific configs belong in your own `industry/` and `site/`.
- **Search existing code first**: Check existing modules before adding new endpoints or helpers.
- **Tests protect behavior, not syntax**: Tests should assert public contract outcomes, not private internals, CSS class names, or pixel layouts.
- **Untouchable files for external PRs**: Dependencies/lockfiles, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `.agents/` / `.claude/` rule files.
