# Feature Specification: Kế thừa tính năng Studio vào PipelineX

**Feature Branch**: `pipelinex` (việc theo kênh vào worktree `channel/diem-tin-cong-nghe`)
**Created**: 2026-11-22 · **Status**: Draft để Thanh duyệt
**Input**: Tài liệu bàn giao `docs/handover-studio/` (README + FEATURE-GAP) + khung automation 22/11/2026 + nguyên tắc kế thừa của Thanh (18:28 22/11/2026)

## User Scenarios & Testing

### User Story 1 — Từ điển phát âm có vòng kiểm ASR trong repo (Priority: P1)

Người vận hành mở trang từ điển của kênh, thấy 578 mục đã nhập từ Space với đúng trạng thái (chỉ "callback" đang bật, 7 mục phạm vi finance). Khi một lô kiểm ASR chạy xong, từng mục có trạng thái kiểm chứng và chỉ mục đạt mới được phép bật.

**Why this priority**: Đọc sai thuật ngữ là lỗi chất lượng trực tiếp trên mọi video; ADR-002 của Studio quy định không mục nào được bật khi chưa kiểm chứng ASR.
**Independent Test**: Nhập file seed → đếm 578 mục / 1 bật; chạy kiểm ASR cho 3 mục mẫu → trạng thái từng mục thay đổi đúng kết quả; mục chưa đạt không bật được từ giao diện lẫn API.
**Acceptance Scenarios**:
1. Given bảng từ điển trống, When nhập `lexicon-export-for-pipelinex.json`, Then có 578 mục, khóa trùng (term, scope) không tạo bản sao khi nhập lại.
2. Given một mục có asr_status chưa đạt, When người vận hành bấm bật, Then hệ thống từ chối kèm lý do.
3. Given kịch bản chứa "SQL injection" và "callback", When bước giọng chạy, Then bản đọc áp cách đọc của cụm dài trước (Longest-Match First) và của "callback", phụ đề hiển thị giữ nguyên thuật ngữ gốc.

### User Story 2 — Cổng QA phụ đề và QA âm thanh chặn bản dựng lỗi (Priority: P1)

Sau bước giọng và render, hệ thống tự chạy QA: phụ đề được đối chiếu bằng ASR với kịch bản, âm thanh được đo LUFS/true peak/quãng lặng. Bản dựng fail QA cứng không được sang bước publish kit.

**Why this priority**: Đây là hai cổng chất lượng Studio đã chuẩn hóa (ADR-003 + khung 22/11); thiếu chúng, pipeline tự động sẽ sản xuất lỗi hàng loạt mà không ai thấy.
**Independent Test**: Cố ý dựng một video có một câu đọc sai thuật ngữ và một đoạn lặng 3 giây → QA báo fail đúng hai lỗi, publish kit không được tạo.
**Acceptance Scenarios**:
1. Given bản dựng đạt mọi ngưỡng, When QA chạy, Then trạng thái QA = pass kèm bảng số đo lưu trong thư mục video.
2. Given true peak vượt −1.5 dBTP, When QA chạy, Then QA = fail, bước publish kit bị chặn, lý do ghi vào job.

### User Story 3 — Cấu hình giọng chuẩn Studio, nghe thử trước khi dựng (Priority: P2)

Người vận hành mở trang Giọng đọc: thấy các engine (vieneu, relay, nvidia, piper, azure, edge) với công tắc, giọng mặc định và thứ tự chuỗi khớp cấu hình chuẩn của Space; nghe thử được clip mẫu của giọng đang chọn trước khi cho dựng thật.

**Why this priority**: Giọng là nhận diện kênh; cấu hình lệch giữa hai hệ từng gây lỗi phải làm lại cả lô.
**Independent Test**: Đối chiếu voice-config.json sinh ra với `studio-voice-standard.json` → khớp 25 preset, giọng mặc định vieneu = "Hải Đăng", chuỗi = [vieneu, relay, piper].
**Acceptance Scenarios**:
1. Given voice-config chưa tồn tại, When mở trang Giọng đọc lần đầu, Then file được sinh với giá trị chuẩn Studio.
2. Given engine nvidia đang tắt, When tạo job dựng với engine nvidia, Then bị từ chối; bật công tắc thì được chấp nhận (khi endpoint NVIDIA hoạt động).

### User Story 4 — Cầu nối duyệt và phát hành đa nền tảng (Priority: P2)

Video dựng xong trong repo xuất hiện trên bàn duyệt của Space với đủ hai bản (16:9, 9:16) xem được ngay; Thanh duyệt từng nền tảng; chỉ các nền tảng đã duyệt mới được đăng qua Composio (YouTube, Shorts, Reels IG/FB), TikTok theo gói tay.

**Why this priority**: Đây là cơ chế kế thừa cốt lõi — repo sản xuất, Space duyệt và phát hành — thay cho việc nhân đôi bàn duyệt vào repo.
**Independent Test**: Một video ở trạng thái ready trong repo → sau một chu kỳ đồng bộ, Space có project tương ứng với pipelinex_video_id đúng, hai render xem được; duyệt thử một nền tảng → trạng thái phản ánh về cả hai phía.
**Acceptance Scenarios**:
1. Given khóa publish đang tắt ở cả hai lớp, When đồng bộ chạy, Then không có lượt đăng nào xảy ra.
2. Given một video bị sửa kịch bản sau khi đã đồng bộ, When chu kỳ kế tiếp chạy, Then Space gắn cờ "cần xem lại".

