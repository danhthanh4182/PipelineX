// Disallowed wording patterns for reader-facing text ([pattern, replacement instruction]).
// Checked after drafting headlines, summaries, and editorial rationales; matches trigger a mend-wording pass.
// Finance: the channel reports; it never gives investment advice or promises returns.

export const READER_WORDING: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(you should|time to|now is the time to) (buy|sell)\b/i, "Remove the investment advice; say what happened and who said it."],
  [/\bguaranteed (returns?|profits?|gains?)\b/i, "Remove the promise of returns; report the figure with its source."],
  [/\b(to the moon|can't lose|easy money)\b/i, "Replace the hype with a neutral description of the move and its source."],
];
