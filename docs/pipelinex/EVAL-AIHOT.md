# ĐÁNH GIÁ AIHOT — GIAI ĐOẠN 0

> Bắt đầu: 2026-11-17 · Bản AIHOT: commit `7c3d557` (2026-11-17) · Thư mục thử: `eval/aihot/`
> Môi trường: macOS, Node 26.13.1, PostgreSQL 18 (Homebrew), **không dùng Docker** (máy chưa cài) — chạy theo hướng dẫn "without Docker" của AIHOT, chế độ dev (`DEV_AUTH_ROLE=admin`).

## Tổng kết

**Kết luận: nên fork** (xem mục Kết luận ở cuối).

| Tiêu chí | Kết quả | Ghi chú |
|---|---|---|
| (1) Chạy được, thêm 15–20 nguồn RSS tiếng Anh | ✅ **Đạt** | 18/18 nguồn mẫu (đều tiếng Anh, ngách AI) lấy tin thành công, 144 bài |
| (2) Prompt tiếng Anh cho kết quả chấm điểm hợp lý | ✅ **Đạt (mẫu nhỏ)** | 12 bài: xếp hạng đúng hoàn toàn; ngưỡng mặc định của AIHOT quá cao, hạ về ~58–60 thì đúng 10–11/11 |
| (3) Gom đúng các bài cùng một sự kiện | ✅ **Đạt** | Lần 3 (embedding Ollama + phân tích lại bằng prompt tiếng Anh): 8/8 cụm dự kiến gom đúng; 1 bài bị gắn vào 2 sự kiện |
| (4) Viết module mà gần như không sửa lõi | ✅ **Đạt** | Module `video` chạy được, 0 dòng sửa lõi, 16/16 test kiến trúc pass |

## (1) Chạy và lấy tin

- `npm ci` → `migrate` (91 migration) → `seed` (18 nguồn) → chạy `api`, `worker`, `web` ở chế độ dev.
- 18/18 nguồn lấy tin `ok`, mỗi nguồn 8 bài, tổng 144 bài. Lần nhập đầu tiên được đánh dấu "backfill" (lưu trữ, không vào tin hôm nay) — đúng thiết kế "old articles do not flood the screen".
- Trích nội dung: ~80/144 bài có nội dung đầy đủ ngay sau vài phút (phần còn lại đang chờ). Một số nguồn (DeepMind, Google Research, Mistral, Berkeley, Simon Willison, The Decoder) chưa có nội dung lúc kiểm tra — cần xem lại khi chạy lâu hơn.
- Admin `/admin` chạy được: danh sách nguồn, hạng nguồn (T1/T2), tình trạng, lần lấy gần nhất.
- PostgreSQL 18 chạy được dù tài liệu ghi 16/17.

## (4) Module video thử nghiệm

Đã viết `modules/video/`:
- `migrations/2000_video_candidates.sql`: bảng `video_candidates`.
- `backend/candidates.ts`: chọn sự kiện có độ nóng cao trong 48 giờ và có ≥ `VIDEO_MIN_SOURCES` (mặc định 3) nguồn độc lập.
- `server.ts`: cron `video-pick-candidates` mỗi 10 phút (pg-boss) + API `GET /api/admin/video/candidates` (kiểm tra phiên admin).
- `tests/candidates.test.ts`: tạo sự kiện + 3 bài từ 3 nguồn → chọn được 1 ứng viên, chạy lại không trùng.

Kết quả:
- **Lõi AIHOT: 0 dòng sửa.** Chỉ đổi `site/modules/server.ts` (đăng ký module), `site/package.json`, `.env.example` (khai báo biến mới), lockfile — đều là chỗ AIHOT thiết kế để tùy biến.
- Migration của module được `migrate.ts` tự chạy; cron xuất hiện trong `pgboss.schedule`; API trả `{"candidates":[]}` (rỗng vì chưa bật model nên chưa có sự kiện).
- `tsc` cho modules: 0 lỗi. Test module: pass. **Test kiến trúc: 16/16 pass** — và nó đã bắt được việc đọc biến môi trường chưa khai báo, tức các rào chắn kiến trúc hoạt động thật.
- Interface module rất đầy đủ: route HTTP, cron, queue riêng, khai báo bước model (hiện trong trang Model của admin), loại nguồn tùy chỉnh, cảnh báo, dọn dữ liệu, trang admin riêng (`admin: true` + `nav`).

