// Disallowed wording patterns for reader-facing text ([pattern, replacement instruction]).
// Checked after drafting headlines, summaries, and editorial rationales; matches trigger a mend-wording pass.
// Empty array disables wording checks.

export const READER_WORDING: ReadonlyArray<readonly [RegExp, string]> = [];
