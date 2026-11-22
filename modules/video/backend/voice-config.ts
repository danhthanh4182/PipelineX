// Voice configuration for the channel: which TTS engines the voice step may use, in which order
// (the fallback chain), and with which voice each. Stored in industry/voice-config.json — the
// renderer (tts.py) reads the same industry folder for the channel profile. The file holds only
// environment variable NAMES for secrets (key_env / secret_env), never a secret value.
// Engine kinds: "package" = a local subprocess engine in its own venv (vieneu, piper);
// "api" = a model call over the network (relay, nvidia, azure, edge).
// The voice catalog and the defaults follow the Studio's voice standard (set by the owner on the
// Studio Space, 21/11/2026): the same 25 VieNeu presets, the same default and preview voices.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const VOICE_CONFIG_FILE = path.join(ROOT, "industry", "voice-config.json");

export class VoiceConfigConflict extends Error {
  code = "conflict";
}

export interface VoiceOption { id: string; label: string; description: string }
export interface EngineMeta { name: string; kind: "package" | "api"; role: string; note: string; voices: VoiceOption[] }

const v = (id: string, label: string, description = ""): VoiceOption => ({ id, label, description });

export const ENGINE_CATALOG: Record<string, EngineMeta> = {
  vieneu: {
    name: "VieNeu-TTS v3 Turbo",
    kind: "package",
    role: "Chính",
    note: "Gói vieneu (pip) trong renderer/.venv-vieneu, ONNX Runtime, chạy CPU tại máy. Không có mốc thời gian từ (words) — phụ đề xử lý ở giai đoạn ASR riêng.",
    voices: [
      v("Mai Anh", "Mai Anh (Nữ · Bắc · tin tức)", "Giọng nữ Bắc phong cách tin tức: trong, rõ, đĩnh đạc, tốc độ đều — lựa chọn an toàn nhất cho bản tin chính và tin nóng."),
      v("Minh Đức", "Minh Đức (Nam · Bắc · tin tức)", "Giọng nam Bắc phong cách tin tức: dứt khoát, trang trọng — hợp tin thời sự, chính trị, kinh tế cần độ tin cậy cao."),
      v("Thùy Dung", "Thùy Dung (Nữ · Nam · tin tức)", "Giọng nữ Nam phong cách tin tức: mềm hơn giọng Bắc nhưng vẫn rõ ràng — hợp bản tin hướng khán giả miền Nam."),
      v("Minh Triết", "Minh Triết (Nam · Nam · tin tức)", "Giọng nam Nam phong cách tin tức: chắc, ấm — hợp bản tin chính cho khán giả miền Nam."),
      v("Adam bựa", "Adam bựa (Nam · Bắc · tự nhiên)", "Giọng nam Bắc phong cách tự nhiên, hơi 'bựa', vui tính — hợp nội dung giải trí, video ngắn bắt trend; tránh dùng cho tin nghiêm túc."),
      v("Trúc Ly", "Trúc Ly (Nữ · Bắc · tự nhiên)", "Giọng nữ Bắc phong cách tự nhiên: tươi, gần gũi — hợp video ngắn, giới thiệu tính năng, nội dung mạng xã hội."),
      v("Thiện Minh", "Thiện Minh (Nam · Bắc · kể chuyện)", "Giọng nam Bắc phong cách kể chuyện: trầm ấm, nhiều biểu cảm — hợp bài phân tích sâu, phóng sự, nội dung dài."),
      v("Hải Đăng", "Hải Đăng (Nam · Bắc · tự nhiên — mặc định của SDK)", "Giọng nam Bắc phong cách tự nhiên (giọng mặc định của SDK): cân bằng, dễ nghe — hợp nhiều loại nội dung phổ thông."),
      v("Thiền Tâm Đức", "Thiền Tâm Đức (Nam · Bắc · kể chuyện)", "Giọng nam Bắc phong cách kể chuyện: chậm, sâu lắng — hợp nội dung nhân văn, chân dung, bài viết giàu cảm xúc."),
      v("Ngọc Huyền", "Ngọc Huyền (Nữ · Bắc · đọc tự nhiên)", "Giọng nữ Bắc phong cách tự nhiên: mềm, trong — hợp giới thiệu sản phẩm, hướng dẫn sử dụng."),
      v("Quang Sơn", "Quang Sơn (Nam · Trung · tự nhiên)", "Giọng nam Trung phong cách tự nhiên: đặc trưng miền Trung — hợp nội dung hướng khán giả miền Trung."),
      v("Ngọc Trân", "Ngọc Trân (Nữ · Trung · tự nhiên)", "Giọng nữ Trung phong cách tự nhiên: nhẹ, rõ — lựa chọn hiếm cho khán giả miền Trung."),
      v("Phạm Tuyên", "Phạm Tuyên (Nam · Bắc · tự nhiên)", "Giọng nam Bắc phong cách tự nhiên: khỏe, rõ — hợp thông báo, hướng dẫn, nội dung ngắn."),
      v("Thái Sơn", "Thái Sơn (Nam · Nam · kể chuyện)", "Giọng nam Nam phong cách kể chuyện: mộc mạc, có hồn — hợp phóng sự, câu chuyện địa phương."),
      v("Xuân Vĩnh", "Xuân Vĩnh (Nam · Bắc · tự nhiên)", "Giọng nam Bắc phong cách tự nhiên: trẻ, nhanh nhẹn — hợp video ngắn, tin vắn."),
      v("Thanh Bình", "Thanh Bình (Nam · Bắc · kể chuyện)", "Giọng nam Bắc phong cách tự nhiên: ôn hòa, gần gũi — hợp bài giải thích, hướng dẫn, nội dung đời sống."),
      v("Ngọc Linh", "Ngọc Linh (Nữ · Bắc · kể chuyện)", "Giọng nữ Bắc phong cách kể chuyện: nhẹ nhàng, truyền cảm — hợp phóng sự mềm, câu chuyện con người."),
      v("Đoan Trang", "Đoan Trang (Nữ · Bắc · tự nhiên)", "Giọng nữ Bắc phong cách tự nhiên: đoan trang, chuẩn mực — hợp nội dung doanh nghiệp, giới thiệu chính thức."),
      v("Thục Đoan", "Thục Đoan (Nữ · Nam · kể chuyện)", "Giọng nữ Nam phong cách kể chuyện: dịu, chậm rãi — hợp nội dung văn hóa, đời sống miền Nam."),
      v("Mỹ Duyên", "Mỹ Duyên (Nữ · Nam · đọc truyện)", "Giọng nữ Nam phong cách đọc truyện: ngọt, biểu cảm — hợp nội dung giải trí, series kể chuyện."),
      v("Quỳnh Anh", "Quỳnh Anh (Nữ · Bắc · đọc truyện)", "Giọng nữ Bắc phong cách đọc truyện: trẻ, sáng — hợp nội dung giải trí nhẹ, giới thiệu sản phẩm."),
      v("Đức Trí", "Đức Trí (Nam · Nam · đọc truyện)", "Giọng nam Nam phong cách đọc truyện: linh hoạt, có nhịp — hợp nội dung giải trí, tóm tắt sách/phim."),
      v("Kim Thanh", "Kim Thanh (Nữ · Nam · đọc truyện)", "Giọng nữ Nam phong cách đọc truyện: ấm, rõ — hợp kể chuyện dài, nội dung thiếu nhi và gia đình."),
      v("Adam", "Adam (Nam · Nam · đọc tự nhiên)", "Giọng nam Nam phong cách tự nhiên: thoải mái, đời thường — hợp nội dung giải trí, vlog công nghệ."),
      v("Quốc Tuấn", "Quốc Tuấn (Nam · Bắc · tự nhiên)", "Giọng nam Bắc phong cách tự nhiên: điềm đạm, chắc chắn — hợp bản tin phổ thông và bài giải thích."),
    ],
  },
  relay: {
    name: "Relay giọng đọc (tts.danhthanh.dev)",
    kind: "api",
    role: "Dự phòng",
    note: "Worker Cloudflare của chủ kênh trước Azure Speech (giọng HoaiMy/NamMinh). Relay thỉnh thoảng trả 502 chớp nhoáng — phía gọi thử lại có giãn cách. Khóa chỉ nằm ở biến môi trường RELAY_SECRET; cấu hình này không lưu khóa.",
    voices: [
      v("HoaiMy", "HoaiMy (nữ)", "Giọng nữ chuẩn Azure: phát âm rõ, nhịp đều, sắc thái trung tính — giọng bản tin chủ lực của kênh."),
      v("NamMinh", "NamMinh (nam)", "Giọng nam chuẩn Azure: trầm, chắc, nhịp ổn định — hợp bản tin chính cần cảm giác tin cậy."),
    ],
  },
  nvidia: {
    name: "NVIDIA Magpie-TTS (Riva gRPC)",
    kind: "api",
    role: "Thử nghiệm",
    note: "Model call qua Riva gRPC (grpc.nvcf.nvidia.com), model ai-magpie-tts-multilingual, khóa từ biến môi trường NVIDIA_API_KEY. Điều khoản API dùng thử NVIDIA: phát triển/kiểm thử; sản xuất thương mại cần giấy phép AI Enterprise. Không có mốc thời gian từ.",
    voices: ["Long", "Jason", "Louise", "Pascal", "Isabela", "Siwei", "Ray", "Sofia", "Mia", "Phung"].map((n) =>
      v(`Magpie-Multilingual.VI-VN.${n}`, `VI-VN.${n} (Magpie)`, n === "Long" ? "Giọng Magpie tiếng Việt đã kiểm chứng qua API NVIDIA trên máy ảo (22/11/2026)." : "")),
  },
  piper: {
    name: "Piper vais1000-medium",
    kind: "package",
    role: "Nháp / dự phòng nhẹ",
    note: "Gói piper-tts trong renderer/.venv-piper, model ONNX tại renderer/models/piper. Tổng hợp nhanh nhất (RTF 0,30), giọng hơi máy — chân dự phòng cuối của chuỗi.",
    voices: [
      v("vi_VN-vais1000-medium", "vi_VN-vais1000-medium", "Giọng Piper duy nhất (dữ liệu vais1000): hơi máy, tổng hợp nhanh nhất — hợp bản nháp và chân dự phòng cuối."),
    ],
  },
  azure: {
    name: "Azure AI Speech",
    kind: "api",
    role: "Dự phòng",
    note: "Khóa + vùng từ AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Có mốc thời gian từ (word boundaries) cho phụ đề.",
    voices: [
      v("vi-VN-HoaiMyNeural", "vi-VN-HoaiMyNeural"),
      v("vi-VN-NamMinhNeural", "vi-VN-NamMinhNeural"),
      v("en-US-AndrewMultilingualNeural", "en-US-AndrewMultilingualNeural"),
      v("en-US-AvaMultilingualNeural", "en-US-AvaMultilingualNeural"),
      v("en-US-GuyNeural", "en-US-GuyNeural"),
    ],
  },
  edge: {
    name: "edge-tts (Edge read-aloud)",
    kind: "api",
    role: "Dự phòng",
    note: "Dịch vụ đọc to của trình duyệt Edge: không cần khóa, có mốc thời gian từ; thỉnh thoảng bị giới hạn tốc độ.",
    voices: [
      v("vi-VN-HoaiMyNeural", "vi-VN-HoaiMyNeural"),
      v("vi-VN-NamMinhNeural", "vi-VN-NamMinhNeural"),
      v("en-US-AndrewMultilingualNeural", "en-US-AndrewMultilingualNeural"),
      v("en-US-AvaMultilingualNeural", "en-US-AvaMultilingualNeural"),
      v("en-US-GuyNeural", "en-US-GuyNeural"),
    ],
  },
};

