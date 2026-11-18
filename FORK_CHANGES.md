# FORK_CHANGES — các chỗ sửa lõi AIHOT

Mọi thay đổi ngoài `modules/`, `site/`, `industry/` ghi ở đây để khi lấy cập nhật từ upstream biết chỗ nào phải xem lại.

| Ngày | File | Thay đổi | Lý do |
|---|---|---|---|
| 2026-11-17 | `apps/worker/src/schedules.ts` | Lịch `content.translate` thêm `when: TRANSLATE_ENABLED !== "false"` | Site tiếng Anh: không dịch bài sang tiếng Trung (tốn lượt gọi model vô ích) |
| 2026-11-17 | `.env.example` | Khai báo `TRANSLATE_ENABLED`, `VIDEO_MIN_SOURCES` | Test kiến trúc yêu cầu mọi biến môi trường phải có trong template |
| 2026-11-17 | `apps/web/**` | Gemini dịch chữ giao diện sang tiếng Anh. Riêng khóa `kind` của changelog (`更新/优化/公告/下线`) vẫn giữ tiếng Trung vì nó là kiểu dữ liệu dùng chung với `packages/contracts` | Giao diện tiếng Anh |
| 2026-11-17 | `tests/analyze`, `category-corrections`, `topics` | Đổi tên tag/danh mục/chủ đề trong test sang taxonomy tiếng Anh | AGENTS.md: đổi `industry/taxonomy.ts` thì phải sửa test theo |
| 2026-11-17 | `modules/video/tests/candidates.test.ts` | Test tự tạo nguồn riêng, không dựa vào dữ liệu seed | Chạy được trên DB test trống |

## Không sửa lõi (cố ý)

- `packages/**`, `apps/api/**`, `tests/**`, `scripts/**`: **giữ nguyên bản gốc tiếng Trung**. Bản Gemini dịch các thư mục này làm 74 test lỗi, vì có những chuỗi mà code dùng để so khớp đã bị dịch. Bản dịch đó được lưu ở `backups/gemini-backend-translation.patch`. Khi cần chữ tiếng Anh ở backend (cảnh báo, lý do hiển thị cho admin), dịch dần từng file và chạy test của file đó.
- `LICENSE`, `NOTICE`: giữ nguyên dòng bản quyền gốc, theo yêu cầu của giấy phép MIT.

## Ghi chú `industry/` (không phải lõi, nhưng phải cẩn thận)

- `taxonomy.ts`: Gemini đã dịch và xóa nhầm vài mục nhận diện công ty. Đã khôi phục tên gọi khác của xAI (`SpaceXAI`, `SpaceXSI`) và các mẫu nhận diện Hunyuan, Doubao, Baidu ERNIE.
- `topics.json`: sửa tag của chủ đề `trends` (`phenomenon/trend` không tồn tại trong taxonomy, đổi thành `Trends`). Khôi phục tên công ty kèm sản phẩm (`Anthropic / Claude`…) để tìm kiếm theo tên sản phẩm vẫn ra. Sửa các tên bị dịch máy kém.

## Sửa lõi có chủ đích (2026-11-17, đợt 2)

| File | Thay đổi | Lý do |
|---|---|---|
| `packages/contracts/src/time.ts` | `monthDay` trả ngày tiếng Anh ("Nov 7", "Dec 31, 2025"); `WEEKDAYS` tiếng Anh | Giao diện tiếng Anh cần ngày tiếng Anh, nếu không sẽ lẫn kiểu "Included in 11月7日 AI 日报 · Top Story" |
| `packages/contracts/src/site.ts` | `REPORT_NAMES` = Daily/Weekly/Monthly; nhãn tháng "Oct 2026"; nhãn tuần "Sep 28 – Oct 4" | Như trên |
| `tests/page-links`, `page-metadata`, `selected-card`, `timeline-day-counts`, `mentions` | Đổi kết quả mong đợi sang tiếng Anh | Theo thay đổi ở trên và taxonomy tiếng Anh |

Ghi chú: `tests/outbound-protocol.standalone.test.ts` (route secure-proxy) lỗi trên **Node 26** nhưng đạt trên Node 24, kể cả với bản AIHOT gốc chưa sửa. Production phải chạy **Node 24 LTS**, đúng như AIHOT yêu cầu (`engines: node >=24.22.1`).

