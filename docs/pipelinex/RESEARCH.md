# PIPELINEX — NGHIÊN CỨU OPEN-SOURCE TRÊN GITHUB

> Cập nhật: 2026-11-16 · Dữ liệu lấy qua GitHub API (sao, license, lần push gần nhất) và README/tài liệu của từng repo.
> Số sao chỉ để tham khảo: một số repo mới có số sao tăng bất thường, không phản ánh chất lượng code.

---

## 1. Kết luận nhanh

1. **Không có repo nào làm đúng bài toán của PipelineX** (nguồn tin → lọc → video dài 10–15 phút → YouTube, chạy tự động hằng ngày). Các dự án hoặc làm **video ngắn** từ một chủ đề, hoặc là **agent skill** chạy tay trong Claude Code, hoặc chỉ làm **phần tin tức**.
2. **Hai repo rất sát, đều MIT, đều Node.js:**
   - **KKKKhazix/AIHOT**: engine thu thập + lọc + gom cụm tin, **cùng stack đã chốt** (Node.js 24, TypeScript, PostgreSQL, pg-boss, Docker Compose). Trùng gần như hoàn toàn với bước ① của PipelineX.
   - **darkzOGx/youtube-automation-agent**: agent vận hành kênh YouTube từ đầu đến cuối có dashboard duyệt. Trùng với bước ②–⑤ về **quy trình và tính năng**, nhưng kỹ thuật cũ hơn (JavaScript thuần, Express, SQLite, slideshow).
3. **Stack v0.4 được xác nhận:** AIHOT dùng đúng PostgreSQL + pg-boss + Node/TS; các dự án video mới đều dùng Remotion; Kokoro và whisper.cpp là lựa chọn phổ biến cho TTS/phụ đề miễn phí.
4. **Hướng đề xuất:** tự xây PipelineX theo SPEC, **lấy AIHOT làm nền cho bước ①** (fork hoặc học cách làm), **học quy trình duyệt và tính năng từ darkzOGx** cho bước ②–⑤. Chi tiết ở mục 5.

---

## 2. Danh sách repo theo nhóm

### 2.1 Tự động hóa YouTube từ đầu đến cuối

