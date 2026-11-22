# Nghiên cứu hiện trạng — Nhật ký thao tác (001-operation-log)

Đối chiếu từ Chặng 4 (audit chức năng) và Chặng 7 (recon nguồn dữ liệu), kiểm chứng trực tiếp trên checkout `D:\channels\diem-tin-cong-nghe` ngày 2026-11-23.

## App đã ghi log gì rồi

| Nguồn | Nơi lưu | Nội dung | Đọc ở đâu | Đánh giá |
|---|---|---|---|---|
| `audit_log` (engine) | Bảng Postgres, ghi qua `packages/backend/src/audit.ts` (`audit()` chèn actor/action/subject/reason/before/after/request_id) | Hành động tầng engine: content.* (sửa ngày phát hành, chạy lại bước, làm mới trình bày), models.switch, receipt.release, delivery.drop, báo cáo theo nguồn | `GET /api/admin/audit` (listAudit: lọc subject/action + phân trang) + trang `/admin/audit` | Nền audit thật, append-only theo thông lệ. Schema thiên về before/after của engine, không có nhóm taxonomy Studio, không có trường evidence/result riêng |
| Thao tác YouTube của module video | Cùng bảng `audit_log`, qua `auditAgent()` trong `modules/video/backend/operations.ts` | 4 hành động: `video.youtube.connect`, `video.youtube.upload`, `video.youtube.thumbnail`, `video.youtube.publish` (server.ts) | Chung trang `/admin/audit` | Module video mới chỉ ghi đúng 4 hành động này |
| Lịch sử sửa theo từng video | Tệp JSON trong thư mục dữ liệu của video, qua `recordEdit()`/`editHistory()` trong `modules/video/backend/editing.ts` | Các lần sửa nội dung một video cụ thể | Trong trang chi tiết video | Rời rạc theo video; không truy vấn/tìm kiếm/lọc toàn cục được |
| Bản ghi YouTube theo video | Tệp JSON (`youtube.ts`: recordFile theo video + `publish.json` của publish kit) | Kết quả upload/publish từng video | Trong luồng video | Là dữ kiện nghiệp vụ, không phải nhật ký thao tác |
| Bảng vận hành | Postgres: `job_runs`, `fetch_runs`, `ingest_events`, `video_jobs` | Lần chạy job/fetch/ingest và hàng đợi dựng video | Trang Runs (`/admin/runs`) và overview | Ghi ở mức job, không gắn người thực hiện/thao tác admin |
| Phiên admin | Postgres: `admin_sessions`, `admin_users` | Phiên đăng nhập đang sống | Nội bộ (kiểm tra phiên) | Suy ra được "có phiên", không phải sự kiện đăng nhập/đăng xuất/thất bại |
| Log hệ thống | Tệp `.data/logs/*.log` (pino JSON) | Debug/vận hành của web + API | Đọc tệp trực tiếp | Không cấu trúc theo thao tác; chứa cả nhiễu kỹ thuật; không phải nơi tra cứu nghiệp vụ |

## Cái còn thiếu (khoảng trống module này lấp)

1. **Thao tác từ điển không có lịch sử**: các handler thêm/sửa/xoá/bật-tắt/khoá/nhập-xuất/xếp hàng ASR trong `modules/video/server.ts` không gọi ghi audit ở đâu cả. Đợt nhập hàng loạt chỉ còn lại trạng thái cuối của bảng `pronunciation_lexicon` + tệp `industry/lexicon.json` đã materialize — không biết ai nhập, nhập từ tệp nào, kết quả từng đợt ra sao (trái với tinh thần ADR-002 của trang Từ điển: mỗi đợt nhập cần một dòng nhật ký kèm evidence).
2. **Đổi cấu hình giọng không có lịch sử**: PUT `/api/admin/video/voice-config` ghi đè `industry/voice-config.json` không dấu vết — chính là điểm mù đã gây khó khăn khi truy vết sự cố chuỗi giọng tối 22/11/2026.
3. **Hành động video ngoài YouTube không có lịch sử**: tạo video, retry, quyết định review, đổi style rule không vào `audit_log`.
4. **Sự kiện đăng nhập không có**: đăng nhập thành công/thất bại/đăng xuất không được ghi ở dạng truy vấn được (thất bại chỉ còn vết trong log tệp của API).
5. **Không có bề mặt đọc hợp nhất cho module**: trang `/admin/audit` của engine hiển thị `audit_log` theo subject/action — không có nhóm taxonomy Studio, không có chip tổng hợp, không xuất CSV/JSON, và không chứa các thao tác ở mục 1–4.

## Kết luận nghiên cứu

- Hạ tầng DB (Postgres dùng chung) và thói quen ghi audit đã có sẵn; module này **mở rộng phạm vi ghi** cho thao tác trong app thay vì dựng hệ log song song từ số 0.
- Quyết định kiến trúc chính (chi tiết ở `plan.md` và `docs/adr/`): bảng riêng `operation_log` trong cùng Postgres (schema có category/evidence/result theo đặc tả), đường ghi là instrumentation phía server dùng chung cho handler của module video và hook đăng nhập của engine, API đọc + trang Nhật ký thay trang giữ chỗ.
- `audit_log` của engine giữ nguyên vai trò; hai bảng phân biệt theo phạm vi (engine vs thao tác trong app module video + auth) và được nối khi đối chiếu bằng `subject`/`evidence` — không di trú, không ghi trùng sự kiện engine.
