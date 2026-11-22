# ADR-0003: Ghi log bằng instrumentation phía server, không nhận sự kiện từ client

**Trạng thái**: Đề xuất (chờ Thanh duyệt cùng bộ đặc tả 001-operation-log)
**Ngày**: 2026-11-23

## Bối cảnh

Sự kiện nhật ký phải đầy đủ (không thao tác nào lọt), đúng người thực hiện, đúng kết quả, và không giả mạo được. Các thao tác cần ghi đều đi qua API server của app (handler module video + route đăng nhập của engine); một phần thao tác đến từ editor MCP và job hệ thống — những đường không có trình duyệt.

## Quyết định

Đường ghi duy nhất là **instrumentation phía server**: các handler gọi writer `recordOperation()` ngay trong request xử lý thao tác, sau khi nghiệp vụ hoàn tất (hoặc ở nhánh thất bại có kiểm soát của đăng nhập). **Không có API ghi công khai** cho client gửi sự kiện; trình duyệt chỉ đọc qua API đọc.

## Hệ quả

- Sự kiện gắn chặt với kết quả nghiệp vụ thật (thành công mới ghi success; lỗi có error rút gọn).
- Phủ được cả ba loại người thực hiện (admin qua UI, agent qua MCP, system job) vì tất cả đều kết thúc ở server.
- Thêm một INSERT vào đường xử lý của thao tác được ghi — khống chế bằng NFR-001 (~50ms) và FR-009 (ghi lỗi không làm hỏng thao tác chính, nhưng phải báo ra log hệ thống).
- Muốn ghi thêm loại thao tác mới phải sửa handler tương ứng — chấp nhận được, vì đó cũng là nơi ngữ nghĩa sự kiện được định nghĩa đúng nhất.

## Phương án đã loại

- **Client tự gửi sự kiện (qua API ghi)**: giả mạo được, mất sự kiện khi tab đóng/lỗi mạng, không phủ được MCP/job, và phải mở thêm bề mặt tấn công (API ghi) — trái kết quả pentest Chặng 3 (bề mặt ghi hiện tại đều khoá sau session + CSRF).
- **Suy ra log từ diff tệp cấu hình / trạng thái DB theo lịch quét**: thiếu người thực hiện, thiếu thời điểm chính xác, không có kết quả thao tác, và bỏ sót các thay đổi bị ghi đè giữa hai lần quét.
- **Đọc lại từ log hệ thống (pino)**: log hệ thống là debug không cấu trúc theo nghiệp vụ, lẫn nhiễu và có thể chứa dữ liệu nhạy cảm — không thể là nguồn cho nhật ký truy vết.