## (2) Chấm điểm bằng prompt tiếng Anh

**Cách làm:** viết lại `industry/prompts/prefilter.md` và `selection-score.md` sang tiếng Anh (giữ nguyên định dạng JSON, 5 trục điểm và bảng trọng số; đổi đối tượng sang khán giả kênh YouTube tiếng Anh). Bản gốc tiếng Trung lưu ở `/tmp/aihot-logs/*.zh.md`. Bộ mẫu 12 bài thật (`eval/aihot/.data/gold.jsonl`), nhãn do mình gán: 7 nên chọn, 5 nên loại. Chạy `scripts/eval-selection.ts` (lọc sơ bộ + chấm điểm 2 lần mỗi bài).

**Model:** `nvidia/nemotron-3.5-super-vl:free` qua OpenRouter (model `google/gemma-4-31b-it:free` bị nhà cung cấp trả 429 vì quá tải — lỗi không bị tính lượt). Nemotron là model suy luận, cần `LLM_REASONING_TOKENS`.

**Kết quả** (đã sắp theo điểm):

| Bài | Nhãn | Điểm |
|---|---|---|
| Meituan 1.6T agent model không dùng GPU Nvidia | chọn | 76 |
| US siết xuất khẩu chip AI | chọn | 75 |
| Qwen4-Max cạnh tranh Opus 5.5 / GPT-6 giá rẻ hơn | chọn | 71 |
| llama.cpp v1.0.0 | chọn | 67 |
| Introducing ChatGPT Wallet | chọn | 63 |
| Google Maps tạo lịch trình du lịch | chọn | 58 |
| Prompt caching trên Amazon Bedrock (hướng dẫn riêng AWS) | loại | 57 |
| LVMH hợp tác OpenAI | loại | 41 |
| datasette-maplibre 0.1a0 | loại | 40 |
| AI Day Seoul | loại | 36 |
| King's Trust + OpenAI £1m | loại | 34 |
| Jensen Huang từ chức (Latent Space) | chọn | lỗi: hết token suy luận |

- **Lọc sơ bộ:** 11/11 PASS — đúng (tất cả đều liên quan AI).
- **Xếp hạng: hoàn hảo** — mọi bài "chọn" (≥ 58) đều điểm cao hơn mọi bài "loại" (≤ 57).
- **Ngưỡng:** script dùng ngưỡng mặc định của AIHOT (T2 = 76, rất khắt khe cho trang tin tiếng Trung) nên chỉ chọn 1 bài → báo cáo accuracy 0.545. Với ngưỡng **60**: đúng 10/11 (precision 100%, recall 83%); ngưỡng **58**: đúng 11/11. → Ngưỡng phải chỉnh lại cho kênh video; nên chỉnh trên bộ mẫu lớn hơn (100–200 bài).
- **1 lỗi:** bài dài (Latent Space, 36k ký tự) làm model suy luận hết `LLM_REASONING_TOKENS=4000` → tăng lên ~8000 hoặc dùng model không suy luận.
- **Chi phí:** 0 đ (model miễn phí); ~94k token vào, ~70k token ra; trung bình 17,5 giây/lượt; 33/50 lượt miễn phí trong ngày.

**Lưu ý:** mẫu 12 bài chỉ chứng minh hướng đi được, chưa đủ để chốt ngưỡng. Nhãn do mình gán — bạn nên gán lại theo khẩu vị kênh.

## (3) Gom sự kiện — lần 1 (không có embedding)

