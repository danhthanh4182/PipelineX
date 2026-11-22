# Implementation Plan: Kế thừa tính năng Studio vào PipelineX

**Branch**: `pipelinex` + worktree kênh `channel/diem-tin-cong-nghe` | **Date**: 2026-11-22 | **Spec**: `docs/handover-studio/spec.md`

## Summary

Đưa vào repo các tính năng Studio còn thiếu theo quyết định PORT ở FEATURE-GAP (từ điển + vòng ASR, QA phụ đề, QA âm thanh + hậu kỳ, nghe thử giọng, luật chọn đề tài + gộp trùng + hash canonical, preset vùng an toàn), đồng thời dựng cầu BRIDGE M1 để Space giữ vai trò bàn duyệt và phát hành đa nền tảng. Phần từ điển và voice-config đang được xây theo prompt riêng (Phần A/B) — plan này nối tiếp ngay sau chúng, không làm lại.

## Technical Context

**Languages**: TypeScript (apps/api, modules/video), Python 3.13 (renderer/tts.py và các bước phụ trợ), SQL (Postgres của kênh).
**Existing systems**: PipelineX pipeline 12 bước; editor MCP (28 tools, đã vá named-source); renderer Remotion; Studio Space actions (getstudio, getrenderconfig, importlexiconentries...).
**Constraints**: THANH-PC không có GPU NVIDIA (CPU-only); không khởi động lại worker của kênh khi video job đang chạy; khóa publish giữ nguyên; bí mật chỉ qua tên biến môi trường; commit theo phần trên đúng checkout (renderer + FORK_CHANGES ở checkout chính nhánh pipelinex; modules/apps ở worktree kênh), push lên fork danhthanh4182/PipelineX.

## Constitution Check (theo ADR của Studio)

- ADR-001 (bằng chứng + log): mỗi task trong tasks.md có mục bằng chứng bắt buộc. PASS.
- ADR-002 (từ điển): FR-001..FR-004 khóa đúng quy tắc của ADR (chưa ASR thì tắt; chỉ sửa bản đọc). PASS.
- ADR-003 (QA phụ đề): FR-007 thể chế hóa cổng QA làm bước pipeline chính thức. PASS.
- Khóa publish hai lớp: FR-011. PASS.
- Không nhân đôi bàn duyệt: User Story 4 chọn BRIDGE thay vì PORT. PASS.

## Project Structure (thay đổi dự kiến)

```text
modules/video/backend/
  lexicon.ts          (đang xây — Phần A: CRUD + sinh industry/lexicon.json)
  lexicon-asr.ts      (MỚI: hàng đợi + ghi kết quả kiểm ASR cho từ điển)
  qa.ts               (MỚI: cổng QA phụ đề + âm thanh, gọi renderer/qa_check.py)
  selection-scope.ts  (MỚI: luật phạm vi kênh cho candidates)
  sync-bridge.ts      (MỚI: đồng bộ M1 repo → Space qua action của Space)
renderer/
  tts.py              (đang sửa — Phần B: voice-config + engine nvidia)
  qa_check.py         (MỚI: đo LUFS/true peak/quãng lặng bằng ffmpeg + ASR phụ đề bằng faster-whisper)
  post_audio.py       (MỚI: hậu kỳ giọng tự host — lọc thông cao, EQ nhẹ, chuẩn hóa độ to)
industry/
  lexicon.json        (sinh tự động — hợp đồng)
  voice-config.json   (sinh từ trang admin — hợp đồng)
docs/handover-studio/ (bộ tài liệu này)
```

## Data Model

- `pronunciation_lexicon` (đang xây ở Phần A): id, term, reading, scope, category_scope, enabled, locked, asr_status, asr_model, asr_checked_at, note, created_at, updated_at. Khóa duy nhất (lower(term), scope).
- `qa_reports` (MỚI): id, video_id, kind (subtitle|audio), status (pass|warn|fail), metrics JSONB, details JSONB, created_at.
- `sync_records` (MỚI, phía tiến trình đồng bộ): pipelinex_video_id, space_project_id, bt_code, canonical_hash, needs_review (bool), last_synced_at.
- Không bảng mới cho voice-config: file `industry/voice-config.json` là nguồn sự thật (theo Phần B).

## Contracts (hợp đồng giữa hai hệ — thay đổi phải có duyệt của Thanh)

### industry/lexicon.json

```json
{ "generated_at": "<ISO>", "entries": [
  { "term": "callback", "reading": "hàm gọi lại", "scope": "all", "category_scope": "all" } ] }
```

Chỉ chứa mục đang bật. Tầng TTS áp Longest-Match First lên bản đọc; phụ đề không đổi.

### industry/voice-config.json

```json
{ "chain": ["vieneu", "relay", "piper"],
  "engines": {
    "vieneu": { "kind": "package", "enabled": true, "voice": "Hải Đăng", "venv": ".venv-vieneu" },
    "relay":  { "kind": "api", "enabled": true, "voice": "HoaiMy", "url_env": "RELAY_URL", "secret_env": "RELAY_SECRET" },
    "nvidia": { "kind": "api", "enabled": false, "voice": "Magpie-Multilingual.VI-VN.Long", "key_env": "NVIDIA_API_KEY", "model": "ai-magpie-tts-multilingual" },
    "piper":  { "kind": "package", "enabled": true, "voice": "vi_VN-vais1000-medium", "venv": ".venv-piper" } } }
```

Giá trị mặc định phải khớp `studio-voice-standard.json`. Không giá trị bí mật thật trong file.

### Đồng bộ M1 (repo → Space)

- Nguồn: editor MCP của kênh (list_videos, get_video, get_publish_kit) + DB kênh cho hash.
- Đích: actions của Space (createproject/updateproject, renders, releases) qua lớp bridge phía máy ảo; khóa nối `pipelinex_video_id`.
- Tần suất: theo chu kỳ do Thanh đặt; chỉ đồng bộ video ở trạng thái ready trở đi; video đổi nội dung sau đồng bộ → needs_review=true.
- Publish: bridge KHÔNG bao giờ gọi tool thuộc lớp publish.

## Phasing

- **P0 (đang chạy)**: Phần A/B của prompt voice-config/lexicon — điều kiện tiên quyết.
- **P1**: QA phụ đề + QA âm thanh + hậu kỳ (User Story 2).
- **P2**: Vòng ASR cho từ điển + nghe thử giọng tối thiểu (User Story 1 phần ASR, User Story 3 phần demo).
- **P3**: Luật chọn đề tài + gộp trùng sourceUrl + hash canonical (User Story 5) — làm cùng đợt sửa candidates/heat đang kẹt.
- **P4**: Bridge M1 đọc-chiều + cờ cần-xem-lại (User Story 4).
- **P5**: Preset vùng an toàn theo nền tảng đích + nghiệm thu tổng theo Success Criteria của spec.