Test web (`npm run test:web`) cần trình duyệt Playwright đúng phiên bản: chạy `npx playwright install chromium webkit` một lần. Thiếu trình duyệt thì 23 test báo "Executable doesn't exist", còn `article-outline.test.ts` treo không có kết quả. `apps/web/tests/navigation-performance.test.ts` chờ tiêu đề trang chủ "Curated". Lưu ý: "精选" đang được dịch lẫn lộn thành "Curated" (menu, tiêu đề) và "Featured" (nút quay lại, badge), cần thống nhất khi làm cấu hình site.

## Cấu hình PipelineX (Phase 1)

| File | Thay đổi | Lý do |
|---|---|---|
| `industry/selection.ts` | Hạ cả thang: T1 60→**55**, T1_5 65→**58**, T2 76→**60**; class ecosystem 70→**58**, leaderboard 76→**60** (giữ thứ tự T1 < class < T2 mà framework và test yêu cầu) | Model chấm tin AI tiếng Anh thấp hơn feed tiếng Trung của AIHOT. Trên mẫu 103 bài T2 (17/11/2026), ngưỡng 76 chỉ chọn 3 bài (cùng một sự kiện), bỏ sót cả tin Anthropic ra model mới (69). Ở 60 có 27 bài / 11 sự kiện, đa số là tin thật. Hiệu chỉnh lại khi có bộ gold có nhãn. |
| `apps/web/app/**` (trừ admin) | "Featured" → "Curated" | Thống nhất tên trang tuyển chọn (gốc "精选"). Trong admin, "Featured" vẫn là tên chế độ nguồn `editorial`. |
| `apps/web/tests/cache.test.ts`, `navigation-performance.test.ts` | Mong đợi "Curated" | Theo thay đổi trên |
| `.env` (không commit) | `COLLECT_ENABLED=true` | Bắt đầu thu tin hằng ngày. Các công tắc Feishu/DingTalk/IndexNow/Baidu vẫn `false`; không có nguồn WeChat/X. |

Repo: nhánh `pipelinex`, remote AIHOT đổi tên thành `upstream` (lấy cập nhật bằng `git fetch upstream && git merge upstream/main`).

## Module video (`modules/video`, `renderer/`)

- Trang admin **/admin/videos** (module page `admin: true`): câu chuyện ứng viên, nút "Make video", danh sách video, trình phát, kịch bản, nguồn ảnh, log; Duyệt / Bỏ / Làm lại từ một bước.
- Bảng `video_jobs` (migration `2001`), hàng đợi `video.make` (1 video một lúc), lịch `video-daily` 09:30 khi `VIDEO_AUTO_ENABLED=true` (mặc định tắt).
- `renderer/`: các bước script (LLM) → assets (Pixabay/Openverse/Commons + kiểm tra bằng AI nhìn hình) → voice (edge-tts) → render (Remotion), mỗi video một thư mục `.data/videos/<id>/`. Phụ thuộc riêng (`renderer/node_modules`, `renderer/.venv`, `renderer/.env` chứa PIXABAY_API_KEY) không commit.
- Còn nợ: các lượt gọi LLM của video chưa ghi biên nhận (receipts) của AIHOT; edge-tts không có giấy phép thương mại (xem RESEARCH-PROCESS.md).
- Bước `dossier` (hồ sơ sự kiện từ toàn văn, có kiểm tra trích dẫn/con số) và `verify` (kiểm chứng từng câu, hiện trên trang Videos; lỗi kiểm chứng không làm hỏng video). Kết quả thử A/B: RESEARCH-PROCESS.md ở thư mục PipelineX.
- `packages/contracts/src/modules.ts`, `apps/web/app/routes.ts`, `apps/web/app/routes/admin/layout.tsx`, `module-layout.tsx`: trang admin của module có thể khai báo `shell: "engine"` (+ `group`) để nằm trong khung admin chính, ở đầu menu, thay vì khung riêng của module. Trang Videos dùng cách này (nhóm "Production"). Lý do: trang dùng hằng ngày, cần chuyển qua lại với Sources/Operations mà không đổi giao diện.

## Provider miễn phí trước, trả phí sau

