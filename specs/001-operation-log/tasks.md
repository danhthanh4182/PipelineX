# Danh sách việc triển khai — Nhật ký thao tác (001-operation-log)

Thứ tự theo phụ thuộc. Mỗi việc có tiêu chí xong rõ ràng. **Chỉ bắt đầu khi Thanh duyệt `spec.md`.**

## Giai đoạn 1 — Nền dữ liệu và writer

- [ ] **T001** Migration tạo bảng `operation_log` + 4 index + trigger append-only (theo `data-model.md`), chạy qua cơ chế migration hiện hữu của repo.
  *Xong khi*: migration áp thành công trên DB dev; INSERT thử được; UPDATE/DELETE thử bị trigger chặn.
- [ ] **T002** Writer `recordOperation()` tại `packages/backend/src/operation-log.ts`: allowlist `detail` theo `action`, che mẫu nhạy cảm, ánh xạ `category` từ `action` theo bảng taxonomy, lỗi ghi → pino error (không ném ngược vào thao tác chính).
  *Xong khi*: test đơn vị đạt cho allowlist/che/ánh xạ; gọi thử từ một handler ghi được dòng đúng hình dạng.
- [ ] **T003** Bổ sung tiền tố `/api/admin/operation-log` vào `apiPaths` của module video trong `module.ts`.
  *Xong khi*: route thử (chưa có handler) tới được API process thay vì rơi vào web (kiểm chứng bằng request chưa đăng nhập → 401 từ API).

## Giai đoạn 2 — Gắn ghi theo nhóm thao tác (phụ thuộc T002)

- [ ] **T004** Gắn writer vào các handler từ điển (CRUD, enabled hàng loạt, locked, import apply, export, asr-queue) trong `modules/video/server.ts`.
  *Xong khi*: từng thao tác thử tạo đúng 1 dòng log với subject/detail/evidence đúng spec FR-002.
- [ ] **T005** Gắn writer vào PUT voice-config: tách sự kiện theo diff trước/sau (chain/engine/giọng).
  *Xong khi*: đổi chuỗi, tắt engine, đổi giọng — mỗi loại đều có dòng log truy được kèm trước→sau (SC-002).
- [ ] **T006** Gắn writer vào các handler video (create, retry, review, publish-kit, style) và các điểm YouTube hiện có (ghi bản taxonomy song song, subject/evidence nối sang `audit_log`).
  *Xong khi*: kịch bản tạo → review → publish thử cho đủ dòng ở nhóm Phát hành & duyệt + Dựng & kiểm chứng.
- [ ] **T007** Gắn hook đăng nhập/đăng xuất vào `apps/api/src/routes/admin-auth.ts` (thành công, sai mật khẩu, bị rate-limit, đăng xuất).
  *Xong khi*: 4 tình huống đều có dòng `auth.*` và không tình huống nào ghi mật khẩu đã thử.
- [ ] **T008** *(phụ thuộc runner ASR tồn tại)* Gắn sự kiện kết quả ASR tại điểm runner hoàn tất mục/đợt.
  *Xong khi*: một đợt ASR thử có dòng kết quả kèm số đạt/trượt. Nếu runner chưa có ở thời điểm triển khai, việc này tách thành đợt sau và spec FR-002 phần kết quả ASR ghi rõ "chờ runner".

## Giai đoạn 3 — Đọc và giao diện (phụ thuộc T001; song song được với Giai đoạn 2)

- [ ] **T009** API đọc `GET /api/admin/operation-log` + `export` theo `contracts/operation-log-api.md` (lọc/tìm kiếm/phân trang/summary; giới hạn xuất 10.000 dòng).
  *Xong khi*: đáp khớp hợp đồng trên dữ liệu thử; chưa đăng nhập → 401; xuất khớp bộ lọc (SC-004).
- [ ] **T010** Viết lại `modules/video/web/journal.tsx` thành trang Nhật ký thật theo mẫu Studio + design system v3 (chip nhóm, tìm kiếm, vùng cuộn riêng, thu gọn 5 dòng, xem chi tiết, nút xuất), mở rộng khóa i18n `journal.*` đủ vi/en. Khai báo `module.ts` và vị trí sidebar giữ nguyên.
  *Xong khi*: trang hiển thị dữ liệu thật từ T009; không còn chữ "Chờ module" (SC-005); typecheck modules + web đạt.

## Giai đoạn 4 — Kiểm chứng và đóng gói

- [ ] **T011** Kịch bản kiểm chứng đầu-cuối toàn bộ FR-002…FR-005 (SC-001) + quét mẫu secret trên log thử (SC-003) + đo độ trễ ghi (NFR-001).
  *Xong khi*: bảng đối chiếu thao tác ↔ dòng log đạt 100%; quét secret = 0; số đo độ trễ ghi lại kèm theo.
- [ ] **T012** Kiểm chứng render trong Chrome thật của Thanh (trang Nhật ký + luồng truy vết mẫu) và cập nhật tài liệu: trang giữ chỗ trong báo cáo Chặng 7 được đánh dấu đã thay thế; `research.md` bổ sung kết quả triển khai.
  *Xong khi*: Thanh xác nhận bằng mắt; nhật ký công việc của dự án ghi lại mốc hoàn thành kèm evidence.
