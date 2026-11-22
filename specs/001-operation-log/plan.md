# Kế hoạch kỹ thuật — Nhật ký thao tác (001-operation-log)

**Đặc tả**: `spec.md` · **Hiện trạng**: `research.md` · **Dữ liệu**: `data-model.md` · **Hợp đồng API**: `contracts/operation-log-api.md` · **Quyết định**: `docs/adr/0001`–`0004`

## 1. Tổng quan kiến trúc

Ba mảnh, tất cả đều ở phía server:

1. **Writer dùng chung** — một hàm ghi duy nhất `recordOperation(entry)` (đặt tại `packages/backend/src/operation-log.ts`, cạnh `audit.ts` hiện hữu để dùng chung pool + quy ước) thực hiện: kiểm tra allowlist theo `action`, che theo mẫu nhạy cảm, INSERT vào `operation_log`. Mọi nơi ghi đều qua hàm này — không INSERT trực tiếp rải rác.
2. **Instrumentation tại handler** — các handler hiện hữu gọi writer sau khi thao tác nghiệp vụ thành công (và ở nhánh thất bại có kiểm soát đối với đăng nhập): handler từ điển + giọng + video trong `modules/video/server.ts` (bọc trong `guarded()` sẵn có), hook đăng nhập trong `apps/api/src/routes/admin-auth.ts`, điểm hoàn tất ASR khi có runner xử lý hàng đợi. Thao tác qua editor MCP đi qua cùng handler/hàm nghiệp vụ nên được ghi với `actor_type = agent` theo phiên MCP (xem `actorOf` hiện hữu).
3. **API đọc + trang Nhật ký** — route đọc trong `modules/video/server.ts` (đi qua `guarded()` như mọi route module) và trang `modules/video/web/journal.tsx` thay thế trang giữ chỗ, giữ nguyên khai báo trong `module.ts` (slug `journal`, nhóm Production).

## 2. Lưu trữ

- Bảng riêng `operation_log` trong Postgres hiện hữu của app — đánh giá đầy đủ ở ADR-0001. Phương án đã cân nhắc: (a) dùng chung `audit_log` — bị loại vì schema/ngữ nghĩa khác (before/after của engine, không category/evidence/result) và quyền sở hữu thuộc engine; (b) tệp JSON theo thư mục — bị loại vì không truy vấn/lọc/phân trang được (đúng điểm yếu của `editHistory` hiện tại); (c) dịch vụ log ngoài — quá mức cho quy mô một admin.
- Migration theo đúng cơ chế migration hiện hữu của repo (thư mục migrations của backend), gồm bảng + index + trigger append-only (xem `data-model.md`).
- Writer ghi **đồng bộ trong cùng request** nhưng tách khỏi transaction nghiệp vụ: thao tác chính commit trước, ghi log ngay sau; ghi log lỗi → pino error + `request_id` (FR-009). Không dùng hàng đợi bất đồng bộ ở v1 (tránh mất sự kiện khi tiến trình chết — đúng bài học độ tin cậy của hệ).

## 3. Đường ghi theo nhóm thao tác

| Nhóm | Điểm gắn writer | Ghi chú |
|---|---|---|
| Từ điển | Cuối mỗi handler lexicon trong `modules/video/server.ts` (CRUD, enabled, locked, import apply, export, asr-queue) | Import preview không ghi (chưa thay đổi dữ liệu); apply ghi 1 dòng/đợt kèm số đếm |
| Giọng | Handler PUT voice-config: so cấu hình trước/sau để tách sự kiện (chain đổi / engine bật-tắt / giọng đổi) — tối thiểu 1 dòng `voice.config.update` kèm detail trước→sau; tách mã hành động chi tiết khi chỉ một loại thay đổi xảy ra | Giữ `evidence` = `industry/voice-config.json` |
| Video | Handler tạo/retry/review/publish-kit/style; các điểm YouTube đã có audit giữ nguyên + ghi bản taxonomy | `subject = video:<id>` |
| ASR kết quả | Nơi runner hoàn tất một mục/đợt ASR (khi runner tồn tại) | v1 ghi sự kiện xếp hàng; kết quả ghi khi có runner — đánh dấu phụ thuộc trong `tasks.md` |
| Đăng nhập | `admin-auth.ts`: sau xác thực thành công, ở nhánh sai mật khẩu và nhánh bị rate-limit, và đăng xuất | Không ghi mật khẩu đã thử; `actor` = định danh tài khoản khi biết, ngược lại địa chỉ IP rút gọn theo chuẩn log hiện hữu |

## 4. API đọc

Theo `contracts/operation-log-api.md`: `GET /api/admin/operation-log` (danh sách + lọc + tìm kiếm + phân trang + tổng hợp theo nhóm cho chip) và `GET /api/admin/operation-log/export` (CSV/JSON theo cùng bộ lọc). Không có API ghi. Bảo vệ: session admin + cùng envelope lỗi như module (`{"error": "unauthorized"}` 401; chi tiết 500 cắt 300 ký tự) — nhất quán bề mặt đã pentest ở Chặng 3.

## 5. Giao diện trang Nhật ký

- Thay nội dung trang giữ chỗ trong `modules/video/web/journal.tsx`; khai báo module/sidebar **không đổi** (đúng cam kết v3: thay đúng vị trí đã giữ).
- Bố cục theo mẫu "Nhật ký phát hành" của Studio + design system v3: tiêu đề + tổng số, chip 4 nhóm + Tổng, ô tìm kiếm, bộ lọc, danh sách cuộn riêng (~70vh, header/điều khiển ngoài vùng cuộn — mẫu danh sách dài ở v3 §5), thu gọn 5 dòng + mở rộng, chấm màu trạng thái theo bộ ba status v3 (success = active, failure = blocked, partial = waiting), dòng Evidence, xem chi tiết (mở rộng tại chỗ hiển thị `detail` dạng khóa–giá trị), nút Xuất CSV/JSON.
- Nhãn qua i18n (mục `journal.*` mở rộng), đủ vi + en.

## 6. Kiểm chứng (gắn với tiêu chí thành công của spec)

- Test đơn vị cho writer: allowlist loại trường lạ; che mẫu nhạy cảm; ánh xạ category đúng taxonomy.
- Kịch bản đầu-cuối trên bản dev: thực hiện từng thao tác thuộc FR-002…FR-005 → đối chiếu dòng log (SC-001, SC-002); xuất CSV/JSON đối chiếu bộ lọc (SC-004); quét mẫu secret trên dữ liệu thử (SC-003).
- Typecheck modules + web; kiểm chứng render trong Chrome thật của Thanh trước khi báo xong (quy tắc nghiệm thu của dự án).

## 7. Rủi ro và giảm thiểu

- **Rò rỉ secret vào log** → allowlist + che hai lớp + test quét mẫu (FR-007, SC-003).
- **Ghi log làm chậm thao tác** → INSERT một dòng, index tối thiểu; đo theo NFR-001 trong kịch bản kiểm chứng.
- **Trùng lặp với `audit_log`** → ranh giới viết rõ ở spec mục 5 + ADR-0004; subject/evidence thống nhất để đối chiếu.
- **Bảng phình** → điểm rà soát 1 triệu dòng/12 tháng (data-model), không xoá tự động ở v1.
