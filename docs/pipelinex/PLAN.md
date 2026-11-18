# PIPELINEX — PHÂN TÍCH KẾ HOẠCH & PHƯƠNG ÁN THỰC HIỆN

> Đi kèm [SPEC.md](SPEC.md). Tài liệu này trả lời: **làm gì trước, chọn công nghệ nào, vì sao, và khi nào coi là xong.**
> Cập nhật: 2026-11-16

---

## A. PHÂN TÍCH KẾ HOẠCH

### A1. Mục tiêu thực chất
Không phải "làm ra một video", mà là **một hệ thống chạy mỗi ngày không cần người trông**. Vì vậy, điều quan trọng nhất là độ ổn định (chạy lại được, báo lỗi, không đăng trùng). Chất lượng một video đơn lẻ là thứ yếu.

### A2. Giả định đang ngầm có (cần xác nhận)
| # | Giả định | Nếu sai thì sao |
|---|---|---|
| G1 | Đã có kênh YouTube và Google Cloud project | Phải tạo trước, vì audit cần kênh thật |
| G2 | Nội dung **tiếng Anh**, khán giả quốc tế (✔ đã chốt) | Cạnh tranh cao hơn và CPM cao hơn; cần giọng đọc và văn phong tự nhiên như người bản xứ |
| G3 | Chấp nhận chi phí API trả phí (LLM, TTS) | Nếu muốn miễn phí 100% thì phải chạy model local, cần GPU |
| G4 | VPS không có GPU | Render chỉ bằng CPU, nên tránh hiệu ứng nặng |
| G5 | Một người vận hành | Kiến trúc phải đơn giản, không dùng Kubernetes, queue phân tán, v.v. |

### A3. Phụ thuộc & đường găng (critical path)
```
Audit YouTube API (vài tuần, bên ngoài kiểm soát) ─────────────────────┐
                                                                       ▼
Nguồn + lọc ─> Script ─> TTS ─> Render ─> Upload Private ─> Đăng Public
                         └── chọn provider LLM/TTS (phải có trước)
```
- **Đường găng là audit YouTube**, không phải code. Phải gửi đơn ngay tuần đầu, song song với việc code.
- Trong phần code, **Render** là khâu khó và tốn công tinh chỉnh nhất. Nên làm sớm để lộ vấn đề.

### A4. Đánh giá độ khó từng khâu
| Khâu | Độ khó | Lý do |
|---|---|---|
| ① Nhập nguồn (nhiều kiểu) | Thấp–Trung bình | Mỗi kiểu nguồn một adapter; RSS dễ, URL/manual dễ |
| ① Lọc nội dung 4 tầng | **Trung bình–Cao** | Gom cụm sự kiện và chấm điểm AI cần tinh chỉnh dần |
| ② AI đa nhà cung cấp | Trung bình | SDK thống nhất lo phần lớn; khó ở fallback và đo chi phí |
| Script LLM | Trung bình | Prompt + validate JSON + fact-check |
| TTS + phụ đề | Thấp–Trung bình | Nhiều giọng tiếng Anh tốt; Whisper căn timestamp tiếng Anh rất chính xác |
| Tư liệu hình ảnh | **Cao** | Kho stock phong phú hơn cho chủ đề quốc tế, nhưng vẫn khó khớp với một sự kiện cụ thể |
| ④ Render (Remotion + FFmpeg) | **Cao** | Thiết kế template, Chromium headless trên VPS |
| Upload YouTube | Trung bình | OAuth, quota, resumable upload |
| Điều phối/state | Trung bình | Thiết kế đúng từ đầu thì đơn giản |
| Dashboard | Trung bình | Nhiều màn hình, nhưng chủ yếu là CRUD |

### A5. Rủi ro lớn nhất (theo thứ tự)
1. **Audit YouTube không được duyệt hoặc duyệt chậm.** Khi đó không đăng Public tự động được.
2. **Tư liệu hình ảnh không khớp nội dung**, video trông rẻ tiền và bị coi là "low-value content".
3. **AI viết sai sự thật** về tin tức, dẫn tới rủi ro pháp lý.
4. Chi phí mỗi video vượt dự kiến khi chạy hằng ngày.

