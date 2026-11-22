// File exchange for the pronunciation lexicon: bulk import (JSON / CSV / TXT) with a preview
// pass and export (JSON / CSV), in exactly the shapes the Studio's dictionary panel uses, so a
// file exported on either side imports cleanly on the other. Parsing and validation live here,
// free of the database; lexicon.ts owns storage, server.ts owns the HTTP shape.
//
// Accepted input (the Studio standard):
//   JSON  the wrapped export { format: "diemtin-lexicon", version: 1, entries: [...] },
//         a bare array of { term, reading, scope, category_scope, note, enabled, asr_status },
//         or a map { term: reading } / { term: { reading, ... } }.
//   CSV   English headers (term,reading,...) or the Vietnamese form headers
//         (Thuật ngữ gốc, Cách đọc thay thế, Phạm vi áp dụng, Ghi chú), BOM tolerated;
//         headerless files are read positionally as term, reading, scope, note.
//   TXT   one entry per line, split by "=>", a tab, or ":" (term, reading, [scope], [note]).
// Scope and category accept their codes (all / relay / selfhost, all / tech / finance) or the
// Vietnamese labels the owner actually writes ("Mọi tuyến", "Công nghệ", ...).
import type { LexiconEntryInput, LexiconRow } from "./lexicon.ts";

export const LEXICON_FORMAT = "diemtin-lexicon";
export const SCOPES = ["all", "relay", "selfhost"] as const;
export const CATEGORY_SCOPES = ["all", "tech", "finance"] as const;
export const ASR_STATUSES = ["", "queued", "running", "passed", "failed"] as const;
export const MAX_IMPORT_ROWS = 5000;

/** Vietnamese diacritic folding, shared by the JS search/preview and the SQL translate(). */
const FOLD_GROUPS: Record<string, string> = {
  a: "àáảãạăắằẳẵặâấầẩẫậ",
  e: "èéẻẽẹêếềểễệ",
  i: "ìíỉĩị",
  o: "òóỏõọôốồổỗộơớờởỡợ",
  u: "ùúủũụưứừửữự",
  y: "ỳýỷỹỵ",
  d: "đ",
};
export const FOLD_FROM = Object.values(FOLD_GROUPS).join("");
export const FOLD_TO = Object.entries(FOLD_GROUPS).map(([base, chars]) => base.repeat(chars.length)).join("");
const FOLD_MAP = new Map<string, string>();
for (const [base, chars] of Object.entries(FOLD_GROUPS)) for (const ch of chars) FOLD_MAP.set(ch, base);

/** Lowercase + strip Vietnamese diacritics ("Kiểm chứng" -> "kiem chung"). */
export function foldVietnamese(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .split("")
    .map((ch) => FOLD_MAP.get(ch) ?? ch)
    .join("");
}

export interface ParsedLexiconEntry {
  term: string;
  reading: string;
  scope: string;
  category_scope: string;
  note: string;
  enabled?: boolean;
  asr_status?: string;
}

export interface LexiconPreviewRow {
  line: number;
  term: string;
  reading: string;
  scope: string;
  category_scope: string;
  note: string;
  enabled?: boolean;
  asr_status?: string;
  status: "new" | "duplicate" | "error";
  error?: string;
  existingId?: number;
}

const SCOPE_LABELS = new Map<string, string>([
  ["all", "all"],
  ["moi tuyen", "all"],
  ["relay", "relay"],
  ["selfhost", "selfhost"],
  ["self-host", "selfhost"],
  ["tu host", "selfhost"],
  ["tu van hanh", "selfhost"],
]);
const CATEGORY_LABELS = new Map<string, string>([
  ["all", "all"],
  ["tat ca", "all"],
  ["tech", "tech"],
  ["cong nghe", "tech"],
  ["finance", "finance"],
  ["tai chinh", "finance"],
]);

function mapScope(raw: unknown): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return "all";
  return SCOPE_LABELS.get(foldVietnamese(String(raw).trim())) ?? null;
}

function mapCategory(raw: unknown): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === "") return "all";
  return CATEGORY_LABELS.get(foldVietnamese(String(raw).trim())) ?? null;
}

function mapEnabled(raw: unknown): boolean | undefined | "invalid" {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "boolean") return raw;
  const text = foldVietnamese(String(raw).trim());
  if (["true", "1", "yes", "bat"].includes(text)) return true;
  if (["false", "0", "no", "tat"].includes(text)) return false;
  return "invalid";
}

