// The channel's style guide: writing rules the agent proposes from what it keeps fixing, which take effect only after
// the human editor approves them on the Videos page (a proposal can never reach a prompt on its own). Active rules are
// handed to the script and Short writers (pipeline.ts writes them to the video's style.json).
import { randomUUID } from "node:crypto";
import { sql } from "@aihot/backend/db";
import { audit } from "@aihot/backend/audit";

export type RuleStatus = "proposed" | "active" | "rejected" | "retired";
export interface StyleRule { id: string; rule: string; why: string; example?: string; status: RuleStatus; proposedBy: string; proposedAt: string; decidedBy?: string; decidedAt?: string }

const KEY = "video.style";
export const MAX_ACTIVE = 20, MAX_PROPOSED = 10;

export async function styleGuide(): Promise<StyleRule[]> {
  const [row] = await sql<{ value: { rules: StyleRule[] } }[]>`SELECT value FROM settings WHERE key = ${KEY}`;
  return row?.value.rules ?? [];
}

async function save(rules: StyleRule[], by: string) {
  await sql`INSERT INTO settings (key, value, updated_by, updated_at) VALUES (${KEY}, ${sql.json({ rules } as never)}, ${by}, now())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export class StyleConflict extends Error { code = "conflict"; }

export async function proposeRule(actor: string, input: { rule: string; why: string; example?: string }): Promise<StyleRule> {
  const rules = await styleGuide();
  if (rules.filter((r) => r.status === "proposed").length >= MAX_PROPOSED) throw new StyleConflict(`${MAX_PROPOSED} proposals already wait for the editor; let them be decided first.`);
  if (rules.some((r) => r.status !== "rejected" && r.rule.toLowerCase() === input.rule.toLowerCase())) throw new StyleConflict("This rule is already in the guide or proposed.");
  const rule: StyleRule = { id: randomUUID().slice(0, 8), rule: input.rule, why: input.why, ...(input.example ? { example: input.example } : {}), status: "proposed", proposedBy: actor, proposedAt: new Date().toISOString() };
  await save([...rules, rule], actor);
  await audit(actor, "video.style.propose", `style:${rule.id}`, input.why, null, rule);
  return rule;
}

/** The human editor's decision (admin only): activate, reject, or retire an active rule. */
export async function decideRule(actor: string, id: string, status: "active" | "rejected" | "retired"): Promise<StyleRule> {
  const rules = await styleGuide();
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new StyleConflict("No such rule.");
  if (status === "active" && rule.status !== "active" && rules.filter((r) => r.status === "active").length >= MAX_ACTIVE) throw new StyleConflict(`At most ${MAX_ACTIVE} active rules; retire one first.`);
  const before = { ...rule };
  Object.assign(rule, { status, decidedBy: actor, decidedAt: new Date().toISOString() });
  await save(rules, actor);
  await audit(actor, `video.style.${status}`, `style:${id}`, null, before, rule);
  return rule;
}

export async function activeRules(): Promise<string[]> {
  return (await styleGuide()).filter((r) => r.status === "active").map((r) => r.rule);
}
