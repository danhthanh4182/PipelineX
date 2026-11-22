# Đặc tả tính năng: Nhật ký thao tác (Operation Log) — PipelineX

**Thư mục đặc tả**: `specs/001-operation-log/`
**Ngày tạo**: 2026-11-23
**Trạng thái**: Bản thảo — chờ Thanh duyệt trước khi triển khai
**Đầu vào**: Lệnh của Thanh (23/11/2026) sau Chặng 4 (audit chức năng) và Chặng 7 (recon + giữ chỗ trang Nhật ký). Chuẩn áp dụng: ADR-001 của Thanh — *việc không có log + evidence thì chưa coi là xong*; design system v3 §5 (mẫu mục giữ chỗ, slug số ít, nhãn i18n đủ vi/en).

## 1. Bối cảnh và mục đích

Admin PipelineX (kênh Điểm Tin Công Nghệ) hiện ghi lại được một phần thao tác: bảng `audit_log` của engine ghi các hành động tầng engine (nội dung, model, delivery…) và 4 hành động YouTube của module video. Nhưng phần lớn thao tác hằng ngày trong module video — sửa từ điển đọc, đổi cấu hình giọng, tạo/duyệt/đổi trạng thái video, xếp hàng ASR — **không để lại dấu vết nào có thể truy lại được**: ai đổi, đổi lúc nào, đổi gì, kết quả ra sao. Khi có sự cố (ví dụ cấu hình giọng lệch khỏi ý định), không có cách trả lời ngoài việc đoán.

Tính năng này xây **module ghi nhật ký thao tác** cho các thao tác diễn ra *trong app PipelineX*, và trang **Nhật ký** tại `/admin/journal` (đang là trang giữ chỗ "Chờ module") để xem, lọc, tìm kiếm và xuất log.

## 2. Câu chuyện người dùng

### US1 — Xem lại thao tác gần đây (Ưu tiên P1)
Admin mở trang Nhật ký và thấy các thao tác mới nhất trong app (mặc định thu gọn 5 dòng gần nhất, mở rộng để xem thêm), mỗi dòng có thời gian, người thực hiện, hành động, đối tượng, kết quả.
*Kiểm chứng*: mở `/admin/journal` sau khi thực hiện một thao tác từ điển → dòng tương ứng xuất hiện ở đầu danh sách với đủ trường.

### US2 — Truy vết một thay đổi cấu hình (Ưu tiên P1)
Khi cấu hình giọng hoặc một mục từ điển bị đổi ngoài ý muốn, admin lọc theo nhóm "Cấu hình" / tìm theo đối tượng (tên engine, thuật ngữ) và biết chính xác ai đã đổi, lúc nào, giá trị trước → sau ở mức chi tiết cho phép.
*Kiểm chứng*: đổi giọng của một engine rồi tìm theo tên engine → thấy dòng log kèm chi tiết thay đổi.

### US3 — Xuất log để đối chiếu (Ưu tiên P2)
Admin xuất CSV/JSON đúng với bộ lọc đang áp dụng để đối chiếu với nhật ký phát hành ở Studio hoặc gửi kèm báo cáo sự cố.
*Kiểm chứng*: đặt bộ lọc nhóm + khoảng thời gian, bấm Xuất CSV → file nhận được chỉ chứa các dòng khớp bộ lọc, đủ cột theo schema sự kiện.

### US4 — Phân biệt người thực hiện (Ưu tiên P2)
Mỗi dòng log phân biệt rõ người thực hiện thuộc loại nào: **admin** (người đăng nhập), **hệ thống** (job/tác vụ tự động), **agent** (thao tác qua editor MCP / tác nhân tự động) — để việc truy vết không lẫn giữa người và máy.
*Kiểm chứng*: một hành động qua editor MCP và một hành động qua giao diện admin xuất hiện với loại người thực hiện khác nhau.

## 3. Yêu cầu chức năng

### 3.1 Ghi sự kiện (phạm vi v1)