### A6. Kết luận phân tích
- Làm theo **chiều dọc**: một video chạy trọn từ đầu đến cuối trước, rồi mới làm từng khâu cho đẹp.
- Song song: gửi audit YouTube từ tuần 1.
- Nội dung tiếng Anh cạnh tranh với rất nhiều kênh AI khác, nên **góc nhìn/giá trị thêm** (phân tích, tổng hợp nhiều nguồn) quan trọng hơn tốc độ đăng.
- Thiết kế state/idempotent **ngay từ MVP**, vì thêm vào sau sẽ phải sửa lại toàn bộ.
- Bài toán tư liệu hình ảnh cần chọn phương án sớm (xem B6).
- Theo yêu cầu: **đưa nguồn tin vào** và **lọc nội dung** là trọng tâm, nên bước ① được làm kỹ ngay từ giai đoạn 1–2, có giao diện để thao tác trực quan.
- Chuỗi 5 bước gốc giữ nguyên: ① Thu thập → ② Kịch bản AI → ③ Giọng đọc & phụ đề → ④ Render → ⑤ Đăng YouTube.

---

## B. PHƯƠNG ÁN CHO TỪNG THÀNH PHẦN

Mỗi mục liệt kê các lựa chọn và **đề xuất** (★). Bạn xác nhận hoặc đổi.

> ⚠ Từ v0.5 (hướng fork AIHOT): các lựa chọn **Dashboard, API, DB access, AI SDK, test, package manager** theo AIHOT (mục G2). Các mục về TTS, tư liệu hình ảnh, render, upload, thông báo, triển khai vẫn giữ nguyên.

### B0. Ngôn ngữ chính: Node.js hay Python? (quyết định nền tảng)

| Tiêu chí | Python | Node.js / TypeScript |
|---|---|---|
| Giao diện web trực quan | Streamlit/NiceGUI làm nhanh nhưng khó làm đẹp, khó mở rộng; muốn đẹp phải thêm frontend JS riêng | ★ Next.js + shadcn/ui: dashboard đẹp, cùng một ngôn ngữ với backend |
| AI đa nhà cung cấp | LiteLLM: rất tốt, hỗ trợ hàng trăm model | ★ Vercel AI SDK: Claude, Gemini, OpenAI, OpenRouter, Ollama; structured output với zod rất gọn |
| Lấy tin & trích nội dung | ★ `feedparser`, `trafilatura` (mạnh nhất) | `rss-parser`, `@mozilla/readability`: đủ dùng |
| Lọc / NLP / embedding | ★ Hệ sinh thái mạnh nhất | Đủ dùng nếu gọi AI qua API |
| Render video | FFmpeg/MoviePy; không có công cụ đồ họa trực quan | ★ Remotion: template viết bằng React, **xem trước trực quan** trong Remotion Studio |
| TTS / Whisper | ★ Thư viện đầy đủ (edge-tts gốc, faster-whisper) | edge-tts port, `kokoro-js`, whisper.cpp binary: dùng được |
| Kiểu dữ liệu xuyên suốt | Pydantic | ★ TypeScript + zod dùng chung cho UI, worker, AI output |
| Số ngôn ngữ phải duy trì | 2 nếu cần UI đẹp (Python + JS) | ★ 1 |

**✔ Đã chốt: TypeScript/Node.js cho toàn bộ hệ thống.**
- Bạn cần **giao diện trực quan** và **render đồ họa**: đây là hai thế mạnh lớn nhất của hệ JS (Next.js, Remotion).
- AI đa nhà cung cấp làm tốt ngang nhau ở cả hai bên.
- Phần Python mạnh hơn (trích nội dung, Whisper) có thể thay bằng thư viện JS đủ dùng, hoặc gọi binary (whisper.cpp).
- Một ngôn ngữ, một bộ kiểu dữ liệu nên dễ duy trì cho một người.

**Khi nào nên chọn Python:** nếu bạn quen Python hơn hẳn và chấp nhận dashboard đơn giản (Streamlit), hoặc muốn tự xử lý NLP/embedding nặng. Phương án lai (Next.js UI + Python worker) **không khuyến nghị** cho một người vì phải duy trì 2 ngôn ngữ và 2 bộ schema.

