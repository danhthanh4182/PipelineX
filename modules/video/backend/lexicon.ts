// Pronunciation dictionary: one row per term the voice step must read differently (a Vietnamese
// reading for an English tech term, a gloss, a respelling). The admin page edits these rows; the
// enabled ones are materialized to industry/lexicon.json, which the renderer's voice step (tts.py)
// applies to the READING text only — display text, titles and captions keep the correct term.
// Only ASR-verified rows are enabled; enabling more is the channel owner's call.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql, withCustomPlans, type Db } from "@aihot/backend/db";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const LEXICON_FILE = path.join(ROOT, "industry", "lexicon.json");
/** Where the Studio's lexicon export lands on the channel machine (the re-import button reads it). */
export const LEXICON_EXPORT_PATH = process.env.LEXICON_EXPORT_PATH || "C:\\ProgramData\\muse-bridge\\lexicon-export-for-pipelinex.json";

export class LexiconConflict extends Error {
  code = "conflict";
}

export interface LexiconRow {
  id: number;
  term: string;
  reading: string;
  scope: string;
  category_scope: string;
  enabled: boolean;
  locked: boolean;
  asr_status: string;
  note: string;
  created_at: Date;
  updated_at: Date;
}

export interface LexiconEntryInput {
  term: string;
  reading: string;
  scope?: string;
  category_scope?: string;
  enabled?: boolean;
  locked?: boolean;
  asr_status?: string;
  note?: string;
}

