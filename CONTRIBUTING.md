# Contributing to AIHOT

Contributions are welcome: reproducible bug reports, documentation improvements, and universal features beneficial to multiple domains. Discussions and contributions are accepted in English or Chinese.

## Community & Channels

- [Issues](https://github.com/KKKKhazix/AIHOT/issues): Reproducible bugs and concrete feature suggestions with clear use cases.
- [Q&A Discussions](https://github.com/KKKKhazix/AIHOT/discussions/categories/q-a): Installation, configuration, and troubleshooting.
- [Ideas](https://github.com/KKKKhazix/AIHOT/discussions/categories/ideas): Discuss directions and use cases before investing heavy engineering effort.
- [Show & Tell](https://github.com/KKKKhazix/AIHOT/discussions/categories/show-and-tell): Share customized industry sites and operational lessons.
- Security vulnerabilities should be reported privately according to [SECURITY.md](SECURITY.md).

## Scope of Contributions

- Preferred: improvements to deployment experience, generic ingestion adapters, pipeline workflows, public endpoints, accessibility, documentation, and bug fixes.
- Site-specific / domain-specific changes belong in your own fork (`industry/` and `site/`). Unique custom functionality should be implemented as modular extensions in `modules/`.

## Submitting Pull Requests

1. Fork the repo and branch off `main`.
2. Keep PRs focused on a single atomic issue without unrelated refactoring or lockfile churn.
3. Verify all changes locally before submitting:
   ```bash
   npm run typecheck
   DATABASE_URL=postgres://127.0.0.1:5432/myhot_test npm test
   npm run build -w @aihot/web && npm run test:web
   ```
4. Database migrations must adhere to online execution rules (1 statement per file from `0055` onward; see [architecture.en.md](docs/architecture.en.md)).
5. Open PR against `main` and check "Allow edits by maintainers". Never commit secret keys, credentials, or production databases.
