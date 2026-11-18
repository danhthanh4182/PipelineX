import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
const { channelProfile } = await import("../backend/channel-profile.ts");
// The AI pack's profile, for rules written with AI stories (the checkout itself may run another pack).
const AI_CHANNEL = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../packs/ai/channel.json"), "utf8"));

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
  assert.ok(kit.long.tags.includes("Nvidia") && kit.long.tags.includes(channelProfile().tags[0]!), "story words and the channel's own tags");
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
  assert.equal(fetchable(`https://${channelProfile().officialSites[0]}/news`), true, "the channel's official sites");
  assert.equal(fetchable("https://www.bloomberg.com/news/x"), false, "paywalled");
  assert.equal(fetchable("https://discuss.huggingface.co/t/1"), false, "a forum on a trusted site");
  assert.equal(fetchable("https://example.org/a"), false, "not a trusted site");
  assert.equal(fetchable("https://arstechnica.com/civis/threads/x.1"), false, "a site's own forum section");
  assert.equal(fetchable("file:///etc/passwd"), false);
  await assert.rejects(webSearch("anything"), ResearchUnavailable);
  await assert.rejects(fetchPage("https://www.bloomberg.com/news/x"), /trusted sites/);
});

test("a story's style follows its strongest topic signal, else its reports' category", async () => {
  const { chooseStyle: choose, STYLES, STYLE_KEYS } = await import("../backend/styles.ts");
  const channel = AI_CHANNEL;
  const chooseStyle = (reports: Array<{ text: string; category: string | null }>) => choose(reports, channel.styles.byCategory, channel.styles.allowed);
  const r = (text: string, category: string | null = "industry") => ({ text, category });
  assert.equal(chooseStyle([r("Drone strikes hit the front line as military AI targeting spreads"), r("Pentagon AI office"), r("Other")]).style, "war");
  assert.equal(chooseStyle([r("Police arrest deepfake scam ring; prosecutors say fraud topped $10M"), r("Scammers charged"), r("x")]).style, "crime");
  assert.equal(chooseStyle([r("California attorney general sues OpenAI"), r("The lawsuit alleges"), r("x")]).style, "investigation");
  assert.equal(chooseStyle([r("Anthropic IPO valuation tops $70 billion"), r("Investors pile in"), r("x")]).style, "finance");
  assert.equal(chooseStyle([r("New model tops benchmarks", "ai-models"), r("It is fast", "ai-models"), r("Hands-on", "ai-products")]).style, "launch");
  assert.equal(chooseStyle([r("A paper on reasoning", "paper")]).style, "explainer");
  assert.equal(chooseStyle([]).style, "news");
  assert.equal(chooseStyle([r("One lawsuit mention"), r("a"), r("b"), r("c")]).style, "news", "a signal in under a third of the reports is not enough");
  assert.equal(choose([r("Police arrest scam ring"), r("Scammers charged")], {}, ["news", "finance"]).style, "news", "a style the channel does not allow is never chosen");
  for (const k of STYLE_KEYS) {
    const s = STYLES[k];
    assert.ok(s.script.structure.includes("hook") && s.script.structure.includes("outro"), `${k} keeps a hook and an outro`);
    if (s.sensitive) assert.ok(s.pictureRules.length && s.script.rules.some((x) => /graphic/.test(x)), `${k} has the sensitive-topic rules`);
  }
});

test("a finance channel picks its finer styles by category, and investigation only for legal stories", async () => {
  const { chooseStyle } = await import("../backend/styles.ts");
  const { readFileSync } = await import("node:fs");
  const finance = JSON.parse(readFileSync(new URL("../../../packs/finance/channel.json", import.meta.url), "utf8"));
  const pick = (reports: Array<{ text: string; category: string | null }>) => chooseStyle(reports, finance.styles.byCategory, finance.styles.allowed).style;
  assert.equal(pick([{ text: "Nvidia revenue beats estimates, shares rise", category: "companies" }, { text: "Nvidia earnings: $57 billion revenue", category: "companies" }]), "earnings");
  assert.equal(pick([{ text: "Fed cuts rates; White House welcomes the decision", category: "macro" }, { text: "Congress debates the budget bill", category: "macro" }]), "macro");
  assert.equal(pick([{ text: "S&P 500 hits record as stocks rally", category: "markets" }]), "markets");
  assert.equal(pick([{ text: "Bitcoin tops $120,000", category: "crypto" }]), "crypto");
  assert.equal(pick([{ text: "SEC sues exchange over fraud", category: "policy" }, { text: "Court ruling on the lawsuit", category: "policy" }]), "investigation");
});
