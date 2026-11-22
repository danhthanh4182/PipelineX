# Design System — Điểm Tin Công Nghệ

**Phiên bản:** v3.2 — 23/11/2026 (module Giọng đọc hợp nhất theo chốt của Thanh: khung trang thật `/admin/voice` + nút Nghe thử từng thẻ — cập nhật tài liệu trước, chưa triển khai code; bản hợp nhất từ gói v2 ngày 22/11/2026 — xem Phụ lục C) · **Bề mặt gốc:** Space Studio Xuất Bản Video Tin Tức (`studio-xuat-ban-video-tin-tuc`) · **Bề mặt áp dụng thêm:** admin PipelineX kênh Điểm Tin Công Nghệ (chỉ vùng nội dung, giữ nguyên sidebar — xem §8), Bản Tin Sáng (web + Space), frame video mọi nền tảng
**Kicker:** ĐIỂM TIN CÔNG NGHỆ · **Tagline:** AI · Công nghệ · Tài chính · Ưu đãi · **Domain:** news.danhthanh.dev

Tài liệu này là bản render tổng hợp của design system từ gói chuẩn `studio-design-system-2026-11-22-v2` (tokens + FRAME-SPEC + Frontend Design System + Motion). Khi có xung đột số đo frame, `FRAME-SPEC.md` trong gói là nguồn sự thật duy nhất.

---

## 1. Token màu thương hiệu

Bộ 11 token dưới đây là bộ duy nhất. Các hex gần giống như `#F49F40`, `#13204F`, `#0B1434` **không phải token** — bề mặt nào còn giữ phải đưa về đúng hex chuẩn.

| Token | Hex | Vai trò |
|---|---|---|
| `brand-navy` | `#131F4F` | Navy nền chính của thương hiệu (web, end card) |
| `brand-navy-dark` | `#0B1435` | Navy tối: dải tiêu đề, nền end card, nền pill |
| `title-box` | `#0C1538` | Nền hộp/dải tiêu đề trên frame video |
| `scrim` | `#0A112C` | Scrim phụ đề trên frame video (màu hiệu dụng) |
| `brand-gold` | `#F4A040` | Gold chính: chữ lockup, kicker, điểm nhấn |
| `brand-gold-deep` | `#E88F33` | Gold đậm: vạch gold, viền bug, viền end card |
| `brand-cream` | `#FFF3E0` | Chữ phụ trên nền navy (tagline) |
| `brand-text` | `#FFFFFF` | Chữ chính trên frame video |
| `frame-backdrop` | `#263678` | Nền vùng bìa sau ảnh contain-fit của frame video (mọi kích thước) |
| `frame-grid` | `#30428A` | Lưới grid trên backdrop trong bản preview frame (chu kỳ 120px) |
| `safe-red` | `#FF405C` | Màu vùng cấm / lớp safe zone trong preview |

Lưu ý: backdrop vùng bìa của frame video dùng `frame-backdrop`, **không** dùng `brand-navy` (navy chỉ giữ cho web và end card).

### Màu trạng thái (giao diện)

Ánh xạ cố định theo vai trò, không tự chế màu mới: **active** = xanh lá, **blocked** = đỏ, **waiting** = hổ phách, **neutral** = xám, **info** = xanh dương. Badge trạng thái luôn gồm **màu + chữ + icon**, không bao giờ chỉ dùng màu.

Bộ ba giá trị của badge (chữ / viền / nền mờ) — trích từ CSS bản render đang chạy (lớp `b-active`, `b-blocked`, `b-waiting`, `b-neutral`, `b-info`), nay chuẩn hoá thành token để mọi bề mặt dùng chung một bộ, không tự pha lại:

| Token | Chữ | Viền | Nền |
|---|---|---|---|
| `status-active` | `#7EE2A0` | `#2E7D4F` | `rgba(46,125,79,.18)` |
| `status-blocked` | `#FF9DB0` | `#B03A50` | `rgba(255,64,92,.14)` |
| `status-waiting` | `#FFD28A` | `#A8742C` | `rgba(244,160,64,.14)` |
| `status-neutral` | `#C9D2E8` | `#5A6B96` | `rgba(120,140,190,.14)` |
| `status-info` | `#9CC8FF` | `#3D6FB4` | `rgba(80,140,230,.14)` |

## 2. Font và thang chữ

