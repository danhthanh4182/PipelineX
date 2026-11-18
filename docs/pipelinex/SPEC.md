# BẢN ĐẶC TẢ KỸ THUẬT: PIPELINEX — HỆ THỐNG TỰ ĐỘNG HÓA VIDEO

> Phiên bản: 0.5 (draft) · Cập nhật: 2026-11-16
> Các giá trị trong `[ngoặc vuông]` là tham số cần chốt.
> Thay đổi so với 0.2: chuyển sang **TypeScript/Node.js**, thêm **Dashboard web**, **AI đa nhà cung cấp**, **lọc nội dung 4 tầng**, nhiều kiểu nguồn tin. Giữ nguyên chuỗi 5 bước gốc.
> Thay đổi 0.3 → 0.4 (review công nghệ): SQLite → **PostgreSQL + pgvector**, hàng đợi tự viết → **pg-boss**, TTS/Whisper chạy dạng **sidecar Docker**, gọn monorepo còn 4 gói.
> Thay đổi 0.4 → 0.5 (**hướng fork**): PipelineX là **fork của [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT)** (MIT). Bước ① dùng engine của AIHOT; bước ②–⑤ là **module `video`** tự viết. Công nghệ theo quy ước của AIHOT (Fastify, React Router, postgres.js + SQL migration, node:test, npm workspaces). Xem RESEARCH.md.

---

## 1. Tổng quan hệ thống

- **Tên dự án:** PipelineX
- **Chuỗi xử lý (5 bước gốc):**

```
① Thu thập tin tức → ② Xử lý & viết kịch bản bằng AI → ③ Giọng đọc & phụ đề → ④ Tư liệu & render video → ⑤ Đăng YouTube
   (nguồn + lọc)        (AI đa nhà cung cấp)                                                       (duyệt trước khi đăng: tùy chọn)
```

- **Trọng tâm v1:** đưa nguồn tin vào dễ dàng, lọc nội dung tốt, chọn được AI nào làm việc gì, và quản lý tất cả qua giao diện web.
- **Đầu ra:** `[1]` video/ngày (tối đa ~6 do quota YouTube API), **dài 10–15 phút** (~1.500–2.200 từ), 16:9 1080p, **tiếng Anh**, kèm tiêu đề/mô tả/tag/thumbnail và nhãn nội dung AI.
- **Kiến trúc:** **Fork AIHOT** (TypeScript/Node 24, 3 process `api` · `worker` · `web`, PostgreSQL + pg-boss). Bước ① (nguồn, lọc, gom sự kiện, độ nóng) dùng engine AIHOT đã chuyển sang tiếng Anh. Bước ②–⑤ là **module `video`** trong `modules/video/`. AI gọi qua lớp model của AIHOT (OpenAI-compatible + preset theo từng bước, có biên nhận và ngắt chi tiêu). Render bằng Remotion + FFmpeg.
- **Lịch chạy:** pg-boss (có sẵn trong AIHOT): lấy tin và lọc chạy liên tục theo tần suất từng nguồn; module video chạy theo lịch của profile; cảnh báo Telegram (thay cho Feishu/DingTalk của AIHOT).
- **Ràng buộc:**
  - Google OAuth app ở chế độ **Production** và project đã qua **audit YouTube API** (nếu chưa, video upload bị ép Private).
  - Chỉ dùng tư liệu hình ảnh/video có license rõ ràng.
  - Tuân thủ chính sách "inauthentic content"; bật nhãn "Altered or synthetic content" khi cần.
- **Ngoài phạm vi v1:** đa kênh YouTube, đa ngôn ngữ, nhiều người dùng.

---

## 2. Yêu cầu chức năng theo 5 bước

### ① Thu thập tin tức

#### 2.1 Nguồn tin — đưa tin vào hệ thống