### B1. Điều phối & lịch chạy
| Phương án | Ưu | Nhược |
|---|---|---|
| Worker Node + bảng job SQLite + `croner` (phương án cũ) | Không thêm service | Phải tự viết retry, lock, backoff, cron; SQLite bị 2 container cùng ghi |
| ★ **pg-boss trên PostgreSQL** | Có sẵn retry/backoff, cron, singleton, giới hạn song song; dùng chung DB | Thêm 1 container Postgres (nhẹ) |
| BullMQ + Redis | Queue mạnh, có UI | Thêm Redis chỉ để làm queue |
| Inngest / Trigger.dev (self-host) | Workflow bền vững, UI xem từng bước | Thêm nhiều service, phức tạp khi tự host |
| n8n / Temporal | Trực quan / bền vững | Nặng, tách logic ra khỏi code |

### B2. ① Đưa nguồn tin vào
- ★ Mỗi kiểu nguồn là một adapter cùng interface: `rss`, `keyword` (Google News RSS), `url`, `manual`, `hackernews`, `reddit`, `sitemap`; `webhook` ở phase sau.
- ★ Nút **Test** trên Dashboard xem trước tin trước khi lưu: quan trọng nhất cho trải nghiệm nhập nguồn.
- Import OPML để đưa nhanh hàng loạt RSS.

### B3. ① Lọc nội dung
| Phương án | Ưu | Nhược |
|---|---|---|
| Chỉ luật từ khóa | Rẻ, nhanh | Lọt nhiều tin rác, bỏ sót tin hay |
| Chỉ AI chấm điểm | Hiểu ngữ cảnh | Tốn phí cho mọi tin; khó giải thích |
| ★ **4 tầng: luật → gom cụm → AI (model rẻ) → xếp hạng + Inbox** | Luật loại phần lớn tin rác miễn phí, AI chỉ chấm phần còn lại; có lý do cho từng quyết định | Nhiều thành phần hơn |

→ Chi tiết: SPEC.md mục 2.2. Bắt đầu với `filter.mode = manual` (chọn tay trong Inbox) để thu dữ liệu, rồi chỉnh ngưỡng và chuyển sang auto.

### B4. ② AI đa nhà cung cấp
| Phương án | Ưu | Nhược |
|---|---|---|
| Gọi SDK từng hãng trực tiếp | Kiểm soát tối đa | Viết lại logic cho mỗi hãng |
| ★ **Vercel AI SDK + bảng ánh xạ task → model + fallback** | Một interface cho mọi hãng; đổi model trên Dashboard | Phụ thuộc thư viện |
| Chỉ OpenRouter | Một key cho mọi model | Thêm trung gian và phí; vẫn nên giữ khả năng gọi trực tiếp |
| Agent CLI (opencode, Gemini CLI, Claude Code) làm mặc định | Dùng gói subscription | Chậm, khó ép JSON, khó đo chi phí, rủi ro ToS → **chỉ là adapter tùy chọn** |

→ Gợi ý ban đầu: `script` dùng Claude, `factcheck` dùng Gemini (kiểm tra chéo khác hãng), `classify`/`metadata` dùng model rẻ nhất có sẵn.

### B5. ③ TTS tiếng Anh
| Phương án | Ưu | Nhược |
|---|---|---|
| ★ **edge-tts** (MVP) | Miễn phí, nhiều giọng neural Anh–Mỹ, có word-boundary timestamp | API không chính thức, có thể bị chặn bất kỳ lúc nào |
| Kokoro (open-source, chạy local) | Miễn phí, giọng tiếng Anh tự nhiên, chạy được trên CPU | Tự vận hành; ít giọng hơn |
| Google Cloud TTS / Azure TTS | Chính thức, ổn định, có SSML | Trả phí |
| OpenAI TTS | Rẻ, tự nhiên, API đơn giản | Không có timestamp, phải căn lại bằng Whisper |
| ElevenLabs | Tự nhiên nhất, có timestamp | Đắt khi chạy hằng ngày; ★ cân nhắc cho production nếu ngân sách cho phép |

