# Site Configuration

Site-specific identity: name, copy, branding, static pages, and enabled modules. See [Adapting AIHOT to Your Field](../docs/customize.md).

| File | Content |
|---|---|
| `site.ts` | Site name, industry keywords, publication schedule, home/about page copy, OG image text, reports phrasing, public API category merging. |
| `models.ts` | Named models and defaults per pipeline step (steps unlisted fall back to the default in `.env`). |
| `brand/` | Favicons, Logo component (`Logo.tsx`), wordmarks (`wordmark.svg`, `wordmark-dark.svg`), report nameplates (`nameplates/`), QR contact cards (`contact/`). |
| `pages/` | Terms of service, privacy notice templates (must be reviewed before production launch). |
| `public/` | Static root files with template placeholder interpolation: `robots.txt`, `manifest.webmanifest`, `openapi-v1.json`, `.well-known/security.txt`. |
| `changelog.json` | System updates and release notes. |
| `modules/` | Enabled module registries (`index.ts`, `server.ts`, `web.ts`) linking extensions in `modules/<name>/`. |