**Cách làm:** giữ 50 bài (34 bài mới + 16 bài thuộc các cặp cùng sự kiện), tạm bỏ qua 129 bài (`eval/aihot/.data/skipped-for-eval.txt`), tắt thu tin, bật model cho worker. Model: `nvidia/nemotron-3.5-super-vl` **bản trả phí** (bản `:free` bị giới hạn 20 lượt/phút với mọi tài khoản, kể cả đã nạp $10 — đã kiểm tra trong tài liệu OpenRouter). Phần lớn bài chạy bằng prompt tiếng Trung (prompt tiếng Anh của Gemini được nạp khi đã xử lý 48/50 bài). Chưa cấu hình embedding → AIHOT tìm ứng viên bằng độ trùng chữ.

**Kết quả:** 49 bài được xử lý (1 bị lọc sơ bộ chặn), tạo 36 sự kiện.

| Cụm dự kiến | Kết quả |
|---|---|
| Google Maps lập lịch trình (TC + Verge) | ✅ gom đúng |
| Audible gợi ý sách bằng AI (TC + Verge) | ✅ gom đúng |
| OpenAI công cụ chống CSAM (OpenAI + TC + Verge) | ⚠️ gom 2/3, bài Verge tách riêng |
| California kiện OpenAI (Verge + TC) | ❌ tách 2 sự kiện |
| Apple nghiên cứu AI sức khỏe (TC + Verge) | ❌ tách 2 sự kiện |
| Mỹ chặn truy cập chip AI từ xa (Ars + TC) | ❌ tách 2 sự kiện |
| GPT-6 và bài toán lattice (OpenAI + Decoder) | ❌ tách; bài OpenAI lại bị gộp với "Our new blog for science" (gộp sai) |
| Jensen Huang (~14 bài) | ⚠️ một sự kiện lớn 6 bài (Trump bình luận, kiến nghị, an ninh, tổng quan) + nhiều sự kiện con riêng; chấp nhận được với chuỗi tin dồn dập |

**Nguyên nhân:** xem bảng `grouping_decisions` — với các bài bị tách, **sự kiện đúng không có trong danh sách ứng viên** (ứng viên chỉ là các sự kiện không liên quan, model đều đánh giá đúng là `UNRELATED` với độ tin 0,9–1,0). Tức là **bước tìm ứng viên bằng trùng chữ bỏ sót**, còn model phán đoán đúng. Tài liệu AIHOT cũng ghi: không có embedding thì gom sự kiện yếu hơn. Bảng `embeddings` đang có 0 dòng.

**Bước tiếp:** cấu hình embedding `openai/text-embedding-3-small` qua OpenRouter (giá $0,02/triệu token, gần như miễn phí), rồi gom lại 49 bài.

**Chi phí đến giờ:** $0,34 (toàn bộ lần chạy trả phí).

## (3) Gom sự kiện — lần 2 và 3 (có embedding)

**Embedding:** dùng **Ollama chạy trên máy**, model `nomic-embed-text` (miễn phí, không cần key, dữ liệu không ra ngoài). `.env`: `EMBEDDING_BASE_URL=http://127.0.0.1:11434/v1`, `EMBEDDING_MODEL=nomic-embed-text`, `EMBEDDING_API_KEY=ollama-local` (Ollama không kiểm tra key, nhưng AIHOT bắt buộc phải có).

**Lần 2** (chỉ thêm embedding): 33 sự kiện. California và OpenAI CSAM đã gom đúng, nhưng Apple, chip Mỹ và GPT-6 vẫn bị tách. Nguyên nhân: **chỉ 16/48 bài có bản phân tích tiếng Anh sạch**. 20 bài được phân tích bằng prompt tiếng Trung cũ (trước khi dịch). 12 bài phân tích đúng lúc prompt bị Gemini cắt, nên ra tiêu đề rác kiểu "you haven't included the article". `nomic-embed-text` chỉ hiểu tiếng Anh nên so sánh sai.

**Lần 3** (phân tích lại cả 48 bài bằng prompt tiếng Anh hiện tại, rồi gom lại): 48/48 bản phân tích tiếng Anh, ra 33 sự kiện.