→ Dùng edge-tts cho MVP. Production: Kokoro (miễn phí) hoặc ElevenLabs/OpenAI TTS (trả phí), tùy ngân sách.
→ Lưu ý: giọng đọc là yếu tố giữ chân người xem chính ở thị trường tiếng Anh, nên đáng đầu tư.

### B6. ④ Tư liệu hình ảnh (quyết định quan trọng)
| Phương án | Ưu | Nhược |
|---|---|---|
| A. Stock (Pexels/Pixabay) theo keyword | Miễn phí, license rõ, kho lớn cho keyword tiếng Anh | Hình chung chung, không khớp sự kiện cụ thể |
| B. Ảnh AI sinh theo segment | Khớp nội dung | Tốn phí; dễ trông "fake"; phải gắn nhãn AI |
| C. **Template đồ họa chữ** (headline, số liệu, bản đồ, quote) trên nền động | Luôn khớp nội dung, nhận diện thương hiệu tốt, không lo bản quyền | Cần thiết kế template ban đầu |
| ★ **C làm nền chính + A làm B-roll phụ** | Cân bằng chất lượng và rủi ro | Render phức tạp hơn một chút |

### B7. ④ Render
| Phương án | Ưu | Nhược |
|---|---|---|
| ★ **Remotion (đồ họa) + FFmpeg (ghép, nén)** | Template React, xem trước trực quan, dễ làm đẹp | Cần Chromium; license miễn phí cho cá nhân/công ty nhỏ, công ty lớn hơn phải mua |
| FFmpeg thuần | Nhẹ nhất | Filter graph khó, khó làm đẹp |
| Editly / MoviePy | Đơn giản | Hạn chế hiệu ứng |

### B8. ⑤ Upload YouTube
- ★ `googleapis` + resumable upload; OAuth kết nối một lần qua trang Settings trên Dashboard; refresh token lưu file quyền 600.
- OAuth consent screen phải ở chế độ **Production**.

### B9. Thông báo & duyệt
- ★ Duyệt chính trên Dashboard (Inbox, Review); Telegram để báo lỗi và gửi link duyệt nhanh.

### B10. Triển khai
- ★ **Docker Compose** (web + worker) trên một VPS; truy cập Dashboard qua Tailscale hoặc HTTPS có đăng nhập.

### B11. Cấu hình ngách theo Profile
- ★ Profile lưu trong DB, sửa bằng form trên Dashboard, Import/Export YAML để sao lưu và chia sẻ. (Trước đây đề xuất YAML file; đổi sang DB vì đã có Dashboard.)

### B12. Dashboard
| Phương án | Ưu | Nhược |
|---|---|---|
| ★ **Next.js + shadcn/ui, cùng monorepo với worker** | Đẹp, dùng chung kiểu dữ liệu | Công làm UI |
| Admin có sẵn (Payload CMS, Refine, AdminJS) | CRUD nhanh | Khó làm màn hình đặc thù (Inbox, Review video) |
| Không có UI, chỉ YAML + CLI | Nhanh nhất | Không trực quan, trái yêu cầu |

---

## C. KẾ HOẠCH TRIỂN KHAI (hướng fork AIHOT)

Ước lượng cho 1 người bán thời gian. Mỗi giai đoạn có **tiêu chí hoàn thành**. So với kế hoạch tự xây: bước ① gần như có sẵn, công việc dồn vào **chuyển AIHOT sang tiếng Anh** và **viết module video**.

### Giai đoạn 0 — Chuẩn bị & đánh giá AIHOT (tuần 1)
**Việc bên ngoài (bạn làm, chạy song song):**
- [ ] Google Cloud project, bật YouTube Data API, OAuth consent (Production), **gửi đơn audit**
- [ ] **Xác minh kênh YouTube** (để upload video > 15 phút)
- [ ] Lấy API key AI (ít nhất 2 hãng để kiểm tra chéo); tạo bot Telegram

