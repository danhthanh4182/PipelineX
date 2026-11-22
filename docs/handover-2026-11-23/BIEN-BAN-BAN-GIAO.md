# BIÊN BẢN BÀN GIAO — Đêm 22→23/11/2026, cho ngày làm việc 23/11/2026

- **Thời điểm lập:** 01:50, 23/11/2026 (Asia/Ho_Chi_Minh)
- **Bên bàn giao:** Muse (chat chính) + các tuyến agent đêm 22–23/11
- **Bên nhận:** Thanh + phiên làm việc ngày 23/11/2026
- **Nguyên tắc áp dụng:** ADR-001 — việc chỉ coi là xong khi có log + evidence truy được. Mục ghi "chưa kiểm chứng" là chưa xong ở tầng đó.
- **Gói tài liệu đi kèm:** `SPEC.md`, `PLAN.md`, `adr/ADR-001..004` trong cùng thư mục này.
- **Cập nhật lần cuối:** 02:15, 23/11/2026 — các mục thay đổi sau thời điểm lập được đánh dấu "(cập nhật 02:15)".

---

## 1. PipelineX (technews, THANH-PC) — lượt 8 chặng: HOÀN THÀNH + đã kiểm chứng trong Chrome của Thanh

| Chặng | Kết quả | Evidence |
|---|---|---|
| 1. i18n | Quét 133 file; vi.json + en.json đủ 135 khóa, thiếu 0, bổ sung 0. Nhãn thô `voice.*` tối 22/11 là dư âm phiên cũ từ cửa sổ sự cố API_BASE_URL, không phải thiếu khóa | `~/workspace/video-studio/i18n-audit/i18n-report.md` |
| 1.5. Từ điển cuộn | Vùng cuộn riêng ~70vh + header cột cố định ngoài vùng cuộn; đã thử cuộn thật trong Chrome — header đứng yên | `i18n-audit/PROGRESS.md`; kiểm chứng Chrome 01:23–01:30 |
| 2. Smoke test | 8/8 route công khai 200; 13/13 route admin chưa đăng nhập → 302 về login; API đúng kỳ vọng | `smoke-report.md` |
| 3. Pentest localhost | **Không có lỗ hổng nghiêm trọng.** 58/58 route admin không phiên → 401; CSRF, rate-limit đăng nhập, chống open-redirect, chống SSRF qua img-proxy đều đạt. Phát hiện duy nhất mức THẤP: thiếu security headers (CSP, X-Frame-Options, nosniff) — chưa sửa, chờ quyết định (xem §6) | `pentest-report.md` |
| 4. Audit chức năng | Bảng đầy đủ 3 trang module video + 10 trang engine + bề mặt công khai; lỗi chức năng thật duy nhất = panel Voice | `audit-report.md` |
| 5. Đồng bộ màu DS v3 | Badge/trạng thái của lexicon.tsx đã về bộ ba token trạng thái v3 §1; màu lõi đã khớp token; màu chưa có token được liệt kê và giữ nguyên | `color-sync-report.md` |
| 6. Panel Voice | **Đính chính gốc lỗi:** dropdown trống trong ảnh 00:49 là dư âm sự cố API_BASE_URL (phiên trình duyệt cũ), logic vốn đúng. Đã sửa 2 lỗi đồng bộ thật: (1) tắt engine trong chuỗi → Lưu trả 409 mà UI im lặng; (2) sau Lưu, UI không nhận lại config từ server. Panel làm lại theo mẫu Studio/v3: một danh sách thẻ ưu tiên (kéo-thả + ↑/↓), Thêm vào chuỗi ngay trên thẻ, tắt engine tự rời chuỗi, chip "Tuyến Relay riêng". NVIDIA vẫn NGOÀI chuỗi (đang bật), VieNeu vẫn "Hải Đăng" — đúng lệnh Thanh. Đã kiểm chứng hiển thị trong Chrome; **không** bấm thử Thêm+Lưu NVIDIA vì sẽ đổi cấu hình thật | `voice-panel-report.md`; kiểm chứng Chrome 01:23–01:30 |
| 7+8. Nhật ký + SpecKit | Mục giữ chỗ "Nhật ký" ở sidebar Production (vị trí TẠM) + trang `/admin/journal` trung thực (chip "Chờ module", không dữ liệu giả, có lối sang Audit Log). Bộ SpecKit đã nằm trong checkout (chưa commit): `specs/001-operation-log/` + `docs/adr/0001–0004` — **chờ Thanh duyệt spec**. Recon: engine đã có `audit_log` (`/admin/audit`) nhưng module video chỉ ghi 4 hành động YouTube; từ điển/giọng/video ngoài YouTube/đăng nhập admin chưa ghi ở đâu | `journal-report.md`; kiểm chứng Chrome 01:23–01:30 |