### Cặp font thương hiệu

| Font | Trọng lượng | Dùng cho |
|---|---|---|
| Be Vietnam Pro | Black 900 | Chữ lớn trên thumbnail |
| Be Vietnam Pro | ExtraBold 800 | Dự phòng tiêu đề |
| Be Vietnam Pro | Bold 700 | Chữ thường, phụ đề, kicker, pill, tagline |
| Noto Serif (subset vietnamese) | Black 900 | Tiêu đề bài trên frame video |
| Noto Serif (subset vietnamese) | Bold 700 | Tiêu đề phụ khi cần nhẹ hơn |

Fallback giao diện: `system-ui, sans-serif`. Noto Serif phải là bản subset vietnamese (đủ Đ ă â ê ô ơ ư và dấu tổ hợp) và phải đóng gói/nạp cục bộ khi render — cấm fallback sang font hệ thống vì metrics ngắt dòng sẽ lệch.

### Thang chữ giao diện (UI)

| Mức | Cỡ | Ghi chú |
|---|---|---|
| Tiêu đề trang | 22px | |
| Tiêu đề mục | 16px | semibold |
| Tiêu đề thẻ | 14px | semibold |
| Thân bài | 13–14px | line-height tối thiểu 1.5 (dấu tiếng Việt không bị cắt) |
| Meta | 12px | |
| Số liệu | — | luôn `tabular-nums` |

### Chữ trên frame video

| Kích thước | Tiêu đề (Noto Serif) | Phụ đề (Be Vietnam Pro) |
|---|---|---|
| 16:9 | 52px | 46px |
| 9:16 | 50px | 46px |
| 4:5 | 48px | 44px |
| 1:1 | 46px | 42px |

Phụ đề 9:16: tối đa 44 ký tự/cue, 2 dòng, baseline dòng 2 tại y=1560.

## 3. Khoảng cách, bo góc, breakpoint

- **Thang khoảng cách (px):** 4 · 8 · 12 · 16 · 24 · 32 — mọi số đo giao diện bám đúng thang này, không dùng số lẻ ngoài thang.
- **Bo góc:** control 8px · thẻ 10–12px · pill 999px (tròn hoàn toàn).
- **Bề rộng nội dung tối đa:** 1440px.
- **Breakpoint (không thêm mốc riêng cho từng trang):** điện thoại ≤640px · máy tính bảng 641–1024px · desktop ≥1025px.
- **Bóng đổ:** hai mức bóng nhẹ cho phần tử nổi và lớp phủ; ưu tiên viền 1px hơn bóng đổ trên bề mặt phẳng.

## 4. Nhận diện thương hiệu

- **Lockup:** một ảnh duy nhất `logo-diem-tin-cong-nghe-master.png` (mark + chữ "Điểm Tin Công Nghệ" gold gradient `#F4A040 → #E88F33`, nền trong suốt; bản nhỏ `logo-diem-tin-cong-nghe-480.png`) cho header mọi bề mặt. **Cấm render chữ tên kênh bằng HTML/text bên cạnh logo** (lỗi nhân đôi tên thương hiệu); tên kênh trong header chỉ tồn tại bên trong ảnh lockup, kèm `aria-label`.
- **Bug trên frame video:** mark avatar `avatar-1080x1080.png` thu nhỏ, bo góc 20% cạnh, viền gold đậm (`brand-gold-deep`) 3px ở cỡ 120px. Favicon suy ra từ avatar mark.
- **Pill domain — phương án C (chốt 19:57, 22/11/2026):** pill `news.danhthanh.dev` nằm **trong** dải/hộp tiêu đề, cùng hàng với kicker, căn phải bên trong hộp. Áp cho mọi frame có dải tiêu đề (9:16, 16:9, 4:5, 1:1). Không đặt pill xếp dọc dưới bug ở góc trên-trái, không đặt ở góc phải-trên của khung. End card: pill căn giữa thân card. Thumbnail và bìa Reels (không có dải tiêu đề): không đặt pill.
  - 9:16: pill cao 42, font Bold 22px, mép phải trong hộp −24px, đỉnh pill = đỉnh hộp +14.
  - 16:9: pill cao 46, font Bold 25px, mép phải x=1856, đỉnh y=890.
  - 4:5: pill cao 40 · 1:1: pill cao 38.