> **Có sẵn trong AIHOT:** RSS, danh sách trang web (web-list), JSON API, tài khoản X, nhận tin đẩy từ script ngoài; thử lấy tin trong admin; phân hạng nguồn; theo dõi tình trạng nguồn. **Phải thêm:** dán URL bài viết, nhập văn bản/file tay, preset `keyword` (sinh URL Google News RSS), import OPML. Reddit, Hacker News, sitemap dùng qua RSS hoặc JSON API sẵn có. Bỏ hoặc tắt nguồn WeChat (`mp`).


| Kiểu | Cách nhập | Ghi chú |
|---|---|---|
| `rss` | Dán URL RSS/Atom | Kiểu chính, ổn định nhất |
| `keyword` | Nhập từ khóa → tự tạo Google News RSS search | Theo dõi chủ đề mà không cần biết báo nào |
| `url` | Dán 1 hoặc nhiều link bài viết | Làm video theo bài cụ thể, vào thẳng Inbox |
| `manual` | Dán văn bản / upload .txt, .md, .pdf | Nội dung tự soạn, thông cáo, ghi chú |
| `hackernews` / `reddit` | Chọn top HN / subreddit | Qua API chính thức |
| `sitemap` | URL news sitemap | Cho trang không có RSS |
| `webhook` (phase 2) | POST JSON vào endpoint | Tích hợp n8n, Zapier, script ngoài |

Trên Dashboard:
- Thêm nguồn → nút **Test** xem trước 5–10 tin mới nhất trước khi lưu.
- Gán nguồn cho một hoặc nhiều profile; bật/tắt; đặt tần suất lấy tin.
- Tình trạng: lần lấy gần nhất, số tin mới, lỗi liên tiếp (tự tắt sau `[5]` lần lỗi và báo Telegram).
- Import/Export (OPML cho RSS, JSON cho mọi kiểu).

Xử lý: trích tiêu đề, URL chuẩn hóa, thời gian, tác giả, nội dung chính (`@mozilla/readability`); tôn trọng `robots.txt`/ToS; rate limit theo domain.

#### 2.2 Lọc nội dung — 4 tầng

> **Có sẵn trong AIHOT:** khử trùng lặp, lọc sơ bộ, chấm điểm 2 lần độc lập theo ngưỡng từng hạng nguồn, gom bài thành **sự kiện** (embedding hoặc trùng chữ), tính **độ nóng** theo sự kiện, sửa điểm bằng tay, script đánh giá bộ lọc bằng mẫu gán nhãn. **Phải làm:** viết lại toàn bộ prompt trong `industry/prompts/` sang tiếng Anh cho ngách của mình; thêm điểm `video_potential` và các cờ nhạy cảm (tầng 3 bên dưới) vào prompt chấm điểm; trang **Inbox video** chọn sự kiện để sản xuất. Phần mô tả 4 tầng dưới đây là yêu cầu; cách thực hiện theo engine AIHOT.


Mỗi tầng ghi **lý do loại/giữ** để hiển thị trên Dashboard.

**Tầng 1 — Luật cứng (miễn phí, nhanh):**
- Độ mới (`max_age_hours`); domain allowlist/blocklist.
- Từ khóa `include` / `exclude` (hỗ trợ regex).
- Chất lượng tối thiểu: nội dung ≥ `[300]` từ, phát hiện paywall / nội dung bị cắt; chỉ tiếng Anh.
- Trùng lặp: hash URL chuẩn hóa; tin đã dùng trong `[7]` ngày.

**Tầng 2 — Gom cụm sự kiện:**
- Gom các bài nói về cùng một sự kiện bằng embedding + pgvector (fuzzy match tiêu đề làm dự phòng).
- Một cụm = một ứng viên video; các bài trong cụm làm nguồn tham chiếu chéo; số nguồn là tín hiệu "độ nóng".

**Tầng 3 — AI phân loại (model rẻ, structured output):**
```json
{
  "relevance": 8,
  "newsworthiness": 7,
  "video_potential": 6,
  "category": "ai-research",
  "flags": ["press_release", "clickbait", "sensitive_tragedy", "legal_ongoing",
            "medical_advice", "financial_advice", "political", "nsfw"],
  "reason": "Short explanation"
}
```
- Các điểm từ 0–10. Profile cấu hình `min_scores` và `blocked_flags`.
- Tin bị gắn cờ nhạy cảm nhưng không bị chặn thì bắt buộc duyệt tay.