**Đánh giá AIHOT (1–2 ngày) — 4 tiêu chí:**
- [ ] (1) `docker compose up` chạy được; thêm 15–20 nguồn RSS tiếng Anh của ngách đầu tiên
- [ ] (2) Viết lại 2–3 prompt chính (`prefilter`, `selection-score`, `summarize-article`) sang tiếng Anh; kết quả chấm điểm hợp lý
- [ ] (3) Gom sự kiện đúng: cùng một tin từ nhiều báo về cùng một sự kiện
- [ ] (4) Viết thử module nhỏ trong `modules/` (lấy top sự kiện → ghi vào bảng `video_candidates`) mà **không phải sửa lõi** quá vài điểm nối

**Xong khi:** cả 4 tiêu chí đạt → tạo repo PipelineX từ fork AIHOT (giữ `LICENSE`/`NOTICE`), tạo `FORK_CHANGES.md`. Nếu (4) không đạt → chuyển sang phương án dự phòng (cuối mục C).

### Giai đoạn 1 — Bước ① tiếng Anh (tuần 2)
- [ ] `site/`: tên PipelineX, `locale: en`, preset model (Claude, Gemini, model rẻ) trong `site/models.ts`
- [ ] `industry/`: viết lại **toàn bộ 31 prompt** sang tiếng Anh cho ngách đầu tiên; bỏ các prompt dịch sang tiếng Trung; `sources.json`, `taxonomy.ts`, `topics.json`, ngưỡng `selection.ts`
- [ ] Tắt phần không dùng: trang công khai (hoặc để nội bộ), WeChat, X (nếu không có key), Feishu/DingTalk, IndexNow/Baidu
- [ ] Thêm nguồn: dán URL bài viết, nhập tay, preset Google News theo từ khóa, import OPML
- [ ] Gán nhãn 100–200 tin và chạy script đánh giá bộ lọc

**Xong khi:** admin hiển thị sự kiện tiếng Anh đã lọc và xếp theo độ nóng; độ chính xác bộ lọc trên mẫu gán nhãn ≥ `[80%]`.

### Giai đoạn 2 — MVP module video (tuần 3–5)
- [ ] Migration `video_*`; queue `video.*` trên pg-boss
- [ ] **Inbox video**: sự kiện đạt ngưỡng → nút Sản xuất
- [ ] ② Kịch bản 3 lượt (outline → chương → rà soát) qua lớp model AIHOT; zod schema
- [ ] ③ edge-tts + phụ đề từ timestamp
- [ ] ④ Project Remotion với 1 template đơn giản, container `renderer`, **render theo chương rồi nối bằng FFmpeg**
- [ ] **Đo thời gian render video 12 phút** để chốt cấu hình VPS
- [ ] ⑤ Upload Private bằng `googleapis` (tham khảo darkzOGx)
- [ ] Trang **Video jobs**: tiến trình, log, chạy lại từ bước bất kỳ

**Xong khi:** chọn một sự kiện trong Inbox → có video 10–15 phút ở chế độ Private trên YouTube.

### Giai đoạn 3 — Tự động hóa & duyệt (tuần 6–7)
- [ ] Profile video + Import/Export YAML; lịch chạy theo profile
- [ ] Fact-check chéo nhà cung cấp theo chương; **fallback model** khi preset chính lỗi
- [ ] Trang **Review**: sửa kịch bản theo chương, Approve/Reject; gắn khẳng định với nguồn (Evidence desk)
- [ ] Telegram: báo lỗi, link duyệt; công tắc `VIDEO_ENABLED`, `PUBLISH_ENABLED`
- [ ] Kiểm tra sẵn sàng (provider, kênh YouTube, render thử) trước khi bật tự động
- [ ] Deploy VPS (8 vCPU / 16 GB), Tailscale hoặc Caddy, sao lưu `pg_dump`

**Xong khi:** chạy tự động 7 ngày liên tục trên VPS, mỗi ngày 1 video chờ duyệt, không phải can thiệp tay ngoài việc duyệt.

