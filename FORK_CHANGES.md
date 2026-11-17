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
