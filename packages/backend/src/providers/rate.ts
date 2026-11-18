// PipelineX: a ceiling on requests per minute per model service (MODEL_RPM, e.g. "nvidia=30"), so a free tier with a
// per-minute cap (NVIDIA's developer API, about 40) is used steadily instead of answering 429 and tripping the circuit.
// Counted from the receipt attempts of the last 60 seconds, so every worker and the API share one budget. A caller over
// the ceiling waits for the oldest attempt to leave the window; it never fails for it.
import { setTimeout as sleep } from "node:timers/promises";
import { config } from "../config.ts";
import { sql } from "../db.ts";

export async function waitForRate(service: string): Promise<void> {
  const limit = config.modelRpm[service];
  if (!limit) return;
  for (;;) {
    const [row] = await sql<{ n: number; oldest: Date | null }[]>`
      SELECT count(*)::int AS n, min(started_at) AS oldest FROM receipt_attempts
      WHERE service = ${service} AND started_at > now() - interval '60 seconds'`;
    if (!row || row.n < limit) return;
    const wait = row.oldest ? new Date(row.oldest).getTime() + 60_000 - Date.now() : 1_000;
    // A little jitter so the callers that were waiting do not all go at once.
    await sleep(Math.min(Math.max(wait, 250), 15_000) + Math.random() * 750);
  }
}