/** One raw record -> a validated entry, or the reason it cannot be imported. */
export function normalizeLexiconEntry(raw: Record<string, unknown>): { entry: ParsedLexiconEntry } | { error: string } {
  const term = String(raw.term ?? "").normalize("NFC").trim();
  if (!term) return { error: "Thiếu thuật ngữ." };
  if (term.length > 120) return { error: `Thuật ngữ dài ${term.length} ký tự (tối đa 120).` };
  const reading = String(raw.reading ?? "").normalize("NFC").trim();
  if (!reading) return { error: "Thiếu cách đọc." };
  if (reading.length > 200) return { error: `Cách đọc dài ${reading.length} ký tự (tối đa 200).` };
  const scope = mapScope(raw.scope);
  if (scope === null) return { error: `Phạm vi áp dụng không hợp lệ: "${String(raw.scope)}" (dùng all / relay / selfhost hoặc nhãn tiếng Việt).` };
  const category_scope = mapCategory(raw.category_scope ?? raw.category);
  if (category_scope === null) return { error: `Phạm vi chuyên mục không hợp lệ: "${String(raw.category_scope ?? raw.category)}" (dùng all / tech / finance).` };
  const enabled = mapEnabled(raw.enabled);
  if (enabled === "invalid") return { error: `Trạng thái enabled phải là boolean, nhận được: "${String(raw.enabled)}".` };
  let asr_status: string | undefined;
  if (raw.asr_status !== undefined && raw.asr_status !== null && String(raw.asr_status) !== "") {
    asr_status = String(raw.asr_status).trim();
    if (!(ASR_STATUSES as readonly string[]).includes(asr_status)) return { error: `Trạng thái ASR không hợp lệ: "${asr_status}".` };
  }
  return {
    entry: {
      term,
      reading,
      scope,
      category_scope,
      note: String(raw.note ?? "").normalize("NFC").trim(),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(asr_status !== undefined ? { asr_status } : {}),
    },
  };
}

function toPreviewRow(line: number, raw: Record<string, unknown>): LexiconPreviewRow {
  const result = normalizeLexiconEntry(raw);
  if ("error" in result) {
    return {
      line,
      term: String(raw.term ?? "").trim(),
      reading: String(raw.reading ?? "").trim(),
      scope: "",
      category_scope: "",
      note: "",
      status: "error",
      error: result.error,
    };
  }
  return { line, ...result.entry, status: "new" };
}

/** The wrapped export's entries, a bare array, or a term->reading map. */
function parseJson(text: string): { rows: LexiconPreviewRow[] } | { fileError: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    return { fileError: `Tệp JSON không hợp lệ: ${(error as Error).message}` };
  }
  let items: unknown[];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)) {
    items = (parsed as { entries: unknown[] }).entries;
  } else if (parsed && typeof parsed === "object") {
    items = Object.entries(parsed as Record<string, unknown>).map(([term, value]) =>
      typeof value === "string" ? { term, reading: value } : { ...(value as Record<string, unknown>), term },
    );
  } else {
    return { fileError: "Tệp JSON phải là mảng các mục, gói { entries: [...] }, hoặc map thuật ngữ -> cách đọc." };
  }
  if (items.length > MAX_IMPORT_ROWS) return { fileError: `Tệp có ${items.length} mục, vượt quá giới hạn ${MAX_IMPORT_ROWS}.` };
  const rows = items.map((item, i) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? toPreviewRow(i + 1, item as Record<string, unknown>)
      : { line: i + 1, term: "", reading: "", scope: "", category_scope: "", note: "", status: "error" as const, error: "Mục không phải là một object." },
  );
  return { rows };
}

