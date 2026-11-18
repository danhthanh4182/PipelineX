// PipelineX: MODEL_RPM keeps a model service under its per-minute cap by waiting, never by failing.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { waitForRate } from "@aihot/backend/providers/rate";

async function attempt(service: string, secondsAgo: number) {
  const [r] = await sql<{ id: number }[]>`
    INSERT INTO receipts (logical_key, service, purpose, status) VALUES (${`rate-test:${service}:${Math.random()}`}, ${service}, 'test', 'completed') RETURNING id`;
  await sql`INSERT INTO receipt_attempts (receipt_id, attempt, service, status, started_at)
            VALUES (${r!.id}, 1, ${service}, 'received', now() - make_interval(secs => ${secondsAgo}))`;
}

test("a service over its per-minute ceiling waits until the oldest call leaves the window; others never wait", async () => {
  config.modelRpm["rate-test"] = 2;
  await attempt("rate-test", 59);
  await attempt("rate-test", 10);
  const started = Date.now();
  await waitForRate("rate-test");
  const waited = Date.now() - started;
  assert.ok(waited >= 500 && waited < 5_000, `waited ${waited} ms for the call made 59 s ago to age out`);

  const free = Date.now();
  await waitForRate("rate-test-unlimited");
  assert.ok(Date.now() - free < 200, "a service without a ceiling goes at once");
  delete config.modelRpm["rate-test"];
});
after(closeDb);
