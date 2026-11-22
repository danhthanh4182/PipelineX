# ADR-002 — Chuẩn chống layout shift: giữ chỗ theo kích thước, không đổi hộp khi đổi trạng thái

- **Trạng thái:** Đã chấp nhận (Thanh chốt qua ảnh chụp và lệnh kiểm tra lại, 01:40–01:45, 23/11/2026)
- **Ngày:** 23/11/2026
- **Bối cảnh:** Module Giọng đọc trong design system: khi bấm "Nghe thử", nút bị bẻ hai dòng, dòng trạng thái dài ra, sóng nhạc xuất hiện từ `display:none` — thẻ engine phình xuống, toàn bộ bố cục bên dưới dịch chuyển. Thanh chụp ảnh bắt lỗi và yêu cầu sửa; bản xuất Space đã sửa bằng kỹ thuật giữ-chỗ, bản dựng file dùng kỹ thuật khác (cắt ellipsis) và chưa tương đương — Thanh bắt tiếp lỗi này khi đối chiếu hai bản.

## Quyết định

Mọi bề mặt theo design system (Space, bản dựng file, admin PipelineX ở vùng content) phải tuân thủ:

1. **Phần tử đổi trạng thái không được đổi kích thước hộp.** Nút bấm có bề rộng cố định theo trạng thái dài nhất; dòng trạng thái khóa chiều cao và giữ nguyên `font-weight` giữa các trạng thái; nội dung dài thì rút gọn câu chữ hoặc cắt trong hộp đã khóa — không để hộp phình.
2. **Phần tử trang trí xuất hiện theo trạng thái (sóng, spinner, badge động) phải chiếm chỗ sẵn** và ẩn/hiện bằng `visibility`/`opacity`. Cấm dùng `display:none` ↔ `display:*` cho phần tử nằm trong luồng bố cục mà việc xuất hiện của nó đẩy nội dung khác.
3. **Ảnh phải có kích thước giữ chỗ trước khi tải:** `aspect-ratio` đúng tỉ lệ thật của ảnh (hoặc width/height tường minh), để khung ảnh không sập rồi nở.
4. **Hàng chứa điều khiển không tự xuống dòng** (`flex-wrap: nowrap`) và có `min-height` cố định khi nội dung trong hàng có thể thay đổi chiều cao.
5. Kỹ thuật cắt chữ (ellipsis) chỉ là biện pháp phụ trợ trong hộp đã khóa kích thước — không thay thế cho giữ-chỗ.

## Hệ quả

- Dương tính: tương tác (phát/dừng nghe thử, lọc, tải ảnh) không còn làm bố cục nhảy; trải nghiệm trên điện thoại — bề mặt Thanh kiểm tra chính — ổn định.
- Âm tính: một số hàng/dòng phải dành sẵn không gian trống khi ở trạng thái nghỉ (chấp nhận được; khoảng trống nhỏ và nhất quán).
- Việc phải làm tiếp: bổ sung quy tắc này vào §8 của MD design system (đã giao tuyến Studio cùng lượt căn chỉnh W1 trong SPEC) và áp kỹ thuật giữ-chỗ vào bản dựng file chuẩn.

## Phương án đã loại

- *Chỉ cắt chữ bằng ellipsis:* xử lý được chữ dài nhưng không xử lý được sóng xuất hiện, nút bẻ dòng, ảnh nở khung — ba trong bốn nguyên nhân dịch chuyển đã gặp.
- *Chấp nhận shift ở module mẫu vì "chỉ là tài liệu":* module mẫu là chuẩn để các bề mặt thật sao theo; mẫu shift thì bề mặt thật shift theo.
