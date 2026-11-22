# Hợp đồng API — Nhật ký thao tác (001-operation-log)

Chỉ có API **đọc**. Không tồn tại API ghi/sửa/xoá log (ADR-0002, ADR-0003). Mọi route đi qua lớp bảo vệ admin hiện hữu của module video: chưa đăng nhập → `401 {"error":"unauthorized"}`; lỗi máy chủ → `500 {"error":"internal","detail":"<tối đa 300 ký tự>"}`.

## GET /api/admin/operation-log

Danh sách dòng log mới nhất trước, kèm tổng hợp theo nhóm cho hàng chip.

**Tham số truy vấn**

| Tên | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `category` | `publish` \| `config` \| `build` \| `other` | — | Lọc theo nhóm taxonomy |
| `actor_type` | `admin` \| `system` \| `agent` | — | Lọc theo loại người thực hiện |
| `action` | string | — | Lọc theo mã hành động (khớp tiền tố, ví dụ `lexicon.`) |
| `q` | string | — | Tìm trong action/subject/actor/evidence/detail |
| `from`, `to` | ISO 8601 | — | Khoảng thời gian theo `at` |
| `page` | int ≥ 1 | 1 | Trang |
| `pageSize` | int 1–100 | 50 | Số dòng mỗi trang |

**Đáp 200**

```json
{
  "items": [
    {
      "id": 1024,
      "at": "2026-11-23T01:30:00.000Z",
      "actorType": "admin",
      "actor": "admin",
      "action": "voice.chain.update",
      "category": "config",
      "subject": "voice-config",
      "detail": { "before": ["vieneu", "relay", "piper"], "after": ["vieneu", "relay", "nvidia", "piper"] },
      "evidence": "industry/voice-config.json",
      "result": "success",
      "error": null
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 50,
  "summary": { "all": 128, "publish": 12, "config": 84, "build": 25, "other": 7 }
}
```

`summary` đếm theo **toàn bộ bộ lọc trừ `category`** để hàng chip luôn hiển thị tổng của các nhóm còn lại trong cùng ngữ cảnh lọc.

## GET /api/admin/operation-log/export

Xuất đúng bộ lọc của API danh sách (trừ phân trang).

**Tham số**: các tham số lọc như trên + `format` = `csv` | `json` (bắt buộc).

**Đáp 200**: `Content-Disposition: attachment; filename="operation-log-<from>-<to>.csv"` (hoặc `.json`); CSV có hàng tiêu đề đúng thứ tự cột của bảng (`id, at, actor_type, actor, action, category, subject, detail, evidence, result, error`); JSON là mảng các object cùng hình dạng `items` ở trên. Giới hạn xuất: tối đa 10.000 dòng mỗi lần; vượt quá → `400 {"error":"export_too_large"}` kèm hướng dẫn thu hẹp khoảng thời gian.

## Quy ước

- Thời gian trong đáp là ISO 8601 UTC; giao diện tự đổi sang Asia/Ho_Chi_Minh.
- `detail` trong đáp là nguyên trạng đã che từ lúc ghi — API không che thêm và không có tham số nào mở khoá giá trị gốc (giá trị gốc không tồn tại trong log).
- Route thuộc nhóm API của module video: khai báo `apiPaths` hiện hữu đã bao phủ tiền tố `/api/admin/video/`; hai route này đặt tại `/api/admin/operation-log` nên cần bổ sung tiền tố vào `apiPaths` của module trong `module.ts` khi triển khai (ghi rõ để tránh sót).