**Tầng 4 — Xếp hạng & chọn:**
- Điểm tổng theo trọng số (độ mới, số nguồn, relevance, newsworthiness, video_potential) cấu hình theo profile.
- Đa dạng hóa: không chọn 2 tin cùng `category` trong một lượt (tùy chọn).
- `filter.mode = auto` tự lấy top `videos_per_run`; `manual` chờ chọn từ Inbox.

**Inbox trên Dashboard:** danh sách ứng viên (điểm, cờ, lý do, các nguồn trong cụm), thao tác **Sản xuất / Bỏ qua / Chặn domain–từ khóa / Ghim**; xem cả tin bị loại kèm lý do để chỉnh luật.

### ② Xử lý & viết kịch bản bằng AI

#### 2.3 Viết kịch bản (video dài 10–15 phút)

Một bài báo đơn lẻ không đủ chất liệu cho 10–15 phút. Đầu vào phải là **cụm nhiều nguồn** (deep-dive) hoặc **nhiều cụm** (roundup).

- **Viết theo 3 lượt** thay vì một lần:
  1. **Outline:** hook, 4–7 chương (`chapters[]`), mỗi chương có mục tiêu, ý chính, thời lượng dự kiến, nguồn dùng.
  2. **Viết từng chương:** mỗi chương 200–400 từ, có nhịp chuyển chương; giữ ngữ cảnh outline để không lặp ý.
  3. **Rà soát toàn bài:** cắt lặp, kiểm tra tổng thời lượng (~150 từ/phút), nhịp mở đầu 30 giây đầu.
- Output JSON (zod schema): `title`, `hook`, `chapters[] {title, segments[] {text, visual_type, visual_keywords[], on_screen_text, data?}}`, `sources[]`, `metadata {description, tags[], thumbnail_text}`.
- `visual_type` cho mỗi segment: `title_card`, `quote`, `stat`, `chart`, `timeline`, `map`, `broll`, `list` — để bước ④ đa dạng hình ảnh.
- Mỗi segment dài 1–3 câu (~5–15 giây) để hình ảnh đổi nhịp liên tục.
- Prompt: tiếng Anh tự nhiên, chỉ dùng thông tin có trong nguồn, trung lập, tổng hợp nhiều nguồn để tạo giá trị thêm.
- **Fact-check theo từng chương** bằng model của nhà cung cấp khác; chương nào không đạt thì viết lại riêng chương đó, không viết lại cả bài.
- Chế độ manual: sửa kịch bản trên Dashboard trước khi sang bước ③.

#### 2.4 AI đa nhà cung cấp

Dùng lớp model của AIHOT (`packages/backend/src/providers/llm.ts`): mọi lệnh gọi qua **API tương thích OpenAI**, mỗi bước chọn một **preset** (`site/models.ts`), đổi được bằng biến môi trường hoặc trang "Model & đánh giá" trong admin. Mọi lệnh gọi đều có **biên nhận** (chạy lại không trả tiền lần 2) và **ngắt chi tiêu** theo phút/giờ/ngày.

**Các bước dùng AI:**

| Bước | Thuộc | Gợi ý |
|---|---|---|
| Lọc sơ bộ, chấm điểm, gom sự kiện, tóm tắt | ① (AIHOT) | Model rẻ, nhanh |
| `video.outline`, `video.chapter`, `video.polish` | ② (module video) | Model mạnh nhất về văn phong tiếng Anh |
| `video.factcheck` | ② | **Khác nhà cung cấp** với bước viết |
| `video.metadata`, `video.visuals` | ② | Model rẻ |

**Nhà cung cấp qua endpoint tương thích OpenAI:**

