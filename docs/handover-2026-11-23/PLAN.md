# PLAN — Ngày làm việc 23/11/2026

- **Đi kèm:** `BIEN-BAN-BAN-GIAO.md` (trạng thái), `SPEC.md` (yêu cầu + nghiệm thu), `adr/` (quyết định kiến trúc).
- **Nguyên tắc chạy:** checkpoint ra đĩa ở mỗi chặng (giao thức chống mất việc); một chat/một Space cho từng tuyến; khởi động lại PipelineX chỉ qua launcher chuẩn trong `.data\`; báo tiến độ theo mốc kèm evidence.

## Thứ tự thực hiện

### Buổi sáng

| # | Việc | Chủ trì | Điều kiện / ghi chú | Đầu ra |
|---|---|---|---|---|
| 1 | Nhận kết quả ASR chunk 1, đối chiếu progress.json + DB, báo Thanh | Chat chính | Agent chunk 1 báo xong; kiểm tra Whisper đã tắt hẳn. Tiến độ 02:12: 97/578 (đạt 78, lệch 19, lỗi 0) | Báo cáo chunk 1: đạt/lệch/lỗi; chờ Thanh gật chunk 2 |
| 2 | Refresh Bản Tin Sáng 06:30 | Cron sẵn có | Quan sát viên theo dõi; chỉ can thiệp khi lỗi | Ấn bản ngày 23/11 (phát hành web vẫn phụ thuộc cổng gói — xem việc 7) |
| 3 | Nhắc rà soát admin ChatGPT (~08:00) | Cron nhắc | Hạn chót 24/11 | Thanh xử lý hoặc giao lại |
| 4 | Kiểm tra thread hỗ trợ 09:00 | Cron sẵn có | Oracle/Vietcombank: nếu vẫn im lặng → chuẩn bị nháp nhắc lần 3 trình Thanh duyệt (không tự gửi). AMD: nháp đã có, chờ duyệt | Báo cáo thread + nháp (nếu cần) |
| 5 | ~~Căn chỉnh layout shift (W1)~~ — ĐÃ XONG trong đêm (02:15) | Tuyến Studio + chat chính | Space v3.2 + bản dựng file HTML v3.2 đã căn chỉnh và kiểm chứng; §8 MD đã có sẵn quy tắc | Không còn việc — chỉ còn việc 6 |
| 6 | Đồng bộ docs\ HTML v3.2 (W1b) + commit bổ sung | Chat chính | scp lỗi kết nối, SSH vẫn thông — chuyển file bằng đường khác, kiểm md5 hai đầu | docs\ HTML khớp md5 bản chuẩn v3.2; commit bổ sung vào checkout kênh |
| 7 | i18n toàn app — P0 kiểm kê (W6) | Agent riêng, chat chính nghiệm thu | Theo `KE-HOACH-I18N-TOAN-APP.md`; recon nền đã có (99 file, 3 file dùng i18n) | Bảng phân loại A/B/C cho 99 file + ước lượng khóa theo giai đoạn P1–P4 |

### Buổi chiều / tối

| # | Việc | Chủ trì | Điều kiện / ghi chú | Đầu ra |
|---|---|---|---|---|
| 7 | Trình lại 5 điểm cổng gói bản tin (BT-334) nếu Thanh chưa chốt | Chat Bản Tin | Không tự gỡ cổng; không chạy review toàn ấn bản khi BT-334 còn giữ pháp lý | Quyết định của Thanh hoặc giữ nguyên trạng |
| 8 | ASR chunk tiếp theo (W2) | Agent riêng, chat chính giám sát | Chỉ khi Thanh gật sau báo cáo chunk trước; guard RAM theo SPEC | results-chunk-N.json + progress.json cập nhật; Whisper tắt sau chunk |
| 9 | Kiểm chứng 4 endpoint HTTP từ điển (W3) | Chat chính | Chờ cửa sổ rate-limit xả hẳn; đúng một lượt | Báo cáo endpoint + xác nhận dọn dẹp dữ liệu test |
| 10 | Các hạng mục W4 | Theo quyết định của Thanh | Chỉ bắt đầu khi có điều kiện ở SPEC W4 | Theo spec riêng từng hạng mục |
| 11 | i18n toàn app — P1 shell + dùng chung (W6) | Agent riêng, chat chính nghiệm thu | Sau P0 (việc 7); làm trước P2–P4 vì phủ khung toàn admin | layout/sidebar/admin-ui/toast/login đã dịch; parity vi/en 100%; kiểm chứng Chrome hai locale |

Các giai đoạn i18n P2 (admin engine), P3 (videos.tsx), P4 (bề mặt công khai), P5 (quét nghiệm thu) xếp vào các ngày tiếp theo theo nhịp cụm 3–4 trang/lượt trong `KE-HOACH-I18N-TOAN-APP.md` — không dồn vào một ngày. **Thanh tái chốt ưu tiên i18n lúc 02:08–02:13: trang Models (`/admin/models`) là điển hình chưa được dịch — P2 bắt đầu bằng models.tsx làm trang mẫu đầu tiên** (trích khóa + dịch vi/en + kiểm chứng Chrome hai locale), rút kinh nghiệm rồi mới đi các cụm tiếp theo.

## Điểm dừng / leo thang

- RAM máy ảo crit trở lại khi không phải do ASR: dừng việc nặng, báo Thanh kèm số liệu doctor.
- Bất kỳ thao tác nào cần đăng nhập lại, nhập mật khẩu, hoặc đổi cấu hình thật (chain giọng, gỡ cổng gói, gửi thư ra ngoài): dừng và xin Thanh quyết.
- Bản HTML tương tác độc lập: nút Nghe thử phát bằng giọng của trình duyệt trên máy người mở — cần Thanh bấm thử trên máy anh để xác nhận tiếng thật. Chưa có xác nhận đó thì ghi rõ "chưa kiểm chứng tiếng thật", không coi hạng mục là xong hẳn.

## Bàn giao cuối ngày

- Cập nhật biên bản ngày 24/11: trạng thái từng hạng mục W1–W5, quyết định mới của Thanh, nợ evidence còn lại.
- Cập nhật `~/workspace/video-studio/asr-578/progress.json` là nguồn sự thật cho ASR; không dựa vào trí nhớ phiên chat.