## 5. Component và module mẫu

Trong bản HTML đi kèm, mục này được dựng thành **module mẫu tương tác thật** bằng chính token của hệ — module Từ điển đọc (tìm kiếm, lọc, chọn hàng loạt, bật/tắt từng mục, xuất JSON/CSV) và module Giọng đọc (một danh sách thẻ ưu tiên hợp nhất + nghe thử từng thẻ, kế thừa trang thật `/admin/voice`) — không dùng ảnh chụp panel. Ảnh chụp Studio thật vẫn được giữ trong gói v2 (`ui-panels/`) làm bằng chứng đối chiếu nguồn.

**Nguyên tắc kế thừa module thật (chốt 23/11/2026):** module mẫu trong design system **kế thừa module thật đang chạy** của sản phẩm, không dựng lại theo trí nhớ và không thay bằng ảnh chụp. Mẫu chuẩn: module Từ điển đọc trong mục này kế thừa trang thật `/admin/lexicon` của PipelineX (localhost:3010) — cùng bộ nút, bộ lọc, thao tác hàng loạt và ngữ nghĩa khóa/kiểm chứng ASR; module Chuỗi ưu tiên giọng đọc kế thừa trang thật `/admin/voice`. Khi module thật thay đổi, module mẫu phải đồng bộ theo trong cùng lượt; sai lệch giữa module mẫu và module thật là lỗi của design system.

Đặc điểm style của component (đối chiếu với panel Studio thật):

- Nền navy đậm; thẻ bề mặt navy sáng hơn với viền 1px. Nút chính gold `#F4A040` chữ navy đậm; nút phụ bề mặt navy + viền.
- Chip/badge pill bo tròn hoàn toàn; trạng thái bật = xanh lá **kèm chữ**, không chỉ dùng màu.
- Công tắc (toggle) xanh lá khi bật, luôn kèm nhãn chữ bên cạnh.
- Tiêu đề panel 16 semibold; chữ thân 13–14; hàng điều khiển xếp theo thang khoảng cách 8/12.
- Nhóm nút đứng cạnh nhau phải đồng nhất chiều cao và cỡ chữ.
- Module mẫu: **Từ điển đọc** — đủ bộ nút như panel thật: Nhập hàng loạt / Xuất JSON / Xuất CSV; 7 bộ lọc có nhãn (tìm kiếm, phạm vi tuyến, phạm vi chuyên mục, trạng thái bật/tắt, kiểm chứng ASR, trạng thái khóa, nhóm theo); hàng loạt đã chọn (bật/tắt/khóa/mở khóa/kiểm chứng ASR/bỏ chọn) và cả đang hiển thị (bật/tắt/kiểm chứng ASR tất cả, kèm số mục); mỗi thẻ có công tắc áp dụng bản đọc, nút Khóa/Mở khóa, Kiểm chứng ASR, Sửa, Xóa — mục đã khóa không sửa, không bật/tắt, không bị thao tác hàng loạt động vào. Và **Giọng đọc** — kế thừa trang thật `/admin/voice`, hợp nhất theo chốt của Thanh 01:55 ngày 23/11/2026 (khung trang thật + nút Nghe thử; cập nhật tài liệu trước, code triển khai sau): thanh hành động đầu module có nút "Khôi phục thứ tự mặc định" và nút chính "Lưu cấu hình giọng"; thẻ giới thiệu giải thích cấu trúc chuỗi dự phòng và in dòng "Câu mẫu chuẩn". Bên dưới là **một danh sách thẻ ưu tiên hợp nhất** cho cả 6 engine (VieNeu, Relay, NVIDIA, Piper, Azure, Edge), xếp theo thứ tự: engine đang trong chuỗi (nhãn "Ưu tiên 1/2/3…") → engine đang bật chưa vào chuỗi (chip waiting "Chưa vào chuỗi") → engine đang tắt (chip neutral "Đang tắt"). Mỗi thẻ có: tay nắm kéo thả + nút ↑/↓ đổi thứ tự trong chuỗi; badge vai trò + badge loại (Package tại máy / Gọi model qua API); riêng Relay có chip "Tuyến Relay riêng"; công tắc bật/tắt kèm nhãn chữ (đủ trạng thái: bật, tắt, hover, focus, vô hiệu/khoá); dòng mô tả engine; hai dropdown "Giọng đọc" và "Giọng nghe thử"; dòng mô tả của giọng đang chọn; nút "Bỏ khỏi chuỗi" (với engine trong chuỗi) hoặc nút "Thêm vào chuỗi" ngay trên thẻ (với engine đang bật chưa vào chuỗi — không dùng ô chọn dùng chung). **Hàng nghe thử** nằm dưới hai dropdown trên từng thẻ: nút "▶ Nghe thử" (bề rộng cố định 160px, một dòng, không bẻ chữ) phát câu mẫu chuẩn bằng đúng giọng đang chọn ở "Giọng nghe thử" — phát thật của engine đó, engine chưa có đường phát thật thì nút vô hiệu kèm ghi chú trung thực, không phát âm thanh giả; sóng (eq) luôn chiếm sẵn 22px và ẩn/hiện bằng `visibility`; dòng trạng thái khóa chiều cao (35px), giữ nguyên độ đậm ở mọi trạng thái, chữ rút gọn "Đang phát · giọng X…" / "Câu mẫu · giọng X"; toàn hàng giữ `min-height` 48px và không xuống dòng — theo quy tắc chống dịch chuyển bố cục ở §8. Tại một thời điểm chỉ một engine phát; đổi giọng nghe thử hoặc tắt engine đang phát thì dừng phát. Hành vi cấu hình: engine trong chuỗi bắt buộc đang bật — tắt một engine thì engine đó tự rời khỏi chuỗi nhưng giữ nguyên cấu hình giọng; bật engine không tự thêm vào chuỗi; sau khi Lưu, giao diện nhận đúng cấu hình máy chủ trả về làm trạng thái mới.

