// Pronunciation dictionary: one row per term the voice step must read differently (a Vietnamese
// reading for an English tech term, a gloss, a respelling). The admin page edits these rows; the
// enabled ones are materialized to industry/lexicon.json, which the renderer's voice step (tts.py)
// applies to the READING text only — display text, titles and captions keep the correct term.
// Only ASR-verified rows are enabled; enabling more is the channel owner's call.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql, withCustomPlans, type Db } from "@aihot/backend/db";
import { FOLD_FROM, FOLD_TO, foldVietnamese } from "./lexicon-io.ts";

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

export interface LexiconFilters {
  q?: string;
  page?: number;
  pageSize?: number;
  scope?: string;
  category_scope?: string;
  enabled?: boolean | null;
  /** "" = any, "none" = never verified (asr_status ''), else an exact asr_status. */
  asr?: string;
  locked?: boolean | null;
}

/** Escape the LIKE wildcards in a folded search string (Postgres LIKE escapes with backslash). */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

export async function listLexicon(filters: LexiconFilters = {}, db: Db = sql) {
  const { q = "", page = 1, pageSize = 50, scope = "", category_scope = "", enabled = null, asr = "", locked = null } = filters;
  // Search ignores Vietnamese diacritics: the query is folded in JS, the columns through
  // translate(lower(...)) with the same fold table (lexicon-io.ts), so "ay pi ai" finds "ây pi ai".
  const folded = likeEscape(foldVietnamese(q.trim()));
  const pattern = "%" + folded + "%";
  const offset = (Math.max(1, page) - 1) * pageSize;
  const fetchPage = async (tx: Db) => {
    const rows = await tx<LexiconRow[]>`
      SELECT * FROM pronunciation_lexicon
      WHERE (${folded} = '' OR translate(lower(term), ${FOLD_FROM}, ${FOLD_TO}) LIKE ${pattern} OR translate(lower(reading), ${FOLD_FROM}, ${FOLD_TO}) LIKE ${pattern})
        AND (${scope} = '' OR scope = ${scope})
        AND (${category_scope} = '' OR category_scope = ${category_scope})
        AND (${enabled}::boolean IS NULL OR enabled = ${enabled})
        AND (${asr} = '' OR (${asr} = 'none' AND asr_status = '') OR asr_status = ${asr})
        AND (${locked}::boolean IS NULL OR locked = ${locked})
      ORDER BY enabled DESC, term ASC
      LIMIT ${pageSize} OFFSET ${offset}`;
    const [count] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pronunciation_lexicon
      WHERE (${folded} = '' OR translate(lower(term), ${FOLD_FROM}, ${FOLD_TO}) LIKE ${pattern} OR translate(lower(reading), ${FOLD_FROM}, ${FOLD_TO}) LIKE ${pattern})
        AND (${scope} = '' OR scope = ${scope})
        AND (${category_scope} = '' OR category_scope = ${category_scope})
        AND (${enabled}::boolean IS NULL OR enabled = ${enabled})
        AND (${asr} = '' OR (${asr} = 'none' AND asr_status = '') OR asr_status = ${asr})
        AND (${locked}::boolean IS NULL OR locked = ${locked})`;
    return { rows, total: count?.n ?? 0 };
  };
  // A search plans per execution (see withCustomPlans); a plain listing takes the fast path.
  return folded ? withCustomPlans((tx) => fetchPage(tx)) : fetchPage(db);
}

/** Every row, term order: the export builders' input. */
export async function listLexiconForExport(db: Db = sql): Promise<LexiconRow[]> {
  return db<LexiconRow[]>`SELECT * FROM pronunciation_lexicon ORDER BY term ASC`;
}

/** term (lowercased) -> row stub, for import classification and duplicate checks. */
export async function lexiconTermIndex(db: Db = sql): Promise<Map<string, { id: number; locked: boolean }>> {
  const rows = await db<{ id: number; term: string; locked: boolean }[]>`SELECT id, term, locked FROM pronunciation_lexicon`;
  return new Map(rows.map((r) => [r.term.toLowerCase(), { id: r.id, locked: r.locked }]));
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

/**
 * Bulk enable/disable (the Studio rule): locked rows are never touched by a bulk operation and
 * are reported as skipped; rows switched on without a passed ASR check are counted so the caller
 * can surface that the owner's confirmation covered unverified entries.
 */
export async function setLexiconEnabled(ids: number[], enabled: boolean, db: Db = sql): Promise<{ updated: number; skippedLocked: number; enabledUnverified: number }> {
  if (!ids.length) return { updated: 0, skippedLocked: 0, enabledUnverified: 0 };
  const before = await db<{ id: number; locked: boolean; enabled: boolean; asr_status: string }[]>`
    SELECT id, locked, enabled, asr_status FROM pronunciation_lexicon WHERE id = ANY(${ids})`;
  const skippedLocked = before.filter((r) => r.locked).length;
  const enabledUnverified = enabled ? before.filter((r) => !r.locked && !r.enabled && r.asr_status !== "passed").length : 0;
  const rows = await db<{ id: number }[]>`
    UPDATE pronunciation_lexicon SET enabled = ${enabled}, updated_at = now()
    WHERE id = ANY(${ids}) AND NOT locked RETURNING id`;
  await regenerateLexiconFile(db);
  return { updated: rows.length, skippedLocked, enabledUnverified };
}

/** Bulk lock/unlock: the one bulk operation that also applies to locked rows (unlocking them). */
export async function setLexiconLocked(ids: number[], locked: boolean, db: Db = sql): Promise<{ updated: number }> {
  if (!ids.length) return { updated: 0 };
  const rows = await db<{ id: number }[]>`
    UPDATE pronunciation_lexicon SET locked = ${locked}, updated_at = now()
    WHERE id = ANY(${ids}) AND locked <> ${locked} RETURNING id`;
  return { updated: rows.length };
}

/**
 * Queue rows for the TTS -> ASR verification loop: sets asr_status to "queued" only. Nothing is
 * enabled by queueing, locked rows are skipped, and rows already queued/running are reported as
 * busy. No runner consumes the queue in this checkout yet; queued rows simply wait.
 */
export async function queueLexiconAsr(ids: number[], db: Db = sql): Promise<{ queued: number; skippedLocked: number; skippedBusy: number }> {
  if (!ids.length) return { queued: 0, skippedLocked: 0, skippedBusy: 0 };
  const before = await db<{ id: number; locked: boolean; asr_status: string }[]>`
    SELECT id, locked, asr_status FROM pronunciation_lexicon WHERE id = ANY(${ids})`;
  const skippedLocked = before.filter((r) => r.locked).length;
  const skippedBusy = before.filter((r) => !r.locked && (r.asr_status === "queued" || r.asr_status === "running")).length;
  const rows = await db<{ id: number }[]>`
    UPDATE pronunciation_lexicon SET asr_status = 'queued', updated_at = now()
    WHERE id = ANY(${ids}) AND NOT locked AND asr_status NOT IN ('queued', 'running') RETURNING id`;
  return { queued: rows.length, skippedLocked, skippedBusy };
}

/**
 * The confirmed half of the file-import flow: validated entries go in with the owner's choices —
 * duplicates skipped or overwritten (locked rows are never overwritten), and one enabled state
 * for the whole batch when the owner picked one (null keeps each entry's own state).
 */
export async function importParsedLexiconEntries(
  entries: LexiconEntryInput[],
  opts: { onDuplicate: "skip" | "overwrite"; batchEnabled: boolean | null },
  db: Db = sql,
): Promise<{ inserted: number; overwritten: number; skipped: number; skippedLocked: number }> {
  const existing = new Map(
    (await db<{ id: number; term: string; locked: boolean; enabled: boolean; asr_status: string }[]>`
      SELECT id, term, locked, enabled, asr_status FROM pronunciation_lexicon`).map((r) => [r.term.toLowerCase(), r]),
  );
  let inserted = 0, overwritten = 0, skipped = 0, skippedLocked = 0;
  for (const entry of entries) {
    const term = (entry.term ?? "").trim();
    if (!term) { skipped++; continue; }
    const key = term.toLowerCase();
    const current = existing.get(key);
    const enabled = opts.batchEnabled ?? entry.enabled ?? current?.enabled ?? false;
    if (!current) {
      const [row] = await db<{ id: number }[]>`
        INSERT INTO pronunciation_lexicon (term, reading, scope, category_scope, enabled, locked, asr_status, note)
        VALUES (${term}, ${(entry.reading ?? "").trim()}, ${entry.scope ?? "all"}, ${entry.category_scope ?? "all"},
                ${enabled}, false, ${entry.asr_status ?? ""}, ${entry.note ?? ""})
        RETURNING id`;
      existing.set(key, { id: row!.id, term, locked: false, enabled, asr_status: entry.asr_status ?? "" });
      inserted++;
    } else if (opts.onDuplicate === "skip") {
      skipped++;
    } else if (current.locked) {
      skippedLocked++;
    } else {
      await db`
        UPDATE pronunciation_lexicon SET
          reading = ${(entry.reading ?? "").trim()},
          scope = ${entry.scope ?? "all"},
          category_scope = ${entry.category_scope ?? "all"},
          enabled = ${enabled},
          asr_status = ${entry.asr_status ?? current.asr_status},
          note = ${entry.note ?? ""},
          updated_at = now()
        WHERE id = ${current.id}`;
      overwritten++;
    }
  }
  await regenerateLexiconFile(db);
  return { inserted, overwritten, skipped, skippedLocked };
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