**Không commit git ở bất kỳ chặng nào trong lượt 8 chặng.** (cập nhật 02:15) Theo lệnh Thanh, toàn bộ thay đổi của đêm đã commit lúc 02:09: checkout kênh `7fa39c5` (module video), `a602bb7` (renderer + font + brand), `1be0f21` (docs design system + speckit + ADR trong repo); checkout gốc `87750b7` (renderer dùng chung + .dockerignore). **Chưa push.** Cố ý không commit: `.fontfix-backup-20261122/`, `.fonttest/`, `docker-compose.override.yml` — giữ dạng untracked trên đĩa.

## 2. Sự cố vận hành trong đêm

| Sự cố | Xử lý | Trạng thái |
|---|---|---|
| Web PipelineX (3010) crash ~01:16 — tiến trình khởi động từ phiên SSH chết theo phiên (Chặng 7) | Khôi phục qua launcher chuẩn `.data\launch-web.cmd` (WMI); kiểm chứng tầng render: trang chủ 200, SSR đầy đủ, 0 "ssr api request failed". API 3011 + worker không rớt. Đã cấm mọi khởi động lại ngoài launcher chuẩn (xem ADR-003) | ĐÃ ĐÓNG |
| RAM máy ảo crit 886 MB lúc 01:20 (rơi từ 1.805 MB trong ~10 phút), swap 446 MB, 0 OOM | Nguyên nhân: lượt ASR nạp model Whisper. Đã báo Thanh; không tự can thiệp | Đang theo dõi qua doctor/guardian |
| Sự cố admin tối 22/11 (API_BASE_URL) | Đã đóng hẳn từ 00:45 với 3 lớp chống tái diễn; bản ghi đã gửi chat Studio | ĐÃ ĐÓNG |

## 3. Design system Điểm Tin Công Nghệ — v3.2, hợp nhất Voice HOÀN TẤT ở lớp tài liệu (cập nhật 02:15)

- **Bản ghi chuẩn duy nhất:** `~/workspace/video-studio/design-system-v2/design-system-diem-tin-cong-nghe-v3.md` bản **v3.2** (29.179 B) + bản dựng file `.html` v3.2 (1.704.455 B). MD là bản phân xử khi các bản dựng lệch nhau (ADR-001 trong gói này).
- **Hợp nhất Voice (Thanh chốt 01:55, xác nhận qua thẻ 01:58):** module Giọng đọc theo khung trang thật (một danh sách thẻ ưu tiên) + bổ sung Nghe thử từng thẻ từ design. Đã áp vào cả ba bề mặt tài liệu: MD chuẩn v3.2; bản dựng file HTML v3.2 (tuyến Studio cập nhật 02:00, marker kiểm chứng đạt); Space Design System (build v3.2 — builder kiểm chứng §5 + Phụ lục C khớp MD từng byte, cấu trúc cũ biến mất, quy tắc giữ-chỗ nguyên vẹn).
- **Layout shift (việc W1 cũ): ĐÃ XONG.** Đính chính so với ghi nhận 01:50: §8 của MD kiểm tra lại thì **đã có sẵn** quy tắc chống layout shift + quy tắc công tắc/nút bấm từ trước — không phải bổ sung mới; cả hai bản dựng đều đã theo cùng chuẩn giữ-chỗ (ADR-002 trong gói này).
- **Bản HTML tương tác độc lập (Thanh lệnh 02:04):** `~/workspace/your_files/design-system-diem-tin-cong-nghe-tuong-tac.html` (3.439.413 B, md5 70c05bec). Kiểm kê toàn bộ điều khiển: gần như mọi thứ vốn chạy sẵn khi mở file độc lập; sửa đúng 1 hạng mục — Nghe thử vốn là **mô phỏng bằng timer**, đã thay bằng phát thật qua speechSynthesis của trình duyệt + ghi chú trung thực khi thiếu giọng Việt (nguyên tắc ở ADR-004 trong gói này). Kiểm chứng cú pháp + logic chọn giọng đạt; **tiếng thật trên máy Thanh chưa kiểm chứng** — cần Thanh bấm thử.
- **Code trang thật `/admin/voice`: CHƯA triển khai** nút Nghe thử — Thanh chốt "tài liệu trước, chưa làm" (01:56); chờ lệnh riêng (SPEC W4). Checkpoint recon còn tại `~/workspace/video-studio/voice-preview/`.
- **Đồng bộ docs\:** MD đã là v3.2 (kiểm chứng 29.179 B trên máy Thanh). HTML trong docs ban đầu vẫn là bản dựng v3.1 vì scp (SFTP) lỗi đóng kết nối; (cập nhật 02:17) **đã đồng bộ xong** bằng `scp -O` — 1.704.455 B, md5 khớp bản chuẩn, commit bổ sung `106f2ad` (SPEC W1b đóng).

## 4. ASR kiểm chứng 578 mục từ điển (tầng relay) — ĐANG CHẠY THEO CHUNK

