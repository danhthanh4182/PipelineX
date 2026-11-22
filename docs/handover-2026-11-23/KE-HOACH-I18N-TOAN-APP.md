# KẾ HOẠCH — Dịch toàn bộ app PipelineX bằng i18n (vi/en)

- **Lệnh:** Thanh, 01:49 ngày 23/11/2026 — "Thêm kế hoạch dịch toàn bộ app với i18n. Điển hình model chưa được dịch" (trang `/admin/models`).
- **Trạng thái:** kế hoạch chờ triển khai theo lộ trình dưới đây; hạ tầng i18n đã có sẵn (react-i18next + `apps/web/app/locales/vi.json`/`en.json`), không cần dựng mới cơ chế. **Thanh tái chốt ưu tiên lúc 02:08–02:13, 23/11: trang Models là điển hình chưa được dịch — làm trang mẫu đầu tiên của P2 (xem §4).**
- **Đi kèm:** `SPEC.md` (hạng mục W6), `PLAN.md`.

## 1. Bằng chứng hiện trạng (recon 01:52, 23/11/2026)

Quét toàn bộ 99 file `.tsx` trong `modules\` + `apps\web\app\` (đếm lời gọi `t("…")` theo file; script: `.data\i18n-recon.ps1` trên THANH-PC):

- **Chỉ 3 file dùng i18n:** `modules\video\web\lexicon.tsx` (123 khóa), `voice.tsx` (24), `journal.tsx` (7) — đều là trang module video làm trong các lượt trước.
- **36/36 file route có 0 khóa i18n** — toàn bộ route của engine (admin + công khai) chưa nối i18n.
- **16/16 route admin của engine chưa dịch**, gồm: models, runs, settings, sources, source, source-new, content, content-item, feedback, audit, selectbench, selectbench-run, admin-login, layout, module-layout, index.
- **Hai trường hợp điển hình:**
  - `apps\web\app\routes\admin\models.tsx` (182 dòng, 0 khóa): hardcode tiếng Anh toàn trang — tiêu đề "Models & Eval", phụ đề "Current model for each capability and resolution origin (Admin > Env > Code Default), plus success rates, latency, and cost…", "Switch History", "Unpriced", badge "Configured … not found, inactive", tooltip "Provider did not report cost…".
  - `modules\video\web\videos.tsx` (706 dòng, 0 khóa): trang Videos của module — hardcode toàn bộ (Chặng 1 từng ghi nhận 14 khóa `video.*` tồn tại nhưng không ai dùng).
- Phần còn lại trong 99 file là component trình bày (icons, chart, primitives) — một phần không có chuỗi giao diện, cần phân loại ở P0 thay vì mặc định phải dịch.

**Kết luận:** Chặng 1 (đêm 22/11) chỉ kiểm chứng *khóa thiếu trong các trang đã dùng i18n* — kết luận "thiếu 0 khóa" đúng trong phạm vi đó nhưng không bao phủ các trang chưa nối i18n. Kế hoạch này xử lý phần chưa bao phủ.

## 2. Nguyên tắc

1. **vi là locale chính; en là locale song song.** Mọi khóa mới phải có mặt ở cả hai file trong cùng một lượt thay đổi — không có lượt "thêm khóa sau".
2. **Không bao giờ để khóa thô hiển thị** (bài học `voice.*` tối 22/11): thiếu khóa ở en thì fallback về vi, không fallback về tên khóa.
3. **Không dịch:** tên riêng/tên model/provider (VieNeu, NVIDIA Magpie, DeepSeek…), mã định danh, nội dung dữ liệu (tiêu đề bài viết, nội dung nguồn), chuỗi kỹ thuật trong log/debug.
4. **Số, ngày, tiền tệ** định dạng theo locale bằng Intl — không nối chuỗi tay.
5. Mỗi trang làm xong phải **kiểm chứng render trong Chrome ở cả hai locale** trước khi coi là xong (ADR-001: log + evidence).
6. Đây là code engine fork từ AIHOT: mọi thay đổi i18n làm tăng độ lệch với upstream — chấp nhận có ý thức, gom thay đổi theo trang để dễ đối chiếu khi upstream cập nhật.

## 3. Phân loại trước khi dịch (P0)

Mỗi file trong 99 file được gán một nhãn:

| Nhãn | Nghĩa | Xử lý |
|---|---|---|
| A — Có chuỗi giao diện | Route/trang/component có chữ hiển thị cho người dùng | Trích chuỗi → khóa → dịch |
| B — Không có chuỗi | Icons, chart thuần, primitives không chữ | Đánh dấu N/A, không đụng |
| C — Dùng chung (shell) | layout, sidebar, admin ui, toast | Làm sớm — một lần sửa phủ mọi trang |

## 4. Lộ trình theo giai đoạn

| Giai đoạn | Phạm vi | Ghi chú |
|---|---|---|
| **P0 — Kiểm kê** | Toàn bộ 99 file: đếm chuỗi hardcode theo file, gán nhãn A/B/C, lập bảng khóa dự kiến theo namespace từng trang (`models.*`, `runs.*`, …) | Đầu ra: bảng kiểm kê + ước lượng khóa theo giai đoạn; là căn cứ báo cáo tiến độ các giai đoạn sau |
| **P1 — Shell + dùng chung** | `admin/layout.tsx`, `admin/module-layout.tsx`, `components/shell/Sidebar.tsx` + shell components có chữ, `features/admin/ui.tsx`, `features/admin/toast.tsx`, `routes/admin-login.tsx` | Phủ khung toàn admin trước; trang chưa dịch vẫn nằm trong khung đã dịch |
| **P2 — Admin engine** | models, runs, settings, sources, source, source-new, content, content-item, feedback, audit, selectbench, selectbench-run, admin/index | 12 file. **Lượt đầu: `models.tsx` một mình làm trang mẫu** (Thanh chỉ định điển hình — 182 dòng, 0 khóa, hardcode toàn trang; xem §1) — trích khóa + dịch vi/en + typecheck + kiểm chứng Chrome hai locale, rút kinh nghiệm cho các cụm sau. Các lượt tiếp theo theo cụm 3–4 trang/lượt với cùng quy trình |
| **P3 — Module video còn lại** | `videos.tsx` (706 dòng) | Trang lớn nhất; dùng lại 14 khóa `video.*` đang bỏ không nếu khớp, bổ sung phần còn thiếu |
| **P4 — Bề mặt công khai** | routes công khai + features feed/item/report/search/hot/about có **chuỗi giao diện** (điều hướng, nút, trạng thái rỗng, nhãn) | Chỉ dịch chrome giao diện; nội dung bài/dữ liệu giữ nguyên theo ngôn ngữ nguồn của dữ liệu |
| **P5 — Quét nghiệm thu** | Toàn app | Cổng tự động + kiểm chứng tay theo §5 |

## 5. Tiêu chí nghiệm thu (đo được)

- SC-I18N-01: Bảng kiểm kê P0 phủ 100% file; mọi file nhãn A đều về 0 chuỗi hardcode sau giai đoạn của nó (đo bằng script trích chuỗi, output đính kèm báo cáo).
- SC-I18N-02: Parity khóa: tập khóa trong vi.json và en.json bằng nhau 100% sau mỗi giai đoạn (script so sánh hai file).
- SC-I18N-03: Từng trang admin: ảnh chụp ở locale vi và en — không khóa thô, không còn chuỗi giao diện tiếng Anh ngoài danh sách ngoại lệ (tên riêng/dữ liệu) được liệt kê trong báo cáo giai đoạn.
- SC-I18N-04: Typecheck web + modules: 0 lỗi mới (lỗi có từ trước ở `Sidebar.tsx` shell ghi riêng, không tính vào).
- SC-I18N-05: Ba trang đã i18n (lexicon, voice, journal) không hồi quy: kiểm chứng lại sau P1 (shell thay đổi có thể ảnh hưởng chúng).

## 6. Rủi ro và cách giảm

- **Khối lượng lớn, dễ nản giữa chừng:** chia cụm nhỏ, mỗi cụm có báo cáo + checkpoint riêng; không dồn một lượt toàn app.
- **Lệch upstream AIHOT:** thay đổi gom theo trang, khóa đặt namespace theo trang để khi upstream đổi trang nào thì biết trang đó cần làm lại i18n.
- **Dịch sai thuật ngữ:** giữ nguyên thuật ngữ kỹ thuật đã chuẩn hoá trong từ điển đọc của kênh khi gặp ở giao diện (capability, provider, latency… quyết từng trường hợp trong báo cáo giai đoạn, tránh dịch máy móc).
- **Chuỗi động (template, số nhiều, nội suy):** dùng cơ chế interpolation/plural của i18next, không nối chuỗi; các trường hợp này liệt kê riêng trong báo cáo vì dễ sót khi trích tĩnh.

---

*Kế hoạch này thay thế mục backlog rời "i18n-hóa videos.tsx" — videos.tsx trở thành giai đoạn P3 của kế hoạch tổng.*