| Nhà cung cấp | Cách kết nối |
|---|---|
| Anthropic (Claude) | Endpoint tương thích OpenAI của Anthropic, hoặc qua OpenRouter. Nếu cần tính năng riêng của Claude thì thêm adapter gốc vào `llm.ts` |
| Google (Gemini) | Endpoint tương thích OpenAI của Gemini |
| OpenAI, DeepSeek, Qwen… | Trực tiếp |
| OpenRouter | Một key cho nhiều model |
| Ollama / LM Studio | Endpoint local tương thích OpenAI |
| Agent CLI (opencode, Gemini CLI, Claude Code) | **Không hỗ trợ ở v1.** Đây là công cụ lập trình dạng agent, chậm, khó ép JSON, khó đo chi phí, có thể vi phạm điều khoản gói subscription |

**Yêu cầu:** output có cấu trúc validate bằng zod (AIHOT đã làm); thêm **fallback** sang preset dự phòng khi preset chính lỗi liên tục (AIHOT có circuit breaker theo model, cần thêm chuyển sang model khác); API key chỉ trong `.env`.

### ③ Tạo giọng đọc & phụ đề

#### 2.5 Voice
- Provider TTS cấu hình được: edge-tts, Kokoro (local), OpenAI, ElevenLabs, Google/Azure.
- Sinh audio theo từng segment (~100–200 segment/video), cache theo hash nội dung để sửa một câu không phải sinh lại cả bài; phụ đề lấy từ timestamp của TTS, nếu không có thì căn bằng whisper.cpp.
- Chuẩn hóa âm lượng -14 LUFS.

### ④ Tổng hợp tư liệu & render video

#### 2.6 Render
- Tư liệu: template đồ họa theo `visual_type` (title card, quote, số liệu, biểu đồ, timeline, bản đồ, danh sách) + B-roll stock Pexels/Pixabay + ảnh AI (tùy chọn); lưu nguồn và license từng asset.
- **Nhịp hình ảnh:** đổi cảnh mỗi ~5–10 giây; không để một `visual_type` lặp quá `[3]` lần liên tiếp; mỗi chương mở bằng chapter card.
- **Render theo chương:** mỗi chương render thành một clip riêng (Remotion), sau đó FFmpeg nối lại + ghép audio + nén. Lợi ích: render song song nhiều chương, lỗi chương nào chạy lại chương đó, sửa một chương không render lại cả video.
- Thumbnail 1280×720 render từ template.
- Output H.264/AAC, 1080p, 30fps; dung lượng ước tính 1–2 GB/video 15 phút.

### ⑤ Tự động đăng tải lên YouTube

#### 2.7 Duyệt (tùy chọn, trước khi đăng)
- `review.mode = auto | manual`. Manual: xem video trên Dashboard (Telegram gửi link), Approve/Reject; quá `[X]` giờ thì giữ lại.

#### 2.8 Publish
- YouTube Data API v3, resumable upload; title, description (kèm nguồn), tags, category, thumbnail, playlist, `containsSyntheticMedia`.
- **Chapters tự động:** sinh mốc thời gian chương vào description (bắt đầu `0:00`, ≥ 3 chương, mỗi chương ≥ 10 giây).
- **Giới hạn độ dài:** kênh chưa xác minh chỉ upload được video ≤ 15 phút. Phải **xác minh kênh** (số điện thoại) hoặc khống chế video **< 15:00**.
- Video ≥ 8 phút được đặt quảng cáo giữa video (mid-roll) khi kênh bật kiếm tiền.
- Privacy `[public | scheduled publishAt]`; idempotent bằng `youtube_video_id`; theo dõi quota trong ngày.

---

## 3. Thành phần dùng chung

### 3.1 Profile nội dung (cấu hình ngách)

Mỗi ngách là một **profile video**, tạo/sửa trên admin, lưu bảng `video_profiles`, Import/Export YAML. Thêm ngách không cần sửa code.

> Phần lọc ở bước ① (nguồn, prompt chấm điểm, ngưỡng, phân loại) cấu hình theo **gói `industry/` của AIHOT** cho toàn hệ thống. Profile video quyết định sự kiện nào được chọn làm video (`min_scores`, `blocked_flags`, chủ đề) và mọi thứ từ ② đến ⑤.

