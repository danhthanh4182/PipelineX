# ADR-004 — Hợp nhất design: tài liệu trước, code sau; bản tương tác độc lập phải trung thực

- **Trạng thái:** Đã chốt — Thanh quyết định trong đêm 22→23/11/2026 (01:55–02:04).
- **Phạm vi:** design system Điểm Tin Công Nghệ và mọi module mẫu của nó (đầu tiên áp dụng cho module Giọng đọc).

## Bối cảnh

- Trang thật `/admin/voice` của PipelineX và module mẫu Giọng đọc trong design system lệch nhau: Chặng 6 (đêm 22/11) viết lại panel theo một danh sách thẻ ưu tiên hợp nhất, trong khi tuyến design lại kế thừa trang thật ở phiên bản trước đó (hai khu vực "Chuỗi dự phòng + lưới thẻ" + ô chọn thêm engine). Hai bên đuổi nhau vì không có thứ tự áp dụng thống nhất.
- Thanh chốt phương án **hợp nhất**: trang thật giữ khung, bổ sung chi tiết tốt từ design (nút Nghe thử từng thẻ), module mẫu sửa theo trang thật. Ngay sau đó Thanh đổi thứ tự thi hành: **cập nhật tài liệu trước (MD + HTML design), chưa triển khai code**.
- Khi Thanh mở bản HTML xuất từ Space ở dạng file độc lập, kiểm kê cho thấy gần như mọi điều khiển vốn chạy được, nhưng nút **Nghe thử trong bản mẫu là mô phỏng bằng timer** (chính chú thích trong mã ghi "âm thanh thật phát tại PipelineX") — người xem bấm nút, thấy sóng chạy, nhưng không có tiếng thật. Đây là dạng "giả vờ hoạt động" không chấp nhận được trong một tài liệu chuẩn.

## Quyết định

1. **Thứ tự hợp nhất design ↔ trang thật:** khi hai bên lệch, hợp nhất theo khung của trang thật + chi tiết tốt của design; cập nhật **lớp tài liệu trước** trên mọi bề mặt (MD chuẩn → bản dựng file → Space), đồng bộ trong cùng một lượt. Code trang thật chỉ triển khai khi Thanh ra lệnh riêng; tài liệu đi trước không tự coi là đã triển khai.
2. **Bản HTML tương tác độc lập là bề mặt phái sinh** của bản ghi chuẩn: dựng từ bản chuẩn ở một phiên bản xác định, ghi rõ phiên bản trên chính file. MD vẫn là bản phân xử khi có lệch (theo ADR-001). Bề mặt phái sinh không tự trở thành bản chuẩn.
3. **Trung thực tương tác:** mọi điều khiển trong tài liệu mẫu phải hoặc (a) hoạt động thật bằng cơ chế sẵn có của môi trường mở file — ví dụ Nghe thử phát thật bằng `speechSynthesis` của trình duyệt với giọng đang chọn — hoặc (b) ghi nhãn mô phỏng rõ ràng ngay tại chỗ. **Cấm mô phỏng im lặng giả làm hoạt động thật.** Khi cơ chế thật không khả thi trong môi trường đó (không có giọng tiếng Việt, trình duyệt không hỗ trợ), hiện ghi chú trung thực tại chính điều khiển, không phát thay bằng thứ khác.

## Hệ quả

- **Dương:** các bề mặt tài liệu không còn drift theo hai hướng; người đọc file độc lập thao tác được thật và biết rõ giới hạn; quyết định "tài liệu trước" tách bạch với "triển khai code" — tránh việc tưởng đã làm code khi mới sửa mẫu.
- **Âm / chấp nhận:** mỗi lần bản chuẩn lên phiên bản, bản phái sinh độc lập phải dựng lại và kiểm kê lại điều khiển; `speechSynthesis` phụ thuộc giọng cài trên máy người mở nên trải nghiệm nghe thử khác nhau theo máy — chấp nhận, vì đã có ghi chú trung thực tại chỗ và bản mẫu luôn ghi rõ âm thanh thật của kênh phát tại PipelineX.
- **Áp dụng ngay:** module Giọng đọc v3.2 (MD + bản dựng file + Space + bản tương tác độc lập `design-system-diem-tin-cong-nghe-tuong-tac.html`); triển khai Nghe thử vào trang thật chờ lệnh riêng của Thanh (SPEC W4).