Trong bản HTML đi kèm, mục 7 còn có **module frame mẫu tương tác**: khung 9:16 dựng sống theo tọa độ preset (đổi preset để hộp tiêu đề/scrim nhảy đúng hình học, bật/tắt lớp safe zone Orson, sửa tiêu đề/phụ đề trực tiếp trên frame) thay cho ảnh preview tĩnh.

### Mẫu danh sách dài cuộn riêng (chốt 23/11/2026)

Danh sách có thể dài hàng trăm mục (từ điển, nhật ký, hàng đợi) bắt buộc nằm trong **vùng cuộn riêng**: chiều cao giới hạn (mặc định ~70vh), thanh cuộn riêng của vùng. Hàng tiêu đề cột (nếu có), ô tìm kiếm, bộ lọc, thống kê và thanh thao tác hàng loạt nằm **ngoài** vùng cuộn, luôn nhìn thấy khi cuộn. Không bao giờ để danh sách kéo dài toàn trang.

### Mẫu mục giữ chỗ (placeholder trung thực, chốt 23/11/2026)

Tính năng chưa có module phía sau vẫn được xuất hiện trong điều hướng/sidebar với badge **"Chờ module"** và một trang giữ chỗ ghi rõ chưa triển khai + lý do. Cấm dựng dữ liệu giả, danh sách giả hay trạng thái giả để lấp chỗ. Khi module thật sẵn sàng, trang thật thay đúng vị trí đã giữ — không đổi slug, không đổi vị trí điều hướng.

### Slug và nhãn giao diện (chốt 23/11/2026)

- Slug/route dùng danh từ **số ít**, không thêm "s": `voice` (không phải `voices`), `video`, `lexicon`.
- Mọi nhãn hiển thị phải qua i18n và có đủ ở **cả hai locale vi + en**; không bao giờ để khóa dịch thô (kiểu `voice.title`) lọt ra giao diện — đó là lỗi phát hành, không phải lỗi chính tả.

## 6. Motion

Mọi thời lượng và đường cong lấy từ bảng token này — không ghi cứng mili giây/cubic-bezier trong component, không tự thêm mức mới.

| Token | Thời lượng | Dùng cho |
|---|---|---|
| `motion-micro` | 80ms | Phản hồi chạm tức thì |
| `motion-fast` | 120ms | Hover, đổi màu trạng thái |
| `motion-base` | 180ms | Mở rộng thẻ, chuyển tab |
| `motion-slow` | 240ms | Mở nhóm, hiện khối nội dung |
| `motion-deliberate` | 320ms | Trần tuyệt đối cho mọi chuyển động giao diện |