export interface VoiceEngineConfig {
  kind: "package" | "api";
  enabled: boolean;
  voice: string;
  preview_voice?: string;
  [key: string]: unknown;
}

export interface VoiceConfig {
  version?: number;
  chain: string[];
  engines: Record<string, VoiceEngineConfig>;
  sample_sentence?: string;
}

/** The channel's current effective state, per the Studio voice standard (defaults set by the owner). */
export function defaultVoiceConfig(): VoiceConfig {
  return {
    version: 1,
    chain: ["vieneu", "relay", "piper"],
    sample_sentence: "Chào bạn đến với Điểm Tin Công Nghệ — bản tin công nghệ mỗi ngày.",
    engines: {
      vieneu: { kind: "package", enabled: true, voice: "Hải Đăng", preview_voice: "Hải Đăng", package: "vieneu", venv: ".venv-vieneu" },
      relay: { kind: "api", enabled: true, voice: "HoaiMy", preview_voice: "HoaiMy", url_env: "RELAY_URL", secret_env: "RELAY_SECRET" },
      nvidia: { kind: "api", enabled: false, voice: "Magpie-Multilingual.VI-VN.Long", preview_voice: "Magpie-Multilingual.VI-VN.Long", model: "ai-magpie-tts-multilingual", key_env: "NVIDIA_API_KEY" },
      piper: { kind: "package", enabled: true, voice: "vi_VN-vais1000-medium", preview_voice: "vi_VN-vais1000-medium", venv: ".venv-piper", model: "models/piper/vi_VN-vais1000-medium.onnx" },
      azure: { kind: "api", enabled: true, voice: "vi-VN-HoaiMyNeural", preview_voice: "vi-VN-HoaiMyNeural", key_env: "AZURE_SPEECH_KEY", region_env: "AZURE_SPEECH_REGION" },
      edge: { kind: "api", enabled: true, voice: "vi-VN-HoaiMyNeural", preview_voice: "vi-VN-HoaiMyNeural" },
    },
  };
}

