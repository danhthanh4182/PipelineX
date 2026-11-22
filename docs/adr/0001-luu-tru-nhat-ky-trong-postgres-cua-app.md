# ADR-0001: Lưu nhật ký thao tác trong Postgres của app, bảng riêng `operation_log`

**Trạng thái**: Đề xuất (chờ Thanh duyệt cùng bộ đặc tả 001-operation-log)
**Ngày**: 2026-11-23

## Bối cảnh

Module Nhật ký thao tác (specs/001-operation-log) cần nơi lưu sự kiện có: truy vấn theo thời gian/nhóm/đối tượng/người thực hiện, phân trang, tổng hợp theo nhóm và xuất CSV/JSON. App đã vận hành Postgres chung cho mọi dữ liệu nghiệp vụ (kể cả bảng `audit_log` của engine và `pronunciation_lexicon`). Tiền lệ lưu tệp (lịch sử sửa theo video trong `editing.ts`) cho thấy tệp JSON theo thư mục không truy vấn toàn cục được.

## Quyết định

Lưu vào **Postgres hiện hữu của app**, trong **bảng riêng `operation_log`** với schema ở `specs/001-operation-log/data-model.md` (có `category`, `evidence`, `result` — các trường mà `audit_log` không có).

## Hệ quả

- Dùng chung pool/kết nối và cơ chế migration hiện hữu; không thêm hạ tầng, không thêm phụ thuộc vận hành.
- Truy vấn/lọc/phân trang/tổng hợp dùng SQL + index — đáp ứng NFR-002.
- Hai bảng audit cùng tồn tại theo phạm vi rõ ràng (engine ↔ thao tác trong app); đối chiếu qua `subject`/`evidence`.
- Cần kỷ luật tăng trưởng: điểm rà soát ở 1 triệu dòng/12 tháng (xem data-model).

## Phương án đã loại

- **Ghi vào `audit_log` dùng chung**: schema thiên về before/after của engine, thiếu category/evidence/result; trộn hai phạm vi làm mờ quyền sở hữu và buộc phải sửa bảng của engine — rủi ro lan sang bề mặt đã ổn định.
- **Tệp JSON/JSONL theo thư mục**: rẻ lúc đầu nhưng không lọc/tìm kiếm/phân trang/tổng hợp được; đúng điểm yếu đã thấy ở lịch sử sửa theo video.
- **Dịch vụ log ngoài (SaaS/self-host riêng)**: quá mức cho một admin nội bộ; thêm phụ thuộc, thêm bề mặt rò rỉ dữ liệu, trái ưu tiên tự host gọn của dự án.
