// Selection thresholds. The rubric itself is defined in prompts/selection-score.md;
// this file defines score cutoffs. Each candidate item is scored twice independently (0–100);
// the sum must be ≥ 2 × Threshold to qualify as a curated candidate.
// Thresholds vary by source tier (T1 official lower, T2 media higher).
// Classes can elevate the threshold for specific source types (e.g. ecosystem, benchmarks).

export const SELECTION = {
  /** Source tier -> selection threshold (average score). */
  // PipelineX: the whole scale moved down (T1 60->55, T1_5 65->58, T2 76->60; classes 70->58, 76->60). On English AI news
  // the model scores lower than on AIHOT's Chinese feed: at T2 76 only 3 of 103 scored T2 items passed (one story),
  // missing e.g. a major Anthropic model release (69). Official sources stay below media, classes in between. See FORK_CHANGES.md.
  thresholds: { T1: 55, T1_5: 58, T2: 60 } as Record<string, number>,
  /** Source class -> threshold floor. Raises the threshold for developer/infra heavy sources. */
  classes: {
    ecosystem: { label: "Ecosystem & Infra", threshold: 58 },
    leaderboard: { label: "Benchmarks", threshold: 60 },
  } as Record<string, { label: string; threshold: number }>,
  /** Below threshold but above this gets full content-understanding treatment (headline, summary, rationale). */
  understandFloor: 50,
  /** Minimum score to appear in browsing "All Updates" (/all). Set to 0 to show all items. */
  browseFloor: 40,
} as const;