| Bước | Trường cấu hình |
|---|---|
| ① | nguồn gán cho profile; `filter` (tuổi tin, keywords, domains, `min_scores`, `blocked_flags`, trọng số, `mode`, `videos_per_run`) |
| ② | `script.style` (deep_dive / roundup / explainer / listicle / analysis), `tone`, `audience`, `duration_sec`, prompt; `factcheck`; `disclaimer`; `ai_overrides` |
| ③ | `tts.provider`, `voice`, `rate` |
| ④ | template, màu, font, `broll` (stock / ai / off), nhạc nền, `format` |
| ⑤ | category, tags, playlist, privacy, lịch đăng, `synthetic_media`, `review.mode` |
| Chung | `schedule` (cron) |

```yaml
name: tech
language: en
sources: [verge-rss, techcrunch-rss, kw-ai-chips]
filter:
  mode: manual
  max_age_hours: 24
  keywords_exclude: [sponsored, deal, coupon]
  min_scores: { relevance: 6, video_potential: 5 }
  blocked_flags: [press_release, nsfw]
  videos_per_run: 1
script:
  style: explainer
  tone: "clear, neutral, slightly conversational"
  audience: "general tech-curious viewers"
  duration_sec: 720          # 12 phút; chấp nhận 600–900
factcheck: true
ai_overrides:
  script: { provider: anthropic, model: "[model-id]" }
  factcheck: { provider: google, model: "[model-id]" }
tts: { provider: edge, voice: en-US-GuyNeural }
visual: { template: tech_dark, broll: stock }
format: landscape_16x9
youtube: { category_id: 28, privacy: private, synthetic_media: true }
schedule: "0 13 * * *"
review: { mode: manual }
```

| Style | Phù hợp | Cấu trúc |
|---|---|---|
| `deep_dive` | Công nghệ/AI, khoa học | Hook → bối cảnh → diễn biến → giải thích kỹ thuật → các góc nhìn → ý nghĩa/tương lai (1 sự kiện lớn, nhiều nguồn) |
| `roundup` | Tin tổng hợp tuần/ngày | Hook → 5–8 tin, mỗi tin một chương 1,5–2 phút → tổng kết |
| `explainer` | Công nghệ/AI, khoa học | Câu hỏi → bối cảnh → giải thích từng lớp → ví dụ → ý nghĩa |
| `listicle` | Mọi ngách | "Top N…", mỗi mục một chương |
| `analysis` | Tài chính, kinh doanh | Sự kiện → số liệu → các góc nhìn → rủi ro → disclaimer |

Với video 10–15 phút, ★ ưu tiên `deep_dive` và `roundup`.

### 3.2 Dashboard

Dùng **admin của AIHOT** (`/admin`, React Router) và thêm trang cho module video.

| Màn hình | Bước | Nguồn |
|---|---|---|
| Nguồn tin (thêm, thử lấy, bật/tắt, tình trạng) | ① | **Có sẵn** (AIHOT) — thêm form dán URL / nhập tay / import OPML |
| Nội dung, chẩn đoán, sửa điểm | ① | **Có sẵn** |
| Model & đánh giá (chọn model từng bước, chạy đánh giá) | ①② | **Có sẵn** — thêm các bước `video.*` |
| Giới hạn chi tiêu, nhật ký chạy, cảnh báo | Chung | **Có sẵn** |
| **Inbox video**: sự kiện đủ điều kiện làm video, điểm, cờ, nguồn; Sản xuất / Bỏ / Ghim | ① → ② | **Mới** |
| **Profiles** (cấu hình ngách cho phần video) | ②–⑤ | **Mới** |
| **Video jobs**: tiến trình từng bước, log, chạy lại từ bước bất kỳ | ②–⑤ | **Mới** |
| **Review**: sửa kịch bản theo chương, duyệt storyboard, xem video, Approve/Reject | ②④⑤ | **Mới** |
| **YouTube**: kết nối OAuth, quota, lịch đăng | ⑤ | **Mới** |