Đường cong chuẩn: `ease-out` cubic-bezier(0.2, 0, 0, 1) cho phần tử đi vào · `ease-in` cubic-bezier(0.4, 0, 1, 1) cho phần tử đi ra · `ease-standard` cubic-bezier(0.45, 0, 0.55, 1) cho di chuyển giữa hai trạng thái trong cùng màn hình. Chuyển động ra ngắn hơn chuyển động vào của cùng phần tử (~70%).

Nguyên tắc: chỉ animate `transform` và `opacity`; không animate width/height/top/left/margin/padding/box-shadow; không chuyển động trang trí; mỗi khung hình tối đa 2 chuyển động có chủ đích; tôn trọng `prefers-reduced-motion` (thời lượng về 0, tắt cuộn mượt và nhịp skeleton).

## 7. Frame video

### Quy ước chung

- Mỗi frame gồm `*-overlay.png` (nền trong suốt, chỉ khung/brand tĩnh; riêng end card là nền đặc) và `*-preview.png` (xem trước trên backdrop, có vùng cấm — **không bao giờ ghép preview vào video**).
- Ảnh bìa luôn **contain-fit** trong vùng bìa; không crop, không cover-fill.
- Overlay chỉ chứa kicker cố định "ĐIỂM TIN CÔNG NGHỆ", bug, pill domain, dải nền và vạch gold; chữ động (tiêu đề, phụ đề) do renderer vẽ vào vùng quy định.

### Preset hình học 9:16 (canvas 1080×1920)

| Preset | Hộp tiêu đề | Scrim phụ đề | Ghi chú |
|---|---|---|---|
| standard-c (bản gốc thiết kế) | (32,1108)→(914,1388) | (24,1436)→(906,1592) | Không dùng trực tiếp để xuất bản TikTok/Shorts/Reels/Story |
| tiktok-orson | (120,956)→(948,1236) | (120,1284)→(948,1440) | Frame xuất bản chính thức cho TikTok |
| shorts-orson | (60,1056)→(914,1336) | (60,1384)→(914,1540) | Frame xuất bản chính thức cho Shorts |
| reels-v5 | (120,1108)→(948,1388) | (120,1436)→(948,1592) | Phụ đề giữ y1436–1592 vì đáy an toàn IG là 1600; tâm phụ đề x=534 |
| story-v5 | (65,1108)→(1015,1388) | (65,1380)→(1015,1532) | Baseline phụ đề dòng 2: y=1500 |

### Safe zone theo Orson Lord (canvas 1080×1920)

Số lấy từ nhãn template + đo pixel; khi văn bài viết mâu thuẫn với template thì **template thắng**.

| Template | Vùng an toàn | Ghi chú |
|---|---|---|
| Instagram Reels | x 120–960, y 250–1600 | Rail phải cao ở góc dưới-phải |
| TikTok | x 120–960, y 160–1440 | Rail phải x960–1080 từ y≈840 |
| YouTube Shorts | x 60–960, y 240–1540 | Rail phải x960–1080 từ y≈720 |
| Universal | x 120–960, y 250–1540 | |

**Hộp giao của Thanh** (cho bố cục bìa/cụm thương hiệu, nằm trọn trong cả ba vùng Orson): **x 60–900, y 300–1330, tâm x=480**. Cụm thương hiệu mở đầu TikTok xếp dọc căn giữa theo hộp giao: mark giữa–trên → tên thương hiệu → dòng chủ đề → pill tên miền.

**Nguyên tắc frame riêng từng nền tảng:** mỗi nền tảng có hình học hộp tiêu đề + scrim + pill nằm gọn trong safe zone của chính nó; chuẩn C chỉ là bản gốc thiết kế, khi xuất bản dùng frame riêng của nền tảng đó. Kiểm tra hình học bằng skill `video_safe_zone` (`check_safezone.py`).

### Ánh xạ nền tảng → biến thể frame