| Repo | Sao | Ngôn ngữ | License | Làm gì | Bài học cho PipelineX |
|---|---|---|---|---|---|
| [darkzOGx/youtube-automation-agent](https://github.com/darkzOGx/youtube-automation-agent) | 5,2k | JavaScript (Node, Express, SQLite) | MIT | Nghiên cứu chủ đề → kịch bản → giọng đọc + hình → MP4 → duyệt → lên lịch đăng → học từ analytics. Có dashboard, 8 nhà cung cấp AI + OpenRouter | **Rất nên học:** cổng duyệt bắt buộc (fact, quyền media), *Evidence desk* (gắn mỗi khẳng định với nguồn), *Production readiness check*, mỗi bước có checkpoint để chạy tiếp, *Scene Repair* (sửa một cảnh rồi build lại), vòng học từ retention/analytics |
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 144k | Python | MIT | Chủ đề → kịch bản LLM → Pexels → edge-tts/Azure → phụ đề → MoviePy; WebUI + API | Mẫu tham khảo cho cấu hình nhiều LLM và giao diện, nhưng chỉ làm **video ngắn**, ghép stock theo từ khóa → không đủ chất lượng cho video 10–15 phút |
| [FujiwaraChoki/MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) | 32k | Python | **AGPL-3.0** | Tự động Shorts + mạng xã hội | Chỉ tham khảo; AGPL không nên chép code |
| [RayVentura/ShortGPT](https://github.com/RayVentura/ShortGPT) | 8,2k | Python | MIT | Framework tự động Shorts | Ít cập nhật (2025-02) |
| [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | 12,6k | Python | GPL-3.0 | Reddit → video | Mẫu "nguồn → video" đơn giản |
| [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker) | 1,5k | TypeScript | MIT | Shorts bằng Remotion + Kokoro + whisper.cpp + Pexels; REST + MCP server | Cùng bộ công cụ ④ đã chọn; xem cách đóng gói Kokoro/whisper.cpp trong Docker |

### 2.2 Thu thập, lọc, gom cụm tin tức (bước ①)

| Repo | Sao | Ngôn ngữ | License | Làm gì | Bài học |
|---|---|---|---|---|---|
| [KKKKhazix/AIHOT](https://github.com/KKKKhazix/AIHOT) | 10,8k | TypeScript (Node 24, Fastify, React Router, PostgreSQL, pg-boss) | MIT | Engine của trang aihot.news: 6 loại nguồn, **thử lấy tin trong admin**, khử trùng, lọc sơ bộ, **chấm điểm 2 lần độc lập**, gom tin thành sự kiện bằng embedding, tính độ nóng, mỗi bước chọn model riêng, **ngắt chi tiêu theo ngân sách**, viết bản tin ngày/tuần/tháng; có API, RSS, MCP | **Gần như chính là bước ① của PipelineX.** Đáng lấy: phân hạng nguồn (chính thức / bán chính thức / báo chí), công thức độ nóng (mỗi nguồn chỉ tính 1 lần trong 48 giờ, giảm một nửa sau 24 giờ), "biên nhận" cho mỗi lệnh gọi trả phí (chạy lại không tốn tiền lần 2), script đánh giá bộ lọc bằng mẫu tự gán nhãn, prompt và ngưỡng tách khỏi code |
| [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | 47k | TypeScript | **AGPL-3.0** | Tạo RSS cho hàng nghìn trang không có RSS | Chạy như **service riêng** (không sửa code) để mở rộng nguồn tin; dùng bản không chỉnh sửa thì không vướng AGPL vào code PipelineX |
| [finaldie/auto-news](https://github.com/finaldie/auto-news) | 0,9k | Python | MIT | Gom tin nhiều nguồn + LLM lọc | Ít cập nhật (2025-07) |
| [adbar/trafilatura](https://github.com/adbar/trafilatura) | 7,1k | Python | Apache-2.0 | Trích nội dung chính trang web | Mạnh nhất cho bước trích nội dung; nếu Readability (JS) không đủ thì chạy làm sidecar |

### 2.3 Video bằng agent skill (Claude Code / Codex)

| Repo | Sao | License | Làm gì | Bài học |
|---|---|---|---|---|
| [Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer) | 3,4k | **PolyForm Noncommercial** | Chủ đề → video giải thích có giọng đọc, Remotion, Kokoro, chapter card, thanh tiến độ chương, phụ đề căn theo từ | **Chỉ học ý tưởng, không dùng code** (cấm dùng thương mại; kênh YouTube kiếm tiền là thương mại). Bảng tham chiếu hữu ích: video 5–8 phút cần 60–80 cảnh, 4–6 chương, ~3 GB đĩa, 2–3 giờ khi dùng agent |
| [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) | 2,6k | MIT | Claude Code viết kịch bản, giọng đọc, nhạc, hình rồi render | Mẫu template Remotion và đo chi phí từng video |
| [OpenMontageInc/OpenMontage](https://github.com/OpenMontageInc/OpenMontage) | 81k | **AGPL-3.0** | Hệ thống sản xuất video theo agent, 12 pipeline; "Backlot" storyboard trực quan, duyệt từng cảnh trước khi render | Ý tưởng: **duyệt storyboard/từng cảnh trước khi render** để không tốn thời gian render lại; AGPL nên chỉ tham khảo |

**Nhận xét chung:** cách làm bằng agent skill cho video đẹp nhưng **chạy tay, mất 1–3 giờ/video, chi phí token cao**, không hợp với lịch chạy tự động hằng ngày. PipelineX nên giữ hướng pipeline xác định (deterministic) với template có sẵn; chỉ dùng AI cho kịch bản, chọn hình và metadata.

### 2.4 Công cụ render

| Repo | Sao | License | Ghi chú |
|---|---|---|---|
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 74k | Remotion License | ★ Đã chọn. Miễn phí cho cá nhân/công ty ≤ 3 người |
| [midrender/revideo](https://github.com/midrender/revideo) | 4,2k | MIT | Phương án dự phòng nếu vướng license Remotion |
| [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | 20k | MIT | Hợp với hoạt họa giải thích; ít hợp render tự động |
| [dmtrKovalenko/fframes](https://github.com/dmtrKovalenko/fframes) | 3,1k | MIT | Render bằng Rust, nhanh; hệ sinh thái nhỏ |
| [mifi/editly](https://github.com/mifi/editly) | 5,6k | MIT | Dựng video khai báo bằng JSON; ít cập nhật (2025-05) |

### 2.5 Thành phần dựng sẵn

| Repo | Sao | License | Vai trò trong PipelineX |
|---|---|---|---|
| [vercel/ai](https://github.com/vercel/ai) | 28k | Apache-2.0 | ② AI đa nhà cung cấp |
| [timgit/pg-boss](https://github.com/timgit/pg-boss) | 4,1k | MIT | Hàng đợi / lịch (AIHOT cũng dùng) |
| [remsky/Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) | 5,7k | Apache-2.0 | ③ TTS sidecar, API tương thích OpenAI |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 55k | MIT | ③ Căn phụ đề |
| [rany2/edge-tts](https://github.com/rany2/edge-tts) | 12,6k | GPL-3.0 / LGPL | ③ TTS miễn phí cho MVP (gọi như công cụ ngoài) |

---

## 3. So sánh nhanh với PipelineX

| Năng lực | PipelineX (SPEC) | AIHOT | darkzOGx agent | MoneyPrinterTurbo |
|---|---|---|---|---|
| Nhiều loại nguồn tin + thử trước | ✔ | ✔ (6 loại) | ✘ (tự nghiên cứu chủ đề) | ✘ |
| Lọc nhiều tầng + gom cụm sự kiện | ✔ | ✔ (rất kỹ) | ✘ | ✘ |
| Mỗi bước chọn model riêng | ✔ | ✔ | Một phần | ✘ |
| Ngân sách / ngắt chi tiêu | Có theo dõi chi phí | ✔ (ngắt theo phút/giờ/ngày) | ✔ (giới hạn giây video trả phí) | ✘ |
| Video dài 10–15 phút, chia chương | ✔ | ✘ | Một phần | ✘ (ngắn) |
| Template đồ họa Remotion | ✔ | ✘ | ✘ (slideshow Playwright) | ✘ (MoviePy) |
| Duyệt trước khi đăng | ✔ | — | ✔ (rất đầy đủ) | ✘ |
| Gắn khẳng định với nguồn | Fact-check theo chương | — | ✔ Evidence desk | ✘ |
| Upload + lên lịch YouTube | ✔ | ✘ | ✔ | ✘ |
| Học từ analytics | Phase sau | ✘ | ✔ | ✘ |
| Stack | Node/TS, Postgres, pg-boss | **Trùng** | JS, Express, SQLite | Python |

---

## 4. Bài học đưa vào SPEC (đề xuất)

**Bước ① (từ AIHOT):**
- Phân hạng nguồn: `official` / `semi_official` / `media`, ngưỡng lọc khác nhau theo hạng.
- Chấm điểm **2 lần độc lập** cùng một tiêu chí, lấy trung bình hoặc yêu cầu cả hai đạt; giảm sai do một lần chấm ngẫu nhiên.
- Độ nóng tính theo **sự kiện**: mỗi nguồn chỉ tính 1 lần trong 48 giờ, giảm một nửa sau 24 giờ.
- Tin cũ hơn 48 giờ lúc phát hiện, hoặc tin cũ khi mới thêm nguồn: lưu trữ, không đưa vào ứng viên.
- **Script đánh giá bộ lọc**: gán nhãn tay 100–200 tin, chạy lại bộ lọc để đo độ chính xác trước khi đổi prompt/ngưỡng.

**Toàn hệ thống (từ AIHOT):**
- **Biên nhận cho mọi lệnh gọi trả phí** (AI, TTS, ảnh): lưu kết quả trước khi dùng; retry/restart dùng lại, không trả tiền lần 2.
- **Ngắt chi tiêu** theo phút/giờ/ngày cho từng dịch vụ trả phí.
- **Công tắc an toàn** trong `.env`: `COLLECT_ENABLED`, `MODEL_CALLS_ENABLED`, `PUBLISH_ENABLED`.

**Bước ②–⑤ (từ darkzOGx):**
- **Evidence desk:** mỗi khẳng định trong kịch bản gắn với đoạn nguồn; Review hiển thị khẳng định nào thiếu nguồn.
- **Production readiness check:** nút kiểm tra mọi provider, kênh YouTube và thử render một MP4 nhỏ trước khi bật tự động.
- **Sửa từng cảnh/chương:** sửa, đổi thứ tự, khóa hoặc sinh lại một cảnh rồi build lại (khớp với render theo chương).
- **Không cho duyệt video thiếu thành phần:** ví dụ thiếu giọng đọc thật hoặc dùng media giả lập.
- Phase sau: **vòng học từ analytics** (retention theo cảnh, CTR tiêu đề/thumbnail), mỗi thay đổi phải được người duyệt.

**Bước ④ (từ OpenMontage, anything2explainer):**
- **Duyệt storyboard trước khi render**: hiển thị bảng cảnh (text + loại hình + asset) để duyệt; render chỉ chạy sau khi duyệt.
- Chapter card + thanh tiến độ chương + phụ đề căn theo từ: chuẩn chung của video giải thích dài.

---

## 5. Các hướng đi

| Hướng | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **H1. Tự xây hoàn toàn theo SPEC** | Viết từ đầu, chỉ học ý tưởng | Kiểm soát hoàn toàn, kiến trúc gọn | Tốn công nhất, nhất là bước ① |
| **★ H2. Lấy AIHOT làm bước ①, tự xây ②–⑤** | Fork AIHOT, bỏ phần website, viết lại prompt sang tiếng Anh; PipelineX đọc sự kiện đã lọc qua API/DB rồi làm video | Bước ① có sẵn và rất kỹ; **cùng stack** nên ghép dễ; MIT | Phải hiểu code AIHOT; repo mới (2026-09), tác giả tự nhận không phải dev chuyên; mặc định viết cho tiếng Trung |
| **H3. Fork darkzOGx rồi sửa** | Đổi nguồn chủ đề sang nguồn tin, thêm video dài | Có sẵn dashboard, duyệt, upload, analytics | JS thuần + Express + SQLite + slideshow: khác stack v0.4; phải viết lại phần render và nguồn; gần như viết lại |
| **H4. Agent skill (Claude Code + Remotion)** | Mỗi video do agent dựng | Video đẹp, linh hoạt | Chạy tay, 1–3 giờ/video, tốn token, không tự động hằng ngày |

**Đề xuất: H2**, theo cách an toàn:
1. **1–2 ngày thử AIHOT** với 15–20 nguồn RSS tiếng Anh của profile đầu tiên. Đánh giá: lọc có đúng không, gom cụm có chuẩn không, dễ sửa prompt sang tiếng Anh không.
2. **Nếu đạt:** fork AIHOT làm service bước ① (giữ `worker` + `api`, bỏ hoặc giữ tối giản `web`). PipelineX gồm phần video ②–⑤ + Dashboard riêng, dùng chung Postgres hoặc đọc qua API.
3. **Nếu không đạt:** quay về H1 nhưng sao chép thiết kế của AIHOT (MIT cho phép, giữ ghi chú bản quyền).
4. Bước ②–⑤: tự xây theo SPEC, bổ sung các tính năng học từ darkzOGx ở mục 4.

**Ảnh hưởng lên kế hoạch nếu chọn H2:** Giai đoạn 2 (lọc 4 tầng + Inbox) rút ngắn đáng kể; thêm 1–2 ngày thử AIHOT vào Giai đoạn 0.

---

## 6. Lưu ý license

| License | Repo | Được làm gì |
|---|---|---|
| MIT / Apache-2.0 | AIHOT, darkzOGx, MoneyPrinterTurbo, short-video-maker, Kokoro-FastAPI, whisper.cpp, pg-boss, revideo | Dùng, sửa, dùng thương mại; giữ ghi chú bản quyền |
| AGPL-3.0 | RSSHub, OpenMontage, MoneyPrinterV2 | Chạy bản gốc như service riêng thì được; **chép code vào PipelineX thì PipelineX phải mở mã theo AGPL** |
| GPL-3.0 | RedditVideoMakerBot, edge-tts | Gọi như công cụ ngoài; không nhúng code |
| PolyForm Noncommercial | anything2explainer | **Không dùng cho kênh kiếm tiền**; chỉ học ý tưởng |
| Remotion License | Remotion | Miễn phí cho cá nhân / công ty ≤ 3 người |
