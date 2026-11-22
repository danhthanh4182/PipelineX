# SPEC — Gói công việc ngày 23/11/2026 (tiếp nối đêm 22→23/11)

- **Trạng thái:** chờ Thanh duyệt cùng gói bàn giao. **Cập nhật 02:15, 23/11/2026:** W1 đã hoàn thành (kết quả ghi ngay trong mục W1); phát sinh W1b; toàn bộ thay đổi đêm 22→23/11 đã commit (chưa push) — chi tiết ở biên bản §1/§3.
- **Phạm vi:** các việc còn mở sau lượt PipelineX 8 chặng + design system v3.1 + ASR 578. Mỗi hạng mục có tiêu chí nghiệm thu đo được; hạng mục phụ thuộc quyết định của Thanh ghi rõ điều kiện bắt đầu.
- **Ngoài phạm vi:** triển khai module Nhật ký thao tác (chỉ khi speckit `001-operation-log` được duyệt — spec riêng đã có trong checkout); đăng bất kỳ nội dung nào ra ngoài; thay đổi cấu hình giọng/chain; mở lại các tuyến video/audio đã đóng ngày 22/11.

---

## W1 — Căn chỉnh fix layout shift cho design system (toàn bộ bề mặt) — ✅ HOÀN THÀNH (02:15, 23/11)

**Mục tiêu:** mọi bản dựng của design system chống dịch chuyển bố cục theo cùng một kỹ thuật giữ-chỗ; quy tắc được ghi vào spec MD.