### User Story 5 — Chọn đề tài đúng phạm vi kênh và chống trùng sự kiện (Priority: P3)

Danh sách ứng viên hằng ngày chỉ gồm tin ai/tech (finance chỉ khi dính AI/chip), tin tuyên bố chưa kiểm chứng bị gắn nhãn và loại mặc định, các tin cùng sự kiện gộp thành một ứng viên với nguồn đại diện.

**Why this priority**: Khung automation 22/11 đo được tin trùng sự kiện rất nhiều (một sự kiện tới 5 mục) và tài chính chiếm ~1/3 bản tin — không lọc sẽ lãng phí lượt dựng và lệch định vị kênh.
**Independent Test**: Chạy chọn đề tài trên dữ liệu một ấn bản thật → không có hai ứng viên cùng sourceUrl; không có ứng viên finance thuần; mục ưu đãi được gom thành một ứng viên tổng hợp tuần.

## Requirements

### Functional Requirements

- **FR-001**: Repo PHẢI lưu từ điển phát âm theo đúng schema của Space (term, reading, scope, category_scope, enabled, locked, asr_status, note) và nhập được file seed 578 mục một cách idempotent.
- **FR-002**: Việc áp từ điển PHẢI theo Longest-Match First, phân biệt hoa/thường theo ranh giới từ, lọc theo category_scope của bài, và CHỈ sửa bản đọc.
- **FR-003**: Mục từ điển CHƯA đạt kiểm ASR thì KHÔNG được bật bằng bất kỳ đường nào (UI, API, sửa file trực tiếp phải bị lớp áp dụng bỏ qua).
- **FR-004**: Sau mỗi thay đổi từ điển, repo PHẢI sinh lại `industry/lexicon.json` chứa đúng các mục đang bật; file này là hợp đồng với tầng TTS và với Space.
- **FR-005**: Voice-config PHẢI là file `industry/voice-config.json` theo schema ở plan.md, giá trị mặc định khớp `studio-voice-standard.json`; khóa bí mật chỉ được tham chiếu bằng TÊN biến môi trường.
- **FR-006**: Bước giọng PHẢI ghi vào timeline của video: engine thực dùng cho từng beat, số mục từ điển đã áp, và đường hậu kỳ đã chạy (nếu có).
- **FR-007**: Cổng QA phụ đề PHẢI chạy ASR trên bản dựng, đối chiếu với kịch bản hiển thị, và trả một trong ba trạng thái pass/warn/fail kèm chi tiết theo câu.
- **FR-008**: Cổng QA âm thanh PHẢI đo tối thiểu: LUFS tích hợp, true peak, quãng lặng dài nhất, năng lượng dưới 60 Hz; fail cứng khi true peak > −1.5 dBTP hoặc quãng lặng > 2 giây trong phần lời.
- **FR-009**: Bản dựng fail QA cứng KHÔNG được tạo publish kit và KHÔNG được đồng bộ sang Space ở trạng thái sẵn sàng duyệt.
- **FR-010**: Đồng bộ M1 PHẢI là một chiều repo → Space cho trạng thái sản xuất, khóa bằng `pipelinex_video_id` + mã BT; Space là nơi duy nhất giữ trạng thái duyệt/phát hành.
- **FR-011**: Mọi đường đăng PHẢI tôn trọng khóa hai lớp; không thêm đường đăng mới trong phạm vi feature này.
- **FR-012**: Khâu chọn đề tài PHẢI áp luật phạm vi: category ai/tech mặc định; finance chỉ khi thực thể liên quan AI/chip; offer gom theo tuần; mục "chưa kiểm chứng" bị loại mặc định.
- **FR-013**: Gộp story PHẢI coi trùng sourceUrl là cùng sự kiện; mỗi story PHẢI có hash canonical từ tiêu đề + tóm tắt + ảnh của nguồn đại diện.
- **FR-014**: Mọi thao tác vận hành sinh ra từ feature này PHẢI có bằng chứng đọc lại được (số đếm, log, ảnh chụp trang admin) theo ADR-001.

### Key Entities

- **PronunciationEntry**: một mục từ điển (khóa: term + scope).
- **VoiceConfig**: cấu hình engine + chuỗi + giọng theo kênh (một bản ghi mỗi kênh).
- **QaReport**: kết quả QA phụ đề + âm thanh gắn với một video job.
- **SyncRecord**: ánh xạ pipelinex_video_id ↔ project của Space, kèm hash canonical và cờ cần-xem-lại.
- **Candidate**: ứng viên đề tài sau lọc phạm vi và gộp trùng.

## Success Criteria

- **SC-001**: 100% mục từ điển trong repo khớp file seed của Space (578 mục, đúng trạng thái bật/tắt và category_scope) sau nhập.
- **SC-002**: 0 mục chưa đạt ASR nào ở trạng thái bật trong bất kỳ lần kiểm tra mẫu nào.
- **SC-003**: QA bắt đúng ≥ 95% lỗi gieo thử (đọc sai thuật ngữ, lặng dài, true peak vượt ngưỡng) trên bộ 10 video kiểm chứng.
- **SC-004**: Một video chạy trọn từ chọn đề tài → publish kit → xuất hiện trên bàn duyệt Space trong ≤ 1 chu kỳ đồng bộ, không cần thao tác tay.
- **SC-005**: 0 lượt đăng nào xảy ra khi khóa publish ở trạng thái tắt, trong toàn bộ thời gian thử nghiệm.
- **SC-006**: Danh sách ứng viên một ngày thật chứa 0 cặp trùng sourceUrl và 0 mục finance thuần.