### Giai đoạn 4 — Chất lượng & Production
- [ ] Bộ template Remotion theo `visual_type` (title card, quote, stat, chart, timeline, map, list), chapter card, thanh tiến độ chương
- [ ] B-roll stock, nhạc nền, thumbnail; **duyệt storyboard trước khi render**
- [ ] So sánh giọng Kokoro / ElevenLabs / OpenAI TTS
- [ ] Profile thứ hai để chứng minh đổi ngách không cần sửa code
- [ ] Khi audit duyệt: đăng Public / lên lịch

**Xong khi:** bạn xem 5 video liên tiếp và thấy đủ chuẩn đăng Public.

### Giai đoạn 5 — Mở rộng (tùy chọn)
- Shorts 9:16 cắt từ video dài, vòng học từ YouTube Analytics, bật trang tin công khai, đa kênh.

### Phương án dự phòng (nếu đánh giá AIHOT không đạt)
- Tạo repo riêng theo cấu trúc v0.4 (SPEC bản trước), **chép có chọn lọc** các phần của AIHOT: nguồn, lọc, gom sự kiện, biên nhận, ngắt chi tiêu (MIT, giữ ghi chú bản quyền).
- Giai đoạn 1 kéo dài thêm khoảng 2–3 tuần.

---

## D. QUYẾT ĐỊNH CẦN CHỐT TRƯỚC KHI CODE

| # | Câu hỏi | Trạng thái / Đề xuất |
|---|---|---|
| D0 | Ngôn ngữ nội dung | ✔ Tiếng Anh |
| D1 | Ngách | ✔ Cấu hình qua profile; profile đầu tiên đề xuất `tech` |
| D2 | Stack | ✔ **TypeScript/Node.js** (B0) |
| D2b | Hướng làm | ✔ **Fork AIHOT + module video** (mục G), sau khi đánh giá ở Giai đoạn 0 đạt |
| D3 | Có API key của những hãng AI nào? | Cần ít nhất 2 hãng (ví dụ Anthropic + Google) để kiểm tra chéo |
| D4 | Danh sách nguồn tin ban đầu | Bạn cung cấp vài RSS/từ khóa cho profile đầu tiên |
| D5 | Format | ✔ **16:9, 10–15 phút** (giữ < 15:00 nếu kênh chưa xác minh) |
| D6 | Số video/ngày | ✔ **1/ngày** |
| D7 | Chế độ lọc và duyệt mặc định | **Manual** 2–4 tuần đầu, sau đó auto |
| D8 | Ngân sách tháng cho API + VPS | Bạn cung cấp |
| D9 | Đã có kênh YouTube và Google Cloud project chưa? | Bạn cung cấp |

---

## E. REVIEW CÔNG NGHỆ (v0.4) — ĐIỀU CHỈNH SO VỚI BẢN TRƯỚC

> ⚠ Đã được thay bởi mục G (hướng fork). Giữ lại để tham khảo và dùng cho phương án dự phòng.

| Thành phần | Bản trước | Chốt mới | Lý do |
|---|---|---|---|
| Ngôn ngữ | TypeScript/Node.js | **Giữ nguyên** | Đã chốt; hợp với Dashboard và Remotion |
| Dashboard | Next.js + shadcn/ui | **Giữ**, thêm quy tắc: Next.js chỉ làm UI + API mỏng | Logic nằm trong `packages/core` để worker dùng chung; tránh dính chặt vào Next.js |
| Database | SQLite | **PostgreSQL + pgvector** | Web và worker là 2 container cùng ghi, SQLite dễ lỗi khóa; pgvector cho gom cụm bằng embedding (tầng 2 lọc) ngay từ đầu |
| Hàng đợi / lịch | Tự viết trên SQLite + `croner` | **pg-boss** | Có sẵn retry, backoff, cron, chống chạy chồng, giới hạn song song; không phải tự viết |
| Gom cụm tin | Fuzzy match, embedding để sau | **Embedding + pgvector** ngay giai đoạn 2 | Fuzzy match tiêu đề bắt sai nhiều với tin cùng sự kiện nhưng khác cách viết |
| TTS local / Whisper | `kokoro-js`, whisper.cpp binary | **Sidecar Docker** (Kokoro-FastAPI, whisper.cpp server), gọi qua HTTP | Image có sẵn, không phải duy trì code Python; dễ thay thế |
| Cấu trúc monorepo | 8 package | **4 package** (`web`, `worker`, `core`, `render`) | 1 người làm, 8 package chỉ thêm cấu hình; `render` tách vì Remotion có bundler riêng |
| AI SDK | Vercel AI SDK | **Giữ**, ghim phiên bản | SDK đổi API giữa các bản lớn; ghim để không vỡ |
| Render | Remotion + FFmpeg | **Giữ**, thêm Remotion Player trên Dashboard | Xem trước template trực quan; kiểm tra license Remotion (miễn phí cho cá nhân/công ty ≤ 3 người) |
| Truy cập Dashboard | Đăng nhập + HTTPS | **Tailscale** (ưu tiên) hoặc Caddy HTTPS | Không mở cổng public, đỡ lo bảo mật |
| Bổ sung | — | pino (log), vitest (test), zod cho `.env`, `pg_dump` sao lưu hằng ngày | Vận hành ổn định |

