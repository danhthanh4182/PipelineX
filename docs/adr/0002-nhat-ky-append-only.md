# ADR-0002: Nhật ký thao tác là append-only — không sửa, không xoá dòng log

**Trạng thái**: Đề xuất (chờ Thanh duyệt cùng bộ đặc tả 001-operation-log)
**Ngày**: 2026-11-23

## Bối cảnh

Giá trị của nhật ký thao tác nằm ở tính truy vết: khi có tranh cãi "ai đã đổi cấu hình, lúc nào", dòng log phải là bằng chứng không thể bị viết lại bởi chính những người bị truy vết — kể cả admin. Chuẩn ADR-001 của Thanh (việc không có log + evidence thì chưa coi là xong) chỉ có ý nghĩa nếu log giữ nguyên trạng từ lúc ghi.

## Quyết định

`operation_log` là **append-only**: ứng dụng không có bất kỳ đường sửa/xoá nào (không API, không hàm nội bộ); tầng CSDL có trigger chặn UPDATE/DELETE. Việc dọn dẹp theo thời gian (retention) không thuộc v1 và nếu sau này cần, phải là một quyết định riêng có ADR bổ sung, thực thi theo đợt có ghi lại — không phải quyền xoá từng dòng.

## Hệ quả

- Dòng log là bằng chứng ổn định cho truy vết và đối chiếu với Studio.
- Sai sót khi ghi (ví dụ gắn nhầm subject) không sửa được tại chỗ — xử lý bằng cách ghi một dòng hiệu chỉnh mới tham chiếu dòng cũ, giữ cả hai.
- Bảng chỉ tăng; chính sách lưu trữ/điểm rà soát đã đặt ở data-model (12 tháng / 1 triệu dòng).

## Phương án đã loại

- **Cho admin sửa/xoá kèm ghi lịch sử sửa**: tự mâu thuẫn — lớp lịch sử sửa cũng cần được bảo vệ tương tự, phức tạp hoá vô hạn và làm loãng niềm tin vào log.
- **Xoá tự động theo hạn ngay từ v1**: chưa có số liệu tăng trưởng để đặt hạn đúng; xoá sớm có thể cắt đúng đoạn log cần truy vết khi sự cố phát hiện muộn.
- **Chỉ quy ước trong code, không chặn ở CSDL**: một thao tác tay nhầm (SQL trực tiếp, script dọn dẹp) có thể phá log mà không để lại vết; trigger là hàng rào rẻ và chắc.
