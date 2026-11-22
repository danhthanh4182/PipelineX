// One-shot seed: the Studio's lexicon export into this channel's pronunciation_lexicon table.
// Run from the channel root:
//   node --env-file-if-exists=.env.shared --env-file-if-exists=.env scripts/import-lexicon.ts [export.json]
// Idempotent: terms already in the table are skipped with their state untouched.
import { readFileSync } from "node:fs";
import { closeDb, sql } from "@aihot/backend/db";
import { importLexiconEntries, lexiconStats, LEXICON_EXPORT_PATH, type LexiconEntryInput } from "../modules/video/backend/lexicon.ts";

const file = process.argv[2] || LEXICON_EXPORT_PATH;
try {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { entries?: LexiconEntryInput[] };
  const entries = parsed.entries ?? [];
  if (!entries.length) throw new Error(`no entries in ${file}`);
  const { inserted, skipped } = await importLexiconEntries(entries, sql);
  const stats = await lexiconStats(sql);
  console.log(`import from ${file}: ${inserted} inserted, ${skipped} skipped; table now ${stats.total} rows, ${stats.enabled} enabled`);
} finally {
  await closeDb();
}
