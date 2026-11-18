# Nghiên cứu cải tiến quy trình làm video (17/11/2026)

Phạm vi: 3 khâu bạn chọn: **tìm hiểu tin**, **chất lượng video**, **tự động hoá & chi phí**. Đây là đề xuất, chưa sửa code.

## Tóm tắt — 5 việc nên làm, theo thứ tự

| # | Việc | Vì sao | Chi phí thêm / video |
|---|---|---|---|
| 1 | **Đổi giọng đọc khỏi edge-tts** (sang Azure Speech, cùng giọng Andrew) | edge-tts dùng endpoint nội bộ của Edge, Microsoft **không cấp quyền dùng thương mại**; có thể bị chặn bất cứ lúc nào | ~$0 (free 500K ký tự/tháng ≈ 45 video 12 phút) |
| 2 | **Thêm bước "hồ sơ câu chuyện" trước khi viết kịch bản** | Hiện chỉ đưa 3.000 ký tự đầu mỗi bài cho LLM → video chỉ được 3,5 phút, lặp ý | ~$0,02–0,05 |
| 3 | **Chốt định dạng 10–15 phút**: "bản tin AI hôm nay" 4–6 câu chuyện, đào sâu 1 chuyện chính | Một câu chuyện hiếm khi đủ tư liệu thật cho 10 phút; kéo dài sẽ lặp ý, mất người xem | — |
| 4 | **Viết kịch bản nhiều lượt**: dàn ý → bản nháp → kiểm chứng từng câu → lượt giữ chân người xem | Bản một lượt hiện tại chỉ kiểm tra trích dẫn và con số, không kiểm tra câu khẳng định | ~$0,03–0,08 |
| 5 | **Đăng YouTube 1 click từ trang Videos** + báo khi có video chờ duyệt | Rút việc tay xuống còn: xem → Duyệt | $0 |

Tổng chi phí ước tính cho video 12 phút: **~$0,15–0,30** (hiện ~$0,03 cho 3,5 phút). Nếu dùng ElevenLabs cho giọng đọc: thêm ~$0,45–0,90.

---

## 1. Khâu tìm hiểu tin (quan trọng nhất)

### Hiện trạng
- Bước `story` lấy tối đa 12 bài của một sự kiện, **cắt mỗi bài 3.000 ký tự**, kèm tóm tắt do AIHOT viết.
- Kịch bản viết **một lượt**. Kiểm chứng chỉ gồm: trích dẫn phải có nguyên văn trong bài, con số phải có trong bài.
- Thử thật với chuyện Jensen Huang (8 bài): kịch bản 470 chữ ≈ 3,4 phút; có chỗ số liệu các nguồn khác nhau (đơn kiến nghị 115.000 vs 140.000 chữ ký) mà mô hình chỉ xử lý được nhờ dặn trong prompt.

