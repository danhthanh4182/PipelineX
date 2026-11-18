import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { sql } from "@aihot/backend/db";

process.env.VIDEO_WORK_DIR = mkdtempSync(path.join(tmpdir(), "pipelinex-tools-"));
delete process.env.TINYFISH_API_KEY;
const { chapters, draftKit, editKit, publishKit } = await import("../backend/publishing.ts");
const { activeRules, decideRule, proposeRule, styleGuide } = await import("../backend/style.ts");
const { fetchable } = await import("../backend/trusted.ts");
const { fetchPage, ResearchUnavailable, webSearch } = await import("../backend/research.ts");

test("chapters follow YouTube's rules: 0:00 first, at least three, none shorter than 10 seconds", () => {
  const scenes = [{ headline: "Hook", start: 0, duration: 20 }, { headline: "Blip", start: 20, duration: 5 }, { headline: "Story", start: 25, duration: 60 }, { headline: "Outro", start: 85, duration: 12 }];
  assert.deepEqual(chapters(scenes, 97), ["0:00 Intro", "0:03 Hook", "0:28 Story", "1:28 Outro"]);
  assert.deepEqual(chapters([{ headline: "Only", start: 0, duration: 30 }], 30), [], "fewer than three chapters: none");
});

test("the publish kit is drafted from the video's files, keeps sources and credits, and edits stay within limits", () => {
  const dir = path.join(process.env.VIDEO_WORK_DIR!, "77");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "script-final.json"), JSON.stringify({ title: "Nvidia Names Kress Interim CEO After Huang Exit", description: "What happened at Nvidia.",
    sources: [{ name: "The Verge", title: "Huang out", url: "https://www.theverge.com/x" }] }));
  writeFileSync(path.join(dir, "timeline.json"), JSON.stringify({ total: 100, scenes: [{ headline: "Hook", start: 0, duration: 30 }, { headline: "Board", start: 30, duration: 40 }, { headline: "Next", start: 70, duration: 30 }] }));
  writeFileSync(path.join(dir, "script-short.json"), JSON.stringify({ title: "Nvidia's CEO is out", scenes: [{ beats: [{ narration: "Nvidia's CEO resigned." }] }] }));
  writeFileSync(path.join(dir, "ATTRIBUTIONS.txt"), "assets/beat-00.jpg: Jane Doe, CC BY 4.0 — https://commons.wikimedia.org/x\n");
  const kit = draftKit(77)!;
  assert.match(kit.long.description, /Chapters:\n0:00 Intro\n0:03 Hook\n0:33 Board\n1:13 Next/);
  assert.match(kit.long.description, /The Verge: Huang out — https:\/\/www\.theverge\.com\/x/);
  assert.match(kit.long.description, /Jane Doe, CC BY 4\.0/);
  assert.match(kit.long.description, /narrated with AI tools/);
  assert.ok(kit.long.tags.includes("Nvidia") && kit.long.tags.includes("AI news"));
  assert.equal(kit.short!.title, "Nvidia's CEO is out #Shorts");
  publishKit(77);
  const out = editKit(77, { longTitle: "x".repeat(150), longTags: Array.from({ length: 20 }, (_, i) => `tag number ${i} with words`) })!;
  assert.equal(out.kit.long.title.length, 100);
  assert.ok(out.kit.long.tags.join(",").length <= 500);
  assert.deepEqual(Object.keys(out.changes).sort(), ["longTags", "longTitle"]);
});

test("a proposed style rule reaches the writers only after the editor approves it", async () => {
  await sql`DELETE FROM settings WHERE key = 'video.style'`;
  const rule = await proposeRule("editor-mcp", { rule: "Attribute every allegation in the hook to who makes it.", why: "Hooks kept stating claims as facts." });
  assert.equal(rule.status, "proposed");
  assert.deepEqual(await activeRules(), [], "a proposal is not a rule");
  await assert.rejects(proposeRule("editor-mcp", { rule: "attribute every allegation in the hook to who makes it.", why: "again, same rule" }), /already/);
  await decideRule("admin:1", rule.id, "active");
  assert.deepEqual(await activeRules(), ["Attribute every allegation in the hook to who makes it."]);
  await decideRule("admin:1", rule.id, "retired");
  assert.deepEqual(await activeRules(), []);
  assert.equal((await styleGuide()).length, 1);
  const [row] = await sql`SELECT count(*)::int AS n FROM audit_log WHERE subject = ${`style:${rule.id}`}`;
  assert.equal(row!.n, 3, "proposal and both decisions are audited");
});

test("web tools read only trusted, non-paywalled sites, and say so plainly without a key", async () => {
  assert.equal(fetchable("https://openai.com/index/news"), true);
  assert.equal(fetchable("https://www.bloomberg.com/news/x"), false, "paywalled");
  assert.equal(fetchable("https://discuss.huggingface.co/t/1"), false, "a forum on a trusted site");
  assert.equal(fetchable("https://example.org/a"), false, "not a trusted site");
  assert.equal(fetchable("https://arstechnica.com/civis/threads/x.1"), false, "a site's own forum section");
  assert.equal(fetchable("file:///etc/passwd"), false);
  await assert.rejects(webSearch("anything"), ResearchUnavailable);
  await assert.rejects(fetchPage("https://www.bloomberg.com/news/x"), /trusted sites/);
});