| Cụm dự kiến | Lần 1 | Lần 3 |
|---|---|---|
| Google Maps lập lịch trình | ✅ | ✅ |
| Audible gợi ý sách bằng AI | ✅ | ✅ |
| OpenAI chống CSAM (3 bài) | ⚠️ 2/3 | ✅ 3/3 |
| California kiện OpenAI | ❌ | ✅ |
| Apple nghiên cứu AI sức khỏe | ❌ | ✅ |
| Mỹ chặn truy cập chip AI từ xa | ❌ | ✅ |
| GPT-6 và bài toán lattice | ❌ (gộp nhầm) | ✅ ("blog khoa học" đã được tách riêng) |
| Jensen Huang | ⚠️ 6 bài + nhiều sự kiện con | ✅ 1 sự kiện 8 bài; vài bài góc nhìn riêng tách ra, chấp nhận được |
| Thêm: OpenAI cho nhà khoa học (2 bài) | — | ✅ |

Lỗi còn lại: bài "The open-source movement wants Jensen Huang back" bị gắn vào cả sự kiện Jensen lẫn sự kiện chip Mỹ.

**Bài học khi fork:**
- Embedding là **bắt buộc**, không phải tùy chọn.
- Mỗi lần đổi prompt phân tích phải **phân tích lại** những bài cũ. Nếu không, dữ liệu lẫn ngôn ngữ và lẫn phiên bản prompt sẽ làm hỏng bước gom.
- Bản sao lưu DB trước khi gom lại: `/tmp/aihot-logs/pipelinex_eval-before-regroup.dump`.

## Thử model local 9B (Unsloth/llama.cpp)

Model: `DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic` Q4_K_M (5,2 GB). Chạy bằng `llama-server` của Unsloth, cổng 8088, Metal, ngữ cảnh 16k. Tốc độ sinh khoảng 16 token/giây. Test trên cùng 12 bài mẫu, chạy từng bài một (chạy song song 6 bài thì 11/12 bài bị quá giờ chờ 120 giây).

| | nemotron 3.5 super (OpenRouter, trả phí) | 9B local |
|---|---|---|
| Điểm bài "loại" | 34–57 | 24–31 |
| Điểm bài "chọn" | 58–76 | 55–95, riêng Google Maps chỉ được **24** |
| Đúng nếu chọn ngưỡng tốt nhất | 10–11/11 | 10/11 (ngưỡng ~40) |
| Lỗi | 0 | 1/12 quá giờ chờ |
| Thời gian | vài giây/lượt gọi | **~52 giây/lượt gọi**, 30 phút cho 12 bài |
| Chi phí | ~$0,002/bài | $0 (tiền điện) |

**Kết luận:** chất lượng chấm điểm của 9B **gần ngang** nemotron, nhưng **quá chậm** cho toàn bộ pipeline. Mỗi bài cần 4–6 lượt gọi, tức khoảng 4–5 phút/bài, nên vài trăm bài mỗi ngày sẽ không chạy kịp. VPS không có GPU còn chậm hơn nữa. **Giữ nemotron** cho bước ①. Có thể dùng 9B cho việc ít lượt gọi, chạy offline hoặc làm phương án dự phòng khi OpenRouter lỗi.

## Prompt tiếng Anh (Gemini dịch)

Bạn đã dùng Gemini dịch cả 31 prompt sang tiếng Anh. Kiểm tra tự động (so placeholder `{{...}}`, `{{> ...}}` và nhãn `title_zh:`/`summary_zh:`/`body_zh:` với bản gốc) phát hiện Gemini **cắt mất phần cuối** của `summarize-article`, `summarize-long-post`, `summarize-short-post` — đúng phần chèn nội dung bài và nhãn output. Đã bổ sung lại; cả 31 file hiện khớp. Khi dịch tiếp phải giữ nguyên placeholder, nhãn và không cắt phần cuối.

