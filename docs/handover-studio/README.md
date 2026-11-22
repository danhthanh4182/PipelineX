# Tài liệu bàn giao: Space Studio Xuất Bản Video Tin Tức → PipelineX

Ngày bàn giao: 22/11/2026 · Người bàn giao: Muse (theo lệnh của Thanh) · Nơi nhận: repo PipelineX, thư mục `docs/handover-studio/`

## Hai hệ thống là gì

- **Space Studio Xuất Bản Video Tin Tức** (Space Muse, slug `studio-xuat-ban-video-tin-tuc`): BÀN ĐIỀU PHỐI VÀ DUYỆT PHÁT HÀNH. Giữ bản ghi canonical của mỗi video, cấu hình giọng chuẩn, từ điển phát âm, các cổng QA, trạng thái phát hành theo từng nền tảng và nhật ký kiểm toán. Space KHÔNG tự dựng video ở quy mô sản xuất.
- **PipelineX** (repo này): ĐỘNG CƠ SẢN XUẤT. Thu thập tin → phân tích → gộp story → kịch bản + dossier + fact-check → tổng hợp giọng → render Remotion (16:9 + 9:16) → publish kit. PipelineX KHÔNG tự phát hành khi chưa có duyệt.

Nguyên tắc kế thừa (Thanh chốt 18:28 22/11/2026): sản phẩm cuối là video hoàn thiện đăng được nhiều nền tảng, làm ra bằng cách kế thừa tính năng của CẢ hai hệ — không xây hệ thứ ba, không nhân đôi bàn duyệt vào repo.

## Cách dùng bộ tài liệu này

1. `FEATURE-GAP.md` — bảng đối chiếu từng tính năng của Space với trạng thái trong repo, kèm quyết định cho từng mục: PORT (đưa vào repo), BRIDGE (giữ ở Space, repo nối qua cầu M1), LEAVE (giữ nguyên ở Space, repo không cần).
2. `spec.md` — đặc tả theo chuẩn spec-kit: user story theo mức ưu tiên, yêu cầu chức năng FR, tiêu chí thành công SC. Đây là nguồn sự thật về "làm gì".
3. `plan.md` — kế hoạch kỹ thuật: kiến trúc, mô hình dữ liệu, hợp đồng (contract) giữa hai hệ. Nguồn sự thật về "làm thế nào".
4. `tasks.md` — danh sách việc theo pha, có thứ tự phụ thuộc và bằng chứng nghiệm thu cho từng việc (chuẩn ADR-001 của Studio: xong = có log + bằng chứng đọc lại được).

## Nguồn chuẩn phải đọc kèm (trong workspace của Studio)

- `studio-voice-standard.json` — cấu hình giọng chuẩn của Space (25 preset VieNeu + mô tả, giọng mặc định theo engine, câu mẫu chuẩn). Voice-config của repo PHẢI khớp file này.
- `lexicon-export-for-pipelinex.json` — 578 mục từ điển phát âm xuất từ Space (nguồn seed cho bảng `pronunciation_lexicon`).
- `MCP-INTEGRATION-SPEC-2026-11-22.md` — đặc tả cầu nối M1–M3 giữa Space và PipelineX (đã có M0 + vá editor-MCP chạy thật).
- `FRAMEWORK-IMPL-2026-11-22.md` — ánh xạ khung automation 12 bước và các xung đột đã chốt.

## Bất biến không được phá

- Không video nào tự phát hành: khóa ở hai lớp độc lập (`VIDEO_AUTO_PUBLISH=false` trong pipeline + `VIDEO_MCP_PUBLISH_ENABLED=false` ở editor MCP), và phát hành thật đi qua Space duyệt từng video × từng nền tảng rồi đăng bằng Composio.
- Không lưu khóa/token thật trong repo, Space hay tài liệu — chỉ tên biến môi trường và nhãn đã che.
- Cách đọc từ điển chỉ áp lên BẢN ĐỌC (read_text), không bao giờ sửa phụ đề hiển thị (display_text).
- Mục từ điển chưa qua vòng kiểm ASR thì giữ tắt (enabled=false).
- Mọi thay đổi phải có commit riêng theo phần + mục FORK_CHANGES.md + bằng chứng kiểm chứng đọc lại được.