- Pilot 10 mục: 8 đạt, 2 lệch (API — Whisper tự chuẩn hoá về dạng viết tắt; array — lệch thật ở giọng Nam Minh). Đã ghi ngược DB, đối chiếu khớp.
- Tốc độ đo thật ~41 giây/mục → Thanh chốt chạy theo chunk 100 mục, mỗi chunk xong báo lại, Thanh gật mới chạy tiếp.
- **Chunk 1 (100 mục) đang chạy** tại thời điểm bàn giao. (cập nhật 02:15) progress.json lúc 02:12: **97/578 mục đã xử lý — đạt 78, lệch 19, lỗi 0**, đang ở mẻ ghi 3; chunk 1 sắp xong (87/100 mục của chunk). Checkpoint: `~/workspace/video-studio/asr-578/` (progress.json, results theo mẻ).
- Còn lại sau chunk 1: ~468 mục = 4 chunk × 100 + 1 chunk 68.
- Quy tắc đứng: Whisper chỉ chạy on-demand; xong mỗi chunk phải tắt hẳn; guard RAM — khả dụng < ~400 MB kéo dài hoặc OOM thì dừng ở biên mẻ.

## 5. Các tuyến khác (trạng thái theo sổ việc tại thời điểm bàn giao)

- **Bản Tin Sáng:** ấn bản 22/11 đã phát hành 16/16. **Cổng gói đang chặn mọi phát hành web tiếp theo** vì BT-334 giữ pháp lý — 5 điểm chờ Thanh chốt (đã trình ở chat Bản Tin). Hàng chờ duyệt HOT: 2 bài. Lượt MXH 20:00 ngày 22/11 FAILED (lỗi pool DB phía Space) — bài vẫn trong hàng chờ.
- **Studio:** VD-002 đã đăng ký, chờ Thanh duyệt. Hai vòng ASR phía Studio vẫn dừng theo lệnh đóng tuyến 22/11 (lượt ASR đang chạy là phía PipelineX).
- **Hạ tầng tự phục hồi:** guardian 5 phút + doctor hourly chạy đều. File unit `voice-demo-poller.service` trên VM đã mất sau lần thay VM ~00:50 (bản đăng ký bền còn nguyên; dịch vụ đang held nên không ảnh hưởng) — đề xuất cài lại file (không bật dịch vụ) đã gửi Thanh 00:51, **chưa trả lời**.
- **Việc hành chính có hạn:** rà soát admin workspace ChatGPT — hạn 24/11, cron nhắc 08:00 ngày 23/11. Oracle/Vietcombank (SGD 138,19) — chạm ngưỡng quá hạn 24/11 nếu Vietcombank vẫn im lặng; kiểm tra thread hỗ trợ 09:00 hằng ngày. Nháp nhắc AMD/Fireworks vẫn chờ Thanh duyệt gửi.

## 6. Quyết định chờ Thanh (không tự quyết thay)

1. **Duyệt bộ speckit `specs/001-operation-log/`** (module Nhật ký thao tác) — duyệt mới triển khai. (cập nhật 02:15: spec + ADR trong repo đã commit ở `1be0f21`; việc duyệt vẫn chờ.)
2. **Security headers** cho web 3010 + API 3011 — chỉ bắt buộc khi công khai hóa; hiện bind 127.0.0.1.
3. ~~**i18n-hóa videos.tsx** (backlog từ Chặng 1)~~ — 01:49 Thanh nâng thành **kế hoạch dịch toàn bộ app** (xem `KE-HOACH-I18N-TOAN-APP.md`): recon cho thấy 36/36 route và 16/16 route admin của engine chưa nối i18n, models.tsx + videos.tsx hardcode toàn bộ. Không còn là quyết định chờ — đã có kế hoạch, chờ xếp lịch triển khai theo PLAN.
4. **5 điểm của cổng gói bản tin** (BT-334) — ở chat Bản Tin.
5. **Cài lại file unit voice-demo-poller** trên VM (chỉ khôi phục file, giữ hold).
6. **Tích hợp hình học Orson vào composition ShortVideo** (đã hỏi 00:32, chưa trả lời).
7. Vị trí chính thức của mục "Nhật ký" trong sidebar (hiện để tạm ở Production).

## 7. Chưa kiểm chứng (nợ evidence)

- 4 endpoint HTTP của từ điển (import preview/apply, asr-queue, locked) ở tầng HTTP với phiên đăng nhập thật — tầng hàm/DB đã đạt; lượt chạy không dùng mật khẩu của Thanh.
- Thao tác Thêm+Lưu trên panel Voice (cố ý không làm — sẽ đổi cấu hình thật; xem Chặng 6).
- Kết quả chunk 1 ASR — chờ agent báo + đối chiếu progress.json.

---

*Biên bản này là bản ghi trạng thái tại 01:50 ngày 23/11/2026. Trạng thái mới hơn (nếu có) nằm ở các file checkpoint được dẫn trong từng mục.*