**Không đổi và lý do:**
- **Không dùng Bun/Deno:** Remotion và một số thư viện chạy ổn định nhất trên Node.
- **Không dùng Redis/BullMQ:** pg-boss đủ cho vài chục job/ngày, bớt một service.
- **Không dùng Inngest/Trigger.dev:** tự host thêm nhiều service; pg-boss + bảng `jobs` đã đủ để xem tiến trình từng bước trên Dashboard.
- **Không đổi Next.js sang Vite + Hono:** cả hai đều được; Next.js phổ biến hơn và gom UI + API vào một app, hợp với một người làm.

**Tác động lên kế hoạch:** không đổi số giai đoạn. Giai đoạn 0 thêm container Postgres; giai đoạn 2 làm gom cụm bằng embedding thay vì fuzzy match.

---

## F. TÁC ĐỘNG CỦA VIDEO DÀI 10–15 PHÚT

| Khía cạnh | Video 3–5 phút (cũ) | Video 10–15 phút (mới) | Điều chỉnh |
|---|---|---|---|
| Nguồn nội dung | 1 bài báo là đủ | Cần nhiều nguồn hoặc nhiều tin | Lọc ưu tiên cụm có ≥ `[3]` nguồn; thêm style `deep_dive`, `roundup` |
| Viết kịch bản | 1 lần gọi AI | Dài 1.500–2.200 từ, dễ lặp ý, lan man | Viết 3 lượt: outline → từng chương → rà soát; fact-check theo chương |
| Hình ảnh | ~30–50 cảnh | ~100–200 cảnh | `visual_type` cho mỗi segment, thêm template stat/chart/timeline/map; đây là phần tốn công nhất |
| Render | vài phút | ước tính 30–60 phút | Render theo chương, song song, chạy lại từng chương; VPS 8 vCPU / 16 GB |
| TTS | ~4.000 ký tự | ~10.000–14.000 ký tự | Cache theo segment; chi phí TTS trả phí tăng ~3 lần |
| Chi phí AI | thấp | tăng ~3–5 lần (outline + chương + fact-check) | Theo dõi chi phí theo job trên Dashboard |
| Lưu trữ | ~200 MB/video | 1–2 GB/video | Giữ video 14 ngày, dọn artifact |
| YouTube | không vướng | > 15 phút cần xác minh kênh | Xác minh kênh ở giai đoạn 0 |
| Kiếm tiền | không có mid-roll | ≥ 8 phút có mid-roll | Lợi thế |
| Giữ chân người xem | dễ hơn | khó hơn | Hook mạnh, chapters, nhịp hình ảnh, giọng đọc tốt |

**Điều chỉnh kế hoạch:**
- Giai đoạn 0: thêm **xác minh kênh YouTube**.
- Giai đoạn 1: MVP vẫn có thể làm video ngắn hơn để test nhanh, nhưng **phải đo thời gian render một video 12 phút** trước khi chốt cấu hình VPS.
- Giai đoạn 1: pipeline viết kịch bản 3 lượt và render theo chương làm ngay từ đầu (đổi sau sẽ phải sửa nhiều).
- Giai đoạn 4: ưu tiên làm bộ template đa dạng `visual_type` — đây là yếu tố quyết định video dài có xem được hay không.
- Giọng TTS: với video dài, giọng máy kém sẽ làm người xem bỏ nhanh. Nên thử ElevenLabs/OpenAI TTS so với Kokoro sớm ở giai đoạn 2.

