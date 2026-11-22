# Tasks: Kế thừa tính năng Studio vào PipelineX

Thứ tự theo pha của plan.md. `[P]` = làm song song được với task kề. Mỗi task chỉ "xong" khi có bằng chứng ghi ở dòng Evidence. Không task nào được khởi động lại worker của kênh khi video job đang chạy — kiểm tra `video_jobs` trước mọi lần restart.

## Phase P0 — Tiên quyết (đang chạy, không làm lại)

- [ ] T001 Hoàn tất Phần A (từ điển) và Phần B (voice-config) theo `PROMPT-voice-config-lexicon-pipelinex.md`, gồm 6 mục kiểm chứng của prompt. Evidence: VOICE-LEXICON-BUILD-RESULT.md + hash commit hai phần.

## Phase P1 — Cổng QA (User Story 2)

- [ ] T101 Viết `renderer/qa_check.py`: đầu vào (video.mp4, script hiển thị, thư mục ra); đo LUFS tích hợp + true peak bằng ffmpeg (loudnorm/astats), quãng lặng dài nhất bằng silencedetect, năng lượng <60 Hz; xuất `qa-audio.json`. Evidence: chạy trên bản dựng VD-002 (đã có sẵn) → file số đo đọc lại được.
- [ ] T102 [P] Thêm chế độ QA phụ đề vào qa_check.py: faster-whisper (large-v3 cho bản chính thức) transcribe bản dựng → đối chiếu từng câu với kịch bản hiển thị → `qa-subtitle.json` với trạng thái theo câu. Evidence: gieo một câu đọc sai vào bản thử → QA bắt đúng câu đó.
- [ ] T103 Viết `renderer/post_audio.py`: hậu kỳ cho giọng tự host (highpass 80 Hz, EQ nhẹ theo preset giọng, loudnorm về −16 LUFS) áp trước bước render khi engine thuộc nhóm tự host. Evidence: cùng một câu VieNeu trước/sau hậu kỳ — số đo LUFS và true peak đạt ngưỡng.
- [ ] T104 Nối QA vào pipeline (modules/video/backend/qa.ts + bước sau render): ghi `qa_reports`, fail cứng → chặn publish kit và đánh dấu job. Evidence: video gieo lỗi ở T102 bị chặn; video sạch qua được; đọc lại qa_reports trong DB.

## Phase P2 — ASR cho từ điển + nghe thử (User Stories 1, 3)

- [ ] T201 Hàng đợi kiểm ASR cho từ điển (lexicon-asr.ts): chọn mục chưa kiểm chứng → tổng hợp câu mang bằng engine của scope → faster-whisper large-v3 → ghi asr_status/model/thời gian qua API nội bộ; mục đạt mới mở khóa nút bật (FR-003 thực thi ở cả API). Evidence: chạy 10 mục mẫu (gồm "callback" và 2 mục cố ý sai) → trạng thái đúng từng mục.
- [ ] T202 [P] Nối kết quả hai lô ASR đang tạm dừng phía Studio (Batch A 63/71, Batch B) làm nguồn tham chiếu khi đối chiếu trạng thái — không nhập ngược kết quả chưa được Thanh duyệt. Evidence: bảng đối chiếu trạng thái hai phía cho 10 mục mẫu.
- [ ] T203 Nghe thử tối thiểu trong trang Giọng đọc: mỗi engine phát clip mẫu của giọng đang chọn (sinh qua vieneu-mcp-local phía máy ảo hoặc engine tương ứng phía máy Thanh), có trạng thái phát trên chính nút. Evidence: ảnh chụp trang + clip phát được kiểm chứng.

## Phase P3 — Chọn đề tài + gộp trùng (User Story 5)

- [ ] T301 Luật phạm vi trong selection-scope.ts: ai/tech mặc định; finance chỉ khi thực thể thuộc danh sách AI/chip; offer → gộp ứng viên tuần; nhãn "chưa kiểm chứng" cho nguồn dạng tuyên bố → loại mặc định. Evidence: chạy trên ấn bản thật 21/11 → SC-006 đạt.
- [ ] T302 Gộp story theo sourceUrl trùng + hash canonical (tiêu đề + tóm tắt + ảnh) lưu vào story. Evidence: cặp BT-238/BT-286 (trùng sourceUrl) thành một story.
- [ ] T303 Sửa đường candidates/heat cho kênh một nguồn (seed heat từ cờ hot + vị trí ấn bản) để pickCandidates chạy được ở chế độ shadow 3–5 ngày. Evidence: danh sách ứng viên 3 ngày liên tiếp xuất ra để Thanh so với lựa chọn tay.

## Phase P4 — Bridge M1 (User Story 4)

- [ ] T401 Tiến trình đồng bộ phía máy ảo: đọc list_videos/get_video qua editor MCP của kênh → tạo/cập nhật project trong Space kèm pipelinex_video_id, hai render (nhập blob để xem được), trạng thái ánh xạ đúng pipeline 6 nấc. Evidence: một video ready xuất hiện trên Space và xem được cả hai bản.
- [ ] T402 Cờ cần-xem-lại: hash canonical đổi sau đồng bộ → needs_review + hiển thị ở Space. Evidence: sửa kịch bản một video đã đồng bộ → chu kỳ sau cờ bật.
- [ ] T403 Kiểm tra khóa publish xuyên suốt bridge: chạy toàn bộ chu kỳ với khóa tắt → 0 lượt đăng; log kiểm tra đính kèm. Evidence: SC-005.

## Phase P5 — Vùng an toàn + nghiệm thu tổng

- [ ] T501 Preset vùng an toàn theo nền tảng đích (Shorts/Reels/TikTok theo số đo đã nghiên cứu 21/11) thành tham số render 9:16, mặc định giữ chuẩn organic y=1560 cho tới khi Thanh chốt biến thể ads. Evidence: bản dựng thử với từng preset + ảnh khung hình.
- [ ] T502 Nghiệm thu tổng theo SC-001..SC-006 của spec.md, viết biên bản vào ACTIVE-WORK.md §9 phía Studio và một file ACCEPTANCE.md trong thư mục này. Evidence: bảng đạt/không đạt từng SC kèm liên kết bằng chứng.

## Phụ thuộc

T001 → tất cả. T101 → T102, T104. T103 → T104. T201 độc lập sau T001. T301 + T302 → T303. T401 → T402, T403. Mọi pha → T502.