| Nền tảng | Kích thước | Biến thể |
|---|---|---|
| YouTube (video dài) | 1920×1080 | 16:9 main + end card |
| YouTube Shorts | 1080×1920 | 9:16 shorts-orson |
| TikTok | 1080×1920 | 9:16 tiktok-orson |
| Instagram / Facebook Reels | 1080×1920 | 9:16 reels (+ reels-cover cho bìa) |
| Instagram / Facebook Story | 1080×1920 | 9:16 instagram-story |
| Feed Instagram / Facebook / Threads | 1080×1350 | 4:5 feed (bản riêng từng nền tảng) |
| Threads (video dọc) | 1080×1920 | 9:16 threads (chữ trong dải tâm 4:5) |
| Bluesky | 1920×1080 / 1080×1920 / feed | 16:9 / 9:16 bluesky / 4:5–1:1 feed-main |
| X | 1920×1080 / 1080×1920 | 16:9 x / 9:16 x |
| Zalo | 1080×1920 | 9:16 zalo (số đo thận trọng, chưa có spec chính thức) |
| LinkedIn | 1080×1350 / 1080×1080 / 1920×1080 | 4:5 / 1:1 feed-main / 16:9 main |
| Telegram | 1920×1080 / 1080×1920 | 16:9 main / 9:16 main |
| File master / gói tay | 1080×1920 / 1080×1080 | 9:16 main / 1:1 feed-main + thumbnail 1:1 |

## 8. Quy tắc nền

- **Một nguồn sự thật duy nhất:** design mới (logo, palette, font, frame, template) phải cập nhật trong cùng một lượt vào design system này, Space trưng bày "Design System — Bản Tin Sáng" và mockup của mọi Space liên quan — không để design mới chỉ tồn tại ở một nơi.
- **Giao diện trung thực:** dữ liệu chụp tại một thời điểm phải gắn nhãn là bản chụp kèm giờ kiểm chứng; không dựng kiểm tra trực tiếp giả, làm mới giả hay thông báo giả. Bí mật không bao giờ hiện trên giao diện — chỉ nhãn đã che và nơi lưu trữ.
- **Microcopy:** viết bằng ngôn ngữ người dùng đọc bề mặt đó, ngắn, cụ thể, không chữ đệm.
- **Tương phản và focus:** chữ trên nền navy dùng `brand-cream`/`brand-text`; `brand-gold` chỉ cho chữ lớn, kicker và điểm nhấn — không dùng gold cho đoạn văn dài trên navy. Mọi phần tử tương tác phải có trạng thái focus nhìn thấy được; trạng thái không bao giờ truyền đạt bằng màu đơn độc (xem §1).
- **Áp dụng từng phần phải khai báo:** bề mặt chỉ áp dụng một phần hệ phải ghi rõ phạm vi ngay tại bề mặt đó. Ví dụ đang hiệu lực: admin PipelineX áp dụng hệ này **chỉ ở vùng nội dung** — sidebar và khung shell giữ nguyên, không được hiểu là đã đồng bộ toàn bộ.
- **Chủ đề sáng — điểm mở:** bộ token này chuẩn hoá cho nền tối (navy). Chưa có bộ token nền sáng tương ứng trong tài liệu này; không tự suy diễn bảng sáng từ bảng tối. Chuẩn hoá nền sáng là một đợt riêng cần Thanh duyệt.
- **Truy cập (a11y) — bắt buộc với mọi module mẫu:** danh sách kéo thả phải có đường bàn phím (tay nắm focus được, phím mũi tên lên/xuống đổi vị trí, focus đi theo mục đã chuyển, thông báo vị trí mới); nút chỉ có biểu tượng phải có `aria-label`; công tắc, ô nhập và ô chọn phải có nhãn truy cập được (label nhìn thấy hoặc `aria-label`); thông báo kết quả thao tác dùng `role="status"`/`aria-live="polite"`; trang tài liệu có liên kết "Bỏ qua tới nội dung"; mọi phần tử tương tác có outline focus qua `:focus-visible`.
- **Công tắc chỉ cho trạng thái, nút bấm cho hành động** (Thanh chốt 23/11/2026): công tắc gạt chỉ dùng cho trạng thái hai cực bền (bật/tắt engine, bật/tắt mục). Hành động tức thời — "Bỏ khỏi chuỗi", đổi thứ tự ↑/↓, Khóa/Mở khóa, Xóa — luôn là nút bấm, không đổi thành công tắc.
- **Chống dịch chuyển bố cục (layout shift):** mọi phần tử xuất hiện hoặc đổi nội dung khi tương tác phải giữ chỗ sẵn — nút đổi nhãn giữ bề rộng cố định và `nowrap`; dòng trạng thái khóa chiều cao, giữ nguyên độ đậm ở mọi trạng thái, tràn thì cắt ellipsis; sóng/loading luôn chiếm chỗ và ẩn hiện bằng `visibility` thay vì `display:none`; ảnh thương hiệu và ảnh minh họa khai báo `aspect-ratio` (hoặc width/height) trước khi nạp.