Đăng nhập admin: mật khẩu trong `.env` (`ADMIN_PASSWORD`, có sẵn). Truy cập qua Tailscale hoặc Caddy HTTPS (Caddy đã có trong compose của AIHOT).

**Trang công khai của AIHOT** (trang tin, RSS, API, MCP, bản tin ngày/tuần): ở v1 **tắt** hoặc để chạy nội bộ. Phase sau có thể bật làm trang tin của kênh để kéo thêm người xem.

---

## 4. Kiến trúc

```
┌──────────────────────── Fork AIHOT ─────────────────────────────────────────┐
│  web (React Router SSR)  ── admin: nguồn · nội dung · model · chi tiêu       │
│                             + module video: Inbox · Profiles · Jobs · Review │
│  api (Fastify)           ── /api/admin/* + /api/admin/video/*                │
│  worker (pg-boss)        ── ① lấy tin → lọc → chấm điểm → gom sự kiện → độ nóng│
│                             module video:                                    │
│                             ② outline → chương → rà soát → factcheck         │
│                             ③ TTS + phụ đề → ④ storyboard → render → ⑤ upload │
│  PostgreSQL 17            ── bảng AIHOT + bảng video_* (SQL migration)       │
└─────────────┬──────────────────────────┬──────────────────┬─────────────────┘
        LLM (OpenAI-compatible)    Sidecar: Kokoro, whisper.cpp   YouTube API · Telegram
```

**Container (Docker Compose):** `app` (api + worker + web, theo AIHOT) · `postgres` · `caddy` (tùy chọn) · `renderer` (worker riêng cho Remotion, cần Chromium) · `kokoro` (tùy chọn) · `whisper` (tùy chọn).

**Nguyên tắc tích hợp với AIHOT:**
- **Không sửa lõi** nếu tránh được. Code video nằm trong `modules/video/`; chỉ sửa lõi ở các điểm cần thiết (đăng ký job, route admin, menu) và ghi lại trong `FORK_CHANGES.md`.
- Module video **chỉ đọc** sự kiện/bài viết của AIHOT qua lớp đọc có sẵn, không ghi vào bảng của AIHOT.
- Tuân theo quy ước của AIHOT: biên nhận cho mọi lệnh gọi trả phí, ngắt chi tiêu, công tắc an toàn trong `.env` (thêm `VIDEO_ENABLED`, `PUBLISH_ENABLED`), kiểm tra ranh giới module bằng `tests/architecture.test.ts`.
- Đồng bộ upstream: fork độc lập, chỉ lấy cập nhật từ AIHOT khi thật cần (cherry-pick).

### 4.1 Trạng thái
- **Bài viết / sự kiện:** theo AIHOT.
- **Video candidate:** `NEW → SELECTED | SKIPPED` (từ sự kiện AIHOT đạt ngưỡng video).
- **Video job:** `QUEUED → OUTLINED → SCRIPTED → CHECKED → VOICED → STORYBOARDED → RENDERED → APPROVED → PUBLISHED`, cộng `FAILED`, `REJECTED`.
- Mỗi bước là một queue pg-boss (`video.script`, `video.voice`, `video.render`, `video.publish`); xong bước nào thì đẩy sang queue kế tiếp.
- Artifact ở `data/video/<job_id>/`; chạy lại từ bước bất kỳ; render theo chương, chương nào lỗi chạy lại chương đó.
- Giới hạn song song: `video.render` = 1 video (nhiều chương song song bên trong), `video.script` = `[2]`.

### 4.2 Công nghệ