- `site/models.ts`: preset `nvidia-nemotron` (NVIDIA API, miễn phí ~40 lượt/phút), `openrouter-free-nemotron` (`:free`, 20/phút, 1.000/ngày), `orcarouter-free-deepseek` (OrcaRouter free, chỉ chữ), `openrouter-nemotron` (trả phí) và `pipelinex-chain` = chuỗi theo thứ tự đó, cuối cùng là `default` (`LLM_*`). Code mặc định giữ như AIHOT (test chạy như upstream); `.env` chuyển 12 bước sang chuỗi (`PREFILTER_MODEL=pipelinex-chain`…).
- `packages/contracts/src/site-config.ts`: `ModelPreset.chain`. `packages/backend/src/providers/llm.ts`: `chatChain` thử từng thành viên, mỗi lượt có biên nhận; chuyển tiếp khi không có câu trả lời, chưa cấu hình, bị từ chối tài khoản hoặc gói free từ chối; câu trả lời hỏng thì không mua lại; lượt gọi có ảnh bỏ qua thành viên không đọc ảnh. Cặp chính/dự phòng gốc của AIHOT giữ nguyên luật (tài khoản bị từ chối không chuyển sang dự phòng). `LLM_FAILOVER_TIMEOUT_MS` (mặc định 30 s, PipelineX đặt 90 s). Test: `tests/model-chain.test.ts`.
- `renderer/lib.ts`: chuỗi tương tự cho các bước video (`VIDEO_PROVIDERS`, mặc định nvidia,openrouter-free,orcarouter,openrouter), kèm kiểm tra câu trả lời dùng được (hồ sơ ≥ 8 sự kiện, kịch bản ≥ 8 beat…).
- `modules/video/backend/pipeline.ts`: tiến trình dựng video chỉ nhận các biến môi trường cần thiết (không nhận mật khẩu DB/admin).

## Video: Background, Thumbnail, Short

