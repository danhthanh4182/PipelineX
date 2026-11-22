# Mô hình dữ liệu — Nhật ký thao tác (001-operation-log)

## Bảng `operation_log` (Postgres của app, DB `pipelinex_diem_tin_cong-nghe`)

Bảng riêng, append-only, cùng cơ sở dữ liệu với `audit_log` của engine nhưng không dùng chung (lý do: ADR-001 trong `docs/adr/`).

| Cột | Kiểu | Ràng buộc / mặc định | Ý nghĩa |
|---|---|---|---|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY` | PRIMARY KEY | Định danh dòng log, tăng đơn điệu |
| `at` | `timestamptz` | NOT NULL, DEFAULT `now()` | Thời điểm sự kiện (lưu UTC; hiển thị Asia/Ho_Chi_Minh) |
| `actor_type` | `text` | NOT NULL, CHECK IN (`admin`, `system`, `agent`) | Loại người thực hiện |
| `actor` | `text` | NOT NULL | Định danh hiển thị: tên phiên admin / `system:<job>` / `agent:<tên>` |
| `action` | `text` | NOT NULL | Mã hành động dot-notation, ví dụ `lexicon.create`, `lexicon.bulk_enabled`, `lexicon.import.apply`, `lexicon.asr.queue`, `voice.chain.update`, `voice.engine.toggle`, `voice.voice.change`, `video.create`, `video.retry`, `video.review`, `video.publish`, `auth.login.success`, `auth.login.failed`, `auth.logout` |
| `category` | `text` | NOT NULL, CHECK IN (`publish`, `config`, `build`, `other`) | Nhóm taxonomy: `publish` = Phát hành & duyệt, `config` = Cấu hình, `build` = Dựng & kiểm chứng, `other` = Khác (nhãn hiển thị qua i18n) |
| `subject` | `text` | NOT NULL | Đối tượng tác động: `lexicon:<term>`, `lexicon:import:<batchId>`, `voice-config`, `voice:<engine>`, `video:<id>`, `auth` |
| `detail` | `jsonb` | NOT NULL DEFAULT `'{}'` | Chi tiết có cấu trúc theo allowlist từng hành động (xem Quy tắc che) |
| `evidence` | `text` | NULL | Tham chiếu kiểm chứng: đường dẫn tệp, id bản ghi liên quan, mã đợt, URL nội bộ |
| `result` | `text` | NOT NULL, CHECK IN (`success`, `failure`, `partial`) | Kết quả thao tác |
| `error` | `text` | NULL | Thông điệp lỗi rút gọn (tối đa 300 ký tự, cùng chuẩn cắt của handler hiện hữu) khi `result` ≠ `success` |
| `request_id` | `text` | NULL | Mã request của API (nối với log hệ thống khi cần) |

### Index

- `operation_log_at_idx` — (`at` DESC): trang danh sách mặc định.
- `operation_log_category_at_idx` — (`category`, `at` DESC): lọc theo nhóm + chip tổng hợp.
- `operation_log_subject_idx` — (`subject`): truy vết một đối tượng.
- `operation_log_actor_at_idx` — (`actor_type`, `actor`, `at` DESC): lọc theo người thực hiện.
- Tìm kiếm toàn văn v1 dùng `ILIKE` trên `action`, `subject`, `actor`, `evidence` và `detail::text` (khớp hành vi tìm kiếm hiện tại của trang Từ điển); đánh giá lại khi bảng vượt ~100.000 dòng.

### Append-only — cơ chế thực thi

- Tầng ứng dụng: không tồn tại hàm update/delete cho bảng này; API chỉ có INSERT (nội bộ) và SELECT.
- Tầng CSDL (khuyến nghị khi triển khai): trigger `BEFORE UPDATE OR DELETE ON operation_log` RAISE EXCEPTION — chặn cả thao tác tay nhầm lẫn ngoài app.
- Tài khoản DB của app hiện dùng chung một vai trò cho mọi bảng; việc tách quyền (REVOKE UPDATE/DELETE) chỉ khả thi nếu tách vai trò — ghi nhận là cải tiến sau, trigger là hàng rào chính ở v1.

## Quy tắc che (redaction) — bắt buộc

1. `detail` chỉ chứa trường nằm trong **allowlist theo từng `action`** (định nghĩa trong mã nguồn cạnh writer; trường lạ bị loại trước khi ghi).
2. Không bao giờ ghi: mật khẩu (kể cả mật khẩu gõ sai), token/refresh token, API key, giá trị biến môi trường dạng secret, nội dung `.env`, thân request/response thô, nội dung đầy đủ của tệp nhập từ điển (chỉ ghi tên tệp + số đếm + mã băm ngắn nếu cần đối chiếu).
3. Giá trị thay đổi cấu hình được ghi ở mức **trước → sau** cho các trường không nhạy cảm (thứ tự chuỗi, tên giọng, trạng thái bật/tắt, term/reading của từ điển). Trường bị nghi nhạy cảm theo mẫu (khớp `token|secret|key|password|authorization`) bị thay bằng chuỗi `[đã che]` ngay trong writer — lớp phòng thủ thứ hai sau allowlist.
4. `error` chỉ chứa thông điệp đã rút gọn của hệ thống, không chứa stack trace, không chứa SQL gốc.

## Chính sách lưu trữ

- v1: **giữ toàn bộ**, không tự xoá (NFR-004: tối thiểu 12 tháng). Ước lượng tăng trưởng: thao tác admin thủ công thưa (hàng chục dòng/ngày) + sự kiện job/ASR theo đợt (hàng trăm dòng/ngày ở ngày cao điểm) — bảng vẫn ở mức dễ quản lý trong năm đầu.
- Điểm rà soát: khi bảng đạt 1.000.000 dòng hoặc sau 12 tháng — quyết định retention (nén/đưa sang bảng lưu trữ) bằng một ADR bổ sung; không tự ý xoá.

## Quan hệ với dữ liệu sẵn có

- `audit_log` (engine): giữ nguyên; các hành động YouTube tiếp tục ghi ở đó như hiện tại, đồng thời module này ghi bản theo taxonomy vào `operation_log` với cùng `subject` (`video:<id>`) và `evidence` trỏ id dòng audit nếu có — phục vụ đối chiếu, không coi là ghi trùng sự kiện engine (xem ranh giới ở `spec.md` mục 5).
- Lịch sử sửa theo video (`editing.ts`) và bản ghi YouTube theo tệp: giữ nguyên vai trò dữ kiện nghiệp vụ; `evidence` của dòng log video trỏ tới các tệp/bản ghi này.
