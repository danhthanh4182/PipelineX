# ADR-003 — Kỷ luật khởi động PipelineX: chỉ qua launcher chuẩn, cấm tiến trình gắn phiên

- **Trạng thái:** Đã chấp nhận (rút ra từ hai sự cố 22–23/11/2026; Thanh đã duyệt cơ chế launcher chuẩn từ sự cố đầu)
- **Ngày:** 23/11/2026
- **Bối cảnh:** Hai sự cố cùng một họ trong hai đêm liên tiếp:
  1. Tối 22/11: khởi động lại web qua WMI tay làm mất biến `API_BASE_URL` → web rơi về API mặc định 3001 (checkout fintech, DB rỗng) → admin trống/404, trang chủ sập sau khi tắt fintech.
  2. Đêm 23/11 (~01:16): một lượt chạy khởi động web bằng tiến trình gắn với phiên SSH — phiên đóng, tiến trình chết theo, web 3010 ngừng nghe cho tới khi được khôi phục qua launcher chuẩn.
  Cả hai đều là lỗi *cách khởi động*, không phải lỗi code ứng dụng.

## Quyết định

1. **Đường khởi động duy nhất** cho web/API technews là hai launcher chuẩn trong `D:\channels\diem-tin-cong-nghe\.data\`: `launch-web.cmd` (đặt `API_BASE_URL=http://127.0.0.1:3011`) và `launch-api.cmd` (`--env-file` đường dẫn tuyệt đối). Cấm khởi động trần bằng lệnh node trực tiếp, WMI tay ngoài launcher, hay Start-Process từ phiên SSH.
2. **Tiến trình phải sống độc lập với phiên điều khiển:** khởi động qua WMI `Win32_Process Create` trỏ vào launcher, hoặc Task Scheduler — không bao giờ là tiến trình con của phiên SSH.
3. **Sau mọi lần khởi động lại, kiểm chứng ở tầng render:** trang chủ 200 với nội dung thật, log không có "ssr api request failed", một trang admin hiển thị dữ liệu thật. "Cổng đang nghe" hoặc đáp 401 không được tính là kiểm chứng.
4. Lớp đệm: `API_BASE_URL` đồng thời được đặt ở cấp user environment trên THANH-PC, để một lần khởi động sai vẫn rơi về đúng API 3011 thay vì 3001.

## Hệ quả

- Dương tính: loại bỏ cả hai cơ chế gây sự cố đã biết; ai (người hay agent) khởi động lại cũng cho cùng một kết quả.
- Âm tính: thêm một bước kiểm chứng sau mỗi lần khởi động; agent không được "tiện tay" restart nhanh bằng lệnh trực tiếp.
- Ràng buộc lan truyền: quy tắc này áp cho mọi agent làm việc trên checkout technews; đã ghi vào AGENTS.md và biên bản bàn giao 23/11.

## Phương án đã loại

- *Sửa mặc định trong code (`api.server.ts`) từ 3001 thành 3011:* che được triệu chứng ở checkout này nhưng tạo mặc định cứng sai cho mọi checkout khác và che giấu lỗi cấu hình thay vì sửa cấu hình.
- *Cho phép agent tự chọn cách khởi động miễn tiến trình sống:* chính là điều kiện đã sinh sự cố thứ hai.