- **FR-001**: Hệ thống PHẢI ghi một dòng log cho mọi thao tác thuộc phạm vi v1 dưới đây, ngay trong cùng request xử lý thao tác đó (ghi phía server — xem ADR-003).
- **FR-002 — Thao tác từ điển**: thêm, sửa, xoá mục; bật/tắt một mục và bật/tắt hàng loạt; khoá/mở khoá; nhập hàng loạt (preview không ghi; **apply** ghi kèm số mục thêm/cập nhật/bỏ qua/lỗi và tên tệp nguồn); xuất JSON/CSV; xếp hàng kiểm chứng ASR (kèm số mục) và kết quả ASR khi có (đạt/trượt theo từng đợt).
- **FR-003 — Đổi cấu hình giọng**: thay đổi chuỗi ưu tiên (thứ tự trước → sau), bật/tắt engine, đổi giọng đọc/giọng nghe thử của engine, khôi phục thứ tự mặc định.
- **FR-004 — Hành động video**: tạo video, thử lại (retry), duyệt/từ chối ở bước review, đổi trạng thái phát hành (publish/unpublish qua YouTube connect/upload/thumbnail/publish — các hành động này hiện đã ghi vào `audit_log` của engine; module này ghi bản song song theo taxonomy chung để trang Nhật ký hiển thị hợp nhất, subject giữ nguyên định danh `video:<id>` để đối chiếu hai phía không lẫn — xem mục 5 về ranh giới), tạo publish kit, đổi style rule.
- **FR-005 — Sự kiện đăng nhập admin**: đăng nhập thành công, đăng nhập thất bại (kèm lý do loại: sai mật khẩu / bị giới hạn tốc độ — không ghi mật khẩu đã thử), đăng xuất.
- **FR-006 — Trường sự kiện bắt buộc**: mỗi dòng log gồm `id`, `at` (thời gian, múi giờ lưu UTC, hiển thị Asia/Ho_Chi_Minh), `actor_type` (`admin` | `system` | `agent`), `actor` (định danh hiển thị), `action` (mã hành động dạng `lexicon.create`, `voice.chain.update`, `auth.login.failed`…), `category` (một trong 4 nhóm ở mục 4), `subject` (đối tượng tác động, ví dụ `lexicon:<term>`, `voice-config`, `video:<id>`, `auth`), `detail` (chi tiết có cấu trúc theo allowlist từng hành động), `evidence` (tham chiếu kiểm chứng được: đường dẫn tệp, id bản ghi, URL nội bộ hoặc mã đợt nhập), `result` (`success` | `failure` | `partial` kèm thông điệp lỗi đã rút gọn khi thất bại).
- **FR-007 — Không ghi secrets**: mật khẩu, token, API key, nội dung tệp cấu hình chứa secret và thân request thô TUYỆT ĐỐI không vào log. `detail` chỉ chứa các trường trong allowlist của từng hành động; giá trị dạng khoá bí mật bị thay bằng nhãn `[đã che]`. (Xem quy tắc che ở `data-model.md`.)
- **FR-008 — Append-only**: dòng log đã ghi không được sửa hoặc xoá bởi bất kỳ vai trò nào trong app, kể cả admin (ADR-002). Không có API sửa/xoá log.
- **FR-009 — Ghi log không làm hỏng thao tác chính**: nếu việc ghi log thất bại, thao tác nghiệp vụ vẫn hoàn tất và lỗi ghi được báo vào log hệ thống (pino) ở mức error kèm mã hành động — không nuốt lỗi im lặng.

### 3.2 Đọc và trình bày

- **FR-010**: Trang `/admin/journal` thay thế trang giữ chỗ hiện tại (giữ nguyên slug và vị trí sidebar nhóm Production), hiển thị: hàng chip tổng hợp theo nhóm (Tổng số dòng · Phát hành & duyệt · Cấu hình · Dựng & kiểm chứng · Khác), ô tìm kiếm (khớp hành động/chi tiết/evidence/người thực hiện), bộ lọc nhóm + khoảng thời gian, chế độ thu gọn 5 dòng gần nhất + mở rộng/phân trang, mỗi dòng gồm chấm màu trạng thái + hành động + người thực hiện + thời gian + mô tả + dòng Evidence + xem chi tiết đầy đủ.
- **FR-011**: API đọc `GET /api/admin/operation-log` hỗ trợ lọc theo `category`, `actor_type`, `action`, tìm kiếm `q`, khoảng thời gian `from`/`to`, phân trang `page`/`pageSize`; chỉ phiên admin hợp lệ mới gọi được (401 khi chưa đăng nhập, theo đúng cơ chế bảo vệ hiện hữu của module).
- **FR-012**: Xuất log: `GET /api/admin/operation-log/export?format=csv|json` tôn trọng đúng bộ lọc đang áp dụng; tên tệp chứa khoảng thời gian xuất.
- **FR-013**: Mọi nhãn giao diện của trang Nhật ký qua i18n, đủ cả vi và en; slug giữ dạng số ít (`journal`), nhất quán quy ước design system v3 §5.

## 4. Phân loại sự kiện (taxonomy — bám đúng Studio)

Bốn nhóm, không chế thêm:

