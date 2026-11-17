import { useState } from "react";
import { SITE } from "@aihot/site";
import { Link, useFetcher } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/runs";
import type { AdminDeliveryIssue, AdminReceiptIssue, AdminRuns } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { ago, bj, duration, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Dot, Empty, Field, Json, ReasonDialog, Select, Stat, Time } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminRuns>(request, "/api/admin/runs");
}

export const meta: Route.MetaFunction = () => [{ title: `Operations · ${SITE.name} Admin` }];

const STATE_LABEL: Record<string, string> = { created: "Queued", retry: "Retry Pending", active: "Running" };

export default function RunsAdmin({ loaderData }: Route.ComponentProps) {
  const refresh = useFetcher<typeof loader>();
  const r = refresh.data ?? loaderData;
  const { run, pending } = useAdminAction();
  const [receipt, setReceipt] = useState<AdminReceiptIssue | null>(null);
  const [billed, setBilled] = useState("false");
  const [delivery, setDelivery] = useState<AdminDeliveryIssue | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "drop" | "resend">("sent");
  // Failure group to put back into processing ("" = every failure of the last 30 days).
  const [requeue, setRequeue] = useState<string | null>(null);

  // Live view: refresh every 20 s while visible.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh.state === "idle" && refresh.load("/admin/runs"), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const backlog = new Map<string, Record<string, { n: number; oldest: string }>>();
  for (const q of r.queues) backlog.set(q.name, { ...(backlog.get(q.name) ?? {}), [q.state]: { n: q.n, oldest: q.oldest } });
  const queued = r.queues.filter((q) => q.state !== "active").reduce((a, q) => a + q.n, 0);
  const worker = r.processes.find((p) => p.role === "worker");
  const failing = r.jobs.filter((j) => j.status === "failed");

  return (
    <AdminPage title="Operations" subtitle={<>Jobs, queues, source latency, receipts, and deliveries. Auto-refreshes every 20s · Last checked {bj(r.checkedAt)}</>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="worker"
          value={<span className="inline-flex items-center gap-2 text-[18px]"><Dot tone={worker?.alive ? "ok" : "bad"} />{worker ? (worker.alive ? "Running" : "Heartbeat Lost") : "No Heartbeat"}</span>}
          hint={worker ? `${worker.host} · Heartbeat ${ago(worker.at)}` : "Worker has not reported heartbeat"}
        />
        <Stat label="Queue Backlog" value={num(queued)} tone={queued > 500 ? "warn" : undefined} hint="Queued and Retry Pending" />
        <Stat label="Failed Scheduled Jobs" value={num(failing.length)} tone={failing.length ? "bad" : "ok"} hint="Failed on latest run" />
        <Stat label="Unknown Receipts" value={num(r.receipts.issues.filter((x) => x.status === "unknown").length)} tone={r.receipts.issues.some((x) => x.status === "unknown") ? "bad" : "ok"} hint={`7d: ${num(Object.values(r.receipts.counts).reduce((a, b) => a + b, 0))} paid requests`} />
        <Stat label="Pending Deliveries" value={num(r.deliveries.filter((d) => d.status === "unknown").length)} tone={r.deliveries.some((d) => d.status === "unknown") ? "bad" : "ok"} />
      </div>

      {r.grouping.waiting > 0 && (
        <Card className="mb-5" title="Featured Items Pending Grouping" right={<span>{num(r.grouping.waiting)}  waiting · {num(r.grouping.needsAttention)} over 10m</span>} pad={false} scrollable>
          <p className="px-4 py-3 text-[13px] text-ink-3">Articles meet selection criteria; pending deduplication check before publishing. Displays up to 30 oldest items.</p>
          <DataTable dense rows={r.grouping.items} rowKey={(item) => item.articleId} columns={[
            { key: "title", label: "Article", render: (item) => <Link className="text-accent" to={`/admin/content/${item.articleId}`}>{item.title}</Link> },
            { key: "since", label: "Waiting Since", render: (item) => <Time at={item.since} /> },
            { key: "recovery", label: "Next Step", render: (item) => <Badge tone={item.recovery === "manual" ? "bad" : "warn"}>{item.recovery === "manual" ? "Action Required" : item.recovery === "receipt" ? "Awaiting Receipt Recovery" : "Processing Automatically"}</Badge> },
            { key: "error", label: "Reason", render: (item) => <span className="line-clamp-2 text-[12px] text-ink-3">{item.receiptId ? `Receipt #${item.receiptId} · ` : ""}{item.error ?? "Awaiting Identity"}</span> },
          ]} />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Queues" pad={false} scrollable>
          <DataTable
            dense
            rows={[...backlog.entries()]}
            rowKey={([name]) => name}
            empty="All queues empty"
            columns={[
              { key: "n", label: "Queue", render: ([name]) => <span className="font-mono text-[12.5px]">{name}</span> },
              ...(["created", "retry", "active"] as const).map((st) => ({
                key: st,
                label: STATE_LABEL[st],
                align: "right" as const,
                render: ([, v]: [string, Record<string, { n: number; oldest: string }>]) => (v[st] ? <span title={`Oldest: ${bj(v[st]!.oldest, true)}`}>{num(v[st]!.n)}</span> : <span className="text-ink-4">0</span>),
              })),
              { key: "old", label: "Oldest Enqueued", render: ([, v]) => <Time at={v.created?.oldest ?? v.retry?.oldest ?? null} /> },
            ]}
          />
        </Card>
        <Card title="Cron Jobs" pad={false} scrollable>
          <DataTable
            dense
            rows={r.jobs}
            rowKey={(j) => j.job}
            columns={[
              { key: "j", label: "Job", render: (j) => <span className="font-mono text-[12.5px]">{j.job}</span> },
              { key: "s", label: "Last Status", render: (j) => <Badge tone={j.status === "ok" ? "ok" : j.status === "failed" ? "bad" : "muted"} title={j.error ?? undefined}>{j.status ?? "Running"}</Badge> },
              { key: "at", label: "Time", render: (j) => <Time at={j.started_at} /> },
              { key: "d", label: "Duration", align: "right", render: (j) => duration(j.started_at, j.finished_at) },
              { key: "f", label: "24h Failed", align: "right", render: (j) => (j.failed_24h ? <span className="text-hot">{j.failed_24h}/{j.runs_24h}</span> : `0/${j.runs_24h}`) },
            ]}
          />
        </Card>
      </div>

      {r.failedJobs.length > 0 && (
        <Card className="mt-5" title="Failed Queue Tasks in 24 Hours" pad={false} scrollable>
          <DataTable
            dense
            rows={r.failedJobs}
            rowKey={(j) => j.name}
            columns={[
              { key: "n", label: "Queue", render: (j) => <span className="font-mono text-[12.5px]">{j.name}</span> },
              { key: "c", label: "Failures", align: "right", render: (j) => num(j.failed) },
              { key: "l", label: "Last", render: (j) => <Time at={j.last} /> },
              { key: "o", label: "Last Error", render: (j) => <span className="line-clamp-2 font-mono text-[11.5px] text-ink-3">{j.last_output}</span> },
            ]}
          />
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Receipts Requiring Reconciliation" right={<span>{Object.entries(r.receipts.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>} pad={false} scrollable>
          <DataTable
            dense
            rows={r.receipts.issues}
            rowKey={(x) => x.id}
            empty="No pending receipts"
            columns={[
              { key: "id", label: "Receipt", render: (x) => <span className="num">#{x.id}</span> },
              { key: "s", label: "Status", render: (x) => <Badge tone={x.status === "unknown" ? "bad" : "warn"}>{x.status}</Badge> },
              { key: "w", label: "Service", render: (x) => <span className="whitespace-nowrap">{x.service}{x.model ? ` · ${x.model}` : ""}</span> },
              { key: "p", label: "Purpose", render: (x) => (x.subject && /^[\w-]{10,}$/.test(x.subject) && x.purpose.includes("analy") ? <Link className="text-accent" to={`/admin/content/${x.subject}`}>{x.purpose}</Link> : x.purpose) },
              { key: "e", label: "Error", render: (x) => <span className="line-clamp-2 text-[12px] text-ink-3" title={x.error ?? ""}>{x.error}</span> },
              { key: "a", label: "", render: (x) => (x.status === "unknown" ? <Button size="sm" onClick={() => setReceipt(x)}>Reconcile</Button> : null) },
            ]}
          />
        </Card>
        <Card title="Deliveries Needing Verification" pad={false} scrollable>
          <DataTable
            dense
            rows={r.deliveries}
            rowKey={(d) => d.id}
            empty="No deliveries requiring verification"
            columns={[
              { key: "t", label: "Target", render: (d) => d.target_key },
              { key: "s", label: "Status", render: (d) => <Badge tone={d.status === "unknown" ? "bad" : "warn"}>{d.status}</Badge> },
              { key: "sub", label: "Content", render: (d) => (d.subject_kind === "selected" ? <Link className="text-accent" to={`/admin/content/${d.subject_id}`}>{d.subject_id}</Link> : `${d.subject_kind} ${d.subject_id}`) },
              { key: "at", label: "Time", render: (d) => <Time at={d.updated_at} /> },
              { key: "a", label: "", render: (d) => <Button size="sm" onClick={() => setDelivery(d)}>Resolve</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Delayed or Failing Sources" right={<Link className="text-accent" to="/admin/sources?health=failing">All Failing Sources</Link>} pad={false} scrollable>
          <DataTable
            dense
            rows={r.lagging}
            rowKey={(s) => s.id}
            empty="All sources on schedule"
            columns={[
              { key: "n", label: "Source", render: (s) => <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
              { key: "h", label: "Health", render: (s) => <Badge tone={s.health === "failing" ? "bad" : s.health === "degraded" ? "warn" : "muted"}>{s.health}</Badge> },
              { key: "ok", label: "Last Success", render: (s) => <Time at={s.last_ok_at} /> },
              { key: "nx", label: "Due At", render: (s) => <Time at={s.next_fetch_at} /> },
              { key: "e", label: "Error", render: (s) => <span className="line-clamp-1 text-[12px] text-ink-3" title={s.last_error ?? ""}>{s.last_error}</span> },
            ]}
          />
        </Card>
        <Card
          title="Processing Failures (30d, by Error)"
          right={
            <span className="flex items-center gap-3">
              {r.retrying.count > 0 && <span>Waiting retry: {num(r.retrying.count)} · Next:  <Time at={r.retrying.next} /></span>}
              {r.errors.length > 0 && <Button size="sm" onClick={() => setRequeue("")}>Requeue All</Button>}
            </span>
          }
          pad={false} scrollable
        >
          <DataTable
            dense
            rows={r.errors}
            rowKey={(e) => e.error}
            empty="No processing failures"
            columns={[
              { key: "e", label: "Error", render: (e) => <span className="font-mono text-[11.5px] text-ink-2">{e.error}</span> },
              { key: "n", label: "Count", align: "right", render: (e) => num(e.n) },
              { key: "x", label: "Example", render: (e) => <Link className="text-accent" to={`/admin/content/${e.example}`}>View</Link> },
              { key: "l", label: "Last", render: (e) => <Time at={e.last} /> },
              { key: "a", label: "", align: "right", render: (e) => <Button size="sm" onClick={() => setRequeue(e.error)}>Requeue</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Task Timeline" pad={false} scrollable>
          <DataTable
            dense
            rows={r.timeline}
            rowKey={(t) => t.id}
            columns={[
              { key: "at", label: "Started", render: (t) => <span className="num whitespace-nowrap">{bj(t.started_at)}</span> },
              { key: "j", label: "Job", render: (t) => <span className="font-mono text-[12px]">{t.job}</span> },
              { key: "s", label: "Result", render: (t) => <Badge tone={t.status === "ok" ? "ok" : t.status === "failed" ? "bad" : "muted"} title={t.error ?? undefined}>{t.status ?? "Running"}</Badge> },
              { key: "d", label: "Duration", align: "right", render: (t) => duration(t.started_at, t.finished_at) },
            ]}
          />
        </Card>
        <Card title="External Ingestion Reports" pad={false} scrollable>
          {r.ingest.length ? (
            <DataTable
              dense
              rows={r.ingest}
              rowKey={(e) => `${e.client}-${e.created_at}`}
              columns={[
                { key: "at", label: "Time", render: (e) => <Time at={e.created_at} /> },
                { key: "c", label: "Client", render: (e) => e.client },
                { key: "k", label: "Type", render: (e) => e.kind },
                { key: "s", label: "Result", render: (e) => <Badge tone={e.status === "ok" ? "ok" : e.status === "error" ? "bad" : "muted"} title={e.error ?? undefined}>{e.status}</Badge> },
                { key: "x", label: "Summary", render: (e) => <Json value={e.summary} label="Summary" /> },
              ]}
            />
          ) : (
            <Empty>No external ingestion reports yet.</Empty>
          )}
        </Card>
      </div>

      {r.processes.length > 0 && (
        <Card className="mt-5" title="Processes">
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {r.processes.map((p) => (
              <li key={p.role} className="flex items-center gap-2">
                <Dot tone={p.alive ? "ok" : "bad"} />
                <span className="font-medium">{p.role}</span>
                <span className="text-ink-3">{p.host} · pid {p.pid} · {p.release} · started at {bj(p.startedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReasonDialog
        open={!!receipt}
        title={`Reconcile Receipt #${receipt?.id ?? ""}`}
        description="Requests still unknown after automated recovery require manual clearance. Check provider billing. Releasing may incur duplicate billing."
        confirmLabel="Record & Release"
        busy={pending === "release"}
        onClose={() => setReceipt(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/receipts/${receipt!.id}/release`, { billed: billed === "unknown" ? null : billed === "true", note }, { label: "release", success: "Released" })) !== null}
      >
        <Field label="Billed by Provider">
          <Select value={billed} onChange={(e) => setBilled(e.target.value)}>
            <option value="false">Not Billed (request rejected)</option>
            <option value="true">Billed (result not retrieved)</option>
            <option value="unknown">Unknown (recovery approved)</option>
          </Select>
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={requeue !== null}
        title={requeue ? "Requeue Failures in This Category" : "Requeue All Failures"}
        description="These articles will re-enter processing queue (extraction, analysis, publication). Model calls will be billed again."
        confirmLabel="Requeue"
        busy={pending === "requeue"}
        onClose={() => setRequeue(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/processing/requeue", { group: requeue || null, reason }, { label: "requeue", success: "Requeued" })) !== null}
      />
      <ReasonDialog
        open={!!delivery}
        title="Resolve Delivery"
        description="Verify with destination channel whether message was received before resending."
        confirmLabel="Confirm"
        danger={outcome === "resend"}
        busy={pending === "delivery"}
        onClose={() => setDelivery(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/deliveries/${delivery!.id}/resolve`, { outcome, note }, { label: "delivery", success: "Resolved" })) !== null}
      >
        <Field label="Resolution">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="sent">Received by channel, mark delivered</option>
            <option value="drop">Drop (do not send)</option>
            <option value="resend">Not in channel, resend</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