| Phần | Lựa chọn | Nguồn |
|---|---|---|
| Ngôn ngữ / runtime | TypeScript, Node.js 24, npm workspaces | AIHOT |
| Web / admin | React Router (SSR) | AIHOT |
| API | Fastify | AIHOT |
| DB | PostgreSQL 17, client `postgres` (postgres.js), **SQL migration** đánh số | AIHOT |
| Hàng đợi / lịch | pg-boss | AIHOT |
| AI | Lớp model OpenAI-compatible + preset + biên nhận + ngắt chi tiêu | AIHOT (+ thêm fallback) |
| Lấy tin / trích nội dung | RSS, web-list, JSON, `@mozilla/readability` + `linkedom` | AIHOT |
| Gom sự kiện | Embedding hoặc trùng chữ | AIHOT |
| Validate | zod | AIHOT |
| Test | `node:test` | AIHOT |
| TTS | edge-tts (MVP) · Kokoro-FastAPI sidecar · ElevenLabs / OpenAI | **Mới** |
| Phụ đề | Timestamp từ TTS; whisper.cpp server sidecar dự phòng | **Mới** |
| Render | Remotion + FFmpeg, container `renderer` riêng | **Mới** |
| Upload | `googleapis` | **Mới** (tham khảo darkzOGx) |
| Thông báo | Telegram Bot API | **Mới** (thay Feishu/DingTalk) |
| Triển khai | Docker Compose + Caddy/Tailscale | AIHOT |

**Bỏ so với v0.4:** Next.js, Drizzle, Vercel AI SDK, vitest, pnpm (thay bằng công nghệ sẵn có của AIHOT để không phải duy trì 2 bộ).

### 4.3 Cấu trúc thư mục (fork)
```
apps/api/ apps/worker/ apps/web/     # AIHOT — chỉ thêm điểm nối cho module video
packages/backend/ packages/contracts/ # AIHOT — lõi, hạn chế sửa
industry/                            # ⚠ viết lại: prompts tiếng Anh, sources.json, taxonomy, ngưỡng
site/                                # ⚠ đổi: tên PipelineX, locale en, models.ts (preset Claude/Gemini/…)
database/migrations/                 # AIHOT + thêm 1xxx_video_*.sql
modules/
  video/
    src/candidates/   # ① → ② chọn sự kiện làm video
    src/script/       # ② outline, chương, rà soát, factcheck, metadata, prompts/
    src/voice/        # ③ adapter TTS, phụ đề
    src/storyboard/   # ④ chọn visual_type, tìm asset, storyboard
    src/render/       # ④ gọi renderer, nối chương, thumbnail
    src/publish/      # ⑤ YouTube, quota, lịch đăng
    src/admin/        # route và trang admin cho video
    tests/
  remotion/           # project Remotion: template chương, title card, stat, chart, timeline…
data/video/           # artifact (không commit)
FORK_CHANGES.md       # ghi lại mọi chỗ sửa lõi AIHOT
NOTICE / LICENSE      # giữ ghi chú bản quyền MIT của AIHOT
```

### 4.4 Mô hình dữ liệu (bảng mới của module video)
- `video_profiles(id, name, config_json, enabled, updated_at)`
- `video_candidates(id, event_id → sự kiện AIHOT, profile_id, score, flags_json, status, created_at)`
- `video_jobs(id, candidate_id, profile_id, profile_snapshot, status, step_attempts, error, youtube_video_id, created_at, updated_at)`
- `video_chapters(id, job_id, idx, title, script_json, factcheck_json, audio_path, clip_path, status)`
- `video_assets(id, job_id, chapter_id, type, source_url, license, local_path)`
- `video_publish(id, job_id, privacy, publish_at, youtube_video_id, status)`; `youtube_quota(date, units_used)`
- Chi phí AI dùng bảng biên nhận có sẵn của AIHOT (gắn `job_id` vào khóa logic).

---

## 5. Yêu cầu phi chức năng

