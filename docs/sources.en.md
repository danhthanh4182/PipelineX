# Ingestion Sources

Sources are managed in the Admin Dashboard under "Sources": create new sources, run preview fetches to inspect returned items, adjust polling intervals, toggle active status, and inspect failure diagnostics or recent ingested items. On initial system boot, seed sources defined in `industry/sources.json` are automatically imported.

## Six Source Types

| Type | Best For | Requirements |
|---|---|---|
| `rss` | Blogs, media outlets, Substack, RSSHub feeds with RSS/Atom. | None. |
| `web_list` | Web pages without RSS (news indexes, blog listings, changelogs). | CSS selectors; optional Jina Reader rendering (pay-per-request). |
| `json_list` | REST APIs returning JSON (GitHub Releases, custom endpoints). | JSON dot-paths. |
| `x_search` | X (Twitter) accounts. | SocialData API key (pay-per-request). |
| `mp_account` | WeChat Official Accounts. | Dajiala API key (pay-per-request). |
| `external` | Custom webhook pushes from your own crawlers/scripts. | `INGEST_TOKEN` secret. |

`json_list` requests only follow same-origin redirects to prevent credential leakage. Internal private network IPs are blocked by default for security, unless explicitly whitelisted via `PRIVATE_FEED_HOSTS`.

Allowed configuration keys for each source type are defined in [`config-keys.ts`](../packages/backend/src/sources/config-keys.ts). Unrecognized configuration keys are rejected upon save.

## Preview Before Creation

In `/admin/sources/new`, choose the source type and paste the configuration JSON.

Clicking "Preview Fetch" displays the total number of matched items and the first 20 items (title, URL, timestamp, summary) without saving them to the database. This allows you to verify that selectors match article links rather than navigation bars, and that timestamps are parsed accurately.

## Configuration Details Per Source Type

### 1. `rss`

```json
{ "feedUrl": "https://example.com/feed.xml" }
```
- Optional: `summaryIsBody: true` (if feed summaries contain full content, avoids fetching source pages), `allowCategories` / `denyCategories` (category filter).
- Video player pages (YouTube, Vimeo) are never extracted as article text. Video descriptions in Media RSS are preserved as summaries.
- Embedded inline SVGs are replaced by their accessible alt text (`aria-label`, `<title>`, `<desc>`) to preserve clean formatting without rendering dependencies.
- Audio/video podcast episodes without a web page use the audio enclosure URL as the canonical link.

### 2. `web_list`

Uses standard CSS selectors. The key is setting `itemSelector` to match **each article card/node**, not the wrapping container:

```json
{
  "url": "https://example.com/news",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["https://example.com/posts/"]
}
```
- `itemSelector`: Selects each individual news item on the page.
- `linkSelector` / `titleSelector`: Evaluated within each item.
- `publishedAtSelector`: Evaluates `datetime`, `content`, `title` attributes, or text content. Timezone offsets default to `+08:00` if unprovided.
- `parseMode`: `html` (default), `markdown`, `docusaurus_changelog`, or `intercom_changelog`. For Jina Reader, provide `https://r.jina.ai/<url>`.
- `detail`: If the listing page lacks dates, full titles, or summaries, configure `detail` to fetch each item's individual detail page. `maxFetches` limits the number of detail page requests per polling round.

### 3. `json_list`

For JSON API endpoints returning an array of items:

```json
{
  "url": "https://example.com/api/news",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "{raw:url}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```
- `itemsPath`: Dot-notation path to the array (e.g. `data.items`). Omit if the root payload is an array.
- `titlePaths`, `summaryPaths`: Fallback candidate paths evaluated in order (e.g. `["title", "name"]`).
- `urlTemplate`: `{raw:url}` for verbatim URLs; `https://example.com/posts/{id}` for slug interpolation.
- Timestamps: ISO strings with timezones recommended; for timestamps in seconds or milliseconds, specify `publishedAtUnit: "epoch_s"` or `"epoch_ms"`.

### 4. `x_search` (Twitter)

Uses SocialData API search syntax:

```json
{ "query": "from:SomeAccount -filter:replies", "searchType": "Latest" }
```
- In backend `.env`, configure `SOCIALDATA_API_KEY`.
- During automated production polling, ordinary accounts are batched into grouped queries (up to ~20 accounts per call) to minimize API billable units.

### 5. `mp_account` (WeChat Official Accounts)

```json
{ "ghid": "gh_xxxxxxxx", "nickname": "Official Account Name" }
```
- Requires `DAJIALA_KEY` in backend `.env`.

---

## Tiers, Participation Modes, and Full Text

- **Tiers (`tier`)**:
  - `T1`: Official first-hand announcements (official corporate blogs, research labs, institutional portals).
  - `T1_5`: Official social accounts & verified company staff.
  - `T2`: Media outlets, tech journalists, independent bloggers.
  - `EXCLUDE_MP`: Non-curated (monitored for signals or internal review only).
- **Participation Modes (`participation_mode`)**:
  - `editorial`: Enters standard selection scoring and public feeds.
  - `hot_signal`: Does not appear as a standalone curated card; counts exclusively toward event heat calculation.
  - `isolated`: Internal only; hidden from all public views.
- **First-hand Representation**: Only `T1` is considered first-hand. When an event has multiple reports, the representative article prioritizes `T1`.
- **Publisher Attribution (`publisherUrlPrefixes`, `publisherRole`)**: Identifies canonical publishers to aggregate reposts or social posts under the genuine creator entity.
- **Full Text (`site_fulltext`, `syndicate_fulltext`)**: Off by default. Displays summaries and links back to the original source. Only enable if full-text distribution rights are granted.

---

## Polling Cadence and Adaptive Scheduling

Polling intervals adapt dynamically at 04:20 daily based on 7-day publication frequency:
- High-volume sources are polled as frequently as every 15 minutes.
- Low-volume sources back off to 60–120 minutes.
- Sources silent for longer than 4 times their median publication interval are surfaced in health alerts as abnormally inactive.

---

## Ingestion Rule: "No Flood of Old Posts" (Backfill Archive)

To prevent newly added sources or initial imports from overwhelming the feed:
- Articles published **>48 hours** prior to discovery are automatically archived: they do NOT enter "Today", do NOT trigger push alerts, and do NOT bump current event rankings.
- Articles lacking a trustworthy publication date are held back until a valid timestamp is resolved.
- Initial import takes at most `_aihot.initialBackfillLimit` (default 30) articles within `_aihot.initialBackfillMonths` (default 12) months.
- `publishedAfter`: When specified, discards any article published strictly before the designated UTC timestamp.

---

## External Ingestion Webhook API

Custom scrapers and external scripts can push content directly:

```http
POST /api/ingest/items
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{
  "sourceId": "my-crawler",
  "sourceName": "My Custom Scraper",
  "items": [
    {
      "title": "Required Title",
      "url": "https://example.com/item-url",
      "publishedAt": "2026-10-01T08:00:00+08:00",
      "author": "Optional"
    }
  ]
}
```
- Requires `INGEST_TOKEN` in `.env` (minimum 16 characters).
- Maximum 50 items per payload.
- Automatically undergoes standard deduplication, scoring, and clustering. Setting `raw._aihot.backfill: true` flags items as historical archives without triggering current notifications.