### Cách làm của các hệ thống kiểm chứng tin (CLEF CheckThat! 2026)
Các đội đứng đầu đều tách thành nhiều bước rõ ràng: lấy bằng chứng → gom và lọc → lập "kế hoạch sự thật" có cấu trúc → viết → **kiểm tra lại từng trích dẫn bằng mô hình suy luận (NLI)**, và chỉ viết lại khi phát hiện câu yếu bằng chứng (tiết kiệm chi phí) ([SourceMinds](https://arxiv.org/pdf/2607.24802), [DS@GT ARC](https://arxiv.org/html/2611.05382)). Khảo sát về "deep research" cũng nhấn mạnh xử lý **bằng chứng mâu thuẫn** giữa các nguồn ([Deep Research survey](https://arxiv.org/pdf/2512.02038)).

### Đề xuất: bước mới "Hồ sơ" (dossier) giữa `story` và `script`
1. **Toàn văn**, không cắt 3.000 ký tự (AIHOT đã có body_text; bài nào thiếu thì dùng bộ lấy toàn văn sẵn có của AIHOT).
2. **Trích xuất có cấu trúc** (1 lượt LLM): danh sách khẳng định "ai – nói/làm gì – khi nào – nguồn nào", mốc thời gian, con số, trích dẫn nguyên văn, câu hỏi còn bỏ ngỏ.
3. **Phát hiện mâu thuẫn**: cùng một sự việc mà các nguồn ghi khác nhau → đánh dấu để kịch bản nói rõ ("theo TechCrunch… trong khi The Verge…").
4. **Bổ sung bối cảnh có kiểm soát** (tuỳ chọn): sinh 5–8 câu hỏi (bối cảnh, sự kiện trước đó, nguồn gốc chính thức, phản ứng, bước tiếp theo) rồi tìm bằng API tìm kiếm, **chỉ lấy từ danh sách nguồn uy tín** (39 nguồn đang theo dõi + trang chính thức của công ty). Giá tham khảo: Perplexity Search $5/1.000 lượt (Fast $1), Exa $7/1.000, Tavily ~$5–8/1.000 + 1.000 lượt miễn phí/tháng ([so sánh giá](https://websearchapi.space/blog/perplexity-sonar-api-pricing), [Perplexity vs Exa vs Tavily](https://omidsaffari.com/blog/perplexity-vs-exa-vs-tavily-search-api-cost-2026)). 10 lượt/video ≈ $0,01–0,07.
5. **Kiểm chứng sau khi viết**: tách kịch bản thành từng câu khẳng định, đối chiếu với hồ sơ; câu không có bằng chứng → viết lại hoặc bỏ; hiện danh sách câu "yếu" trên trang Videos để bạn duyệt nhanh.

Hồ sơ cũng nên hiện trên trang Videos (tab "Research") để lúc duyệt bạn thấy video dựa trên gì.

## 2. Chất lượng video

### Kịch bản giữ chân người xem
Tổng hợp từ các hướng dẫn 2026 (chủ yếu blog người làm nội dung/nhà bán công cụ, nên xem như kinh nghiệm chứ không phải số liệu chuẩn) ([channel.farm](https://channel.farm/blog/storytelling-ai-video-scripts-long-form-youtube), [creatorskills](https://creatorskills.co/blog/how-to-write-youtube-script-with-ai-2026), [Fyre Interactive](https://fyreinteractive.co/blog/why-ai-scripts-are-killing-your-faceless-youtube-channel/)):
- **Một lời hứa rõ ràng** cho mỗi video, mọi phần đều phục vụ lời hứa đó.
- **Mở đầu**: vào thẳng vấn đề trong 15 giây đầu; không chào hỏi kiểu "welcome back".
- **Cứ 60–120 giây có một điểm giữ chân**: thông tin mới, câu hỏi bỏ ngỏ, chuyển cảnh.
- Người xem hay bỏ ở: sau phần mở đầu, ở chỗ chuyển phần, và khoảng 2/3 video; với video AI thường là phút 3–5.
- Điểm yếu điển hình của kịch bản AI: **đoạn sau chỉ là bản nhẹ hơn của đoạn trước**. Cần lượt sửa riêng để cắt lặp ý.
- Video 8–15 phút ≈ 1.200–2.200 chữ; kéo dài để có quảng cáo giữa video thường phản tác dụng.

→ Áp dụng: thay prompt một lượt bằng **dàn ý → nháp → lượt "giữ chân" (cắt lặp, thêm câu hỏi bỏ ngỏ, kiểm tra mỗi 60–90 giây có điểm mới) → kiểm chứng**. Sinh 3–5 câu mở đầu rồi chọn một.

### Hình ảnh
- Đã có: ảnh Commons/Openverse/Pixabay có kiểm tra bằng AI nhìn hình, video b-roll Pixabay, thẻ bài báo, số liệu, biểu đồ, mốc thời gian.
- Còn yếu: từ khoá b-roll chung chung ("AI chip factory" → ảnh xưởng không liên quan). Đề xuất: để LLM viết **2–3 từ khoá cụ thể, nhìn thấy được** cho mỗi beat (ví dụ "server racks blue light" thay vì "AI infrastructure"), và cho bước kiểm tra hình chấm điểm 1–5 thay vì CÓ/KHÔNG để chọn hình tốt nhất.
- Thêm: logo nguồn trên thẻ bài báo, ảnh chụp trang công bố chính thức (nếu có), thumbnail tự sinh (3 phương án tiêu đề + ảnh).

### Giọng đọc (cần làm sớm)
- **edge-tts không có giấy phép thương mại**: Microsoft không công bố điều khoản cho phép dùng endpoint Read Aloud ngoài trình duyệt Edge; nhân viên/kiểm duyệt viên của Microsoft hướng người dùng thương mại sang Azure AI Speech ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use), [Microsoft Q&A 2](https://learn.microsoft.com/en-us/answers/questions/6007729/commercial-use-of-microsoft-edge-text-to-speech-vi?page=1#answer-12979213)). Endpoint này cũng có thể bị chặn không báo trước ([dev.to](https://dev.to/morinaga/four-free-neural-tts-options-for-ci-pipelines-edge-tts-kokoro-melotts-bark-3l2f)).
- Lựa chọn ([Azure pricing](https://texttolab.com/blog/azure-text-to-speech-pricing), [so sánh TTS](https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/streaming-tts-kokoro-elevenlabs-turbo-openai-tts)):

| Giọng | Giá | Video 12 phút (~11K ký tự) | Ghi chú |
|---|---|---|---|
| **Azure Neural** (cùng giọng Andrew) | $15/1M ký tự, miễn phí 500K/tháng | ~$0 trong hạn miễn phí | Ít sửa code nhất; có mốc thời gian từng chữ cho phụ đề |
| Kokoro (chạy máy) | $0 | $0 | Apache 2.0; chất lượng khá, cần thử |
| ElevenLabs v4 / Turbo | $80 / $40 /1M | ~$0,90 / $0,45 | Tự nhiên nhất cho dẫn chuyện |

→ Đề xuất: **Azure Neural ngay** (giữ được giọng hiện tại), thử ElevenLabs trên 2–3 video để so.

## 3. Tự động hoá & chi phí

### Luồng mục tiêu (việc tay chỉ còn duyệt)
```
08:00  AIHOT ra bản tin ngày (đã có)
09:30  Tự chọn câu chuyện / tự gom 4–6 chuyện → hồ sơ → kịch bản → hình → giọng → render (đã có khung, VIDEO_AUTO_ENABLED)
~09:50 Báo "có video chờ duyệt" (email/Telegram)
Bạn    Xem trên /admin/videos → Duyệt (hoặc "Làm lại từ bước…")
       → Tự đăng YouTube (tiêu đề, mô tả, nguồn, thumbnail, lịch đăng)
```

### YouTube API
- Từ 01/06/2026 việc tải video có **hạn mức riêng: 100 lượt/ngày**, mỗi lượt 1 đơn vị; các lệnh khác (thumbnail 50, sửa metadata 50) dùng chung 10.000 đơn vị/ngày ([Google docs](https://developers.google.com/youtube/v3/docs/videos/insert), [tổng hợp](https://www.upload-post.com/youtube-api/)) → 1 video/ngày dư sức.
- Tài liệu Google hiện ghi video từ dự án API chưa xác minh **không còn bị khoá ở chế độ riêng tư**; một số nguồn bên thứ ba vẫn nói cần qua kiểm duyệt. Nên đăng thử ở chế độ "unlisted" trước.

### Chi phí và độ tin cậy
- Các lượt gọi LLM của video hiện **chưa ghi biên nhận** vào hệ thống budget của AIHOT (quy tắc số 4 của AGENTS.md). Nên nối vào để có trần chi phí và cảnh báo.
- Render 3,4 phút mất ~2 phút → video 12 phút ~7–8 phút trên máy này; ổn với 1 video/ngày.
- Lưu cache tìm hình theo từ khoá để chạy lại rẻ hơn.

### Liên quan chính sách (để định hướng chất lượng)
YouTube không cấm nội dung làm bằng AI, nhưng không trả tiền cho nội dung "hàng loạt, lặp khuôn, không có góc nhìn riêng" ([tổng hợp](https://www.vidmyth.com/guides/youtube-inauthentic-content-policy), [ScaleLab](https://scalelab.com/en/youtube-monetization-policy-updates)). Đây là lý do khâu hồ sơ + góc nhìn + kiểm chứng (mục 1–2) quan trọng hơn việc tăng số lượng video.

---

## Cách làm đề xuất: thử nhỏ trước khi làm lớn
Mỗi cải tiến làm theo vòng: **nghiên cứu → thử trên 3 câu chuyện thật → so với bản hiện tại trên trang Videos → mới đưa vào quy trình**. Trang Videos đã hỗ trợ "Làm lại từ bước…", nên so sánh A/B tốn ít công.

Thứ tự gợi ý:
1. Azure TTS (nhỏ, giải quyết rủi ro giấy phép).
2. Hồ sơ câu chuyện + kiểm chứng từng câu (thử trên 3 chuyện, đo độ dài và số câu thiếu bằng chứng).
3. Chốt định dạng 10–15 phút (1 chuyện sâu hay bản tin nhiều chuyện) — **cần bạn quyết định**.
4. Kịch bản nhiều lượt + từ khoá hình cụ thể.
5. Đăng YouTube + thông báo.

---

## Kết quả thử: bước "Hồ sơ" (17/11/2026)

**Đã làm:** thêm 2 bước vào quy trình: `story → **dossier** → script → **verify** → assets → voice → render`.
- **dossier** (hồ sơ): đọc toàn văn (tới 12.000 ký tự/bài thay vì 3.000), rút ra 30–50 sự kiện có ghi nguồn, trích dẫn nguyên văn, con số, mốc thời gian, **chỗ các nguồn ghi khác nhau**, câu hỏi còn bỏ ngỏ. Trích dẫn và con số được máy kiểm tra lại với bài gốc. ~$0,01/video.
- **verify** (kiểm chứng): từng câu của lời đọc được đối chiếu với toàn văn bài báo → có bằng chứng / đúng một phần / không có bằng chứng / câu dẫn dắt. Hiện trên trang Videos để bạn duyệt. ~$0,005/video.

**Cách đo:** 3 câu chuyện thật (Nvidia–Jensen Huang 17 bài, Anthropic IPO 6 bài, California kiện OpenAI 4 bài). Mỗi kịch bản được kiểm chứng 3 lần; một câu chỉ tính là lỗi khi ≥2/3 lần chấm gắn cờ (vì chính bộ chấm cũng dao động: cùng một kịch bản có lần 8 cờ, có lần 1).

| Cách viết | Số kịch bản | Số câu | Câu lỗi thật | Tỷ lệ |
|---|---|---|---|---|
| A — cách cũ (3.000 ký tự đầu mỗi bài) | 3 | 67 | 4 | 6,0% |
| B — từ hồ sơ, prompt đầu tiên | 3 | 82 | 8 | 9,8% |
| **B3 — từ hồ sơ, sửa cách ghi nguồn** | 6 | 179 | 4 | **2,2%** |
| B-dài (745 chữ, ~5 phút) | 1 | 45 | 1 | 2,2% |

**Rút ra:**
1. Cả hai cách **không bịa sự kiện**; lỗi chủ yếu là **ghi sai tên báo** ("theo The Verge" cho chi tiết của TechCrunch) và nói quá ở đoạn "điều gì xảy ra tiếp".
2. Hồ sơ lúc đầu còn tệ hơn vì chỉ ghi số thứ tự bài → AI đoán tên báo. Ghi tên báo cạnh từng sự kiện + luật "chỉ nêu báo có trong danh sách của sự kiện" giảm lỗi xuống ~2%.
3. Hồ sơ cho **nhiều chất liệu hơn**: 31–48 sự kiện, 2–5 chỗ nguồn khác nhau (vd. số chữ ký đơn kiến nghị tăng 115K → 190K qua các bài — làm được biểu đồ), câu hỏi bỏ ngỏ. Bản dài 745 chữ vẫn giữ tỷ lệ lỗi ~2% → **đủ tư liệu để làm video dài hơn mà không bịa**.
4. Phát hiện kèm theo: bộ kiểm tra trích dẫn cũ so cả dấu câu nên **loại oan trích dẫn thật** (8/8 trích dẫn bị loại ở lần đầu đều có thật). Đã sửa: so theo từ.

**Bước tiếp theo đề xuất:** "sửa có điều kiện" — chỉ viết lại những câu bị gắn cờ (theo cách các hệ thống CheckThat! 2026 làm), rồi kiểm lại một lần. Ước tính +$0,01/video.