/** The file the renderer reads: enabled rows only, the fields tts.py matches on. Written after every change. */
export async function regenerateLexiconFile(db: Db = sql): Promise<number> {
  const rows = await db<{ term: string; reading: string; category_scope: string }[]>`
    SELECT term, reading, category_scope FROM pronunciation_lexicon WHERE enabled ORDER BY term`;
  const payload = { version: 1, kind: "pronunciation-lexicon", generated_at: new Date().toISOString(), entries: rows };
  writeFileSync(LEXICON_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return rows.length;
}

export async function listLexicon({ q = "", page = 1, pageSize = 50 }: { q?: string; page?: number; pageSize?: number } = {}, db: Db = sql) {
  const term = q.trim();
  const offset = (Math.max(1, page) - 1) * pageSize;
  const fetchPage = async (tx: Db) => {
    const rows = await tx<LexiconRow[]>`
      SELECT * FROM pronunciation_lexicon
      WHERE ${term} = '' OR term ILIKE ${"%" + term + "%"} OR reading ILIKE ${"%" + term + "%"}
      ORDER BY enabled DESC, term ASC
      LIMIT ${pageSize} OFFSET ${offset}`;
    const [count] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pronunciation_lexicon
      WHERE ${term} = '' OR term ILIKE ${"%" + term + "%"} OR reading ILIKE ${"%" + term + "%"}`;
    return { rows, total: count?.n ?? 0 };
  };
  // A search plans per execution (see withCustomPlans); a plain listing takes the fast path.
  return term ? withCustomPlans((tx) => fetchPage(tx)) : fetchPage(db);
}

export async function lexiconStats(db: Db = sql): Promise<{ total: number; enabled: number }> {
  const [row] = await db<{ total: number; enabled: number }[]>`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled FROM pronunciation_lexicon`;
  return row ?? { total: 0, enabled: 0 };
}

async function getRow(id: number, db: Db): Promise<LexiconRow> {
  const [row] = await db<LexiconRow[]>`SELECT * FROM pronunciation_lexicon WHERE id = ${id}`;
  if (!row) throw new LexiconConflict("No such dictionary entry.");
  return row;
}

export async function createLexiconEntry(input: LexiconEntryInput, db: Db = sql): Promise<LexiconRow> {
  const term = input.term.trim();
  const [dupe] = await db`SELECT id FROM pronunciation_lexicon WHERE lower(term) = lower(${term})`;
  if (dupe) throw new LexiconConflict(`"${term}" is already in the dictionary.`);
  const [row] = await db<LexiconRow[]>`
    INSERT INTO pronunciation_lexicon (term, reading, scope, category_scope, enabled, locked, asr_status, note)
    VALUES (${term}, ${input.reading.trim()}, ${input.scope ?? "all"}, ${input.category_scope ?? "all"},
            ${input.enabled ?? false}, ${input.locked ?? false}, ${input.asr_status ?? ""}, ${input.note ?? ""})
    RETURNING *`;
  await regenerateLexiconFile(db);
  return row!;
}

export async function updateLexiconEntry(id: number, patch: Partial<LexiconEntryInput>, db: Db = sql): Promise<LexiconRow> {
  const before = await getRow(id, db);
  if (before.locked) throw new LexiconConflict("This entry is locked; unlock it before editing.");
  if (patch.term && patch.term.trim().toLowerCase() !== before.term.toLowerCase()) {
    const [dupe] = await db`SELECT id FROM pronunciation_lexicon WHERE lower(term) = lower(${patch.term.trim()}) AND id <> ${id}`;
    if (dupe) throw new LexiconConflict(`"${patch.term.trim()}" is already in the dictionary.`);
  }
  const [row] = await db<LexiconRow[]>`
    UPDATE pronunciation_lexicon SET
      term = ${patch.term?.trim() ?? before.term},
      reading = ${patch.reading?.trim() ?? before.reading},
      scope = ${patch.scope ?? before.scope},
      category_scope = ${patch.category_scope ?? before.category_scope},
      enabled = ${patch.enabled ?? before.enabled},
      locked = ${patch.locked ?? before.locked},
      asr_status = ${patch.asr_status ?? before.asr_status},
      note = ${patch.note ?? before.note},
      updated_at = now()
    WHERE id = ${id} RETURNING *`;
  await regenerateLexiconFile(db);
  return row!;
}

export async function deleteLexiconEntry(id: number, db: Db = sql): Promise<void> {
  const before = await getRow(id, db);
  if (before.locked) throw new LexiconConflict("This entry is locked; unlock it before deleting.");
  await db`DELETE FROM pronunciation_lexicon WHERE id = ${id}`;
  await regenerateLexiconFile(db);
}

export async function setLexiconEnabled(ids: number[], enabled: boolean, db: Db = sql): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db<{ id: number }[]>`
    UPDATE pronunciation_lexicon SET enabled = ${enabled}, updated_at = now()
    WHERE id = ANY(${ids}) RETURNING id`;
  await regenerateLexiconFile(db);
  return rows.length;
}

/**
 * The Studio export's entries into the table, keeping each entry's enabled / asr_status /
 * category_scope exactly as exported. Idempotent: a term already present (in any letter case)
 * is skipped, so re-importing never overwrites an edit made on this channel.
 */
export async function importLexiconEntries(entries: LexiconEntryInput[], db: Db = sql): Promise<{ inserted: number; skipped: number }> {
  const existing = new Set((await db<{ term: string }[]>`SELECT term FROM pronunciation_lexicon`).map((r) => r.term.toLowerCase()));
  let inserted = 0, skipped = 0;
  for (const entry of entries) {
    const term = (entry.term ?? "").trim();
    if (!term || existing.has(term.toLowerCase())) { skipped++; continue; }
    await db`
      INSERT INTO pronunciation_lexicon (term, reading, scope, category_scope, enabled, locked, asr_status, note)
      VALUES (${term}, ${(entry.reading ?? "").trim()}, ${entry.scope ?? "all"}, ${entry.category_scope ?? "all"},
              ${entry.enabled ?? false}, ${entry.locked ?? false}, ${entry.asr_status ?? ""}, ${entry.note ?? ""})`;
    existing.add(term.toLowerCase());
    inserted++;
  }
  await regenerateLexiconFile(db);
  return { inserted, skipped };
}

/** The re-import button's source: the Studio export file on this machine. */
export async function importLexiconFromExportFile(db: Db = sql): Promise<{ inserted: number; skipped: number; total: number }> {
  let parsed: { entries?: LexiconEntryInput[] };
  try {
    parsed = JSON.parse(readFileSync(LEXICON_EXPORT_PATH, "utf8")) as { entries?: LexiconEntryInput[] };
  } catch {
    throw new LexiconConflict(`Cannot read the lexicon export at ${LEXICON_EXPORT_PATH}.`);
  }
  const entries = parsed.entries ?? [];
  if (!entries.length) throw new LexiconConflict("The lexicon export holds no entries.");
  const result = await importLexiconEntries(entries, db);
  return { ...result, total: entries.length };
}
