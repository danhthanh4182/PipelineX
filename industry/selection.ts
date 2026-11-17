// Selection thresholds. The rubric itself is defined in prompts/selection-score.md;
// this file defines score cutoffs. Each candidate item is scored twice independently (0–100);
// the sum must be ≥ 2 × Threshold to qualify as a curated candidate.
// Thresholds vary by source tier (T1 official lower, T2 media higher).
// Classes can elevate the threshold for specific source types (e.g. ecosystem, benchmarks).

export const SELECTION = {
  /** Source tier -> selection threshold (average score). */
  thresholds: { T1: 60, T1_5: 65, T2: 76 } as Record<string, number>,
  /** Source class -> threshold floor. Raises the threshold for developer/infra heavy sources. */
  classes: {
    ecosystem: { label: "Ecosystem & Infra", threshold: 70 },
    leaderboard: { label: "Benchmarks", threshold: 76 },
  } as Record<string, { label: string; threshold: number }>,
  /** Below threshold but above this gets full content-understanding treatment (headline, summary, rationale). */
  understandFloor: 50,
  /** Minimum score to appear in browsing "All Updates" (/all). Set to 0 to show all items. */
  browseFloor: 40,
} as const;
