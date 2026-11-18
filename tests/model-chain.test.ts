// PipelineX provider chain (site/models.ts pipelinex-chain): free models only, ending with the deployment's LLM_*. A member that refuses
// the account, throttles, fails or is not configured hands the call to the next; an unusable answer does not; a call
// with an image skips the members that cannot read one.
import { pointModels, Reply, stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { z } from "zod";
import { sql, closeDb } from "@aihot/backend/db";
import { chatJson } from "@aihot/backend/providers/llm";
import { failureKind } from "@aihot/backend/providers/receipts";
import { stopBoss } from "@aihot/backend/jobs/queue";

const answer = (value: string) => ({ choices: [{ message: { content: JSON.stringify({ value }) } }] });
let nvidiaAnswer: () => unknown = () => answer("nvidia");
let openrouterAnswer: (model: string) => unknown = (model) => answer(model);
let orcaAnswer: () => unknown = () => answer("orca");
const nvidia = await stub(() => nvidiaAnswer());
// Both OpenRouter members share one address; the stub answers by the model asked for.
const openrouter = await stub((_hit, req) => { const model = JSON.parse(req.body).model; askedOpenRouter.push(model); return openrouterAnswer(model); });
const orca = await stub(() => orcaAnswer());
// The chain's last member, the deployment's own LLM_* model.
let lastAnswer: () => unknown = () => answer("last");
const last = await stub(() => lastAnswer());
process.env.LLM_BASE_URL = `${last.url}/v1`;
process.env.LLM_API_KEY = "test-key";
process.env.LLM_MODEL = "test-free-model";
process.env.LLM_VISION = "true";
pointModels(nvidia.url, ["nvidia-nemotron"]);
pointModels(openrouter.url, ["openrouter-free-nemotron", "openrouter-nemotron"]);
pointModels(orca.url, ["orcarouter-free-deepseek"]);
const T = tag();
const request = (name: string) => ({
  model: "pipelinex-chain", purpose: "summarize_article", subject: `chain:${T}:${name}`, promptVersion: "chain-test",
  system: "Return the requested value.", user: `${T}:${name}`, schema: z.object({ value: z.string() }),
});
beforeEach(async () => {
  await sql`DELETE FROM settings WHERE key LIKE 'model.circuit.%' OR key LIKE 'provider.stop.%'`;
  nvidiaAnswer = () => answer("nvidia");
  openrouterAnswer = (model) => answer(model);
  orcaAnswer = () => answer("orca");
  lastAnswer = () => answer("last");
});
after(async () => { await Promise.all([nvidia.close(), openrouter.close(), orca.close(), last.close()]); await stopBoss(); await closeDb(); });

/** OpenRouter models the stub was asked for, to prove the paid one never is. */
const askedOpenRouter: string[] = [];

test("the free primary answers when it can", async () => {
  const before = openrouter.hits();
  const result = await chatJson(request("primary"));
  assert.deepEqual([result.model, result.data.value], ["nvidia-nemotron", "nvidia"]);
  assert.equal(openrouter.hits(), before, "nobody else is asked");
});

test("a spent key at one provider goes on to the next free one, and the paid model is never asked", async () => {
  nvidiaAnswer = () => new Reply(403, { error: { message: "Key limit exceeded" } });
  const free = await chatJson(request("refused"));
  assert.deepEqual([free.model, free.data.value], ["openrouter-free-nemotron", "nvidia/nemotron-3.5-super-vl:free"]);

  openrouterAnswer = (model) => (model.endsWith(":free") ? new Reply(429, { error: { message: "rate limited" } }) : answer(model));
  orcaAnswer = () => new Reply(429, { error: { code: "free_rate_limited", message: "free tier window full", metadata: { reason: "err_free_rate" } } });
  const end = await chatJson(request("all-free-busy"));
  assert.deepEqual([end.model, end.data.value], ["default", "last"]);
  assert.ok(askedOpenRouter.every((model) => model.endsWith(":free")), "OpenRouter is only asked for its free model");

  lastAnswer = () => new Reply(429, { error: { message: "rate limited" } });
  await assert.rejects(chatJson(request("everyone-busy")), (error: unknown) => failureKind(error) === "outage");
  assert.ok(askedOpenRouter.every((model) => model.endsWith(":free")));
});

test("an unusable answer is not bought again from another provider", async () => {
  nvidiaAnswer = () => ({ choices: [{ message: { content: "not json at all" } }] });
  const before = [openrouter.hits(), orca.hits()];
  await assert.rejects(chatJson(request("unusable")), (error: unknown) => failureKind(error) === "unusable");
  assert.deepEqual([openrouter.hits(), orca.hits()], before);
});

test("a call with an image skips the text-only member", async () => {
  nvidiaAnswer = () => new Reply(503, { error: "overloaded" });
  openrouterAnswer = () => new Reply(503, { error: "overloaded" });
  const before = orca.hits();
  const result = await chatJson({ ...request("image"), user: [{ type: "text", text: "What is this?" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] });
  assert.equal(result.model, "default");
  assert.equal(orca.hits(), before, "the text-only DeepSeek member is not asked");
});
