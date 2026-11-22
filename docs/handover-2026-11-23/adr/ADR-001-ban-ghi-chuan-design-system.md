# ADR-001 — Design system: một bản ghi chuẩn duy nhất, MD là bản phân xử

- **Trạng thái:** Đã chấp nhận (Thanh chốt qua các lượt 01:00–01:14, 23/11/2026)
- **Ngày:** 23/11/2026
- **Bối cảnh:** Design system Điểm Tin Công Nghệ tồn tại ở nhiều bề mặt: tài liệu MD, bản dựng HTML độc lập, Space "Design System — Điểm Tin Công Nghệ", bản sao trong `docs\` của project PipelineX, và các mockup ở các Space liên quan. Đêm 22→23/11, hai tuyến (chat chính và tuyến Studio) cùng sửa một tài liệu, sinh ra các bản lệch nhau (module Voice theo panel Studio vs theo trang thật `/admin/voice`; fix layout shift có ở bản xuất Space nhưng chưa có ở bản dựng file). Thanh đã bắt lỗi trực tiếp hai lần (thiếu nút trong module mẫu; fix layout shift chưa tương đương).

## Quyết định

1. **Một bản ghi chuẩn duy nhất** đặt tại `~/workspace/video-studio/design-system-v2/design-system-diem-tin-cong-nghe-v3.md` + `.html` (phiên bản hiện tại v3.1). Mọi bề mặt khác (Space, `docs\` trong project, mockup) là **bản phái sinh** — phải đồng bộ từ bản chuẩn, không tự sửa độc lập.
2. **Khi các bản dựng lệch nhau, file MD là bản phân xử** về mặt spec (token, quy tắc, hành vi yêu cầu); bản dựng HTML chuẩn là bản phân xử về mặt cài đặt mẫu.
3. **Module mẫu trong design system kế thừa module thật đang chạy** (Từ điển đọc ← `/admin/lexicon`, Giọng đọc ← `/admin/voice`). Module thật thay đổi thì module mẫu đồng bộ cùng lượt; lệch nhau là lỗi của design system, không phải của module thật.
4. Mọi thay đổi thiết kế phải cập nhật vào bản chuẩn **trong cùng lượt** với việc tạo ra nó (mở rộng design sync rule đã có trong AGENTS.md).

## Hệ quả

- Dương tính: hết drift giữa các bề mặt; tranh chấp "bản nào đúng" có căn cứ phân xử rõ ràng; việc đồng bộ `docs\` trở thành thao tác cơ học (chép + kiểm chứng md5/dung lượng).
- Âm tính: thêm một bước đồng bộ sau mỗi lần sửa; tuyến sở hữu bề mặt phải chờ bản chuẩn cập nhật thay vì tự sửa tại chỗ.
- Trung lập: bản xuất từ Space chỉ là bằng chứng hiển thị tại một thời điểm, không bao giờ tự động trở thành bản chuẩn.

## Phương án đã loại

- *Mỗi bề mặt giữ bản riêng và đối chiếu định kỳ:* đã thử trong thực tế và sinh đúng loại lỗi Thanh phải bắt bằng mắt (thiếu nút, lệch fix).
- *Lấy bản xuất Space làm chuẩn:* bản xuất là ảnh chụp render, thiếu tính độc lập của bản dựng file và không ổn định giữa các lần xuất.