/** Minimal RFC 4180 reader: quotes, doubled quotes, commas and CRLF inside quoted cells. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const CSV_HEADERS = new Map<string, string>([
  ["term", "term"],
  ["reading", "reading"],
  ["scope", "scope"],
  ["category_scope", "category_scope"],
  ["category", "category_scope"],
  ["note", "note"],
  ["enabled", "enabled"],
  ["asr_status", "asr_status"],
  ["thuat ngu goc", "term"],
  ["thuat ngu", "term"],
  ["cach doc thay the", "reading"],
  ["cach doc", "reading"],
  ["pham vi ap dung", "scope"],
  ["pham vi chuyen muc", "category_scope"],
  ["ghi chu", "note"],
]);

function parseCsv(text: string): { rows: LexiconPreviewRow[] } | { fileError: string } {
  const table = parseCsvRows(text);
  if (!table.length) return { fileError: "Tệp CSV rỗng." };
  const header = table[0]!.map((cell) => CSV_HEADERS.get(foldVietnamese(cell.trim())));
  const hasHeader = header.filter(Boolean).length >= 2 && header.includes("term") && header.includes("reading");
  const rows: LexiconPreviewRow[] = [];
  const body = hasHeader ? table.slice(1) : table;
  if (body.length > MAX_IMPORT_ROWS) return { fileError: `Tệp có ${body.length} mục, vượt quá giới hạn ${MAX_IMPORT_ROWS}.` };
  body.forEach((cells, i) => {
    const line = i + (hasHeader ? 2 : 1);
    if (hasHeader) {
      if (cells.length > header.length) {
        rows.push({ line, term: cells[0] ?? "", reading: "", scope: "", category_scope: "", note: "", status: "error", error: `Dòng có ${cells.length} cột, nhiều hơn ${header.length} cột của tiêu đề.` });
        return;
      }
      const raw: Record<string, unknown> = {};
      header.forEach((field, j) => { if (field) raw[field] = cells[j] ?? ""; });
      rows.push(toPreviewRow(line, raw));
    } else {
      if (cells.length < 2 || cells.length > 4) {
        rows.push({ line, term: cells[0] ?? "", reading: "", scope: "", category_scope: "", note: "", status: "error", error: `Dòng không có tiêu đề cần 2-4 cột (thuật ngữ, cách đọc, [phạm vi], [ghi chú]); dòng này có ${cells.length} cột.` });
        return;
      }
      rows.push(toPreviewRow(line, { term: cells[0], reading: cells[1], scope: cells[2] ?? "", note: cells[3] ?? "" }));
    }
  });
  return { rows };
}

function parseTxt(text: string): { rows: LexiconPreviewRow[] } | { fileError: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows: LexiconPreviewRow[] = [];
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const sep = line.includes("=>") ? "=>" : line.includes("\t") ? "\t" : line.includes(":") ? ":" : null;
    if (!sep) {
      rows.push({ line: i + 1, term: line, reading: "", scope: "", category_scope: "", note: "", status: "error", error: "Không tìm thấy dấu tách (=>, tab hoặc :) giữa thuật ngữ và cách đọc." });
      return;
    }
    const parts = line.split(sep).map((p) => p.trim());
    const raw: Record<string, unknown> = { term: parts[0], reading: parts[1] ?? "" };
    if (parts.length > 2) {
      if (mapScope(parts[2]) !== null) {
        raw.scope = parts[2];
        if (parts.length > 3) raw.note = parts.slice(3).join(sep);
      } else {
        raw.note = parts.slice(2).join(sep);
      }
    }
    rows.push(toPreviewRow(i + 1, raw));
  });
  if (rows.length > MAX_IMPORT_ROWS) return { fileError: `Tệp có ${rows.length} mục, vượt quá giới hạn ${MAX_IMPORT_ROWS}.` };
  return { rows };
}

/** Parse an uploaded dictionary file into preview rows (not yet classified against the table). */
export function parseLexiconFile(name: string, text: string): { format: string; rows: LexiconPreviewRow[] } | { fileError: string } {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  let format = ext === "json" || ext === "csv" || ext === "txt" ? ext : "";
  if (!format) {
    const head = text.replace(/^\uFEFF/, "").trimStart();
    format = head.startsWith("{") || head.startsWith("[") ? "json" : head.includes(",") ? "csv" : "txt";
  }
  const parsed = format === "json" ? parseJson(text) : format === "csv" ? parseCsv(text) : parseTxt(text);
  if ("fileError" in parsed) return parsed;
  return { format, rows: parsed.rows };
}

/**
 * Classify parsed rows against the terms already in the table (and against each other):
 * a row is "duplicate" when its term exists in the table or appeared earlier in the same file.
 */
export function classifyLexiconRows(rows: LexiconPreviewRow[], existing: Map<string, { id: number; locked: boolean }>): LexiconPreviewRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.status === "error") return row;
    const key = row.term.toLowerCase();
    const hit = existing.get(key);
    if (hit) {
      seen.add(key);
      return { ...row, status: "duplicate" as const, existingId: hit.id };
    }
    if (seen.has(key)) return { ...row, status: "duplicate" as const };
    seen.add(key);
    return { ...row, status: "new" as const };
  });
}

/** The Studio-shaped JSON export: re-imports verbatim on either side. */
export function lexiconExportJson(rows: LexiconRow[]): string {
  return JSON.stringify(
    {
      format: LEXICON_FORMAT,
      version: 1,
      exported_at: new Date().toISOString(),
      entries: rows.map((r) => ({
        term: r.term,
        reading: r.reading,
        scope: r.scope,
        category_scope: r.category_scope,
        note: r.note,
        enabled: r.enabled,
        asr_status: r.asr_status,
      })),
    },
    null,
    2,
  ) + "\n";
}

/** CSV export with the English header row (the Vietnamese form headers import too); BOM first, like the owner's files. */
export function lexiconExportCsv(rows: LexiconRow[]): string {
  const esc = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [
    "term,reading,scope,category_scope,note,enabled,asr_status",
    ...rows.map((r) => [r.term, r.reading, r.scope, r.category_scope, r.note, String(r.enabled), r.asr_status].map(esc).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** Coerce an apply-request entry back through the same validation the preview used. */
export function toEntryInput(entry: ParsedLexiconEntry): LexiconEntryInput {
  return {
    term: entry.term,
    reading: entry.reading,
    scope: entry.scope,
    category_scope: entry.category_scope,
    note: entry.note,
    ...(entry.enabled !== undefined ? { enabled: entry.enabled } : {}),
    ...(entry.asr_status !== undefined ? { asr_status: entry.asr_status } : {}),
  };
}