export function readVoiceConfig(): { config: VoiceConfig; exists: boolean } {
  if (!existsSync(VOICE_CONFIG_FILE)) return { config: defaultVoiceConfig(), exists: false };
  try {
    const parsed = JSON.parse(readFileSync(VOICE_CONFIG_FILE, "utf8")) as VoiceConfig;
    if (!parsed || !Array.isArray(parsed.chain) || typeof parsed.engines !== "object" || parsed.engines === null) {
      return { config: defaultVoiceConfig(), exists: true };
    }
    return { config: parsed, exists: true };
  } catch {
    return { config: defaultVoiceConfig(), exists: true };
  }
}

/** First read creates the file with the defaults, so the page and the renderer see the same state. */
export function ensureVoiceConfig(): { config: VoiceConfig; created: boolean } {
  const { config, exists } = readVoiceConfig();
  if (exists) return { config, created: false };
  writeFileSync(VOICE_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { config, created: true };
}

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const ALLOWED_FIELDS = new Set(["kind", "enabled", "voice", "preview_voice", "package", "venv", "model", "url_env", "secret_env", "key_env", "region_env"]);

export function saveVoiceConfig(input: VoiceConfig): VoiceConfig {
  if (!input || !Array.isArray(input.chain) || !input.chain.length) {
    throw new VoiceConfigConflict("The voice chain must name at least one engine.");
  }
  const engines = input.engines ?? {};
  for (const [name, engine] of Object.entries(engines)) {
    const meta = ENGINE_CATALOG[name];
    if (!meta) throw new VoiceConfigConflict(`Unknown voice engine "${name}".`);
    if (!engine || engine.kind !== meta.kind) throw new VoiceConfigConflict(`Engine "${name}" must be kind "${meta.kind}".`);
    for (const field of Object.keys(engine)) {
      if (!ALLOWED_FIELDS.has(field)) throw new VoiceConfigConflict(`Field "${field}" is not allowed in a voice config (secrets are referenced by env name only).`);
    }
    for (const envField of ["url_env", "secret_env", "key_env", "region_env"] as const) {
      const value = engine[envField];
      if (value !== undefined && (typeof value !== "string" || !ENV_NAME.test(value))) {
        throw new VoiceConfigConflict(`Engine "${name}": ${envField} must be an environment variable NAME (e.g. NVIDIA_API_KEY), never a value.`);
      }
    }
    if (meta.voices.length && !meta.voices.some((option) => option.id === engine.voice)) {
      throw new VoiceConfigConflict(`Engine "${name}": voice "${engine.voice}" is not one of its known voices.`);
    }
  }
  for (const name of input.chain) {
    if (!ENGINE_CATALOG[name]) throw new VoiceConfigConflict(`Unknown voice engine "${name}" in the chain.`);
    const engine = engines[name];
    if (!engine) throw new VoiceConfigConflict(`Engine "${name}" is in the chain but has no configuration.`);
    if (!engine.enabled) throw new VoiceConfigConflict(`Engine "${name}" is in the chain but disabled; enable it or take it out of the chain.`);
  }
  const config: VoiceConfig = { version: 1, chain: [...input.chain], engines, sample_sentence: input.sample_sentence };
  writeFileSync(VOICE_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  return config;
}