- Bước `background` (TinyFish, miễn phí, không bắt buộc): lấp toàn văn bài ngắn (không lấy báo trả phí), tìm bối cảnh trong tên miền uy tín, thêm tối đa 8 trang được đánh dấu BACKGROUND.
- Bước `thumbnail` (Remotion still 1280×720, chữ do kịch bản viết `thumbnail_text`), `short` / `shortvoice` / `shortrender` (YouTube Short dọc 1080×1920, ~45–60 s, dùng lại hình đã kiểm tra của bản dài, kiểm chứng từng câu như bản dài). Lỗi ở các bước này không làm hỏng video dài.
- Trang Videos: ảnh thumbnail, trình phát Short, nút tải video/thumbnail/Short, kết quả kiểm chứng của Short.
- (18/11) `pipelinex-chain` chỉ còn model miễn phí: NVIDIA → OpenRouter `:free` → OrcaRouter free → `LLM_*` (`.env` đặt `LLM_MODEL=nvidia/nemotron-3.5-super-vl:free`, `LLM_VISION=true`). Bỏ tầng OpenRouter trả phí (đêm 17/11 nó đã nhận 103 lượt, $0,41, khi các tầng free bị giới hạn). Khi mọi tầng free bận, bước đó thất bại và được thử lại sau.
- Giọng đọc: Azure AI Speech khi có `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (cùng giọng Andrew, mốc thời gian từng chữ), edge-tts cho beat Azure lỗi hoặc khi chưa có key. `renderer/requirements.txt`.

## MCP biên tập cho agent trên máy (Antigravity…)

- `modules/video/backend/editor-mcp.ts`: `http://127.0.0.1:3001/api/admin/video/mcp`, công cụ `list_videos`, `get_video`, `edit_script` (sửa lời, tiêu đề, mô tả, chữ thumbnail của bản dài hoặc Short, rồi kiểm chứng lại ngay), `remake`, `review`. Không đăng được video. Chỉ nhận kết nối trực tiếp trên máy (loopback, `Host` đúng cổng API, không `Via`/`X-Forwarded-*`/`Origin`) kèm `VIDEO_EDITOR_TOKEN` (≥ 24 ký tự; trống = tắt).
- `modules/video/backend/editing.ts`: đọc/sửa kịch bản, lịch sử `edits.json` (trước/sau, ghi chú), hiện trên trang Videos ("Edit history").
- `apps/web/app/lib/api-proxy.server.ts`: proxy web luôn gắn `Via: 1.1 pipelinex-web` (ghi đè giá trị client gửi) để API phân biệt yêu cầu đi qua web.
- Test: `modules/video/tests/editor.test.ts`.
- (18/11) Công cụ vận hành cho agent: `list_candidates`, `search_stories`, `get_story`, `make_video` (tối đa 3 video/24 giờ do agent tạo, kèm lý do), `edit_visual` (đổi hình một beat rồi làm lại từ `assets`), `system_status` (dữ liệu trang Operations + provider giờ qua + video), `retry_failed_articles` (dùng `requeueFailedArticles` của AIHOT). Mọi hành động của agent vào cả `edits.json` của video lẫn Audit Log (`video.create|edit|remake|review`). `.env` bật `VIDEO_AUTO_ENABLED=true`.
- (18/11) Thêm công cụ cho agent: `look_at_video` (thumbnail + khung hình từng beat dạng ảnh, kèm lời đọc), `get_publish_kit` / `edit_publish_kit` (tiêu đề, mô tả có chương, nguồn, credit ảnh, ghi chú làm bằng AI, tag — bản dài và Short; không đăng), `web_search` / `fetch_page` (TinyFish, chỉ tên miền uy tín, chặn báo trả phí và diễn đàn), `get_style_guide` / `propose_style_rule` (luật chỉ có hiệu lực khi người duyệt trên trang Videos; luật đang hiệu lực được đưa vào prompt kịch bản và Short qua `style.json`). Danh sách tên miền uy tín dùng chung: `modules/video/backend/trusted.ts`.
- (18/11) Cứu hộ qua MCP (`modules/video/backend/rescue.ts`): `list_stalled_articles` (bài lỗi hoặc đang chờ thử lại do provider 403/429/timeout; gửi lại phân tích bằng `retry_failed_articles`) và `rescue_video_script` (khi bước script cứ lỗi, agent tự viết kịch bản dài; video được khoá trước bằng `requeueVideo` — bị từ chối nếu đang chạy — rồi mới ghi `script.json`, giữ danh sách nguồn của script cũ, làm lại từ `verify` nên mọi câu vẫn được kiểm chứng). Đã bỏ `get_article_to_analyze` / `submit_article_analysis` của bản đầu: agent tự chấm điểm và tự chọn bài là đi vòng quy trình chọn bài của AIHOT (lọc, hai điểm độc lập, ngưỡng theo kênh, biên nhận) và dùng thang điểm AI cho cả kênh tài chính. Bài viết luôn do hệ thống chấm.
- (18/11) `remake` có `force`: chỉ khởi động lại video bị kẹt ở trạng thái running do worker khởi động lại — bị từ chối khi pg-boss còn job `video.make` đang chờ, hoặc đang chạy mà video vừa đổi bước trong 15 phút qua (`FORCE_QUIET_MINUTES`).
- (18/11) Phong cách video (`modules/video/backend/styles.ts`, cột `video_jobs.style`, migration `2002`): news, launch, product, finance, investigation, crime, war, explainer, analysis. Tự chọn theo bài báo của câu chuyện (chiến tranh/tội phạm khi ≥ 1/3 số bài, rồi điều tra hoặc tài chính — chọn bên chiếm tỷ lệ cao hơn, rồi theo chủ đề AIHOT). Phong cách quyết định cấu trúc cảnh, giọng văn, luật riêng, gợi ý b-roll (kịch bản và Short), luật kiểm tra hình, tốc độ đọc, nhạc theo tâm trạng (`renderer/music/<mood>/`), màu chủ đạo (video, Short, thumbnail). Crime và war là chủ đề nhạy cảm: luật lời văn và hình ảnh nghiêm hơn. Đổi trên trang Videos hoặc qua MCP (`list_styles`, `set_video_style`, `make_video` có tham số `style`).

## Đa kênh (18/11)

- Mỗi kênh là một checkout riêng (git worktree, nhánh `channel/<tên>`, thư mục `PipelineX/channels/<tên>/`), loại kênh chọn **một lần** lúc tạo: `industry/` của kênh là gói `packs/<loại>/` (loại `ai` dùng `industry/` của checkout chính). Database, cổng (3010/3011, 3020/3021…), token MCP biên tập riêng; key dùng chung qua `.env.shared` (liên kết tới `.env` chính, nạp trước `.env` của kênh). Bộ dựng video (`renderer/`) dùng chung.
- `npm run channel -- create <tên> --type <loại> [--title "Tên"] | list | start | stop | update [<tên>] | remove <tên> --yes | types`. `update` merge code của nhánh hiện tại vào kênh (gói và `site/site.ts` của kênh giữ nguyên nhờ `.gitattributes` merge=ours), cài thư viện, migrate.
- `industry/channel.json`: hồ sơ kênh (loại, chủ đề, khán giả, thương hiệu, tag, trang chính thức uy tín, báo trả phí, phong cách được dùng, bảng chủ đề → phong cách). Prompt video, kiểm tra hình, intro/outro/thumbnail, publish kit, danh sách trang uy tín đọc từ đây.
- `apps/api` và `apps/worker` (dev) nạp `../../.env.shared` rồi `../../.env`.