Bước dịch toàn văn sang tiếng Trung đã tắt bằng `TRANSLATE_ENABLED=false` (sửa 1 dòng lõi, ghi trong `eval/aihot/FORK_CHANGES.md`).

## Phát hiện về chuyển sang tiếng Anh (quan trọng)

Tiếng Trung không chỉ nằm ở prompt:

| Chỗ | Số dòng có chữ Trung | Mức độ |
|---|---|---|
| `industry/prompts/` (31 file) | 310 | Phải viết lại — đã dự kiến |
| `industry/` khác (taxonomy, wording…) | ~200 | Phải viết lại |
| `site/` | 230 | Phải viết lại (tên, văn bản) |
| Giao diện admin (`apps/web/app/routes/admin`) | 524 | **Giao diện admin toàn tiếng Trung** — cần dịch nếu bạn muốn dùng tiếng Anh/Việt |
| Toàn bộ web (`apps/web/app`) | 1.363 | Phần lớn là trang công khai — có thể tắt |
| Backend (`packages/backend/src`) | 581 | Nhãn lỗi, cảnh báo, báo cáo |

Trong **code lõi**:
- Tên cột/biến mang hậu tố `_zh` (`title_zh`, `summary_zh`, `translations.lang = 'zh'`): chỉ là tên, vẫn chứa được tiếng Anh nếu prompt yêu cầu viết tiếng Anh.
- Có **bước dịch sang tiếng Trung** cho bài viết không phải tiếng Trung, **không có công tắc tắt**. Với site tiếng Anh, bước này sẽ dịch mọi bài sang tiếng Trung → tốn tiền vô ích. **Cần sửa lõi**: bỏ qua bước dịch khi site tiếng Anh (thay đổi nhỏ, ghi vào `FORK_CHANGES.md`).
- Một vài chỗ dự phòng chỉ giữ tiêu đề gốc nếu là tiếng Trung (`looksZh(title) ? title : ""`) → cần sửa để giữ tiêu đề tiếng Anh.
- Giờ được quy đổi theo giờ Bắc Kinh (`contracts/time.ts`) cho bản tin ngày/tuần — cần đổi múi giờ nếu dùng.

**Đánh giá:** khối lượng chuyển sang tiếng Anh **lớn hơn dự kiến** (không chỉ 31 prompt), nhưng vẫn khả thi: phần bắt buộc là prompt + `industry/` + `site/` + vài điểm sửa lõi về dịch; giao diện admin có thể để tiếng Trung lúc đầu hoặc dịch dần.

## Kết luận: NÊN FORK AIHOT

Cả 4 tiêu chí đều đạt. Phần lấy tin, chấm điểm, gom sự kiện và tính độ nóng của AIHOT dùng được cho bước ①. Module `video` gắn vào mà không phải sửa lõi.

Những việc bắt buộc khi fork:
1. Bật embedding (Ollama `nomic-embed-text` chạy trên máy/VPS).
2. Hạ ngưỡng chọn bài (T2 76 → ~58–60) và hiệu chỉnh lại khi có bộ bài mẫu lớn hơn.
3. Chuyển sang tiếng Anh: prompt, `industry/`, `site/`, tắt bước dịch sang tiếng Trung. Giao diện admin dịch dần.
4. Mỗi lần đổi prompt phân tích thì phân tích lại các bài cũ.

## Việc còn lại

- [x] (2) Prompt tiếng Anh + chấm điểm 12 bài.
- [x] (3) Gom sự kiện với embedding: 8/8 cụm đúng.
- [x] Thử model 9B local.
- [ ] Trả 129 bài tạm bỏ qua (`.data/skipped-for-eval.txt`) về trạng thái `new`, bật `COLLECT_ENABLED=true`, chạy vài giờ để xem các nguồn chưa lấy được nội dung.
- [ ] Xóa API key OpenRouter đã dán trong chat, tạo key mới cho dự án.
- [ ] Bắt đầu Phase 1 của PLAN.md (fork chính thức).