| Nhóm | Gồm các hành động |
|---|---|
| **Phát hành & duyệt** | Duyệt/từ chối video ở bước review, đổi trạng thái phát hành, upload/publish/thumbnail YouTube, tạo publish kit |
| **Cấu hình** | Mọi thao tác từ điển (FR-002), đổi cấu hình giọng (FR-003), đổi style rule |
| **Dựng & kiểm chứng** | Tạo video, retry, xếp hàng + kết quả ASR, các bước dựng do hệ thống/agent thực hiện |
| **Khác** | Đăng nhập/đăng xuất admin, sự kiện không thuộc ba nhóm trên |

## 5. Ranh giới với Nhật ký phát hành ở Studio

- **Nhật ký phát hành (Studio)** là **bản ghi chuẩn cho quyết định phát hành**: duyệt bài/video ở cấp ấn bản, quyết định của Thanh, điều kiện kèm theo. Nó sống ở Space Studio, không thuộc app này.
- **Nhật ký thao tác (module này)** ghi **thao tác trong app PipelineX**: ai bấm gì trong admin, job nào chạy, kết quả kỹ thuật ra sao.
- Hai bên **không ghi trùng cùng một sự kiện**: quyết định duyệt phát hành ở cấp ấn bản chỉ ghi ở Studio; thao tác kỹ thuật thực thi trong app (upload, publish, đổi trạng thái bản ghi video) ghi ở đây. Khi cần đối chiếu, dùng `evidence`/`subject` (ví dụ `video:<id>`) để nối hai phía thủ công.

## 6. Yêu cầu phi chức năng

- **NFR-001 (hiệu năng ghi)**: ghi log thêm tối đa ~50ms vào thời gian xử lý của thao tác được ghi (đo ở máy hiện tại); không mở kết nối DB phụ ngoài pool hiện hữu.
- **NFR-002 (hiệu năng đọc)**: API danh sách trả trang đầu (50 dòng) dưới 500ms với bảng 100.000 dòng, nhờ index theo thời gian và nhóm (xem `data-model.md`).
- **NFR-003 (bảo mật)**: không endpoint ghi công khai; đường ghi là instrumentation nội bộ phía server. API đọc đi qua cùng lớp bảo vệ như mọi route admin của module (session + CSRF cho thao tác ghi phía client — trang này chỉ đọc nên không phát sinh thao tác ghi từ client).
- **NFR-004 (lưu trữ)**: giữ toàn bộ log tối thiểu 12 tháng; v1 không tự xoá — chính sách dọn dẹp là quyết định riêng sau khi có số liệu tăng trưởng (xem `data-model.md`).
- **NFR-005 (nhất quán hiển thị)**: thời gian hiển thị theo Asia/Ho_Chi_Minh; mã hành động giữ tiếng Anh dạng dot-notation để tìm kiếm ổn định, nhãn hiển thị dịch qua i18n.

## 7. Tiêu chí thành công (đo được)

- **SC-001**: 100% thao tác thuộc phạm vi v1 (FR-002…FR-005) tạo đúng một dòng log truy được trong vòng 5 giây sau khi thao tác hoàn tất (kiểm chứng bằng kịch bản thử liệt kê từng thao tác).
- **SC-002**: Truy vết một thay đổi cấu hình giọng bất kỳ ra người thực hiện + thời điểm + chi tiết thay đổi trong tối đa 2 phút thao tác trên trang Nhật ký.
- **SC-003**: Quét tự động trên toàn bộ dòng log mẫu thử không tìm thấy chuỗi nào khớp mẫu secret (token/mật khẩu/key) — 0 rò rỉ.
- **SC-004**: Tệp xuất CSV/JSON khớp 100% với bộ lọc đã áp dụng (đối chiếu số dòng và một mẫu ngẫu nhiên 10 dòng).
- **SC-005**: Trang Nhật ký thay thế trang giữ chỗ tại đúng slug `/admin/journal` và vị trí sidebar, không còn dòng chữ "Chờ module".

## 8. Phạm vi NGOÀI (v1 không làm)

- Debug log hệ thống (pino, file log ở `.data/logs`) — giữ nguyên vai trò riêng, không hợp nhất vào nhật ký thao tác.
- Ghi thao tác của engine (nội dung/model/delivery) — đã có `audit_log` + trang `/admin/audit`; module này không ghi thay và không di trú dữ liệu đó.
- Sửa/xoá/khôi phục dòng log; cảnh báo real-time; streaming log trực tiếp.
- Ghi thao tác ở các bề mặt ngoài app PipelineX (Studio, Telegram, web công khai).
- Tự động dọn log theo hạn (retention job) — để quyết định sau (NFR-004).