**Yêu cầu:**
- FR-W1-01: Bản dựng file chuẩn áp kỹ thuật của bản xuất Space mới ở 7 điểm: aspect-ratio giữ chỗ cho ảnh lockup topbar (3252/480) và ảnh brand-stage (6504/960); hàng nghe thử `flex-wrap: nowrap` + `min-height: 48px`; nút nghe thử bề rộng cố định 160px + `white-space: nowrap`; dòng trạng thái khóa `height: 35px`, `font-weight` không đổi giữa hai trạng thái, `overflow: hidden`; sóng (eq) luôn chiếm sẵn 22px, ẩn/hiện bằng `visibility`/`opacity`, animation chỉ chạy khi đang phát; chữ trạng thái dùng dạng rút gọn ("Đang phát · giọng X…" / "Câu mẫu · giọng X").
- FR-W1-02: MD §8 bổ sung quy tắc chống layout shift (nội dung theo ADR-002): phần tử thay đổi trạng thái phải giữ nguyên kích thước hộp; ảnh phải có aspect-ratio/ kích thước giữ chỗ; ẩn/hiện bằng visibility, không dùng display cho phần tử nằm trong luồng bố cục có thể gây dịch chuyển.
- FR-W1-03: Sau căn chỉnh, đồng bộ bản mới vào `docs\` của project PipelineX và vào Space Design System; giữ một bản ghi chuẩn duy nhất.

**Tiêu chí thành công:**
- SC-W1-01: Đối chiếu CSS: cả hai bản dựng đều có đủ 7 điểm giữ-chỗ (grep theo từng thuộc tính, có output kèm theo).
- SC-W1-02: Bấm nghe thử/dừng trên bản dựng file: chiều cao thẻ engine không đổi giữa hai trạng thái (đo bằng ảnh chụp trước/sau hoặc đo offsetHeight trong trình duyệt).
- SC-W1-03: MD §8 có mục quy tắc chống layout shift; docs\ trong project khớp md5 với bản chuẩn sau đồng bộ.

**Kết quả (02:15):** ĐÃ XONG ở cả hai bản dựng — Space Design System build v3.2 (kiểm chứng: §5 + Phụ lục C khớp MD từng byte; bộ quy tắc giữ-chỗ nguyên vẹn) và bản dựng file HTML v3.2 (tuyến Studio cập nhật 02:00; marker: hết cấu trúc "Chuỗi dự phòng", có Nghe thử + nhãn v3.2, aspect-ratio lockup). FR-W1-02: §8 MD kiểm tra lại **đã có sẵn** quy tắc chống layout shift từ trước — không cần bổ sung. SC-W1-03 đạt một phần: docs\ MD khớp bản chuẩn v3.2; docs\ HTML còn là bản v3.1 → tách thành W1b.

## W1b — Đồng bộ HTML design system v3.2 vào docs\ PipelineX — ✅ HOÀN THÀNH (02:17, 23/11)

Đã xong: chuyển bằng `scp -O` (giao thức legacy — SFTP mặc định bị đóng kết nối), file trong docs\ = 1.704.455 B, md5 `7678bbf59f0bcaa362d3e9e0032f9eed` khớp bản chuẩn; commit bổ sung `106f2ad`. Mục dưới đây giữ lại làm hồ sơ.

- **Nguyên nhân:** scp sang THANH-PC lỗi đóng kết nối (2 lần, 02:00–02:02); SSH lệnh vẫn thông bình thường. MD v3.2 đã vào docs\ thành công trước đó.
- **Việc:** chuyển bản chuẩn `design-system-diem-tin-cong-nghe-v3.html` (v3.2, 1.704.455 B) vào `D:\channels\diem-tin-cong-nghe\docs\` bằng đường khác (ví dụ truyền qua SSH theo đoạn/base64 rồi ghép lại), kiểm chứng dung lượng + md5 trên máy Thanh, commit bổ sung vào checkout kênh.
- **Tiêu chí xong:** file trong docs\ khớp md5 với bản chuẩn; `git status` sạch ở docs/.

## W2 — ASR 578 mục: các chunk còn lại

**Mục tiêu:** hoàn tất kiểm chứng tầng relay cho toàn bộ 578 mục mà không gây rủi ro RAM cho máy ảo.

**Yêu cầu:**
- FR-W2-01: Chạy tiếp chunk 2–6 (100, 100, 100, 100, 68) theo đúng khung pilot: câu mang chuẩn, hai giọng relay Hoài My + Nam Minh, faster-whisper large-v3 int8, ngưỡng đạt partial_ratio ≥ 90 hoặc chứa nguyên văn.
- FR-W2-02: Mỗi chunk: ghi ngược DB theo mẻ 50 (chỉ các cột asr_status, note, updated_at; chỉ ID trong snapshot), cập nhật `progress.json` sau mỗi mẻ, viết results-chunk-N.json, xong chunk thì **tắt hẳn Whisper** và báo Thanh; Thanh gật mới chạy chunk tiếp.
- FR-W2-03: Guard RAM: RAM khả dụng < ~400 MB kéo dài hoặc có OOM → dừng ở biên mẻ gần nhất, giữ nguyên kết quả đã ghi, báo ngay.
- FR-W2-04: Không đổi term/reading/enabled của bất kỳ mục nào. Mục lệch chỉ ghi trạng thái + ghi chú.
- **Tiến độ tại 02:15:** pilot xong; chunk 1 đang chạy — tổng 97/578 (đạt 78, lệch 19, lỗi 0), mẻ ghi 3. Nguồn sự thật: `~/workspace/video-studio/asr-578/progress.json`.

**Tiêu chí thành công:**
- SC-W2-01: Tổng cuối: passed + failed + errors = 578, đối chiếu trực tiếp trong DB khớp với tổng hợp từ các results-chunk.
- SC-W2-02: Sau mỗi chunk, không còn tiến trình Whisper nào chạy (kiểm chứng bằng ps).
- SC-W2-03: Danh sách mục lệch cuối cùng được tổng hợp riêng (term, reading, giọng lệch, tỉ lệ) để Thanh quyết định sửa cách đọc hay giữ nguyên.

## W3 — Kiểm chứng 4 endpoint HTTP của từ điển bằng phiên thật

**Mục tiêu:** đóng nợ evidence của tính năng nhập/xuất từ điển ở tầng HTTP.

**Yêu cầu:**
- FR-W3-01: Một lượt duy nhất qua API native 3011 với phiên đăng nhập thật, sau khi cửa sổ rate-limit (10 lần/IP/15 phút) đã xả hẳn: import preview (file test nhỏ tự tạo), import apply, asr-queue, locked — mỗi endpoint đúng một lần gọi kiểm chứng.
- FR-W3-02: Dữ liệu test tự tạo phải được xóa ngay sau kiểm chứng và xác nhận đã xóa; không đụng 578 mục thật ngoài thao tác queue/locked trên chính mục test.
- FR-W3-03: Không thử lại nhiều lần khi bị 429; bị chặn thì ghi nhận và dừng, báo Thanh.

**Tiêu chí thành công:**
- SC-W3-01: Mỗi endpoint có mã đáp + thân đáp lưu trong báo cáo; preview/apply khớp số đếm kỳ vọng của file test; trạng thái DB sau dọn dẹp trở về đúng 578 mục như trước lượt kiểm chứng.

## W4 — Việc chờ quyết định của Thanh (điều kiện bắt đầu, không tự chạy)

| Hạng mục | Điều kiện bắt đầu | Việc sau khi có điều kiện |
|---|---|---|
| Module Nhật ký thao tác | Thanh duyệt speckit `specs/001-operation-log/` (đã commit ở `1be0f21`) | Triển khai theo tasks T001–T012 trong spec đó |
| Triển khai Nghe thử thật vào trang `/admin/voice` | Thanh ra lệnh riêng (đã chốt tài liệu-trước lúc 01:56, 23/11) | Theo module mẫu DS v3.2: nút Nghe thử từng thẻ phát thật theo engine; engine chưa có đường phát thật thì vô hiệu + ghi chú trung thực, cấm tiếng giả; checkpoint recon sẵn tại `~/workspace/video-studio/voice-preview/` |
| Security headers (3010/3011) | Thanh chốt áp dụng (hoặc khi có kế hoạch công khai hóa) | Thêm CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy; kiểm chứng không vỡ SSR/admin |
| ~~i18n videos.tsx~~ | Đã gộp vào W6 theo lệnh Thanh 01:49 | Xem `KE-HOACH-I18N-TOAN-APP.md`, giai đoạn P3 |
| Cổng gói bản tin (BT-334) | Thanh chốt 5 điểm ở chat Bản Tin | Xử lý theo quyết định; không tự gỡ cổng |
| Cài lại unit voice-demo-poller | Thanh đồng ý | Cài file từ bản đăng ký bền; giữ nguyên hold; không bật dịch vụ |
| Hình học Orson → ShortVideo | Thanh đồng ý | Tích hợp hình học TikTok-Orson/Shorts-Orson vào composition; render still kiểm chứng |

## W5 — Việc nền theo lịch (không đổi)

- 06:30 — refresh Bản Tin Sáng (cron sẵn có).
- ~08:00 — nhắc rà soát admin workspace ChatGPT (hạn 24/11).
- 09:00 — kiểm tra thread hỗ trợ (Oracle/Vietcombank chạm ngưỡng quá hạn 24/11; AMD/Fireworks — nháp nhắc chờ duyệt, không tự gửi).
- Guardian 5 phút + doctor hourly: giữ nguyên; chỉ báo khi có crit mới hoặc phục hồi thật.
- Quan sát viên 30 phút: báo tiến độ các việc đang chạy theo mốc.

---

## W6 — Dịch toàn bộ app bằng i18n (lệnh Thanh 01:49, 23/11)

**Mục tiêu:** mọi trang của app (admin engine + module video + bề mặt công khai) hiển thị đúng locale vi/en, không còn trang hardcode.

**Cơ sở:** recon 01:52 ngày 23/11 — 99 file .tsx: chỉ 3 file dùng i18n (lexicon/voice/journal); 36/36 route và 16/16 route admin của engine có 0 khóa; models.tsx và videos.tsx hardcode toàn bộ. Chi tiết + lộ trình P0–P5 + tiêu chí nghiệm thu SC-I18N-01..05 nằm trong tài liệu riêng: **`KE-HOACH-I18N-TOAN-APP.md`** (cùng gói này) — tài liệu đó là spec điều hành của hạng mục này.

**Điều kiện nghiệm thu tóm tắt:** bảng kiểm kê phủ 100% file; parity vi/en 100% sau mỗi giai đoạn; mỗi trang admin có ảnh kiểm chứng ở cả hai locale, không khóa thô, không chuỗi giao diện hardcode ngoài danh sách ngoại lệ đã liệt kê.

*Spec này không tự kích hoạt hạng mục nào ở W4. Hạng mục W1–W3 là việc đã được Thanh giao từ đêm 22→23/11 và còn dở dang.*