## Render, giọng đọc, hình & đồ hoạ (18/11)

- `pipeline.ts`: render và thumbnail dùng `--bundle-cache`, render dùng `--hardware-acceleration if-possible`. Mặc định `--concurrency` vẫn 4 (`VIDEO_RENDER_CONCURRENCY`; máy chính đặt 6 trong `.env` để chừa nhân cho kênh khác render cùng lúc).
- `renderer/tts.py`: cache từng beat (`public/audio/<beat>.meta.json`: engine, giọng, tốc độ, lời). Làm lại từ `voice` sau `edit_script` chỉ thu lại beat đã sửa; beat từng phải dùng edge-tts thay Azure sẽ được thu lại khi Azure chạy.
- `renderer/assets.ts`: khi không có ảnh hợp cho truy vấn của beat, thử tối đa 2 truy vấn rộng hơn chọn theo nội dung (thị trường, lợi nhuận, Fed, crypto, thanh toán, app, máy chủ/chip, lãnh đạo, trụ sở, toà án) rồi mới về thẻ chữ; mỗi beat tối đa 12 lần kiểm tra bằng vision.
- `renderer/src/NewsVideo.tsx`: beat mới `compare`/`comparison` (bảng 2 cột), `code`/`terminal`, `card` có `items`; nền lưới có ánh sáng chuyển động và vignette, số liệu `stat` nổi hơn, phụ đề kính mờ, thanh tiến trình gradient. `Thumbnail.tsx`, `ShortVideo.tsx`: tương phản, viền và ánh sáng nền mạnh hơn. `short.ts`: cho phép visual so sánh/code, luật trích nguồn ở beat cuối chặt hơn.
- `editing.ts`: ghi file của video tạo thư mục nếu chưa có.
- Tài liệu kế hoạch (EVAL-AIHOT, PLAN, RESEARCH-PROCESS, RESEARCH, SPEC) nằm trong `docs/pipelinex/`; các file cùng tên ở thư mục `PipelineX/` là symlink tới đây.

## Checkout chính chuyển sang tài chính (18/11)

- Theo yêu cầu chủ dự án: checkout chính (:3000) chạy gói `finance`, xoá dữ liệu AI. Backup trước khi xoá: `PipelineX/backups/ai-channel-20261118/` (`pipelinex_eval.dump` — `pg_restore -d <db>`; `data/`: video, gold set và kết quả đánh giá của kênh AI). Database `pipelinex_eval` tạo lại, migrate, seed nguồn tài chính.
- Gói AI gốc chuyển sang `packs/ai/` (gồm `site/site.ts`); `scripts/channel.ts` lấy mọi loại kênh từ `packs/<type>/`.
- Test engine từng ghi cứng mục AI làm kiểu (`web-server.ts`, `page-metadata.standalone`, `pool-relevance`, `search-sharing`) giờ lấy `CATEGORIES` của gói, nên typecheck qua với gói nào cũng được.
- Rà nguồn tài chính theo số liệu thật của kênh `markets` (750 bài, 67 được chọn): bỏ Seeking Alpha, Abnormal Returns, The Big Picture, The Block, Cointelegraph (tắt trong database, giữ bài cũ); Bloomberg, FT, WSJ, Economist, Reuters (Google News) chỉ còn là tín hiệu độ nóng (`hot_signal`: báo trả phí/chỉ có tiêu đề, gần như không bài nào được chọn); thêm BEA, BLS và US Treasury (qua Google News), Bank of England, CFTC, NY Fed Liberty Street (T1), CNBC Economy, BBC Business, Guardian Business, NPR Business, NerdWallet (T2), AP qua Google News (`hot_signal`). Feed đã thử trước khi thêm; IMF, Yahoo Finance, Fortune, FDIC, Marketplace, Calculated Risk không dùng được. Thay đổi trong database qua `updateSource` (Audit Log).
- `channel.json`: thêm newyorkfed.org, bbc.co.uk, theguardian.com, npr.org, nerdwallet.com, cnbc.com vào trang uy tín cho nghiên cứu.
