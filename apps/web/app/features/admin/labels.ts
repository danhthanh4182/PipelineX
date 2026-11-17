// Shared admin vocabulary.
import { SELECTION } from "@aihot/industry/selection";

export const KIND_LABEL: Record<string, string> = { rss: "RSS", web_list: "Web List", json_list: "JSON", x_search: "X", mp_account: "WeChat MP", external: "External" };
export const MODE_LABEL: Record<string, string> = { editorial: "Featured", hot_signal: "Heat Only", isolated: "Isolated" };
export const HEALTH_LABEL: Record<string, string> = { ok: "Healthy", degraded: "Degraded", failing: "Failing", paused: "Paused", unknown: "Unchecked" };
export const VISIBILITY_LABEL: Record<string, string> = { public: "Public", "summary-only": "Summary Only", withdrawn: "Withdrawn" };
export const FEEDBACK_STATUS: Record<string, string> = { new: "New", triaged: "Triaged", replied: "Replied", resolved: "Resolved", spam: "Spam" };
export const FEEDBACK_KIND: Record<string, string> = { bug: "Bug", suggestion: "Suggestion", question: "Question", other: "Other" };
export const TIER_LABEL: Record<string, string> = { T1: "T1", T1_5: "T1.5", T2: "T2", EXCLUDE_MP: "Exclude MP" };
/** The industry pack's source classes, each with the threshold floor it sets. */
export const SELECTION_CLASS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SELECTION.classes).map(([k, c]) => [k, `${c.label} (Threshold >= ${c.threshold})`]),
);
