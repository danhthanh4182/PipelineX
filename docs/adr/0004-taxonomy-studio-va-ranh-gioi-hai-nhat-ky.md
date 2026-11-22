# ADR-0004: Taxonomy bám Studio và ranh giới hai nhật ký không ghi trùng

**Trạng thái**: Đề xuất (chờ Thanh duyệt cùng bộ đặc tả 001-operation-log)
**Ngày**: 2026-11-23

## Bối cảnh

Hệ của Thanh đã có một nhật ký chuẩn: **Nhật ký phát hành ở Studio**, phân nhóm theo 4 nhóm đã chốt (Phát hành & duyệt / Cấu hình / Dựng & kiểm chứng / Khác) và là bản ghi chuẩn cho *quyết định phát hành*. Module mới ghi *thao tác trong app PipelineX*. Nếu mỗi nơi một taxonomy hoặc cả hai cùng ghi một sự kiện, việc đối chiếu xuyên hệ sẽ rối và sinh mâu thuẫn — đúng loại drift mà quy tắc thay đổi taxonomy của Thanh yêu cầu phải audit trước.

## Quyết định

1. Module Nhật ký thao tác dùng **đúng 4 nhóm của Studio**, không thêm/bớt/đổi tên: Phát hành & duyệt · Cấu hình · Dựng & kiểm chứng · Khác (mã lưu trữ `publish`/`config`/`build`/`other`, nhãn hiển thị qua i18n).
2. **Ranh giới ghi**: quyết định phát hành ở cấp ấn bản (duyệt của Thanh, điều kiện kèm theo) chỉ ghi ở Studio; thao tác kỹ thuật trong app (upload, publish, đổi trạng thái bản ghi, sửa cấu hình, job dựng) chỉ ghi ở module này. Hai bên nối nhau bằng `subject`/`evidence` khi cần đối chiếu, không sao chép sự kiện của nhau.

## Hệ quả

- Một vốn từ vựng nhóm duy nhất cho cả hệ; chip tổng hợp và cách đọc log ở hai nơi giống nhau.
- Thay đổi taxonomy trong tương lai là thay đổi *toàn hệ*: phải qua quy tắc audit taxonomy của Thanh và sửa cả hai phía cùng lúc — ADR này là điểm neo cho việc đó.
- Một số hành động ở vùng giao (ví dụ bấm "publish" trong app sau khi Studio đã duyệt) được hiểu thống nhất: quyết định = Studio, thực thi = PipelineX.

## Phương án đã loại

- **Taxonomy riêng theo module** (ví dụ nhóm theo trang: Từ điển/Giọng/Video/Auth): dễ gắn lúc đầu nhưng lệch chuẩn đã chốt, nhân đôi khái niệm khi đối chiếu với Studio.
- **Gộp hai nhật ký thành một**: Studio là bề mặt quản trị ấn bản và bản ghi quyết định; PipelineX là app vận hành — khác hệ, khác vòng đời; gộp sẽ phá vai trò bản-ghi-chuẩn của mỗi bên.
- **Ghi cả hai nơi cho chắc**: trùng lặp sinh mâu thuẫn khi một phía sửa/che khác phía kia; truy vết phải luôn biết nơi nào là chuẩn — quyết định trên đã phân vai rõ.
