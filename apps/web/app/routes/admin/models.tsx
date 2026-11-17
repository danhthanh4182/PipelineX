import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/models";
import type { AdminModels } from "@aihot/contracts/admin";
import { SITE } from "@aihot/site";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, money, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Field, FilterChips, ReasonDialog, Select } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  const days = new URL(request.url).searchParams.get("days") ?? "7";
  return adminGet<AdminModels>(request, `/api/admin/models?days=${encodeURIComponent(days)}`);
}

export const meta: Route.MetaFunction = () => [{ title: `Models & Eval · ${SITE.name} Admin` }];

const SOURCE_LABEL = { admin: "Admin Override", env: "Environment", default: "Code Default" } as const;

/** A cost the provider did not report and no price covers. */
function Unpriced() {
  return <span className="whitespace-nowrap text-ink-4" title="Provider did not report cost; estimate using tokens and model pricing">Unpriced</span>;
}
const secs = (ms: number | null) => (ms == null ? "—" : ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);

export default function ModelsAdmin({ loaderData: m }: Route.ComponentProps) {
  const { run, pending } = useAdminAction();
  const [target, setTarget] = useState<AdminModels["capabilities"][number] | null>(null);
  const [choice, setChoice] = useState<string>("");
  const labelOf = (key: string) => m.capabilities.find((c) => `capability:${c.key}` === key)?.label ?? key;

  return (
    <AdminPage
      title="Models & Eval"
      subtitle="Current model for each capability and resolution origin (Admin > Env > Code Default), plus success rates, latency, and cost. Changes apply to subsequent tasks only."
      actions={<FilterChips param="days" options={[{ value: "1", label: "24 Hours" }, { value: "", label: "7 Days" }, { value: "30", label: "30 Days" }]} />}
    >
      <div className="grid grid-cols-1 gap-5">
        {m.capabilities.map((c) => {
          const total = c.usage.reduce((a, u) => a + u.calls, 0);
          return (
            <Card
              key={c.key}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {c.label}
                  <span className="font-mono text-[12px] font-normal text-ink-3 [overflow-wrap:anywhere]">{c.current.model}</span>
                  <Badge tone={c.current.source === "admin" ? "accent" : "muted"}>{SOURCE_LABEL[c.current.source]}</Badge>
                  {c.current.invalid && <Badge tone="bad">Configured {c.current.invalid} not found, inactive</Badge>}
                  {c.fallback && <span className="text-xs font-normal text-ink-3">
                    Fallback {c.fallback.model} · {c.fallback.primaryPaused
                      ? c.fallback.backupPaused ? "Primary & backup paused" : "Failing over"
                      : c.fallback.backupPaused ? "Unavailable" : "Ready"}
                    {c.fallback.nextProbeAt && ` · ${bj(c.fallback.nextProbeAt)}  probe primary with next request`}
                  </span>}
                </span>
              }
              right={
                <Button
                  size="sm"
                  onClick={() => {
                    setTarget(c);
                    setChoice(c.current.model);
                  }}
                >
                  Switch
                </Button>
              }
              pad={false}
            >
              {c.usage.length ? (
                <DataTable
                  dense
                  rows={c.usage}
                  rowKey={(u) => `${u.purpose}|${u.model}|${u.promptVersion}`}
                  columns={[
                    { key: "m", label: "Model", render: (u) => <span className="whitespace-nowrap font-mono text-[12px]">{u.model}</span> },
                    { key: "v", label: "Prompt Version", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.promptVersion ?? "—"}</span> },
                    { key: "p", label: "Purpose", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.purpose}</span> },
                    { key: "c", label: "Calls", align: "right", render: (u) => num(u.calls) },
                    {
                      key: "ok",
                      label: "Success Rate",
                      align: "right",
                      render: (u) => {
                        const rate = u.calls ? u.ok / u.calls : 0;
                        return <span className={rate < 0.95 ? "text-hot" : ""} title={`Failed ${u.failed} · Unknown ${u.unknown}`}>{`${Math.round(rate * 1000) / 10}%`}</span>;
                      },
                    },
                    { key: "l", label: "Latency p50 / p95", align: "right", render: (u) => <span className="whitespace-nowrap">{`${secs(u.p50)} / ${secs(u.p95)}`}</span> },
                    { key: "t", label: "Input / Output Tokens", align: "right", render: (u) => <span className="whitespace-nowrap">{`${num(u.tokensIn)} / ${num(u.tokensOut)}`}</span> },
                    {
                      key: "$",
                      label: "Cost",
                      align: "right",
                      render: (u) =>
                        u.actualCost !== null ? (
                          `${money(u.actualCost)}${u.currency && u.currency !== "CNY" ? ` ${u.currency}` : ""}`
                        ) : u.estimate ? (
                          <span title="Estimated from usage × unit price">≈ {money(u.estimate.amount)}{u.estimate.currency !== "CNY" ? ` ${u.estimate.currency}` : ""}</span>
                        ) : (
                          <Unpriced />
                        ),
                    },
                  ]}
                />
              ) : (
                <Empty>{m.days}  days without calls{total === 0 && c.vision ? " (used only for images)" : ""}</Empty>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Switch History" pad={false}>
          {m.history.length ? (
            <DataTable
              dense
              rows={m.history}
              rowKey={(h) => `${h.at}|${h.subject}`}
              columns={[
                { key: "at", label: "Time", render: (h) => <span className="num whitespace-nowrap">{bj(h.at)}</span> },
                { key: "c", label: "Capability", render: (h) => labelOf(h.subject) },
                { key: "m", label: "Change", render: (h) => <span className="font-mono text-[12px]">{h.before?.model ?? "—"} → {h.after?.model ?? "—"}</span> },
                { key: "r", label: "Reason", render: (h) => <span className="text-ink-3">{h.reason}</span> },
                { key: "a", label: "Actor", render: (h) => h.actor },
              ]}
            />
          ) : (
            <Empty>No models switched via admin yet.</Empty>
          )}
        </Card>
        <Card title="Benchmark Sample Comparison (SelectBench)" right={<Link to="/admin/selectbench" className="text-accent">All Runs</Link>} pad={false}>
          {m.benches.length ? (
            <DataTable
              dense
              rows={m.benches}
              rowKey={(b) => b.id}
              columns={[
                { key: "l", label: "Run", render: (b) => <Link to={`/admin/selectbench/${b.id}`} className="text-ink hover:text-accent">{b.label}</Link> },
                { key: "m", label: "Model", render: (b) => <span className="font-mono text-[11.5px] text-ink-3">{b.models.join(", ")}</span> },
                { key: "n", label: "Samples", align: "right", render: (b) => num(b.sample_size) },
                { key: "at", label: "Time", render: (b) => <span className="num whitespace-nowrap">{bj(b.created_at)}</span> },
              ]}
            />
          ) : (
            <Empty>No benchmark runs imported yet.</Empty>
          )}
        </Card>
      </div>

      <ReasonDialog
        open={!!target}
        title={`Switch Model: ${target?.label ?? ""}`}
        description='Affects subsequent tasks only. Choose "Restore Default" to revert to environment variable or code default.'
        confirmLabel="Switch"
        busy={pending === "switch"}
        onClose={() => setTarget(null)}
        onSubmit={async (reason) =>
          (await run("POST", `/api/admin/models/${target!.key}`, { model: choice === "__default" ? null : choice, reason }, { label: "switch", success: "Switched; effective on next call" })) !== null
        }
      >
        <Field label="Model">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {m.choices
              .filter((x) => !target?.vision || x.vision)
              .map((x) => (
                <option key={x.key} value={x.key}>
                  {x.key} ({x.service})
                </option>
              ))}
            <option value="__default">Restore Default ({target?.env} or {target?.defaultModel})</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