## Phụ lục A — tokens.css

```css
:root {
  /* Màu thương hiệu */
  --brand-navy: #131F4F;        /* navy nền chính (web, end card) */
  --brand-navy-dark: #0B1435;   /* navy tối: dải tiêu đề, end card, nền pill */
  --brand-gold: #F4A040;        /* gold chính: lockup, kicker, nhấn */
  --brand-gold-deep: #E88F33;   /* gold đậm: vạch, viền */
  --brand-cream: #FFF3E0;       /* chữ phụ trên navy (tagline) */
  --brand-text: #FFFFFF;        /* chữ chính trên frame video */

  /* Màu frame video */
  --title-box: #0C1538;         /* hộp/dải tiêu đề */
  --scrim: #0A112C;             /* scrim phụ đề (màu hiệu dụng) */
  --frame-backdrop: #263678;    /* nền vùng bìa sau ảnh contain-fit */
  --frame-grid: #30428A;        /* lưới preview, chu kỳ 120px */
  --safe-red: #FF405C;          /* vùng cấm / safe zone trong preview */

  /* Font */
  --font-sans: "Be Vietnam Pro", system-ui, sans-serif;
  --font-serif: "Noto Serif", Georgia, serif;

  /* Thang chữ giao diện (px) */
  --text-page-title: 22px;
  --text-section-title: 16px;
  --text-card-title: 14px;      /* semibold */
  --text-body: 14px;            /* 13–14 */
  --text-meta: 12px;
  --leading-body: 1.5;

  /* Thang khoảng cách (px) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 24px; --space-6: 32px;

  /* Bo góc */
  --radius-control: 8px;
  --radius-card: 12px;          /* 10–12 */
  --radius-pill: 999px;

  /* Bề rộng nội dung tối đa */
  --content-max: 1440px;

  /* Màu trạng thái — bộ ba chữ/viền/nền của badge (xem §1) */
  --status-active-text: #7EE2A0;  --status-active-border: #2E7D4F;  --status-active-bg: rgba(46,125,79,.18);
  --status-blocked-text: #FF9DB0; --status-blocked-border: #B03A50; --status-blocked-bg: rgba(255,64,92,.14);
  --status-waiting-text: #FFD28A; --status-waiting-border: #A8742C; --status-waiting-bg: rgba(244,160,64,.14);
  --status-neutral-text: #C9D2E8; --status-neutral-border: #5A6B96; --status-neutral-bg: rgba(120,140,190,.14);
  --status-info-text: #9CC8FF;    --status-info-border: #3D6FB4;    --status-info-bg: rgba(80,140,230,.14);
}
/* Breakpoint: điện thoại ≤640px · máy tính bảng 641–1024px · desktop ≥1025px */
```

## Phụ lục B — Cấu trúc gói nguồn (v2)

- `tokens/` — tokens.json + tokens.css (bản máy đọc của tài liệu này)
- `brand/` — lockup master + bản 480, avatar 1080×1080, 5 file font TTF
- `docs/` — FRONTEND-DESIGN-SYSTEM.md (4 trụ cột + nhận diện), FRAME-SPEC.md (số đo frame), MOTION.md, báo cáo redesign/mở rộng
- `mockups/frames/` — 64 PNG frame (overlay + preview) và template Orson gốc ở `reference/orsonlord/`
- `ui-panels/` — 3 ảnh panel Studio thật + README nguồn ảnh
- `scripts/` — 11 script Python dựng frame

## Phụ lục C — Nhật ký thay đổi

