# Bảng thiếu hụt tính năng: Space Studio có — PipelineX repo thiếu

Đối chiếu ngày 22/11/2026 từ trạng thái đã kiểm chứng của cả hai hệ. Cột "Quyết định": PORT = triển khai vào repo; BRIDGE = giữ ở Space, repo kết nối qua cầu M1 (xem MCP-INTEGRATION-SPEC); LEAVE = chỉ thuộc về Space.

| # | Tính năng phía Space | Phía repo hiện tại | Quyết định |
|---|---|---|---|
| 1 | Từ điển phát âm: 578 mục, scope (all/relay/selfhost), category_scope (all/tech/finance), khóa mục (locked), bật/tắt hàng loạt, nhập/xuất JSON/CSV/TXT có xem trước | Chưa có — ĐANG XÂY (Phần A của prompt voice-config/lexicon: bảng pronunciation_lexicon + trang admin + sinh industry/lexicon.json + áp LMF trong tts.py) | PORT (đang làm) |
| 2 | Vòng kiểm chứng ASR cho cách đọc: TTS → faster-whisper → đối chiếu, trạng thái asr_status theo mục, hàng đợi kiểm hàng loạt, quy tắc "chưa kiểm chứng thì giữ tắt" | Chưa có: repo không có vòng ASR cho từ điển | PORT (sau Phần A) |
| 3 | Cấu hình giọng theo engine: thẻ engine, công tắc bật/tắt, giọng mặc định + giọng nghe thử theo engine, thứ tự chuỗi dự phòng | Một phần: tts.py có chuỗi VieNeu → relay → Piper viết trong code (commit 5c4835e); cấu hình qua file + trang admin ĐANG XÂY (Phần B) | PORT (đang làm) |
| 4 | Bộ giọng chuẩn liên hệ: 25 preset VieNeu kèm mô tả, giọng tin tức ưu tiên, khớp studio-voice-standard.json | tts.py biết tên giọng nhưng không có danh mục chuẩn kèm mô tả | PORT (kèm Phần B) |
| 5 | Nghe thử giọng (voice demos): clip mẫu theo preset + hàng đợi tổng hợp demo theo câu tùy chỉnh, khóa demo dạng engine:voice@hash10 | Chưa có hệ thống demo/nghe thử trong repo | PORT (mức tối thiểu: phát clip mẫu từ voice-config) |
| 6 | Cổng QA phụ đề (ADR-003): ASR bản dựng, đối chiếu kịch bản, trạng thái pass/warn/fail gắn vào bản dựng, chặn gói phát hành khi fail | Repo có bước verify fact-check theo văn bản, KHÔNG có QA phụ đề theo âm thanh | PORT |
| 7 | Cổng QA âm thanh: LUFS ≈ −16, true peak ≤ −1.5 dBTP, quãng lặng dài nhất, năng lượng <60 Hz, hậu kỳ giọng tự host | Cả hai hệ đều chưa có (khung automation 22/11 bổ sung cho cả hai) | PORT + xây cả phía Space |
| 8 | Bàn duyệt phát hành: bản ghi canonical mỗi video, trạng thái pipeline 6 nấc, phát hành theo từng nền tảng (Chờ duyệt → Đã lên lịch → Đã phát hành), duyệt của Thanh là điều kiện đăng | Repo có publish kit + cờ publish, không có sổ phát hành theo nền tảng | BRIDGE (M1: repo là nguồn trạng thái sản xuất, Space giữ sổ duyệt/phát hành) |
| 9 | Đăng đa nền tảng qua Composio: YouTube + Shorts, Instagram Reels, Facebook Reels; TikTok gói tay có theo dõi | Repo chỉ có đường YouTube của riêng nó (đang khóa) | BRIDGE (giữ route Composio ở Space; repo không xây thêm đường đăng) |
| 10 | Danh mục kênh đích là CÀI ĐẶT: kênh YouTube brand UC5NAPNEhhciwZ6m6rzLRV8Q, IG @diemtincongnghe.vn, Page FB 1451451628052901, đồng bộ tài khoản Composio | Repo có OAuth YouTube theo từng checkout; không có khái niệm kênh đích đa nền tảng | BRIDGE (M1 đồng bộ định danh kênh vào project) |
| 11 | Chỉ mục bài viết từ bot-data.json: mã BT làm khóa, metadata đầy đủ cho bàn duyệt | Repo nạp cùng nguồn qua sources.json nhưng theo mô hình article/story riêng | BRIDGE (article_index ở Space vẫn lấy từ bot-data; M1 nối bằng mã BT/story id) |
| 12 | Gộp tin trùng sự kiện + hash canonical + cờ "cần xem lại" khi tin gốc bị sửa | Repo gộp story theo nội dung nhưng chưa có luật sourceUrl trùng và hash canonical | PORT (luật gộp + hash vào story/article của repo; cờ xem lại hiển thị qua M1) |
| 13 | Hàng đợi render có trạng thái theo job + xem lại video ngay trong bàn duyệt (blob import, nút Xem video) | Repo có video_jobs và thư mục .data/videos, không có trình xem trong bàn duyệt | BRIDGE (M1/M2: Space nhập bản dựng để xem và duyệt) |
| 14 | Nhật ký kiểm toán ADR-001: mọi thao tác cấu hình/duyệt đều có dòng log kèm bằng chứng | Repo có git history + FORK_CHANGES.md, không có audit log vận hành | LEAVE (Space giữ audit; repo giữ FORK_CHANGES cho thay đổi code) |
| 15 | Lớp phủ vùng an toàn theo nền tảng (safe-zone presets cho Shorts/Reels/TikTok) | Remotion render theo composition cố định, chưa có preset vùng an toàn | PORT (tham số render theo nền tảng đích) |
| 16 | i18n hiển thị cho bàn điều phối (VI mặc định, không dịch giá trị trạng thái lưu trong DB) | Repo ĐÃ có hạ tầng i18n (i18next, 4 locale) nhưng nội dung khóa còn thiếu nhiều | LEAVE cho Space; repo tự hoàn thiện khóa của mình (việc riêng) |

## Ghi chú phạm vi

- Mục 1, 3, 4 đang được xây theo `PROMPT-voice-config-lexicon-pipelinex.md`; bộ tài liệu này KHÔNG thay prompt đó — nó mở rộng phần còn thiếu (mục 2, 5, 6, 7, 12, 15) và chốt các mục BRIDGE (8, 9, 10, 11, 13) thành hợp đồng M1.
- Mọi mục PORT đều phải tôn trọng các bất biến ở README.md của thư mục này.