| Hạng mục | Yêu cầu |
|---|---|
| Hạ tầng | VPS `[8 vCPU / 16 GB RAM / 160 GB SSD]` (video 10–15 phút render nặng), Ubuntu LTS, Docker; Remotion cần Chromium headless; Postgres ~200 MB RAM; Kokoro sidecar ~1–2 GB RAM |
| Hiệu năng | Mỗi video hoàn tất < `[90]` phút (render là khâu lâu nhất, ước tính `[30–60]` phút trên 8 vCPU — cần đo thực tế ở giai đoạn 1); render tối đa `[1]` video song song, chia nhiều chương trong video |
| Độ tin cậy | Tỉ lệ job thành công ≥ `[95%]`; lỗi một bước không mất artifact |
| Chi phí | ≤ `[$X]`/video; chi phí AI theo job/provider trên Dashboard |
| Sao lưu | `pg_dump` hằng ngày, giữ `[7]` bản |
| Lưu trữ | Xóa artifact trung gian sau `[7]` ngày; giữ video cuối `[14]` ngày (1–2 GB/video) |
| Bảo mật | API key chỉ trong `.env`, không lưu DB, không hiển thị trên UI; Dashboard có đăng nhập, không mở public |
| Quan sát | Log JSON theo `job_id`; Telegram khi FAILED, nguồn lỗi liên tục, quota thấp, token sắp hết hạn |

---

## 6. Tuân thủ & rủi ro

| Rủi ro | Biện pháp |
|---|---|
| Video bị ép Private | Xin audit YouTube API ngay từ đầu |
| Hết quota (~6 upload/ngày) | Theo dõi `quota_usage`; xin tăng quota khi audit |
| Bị tắt kiếm tiền vì nội dung lặp lại | Tổng hợp nhiều nguồn, lọc `video_potential`, đa dạng style, review |
| Video dài nhưng người xem bỏ sớm (retention thấp) | Hook 30 giây đầu, chapters, đổi cảnh 5–10 giây, giọng TTS chất lượng cao, theo dõi retention trong YouTube Studio |
| Upload thất bại do vượt 15 phút | Xác minh kênh; validate tổng thời lượng trước khi upload |
| Render quá lâu / hết RAM | Render theo chương, giới hạn concurrency, đo ở giai đoạn 1 rồi chọn cấu hình VPS |
| Vi phạm bản quyền | Asset có license, lưu nguồn; không dùng ảnh/video từ báo |
| AI sai sự thật | Fact-check chéo nhà cung cấp, ghi nguồn, duyệt tay tin nhạy cảm |
| Lọc sai | Lưu lý do từng tầng, xem tin bị loại trên Inbox, chỉnh luật nhanh |
| Agent CLI vi phạm ToS / chập chờn | Chỉ là adapter tùy chọn, có fallback sang API |
| Nhà cung cấp AI đổi giá/ngừng model | Ánh xạ task → model + fallback, đổi trên Dashboard |

---

## 7. Lộ trình

0. **Đánh giá & fork AIHOT:** chạy thử với nguồn tiếng Anh, viết lại prompt chính, thử viết một module nhỏ; đạt thì fork.
1. **Bước ① tiếng Anh:** đổi `site/` + `industry/` sang tiếng Anh và ngách đầu tiên, tắt phần không dùng (trang công khai, WeChat, Feishu, Baidu…).
2. **MVP module video:** Inbox video → kịch bản 3 lượt → edge-tts → template Remotion đơn giản, render theo chương → upload Private.
3. **Tự động hóa & duyệt:** lịch theo profile, Review, Telegram, fact-check chéo, fallback model, deploy VPS.
4. **Chất lượng & Production:** bộ template theo `visual_type`, B-roll, thumbnail, duyệt storyboard, đăng Public khi audit xong.
5. **Mở rộng:** Shorts 9:16, vòng học từ analytics, bật trang tin công khai, đa kênh.

---

## 8. Việc cần chốt

- [x] Ngôn ngữ nội dung: tiếng Anh
- [x] Ngách: cấu hình được qua profile
- [x] Stack: TypeScript/Node.js
- [x] Hướng làm: fork AIHOT + module video (sau khi đánh giá đạt)
- [ ] Profile đầu tiên và danh sách nguồn tin ban đầu
- [ ] Provider AI có sẵn key (Anthropic / Google / OpenAI / OpenRouter)
- [x] Format: 16:9, 10–15 phút, 1 video/ngày
- [ ] Ngân sách mỗi tháng và cấu hình VPS
- [ ] Đã có kênh YouTube và Google Cloud project chưa