**v3.2 (23/11/2026)** — hợp nhất module Giọng đọc, cập nhật tài liệu trước (Thanh chốt 01:55–01:56):
- §5 Giọng đọc viết lại theo phương án hợp nhất Thanh chốt: giữ khung trang thật `/admin/voice` sau Chặng 6 (một danh sách thẻ ưu tiên hợp nhất, nhãn "Ưu tiên N", nút Thêm vào chuỗi ngay trên thẻ, Khôi phục thứ tự mặc định, Lưu nhận cấu hình từ máy chủ) và bổ sung hàng **Nghe thử từng thẻ** (nút 160px + sóng giữ chỗ + dòng trạng thái khóa chiều cao theo quy tắc chống dịch chuyển bố cục §8). Bỏ cấu trúc hai khu vực "Chuỗi dự phòng + lưới thẻ" và ô chọn "Thêm engine đang bật vào chuỗi" của v3.1.
- §8 đã có sẵn quy tắc chống dịch chuyển bố cục và quy tắc công tắc/nút bấm (bổ sung ở các lượt trước trong ngày) — v3.2 chỉ tham chiếu, không đổi nội dung §8.
- Phạm vi lượt này: **chỉ tài liệu** (MD này + bản dựng HTML + Space + docs trong project PipelineX). Trang thật `/admin/voice` hiện chưa có nút Nghe thử — đây là khoảng lệch đã ghi nhận, code triển khai làm ở lượt riêng khi Thanh ra lệnh.

**v3.1 (23/11/2026)** — hợp nhất phần render của Voice:
- Module giọng trong §5 (bản HTML + bản MD) thay toàn bộ bằng bản kế thừa trang thật `/admin/voice` của PipelineX: thẻ Chuỗi dự phòng (đánh số, ↑/↓, Bỏ khỏi chuỗi, thêm engine vào chuỗi, câu mẫu chuẩn, nút Lưu cấu hình giọng) + lưới thẻ 6 engine với badge loại/vai trò, nút bật/tắt dạng nút bấm và hai dropdown Giọng đọc/Giọng nghe thử. Bản cũ theo panel Studio (kéo thả + công tắc + Nghe thử + khôi phục mặc định) không còn là mẫu.
- Cấu trúc module lấy từ mã nguồn bản build đang chạy của trang `/admin/voice` (chunk giao diện + chuỗi i18n vi) vì lượt xem trực tiếp bằng trình duyệt không thực hiện được (phiên trình duyệt bị khôi phục giữa chừng và địa chỉ loopback bị chặn); số liệu catalog từng engine trong module mẫu là dữ liệu mẫu trình diễn.
- §1 (bản HTML) có thêm bảng giá trị cụ thể của 5 token trạng thái; §8 (bản HTML) bổ sung ba quy tắc tương phản/focus, khai báo phạm vi áp dụng và điểm mở chủ đề sáng cho khớp bản MD.

**v3 (23/11/2026)** — bản hợp nhất hai tuyến cải thiện từ bản render v2:
- §5 + §7 (bản HTML): bỏ toàn bộ ảnh chụp panel và thư viện frame tĩnh, thay bằng **module mẫu tương tác thật** (Từ điển đọc, Chuỗi ưu tiên giọng đọc, frame 9:16 đổi preset/safe zone/sửa chữ trực tiếp); module Từ điển đọc đã bổ sung đủ bộ nút sau khi Thanh soi thiếu (7 bộ lọc có nhãn, hàng loạt đã chọn + đang hiển thị, nút Khóa/ASR/Sửa/Xóa từng thẻ, ngữ nghĩa mục đã khóa).
- §5: thêm **nguyên tắc kế thừa module thật** — module mẫu kế thừa module đang chạy (Từ điển đọc ← `/admin/lexicon`, Chuỗi giọng đọc ← `/admin/voice` của PipelineX), đồng bộ cùng lượt khi module thật đổi.
- §1: chuẩn hoá màu trạng thái thành token có giá trị cụ thể (bộ ba chữ/viền/nền trích từ CSS bản render đang chạy) thay cho mô tả theo tên màu; Phụ lục A có thêm biến tương ứng.
- §5: thêm ba mẫu đã chốt — danh sách dài cuộn riêng, mục giữ chỗ "Chờ module" trung thực, quy ước slug số ít + nhãn i18n đủ hai locale.
- §8: thêm quy tắc tương phản/focus, khai báo phạm vi khi áp dụng từng phần (PipelineX: chỉ vùng nội dung), và điểm mở về chủ đề sáng.
- Đầu tài liệu: đăng ký thêm các bề mặt áp dụng (admin PipelineX, Bản Tin Sáng) bên cạnh bề mặt gốc Studio.
- Token màu thương hiệu, thang chữ, hình học frame và safe zone: **không đổi** so với v2.