---

## G. HƯỚNG FORK AIHOT (v0.5) — ĐÃ CHỐT

### G1. Vì sao fork
- AIHOT đã làm xong phần khó nhất của bước ①: nhiều loại nguồn, thử lấy tin, lọc sơ bộ, chấm điểm 2 lần, gom sự kiện, độ nóng, sửa điểm tay, đánh giá bộ lọc.
- Hạ tầng vận hành có sẵn: admin, chọn model từng bước, biên nhận cho lệnh gọi trả phí, ngắt chi tiêu, công tắc an toàn, cảnh báo, sao lưu.
- Cùng stack (Node 24, TypeScript, PostgreSQL, pg-boss, Docker Compose); ~74 nghìn dòng TypeScript, 173 file test; license MIT.
- Có thư mục `modules/` để thêm tính năng riêng mà không sửa lõi.

### G2. Thay đổi công nghệ so với v0.4
| Thành phần | v0.4 | v0.5 (theo AIHOT) | Ghi chú |
|---|---|---|---|
| Web/admin | Next.js + shadcn/ui | **React Router SSR** + admin AIHOT | Thêm trang video vào admin sẵn có |
| API | Route của Next.js | **Fastify** | |
| DB access | Drizzle ORM | **postgres.js + SQL migration** | Bảng video viết migration SQL cùng kiểu |
| AI | Vercel AI SDK | **Lớp model OpenAI-compatible của AIHOT** | Claude/Gemini qua endpoint tương thích OpenAI hoặc OpenRouter; thêm fallback |
| Test | vitest | **node:test** | |
| Package manager | pnpm | **npm workspaces** | |
| Giữ nguyên | PostgreSQL, pg-boss, Remotion + FFmpeg, Kokoro/whisper.cpp sidecar, googleapis, Telegram, Docker Compose | | |

### G3. Khối lượng việc
| Phần | Có sẵn | Phải làm |
|---|---|---|
| ① Nguồn | 6 loại, thử lấy tin, tình trạng | Dán URL, nhập tay, preset từ khóa, import OPML |
| ① Lọc & gom sự kiện | Đầy đủ | **Viết lại 31 prompt sang tiếng Anh**, thêm `video_potential` và cờ nhạy cảm, chỉnh ngưỡng |
| ② Kịch bản | Lớp gọi model | Toàn bộ logic kịch bản 3 lượt, factcheck, metadata, fallback model |
| ③ Giọng đọc | — | Toàn bộ |
| ④ Render | — | Toàn bộ (project Remotion, container renderer, template) |
| ⑤ Upload | — | Toàn bộ |
| Admin | Nguồn, nội dung, model, chi tiêu | Inbox video, Profiles, Video jobs, Review, YouTube |

### G4. Rủi ro của hướng fork
| Rủi ro | Biện pháp |
|---|---|
| Codebase lớn, mất thời gian đọc hiểu | Dùng `AGENTS.md`, `docs/architecture.md`; nhờ AI đọc cùng; giai đoạn 0 có tiêu chí (4) để thử trước |
| Prompt và ngưỡng thiết kế cho tiếng Trung và ngách AI | Viết lại prompt; gán nhãn 100–200 tin để đo lại |
| Phải sửa lõi nhiều hơn dự kiến | Ghi mọi chỗ sửa vào `FORK_CHANGES.md`; nếu quá nhiều thì chuyển phương án dự phòng |
| Upstream thay đổi lớn | Fork độc lập, chỉ cherry-pick khi cần |
| Lớp AI chỉ hỗ trợ OpenAI-compatible | Đủ cho Claude/Gemini/OpenRouter; nếu cần tính năng riêng của một hãng thì thêm adapter vào `llm.ts` |
| Postgres image của AIHOT (`postgres:17-alpine`) | Kiểm tra cách AIHOT lưu embedding trước khi thêm pgvector |
