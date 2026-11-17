import { ADMIN, SITE } from "@aihot/site";
import { useState } from "react";
import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/feedback";
import type { AdminFeedback, AdminFeedbackRow } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { FEEDBACK_KIND, FEEDBACK_STATUS } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, Empty, FilterChips, Input, Pager, ReasonDialog, Select, Textarea, Time } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminFeedback>(request, `/api/admin/feedback${new URL(request.url).search}`);
}

export const meta: Route.MetaFunction = () => [{ title: `Feedback · ${SITE.name} Admin` }];

const TONE: Record<string, "accent" | "warn" | "ok" | "muted"> = { new: "accent", triaged: "warn", replied: "ok", resolved: "ok", spam: "muted" };
/** The pool's names, offered while naming a suggestion so the same idea keeps one name. */
const IDEAS_LIST = "feedback-ideas";

function FeedbackCard({ f }: { f: AdminFeedbackRow }) {
  const { run, pending } = useAdminAction();
  const [note, setNote] = useState(f.note ?? "");
  const [idea, setIdea] = useState(f.idea ?? "");
  const [dialog, setDialog] = useState<null | "ban" | "email-ban" | "erase">(null);
  const base = `/api/admin/feedback/${f.id}`;
  const version = new Date(f.updated_at).toISOString();
  const edited = note !== (f.note ?? "") || idea !== (f.idea ?? "");
  return (
    <article className="rounded-panel bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <span className="num font-medium text-ink-2">#{f.id}</span>
        <Badge tone={TONE[f.status] ?? "muted"}>{FEEDBACK_STATUS[f.status] ?? f.status}</Badge>
        {f.kind && <Badge tone="info">{FEEDBACK_KIND[f.kind] ?? f.kind}</Badge>}
        {f.idea && <Badge tone="muted" title="Assigned idea group">{f.idea}</Badge>}
        <Time at={f.created_at} />
        {f.email && <a className="text-accent" href={`mailto:${f.email}`}>{f.email}</a>}
        {f.page_url && <a className="max-w-[320px] truncate hover:text-accent" href={f.page_url} target="_blank" rel="noreferrer">{f.page_url}</a>}
        {f.from_source > 1 && <Badge tone="info" title="Same source (irreversible hash of IP and browser fingerprint)">Same source: {f.from_source}</Badge>}
        {f.banned && <Badge tone="bad">Source Banned</Badge>}
        {f.email_banned && <Badge tone="bad">Email Temp Banned</Badge>}
        {!f.forwarded_at && f.status === "new" && (
          <Badge tone="warn" title={f.forward_error && f.forward_error !== "pending" ? `Not yet forwarded to internal webhook: ${f.forward_error}` : "Not forwarded to internal webhook yet"}>Not Forwarded</Badge>
        )}
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{f.content}</p>
      {f.screenshot === "local" && (
        <a href={`${base}/screenshot`} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img src={`${base}/screenshot`} alt="Feedback screenshot" loading="lazy" className="max-h-48 rounded-control ring-1 ring-line" />
        </a>
      )}
      {f.screenshot === "feishu" && <p className="mt-2 text-[12.5px] text-ink-4">Screenshot forwarded to internal webhook.</p>}
      {f.screenshot === "gone" && <p className="mt-2 text-[12.5px] text-ink-4">Screenshot failed to forward; purged per policy.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-start">
        <div className="grid gap-2">
          <Select
            aria-label="Status"
            value={f.status}
            disabled={!!pending}
            onChange={(e) => run("PATCH", base, { status: e.target.value, version }, { label: "status", success: "Status updated" })}
          >
            {Object.entries(FEEDBACK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select
            aria-label="Type"
            value={f.kind ?? ""}
            disabled={!!pending}
            onChange={(e) => run("PATCH", base, { kind: e.target.value || null, version }, { label: "kind", success: "Type updated" })}
          >
            <option value="">Uncategorized</option>
            {Object.entries(FEEDBACK_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="grid gap-2">
          <Textarea rows={1} className="!min-h-[38px]" placeholder="Internal triage note" value={note} onChange={(e) => setNote(e.target.value)} />
          {f.kind === "suggestion" && (
            <Input list={IDEAS_LIST} aria-label="Assigned Idea" placeholder="Assign to idea cluster (use consistent name)" value={idea} onChange={(e) => setIdea(e.target.value)} />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="md" disabled={!edited} busy={pending === "note"} onClick={() => run("PATCH", base, { note: note || null, ...(f.kind === "suggestion" ? { idea: idea || null } : {}), version }, { label: "note", success: "Saved" })}>
            Save
          </Button>
          <Button tone="ghost" onClick={() => setDialog(f.banned ? null : "ban")} disabled={f.banned} title="Reject subsequent feedback from this source">Ban Source</Button>
          {f.email && <Button tone="ghost" onClick={() => setDialog("email-ban")} disabled={f.email_banned} title="Reject feedback from this email; auto-expires in 48h">Temp Ban Email</Button>}
          <Button tone="ghost" onClick={() => setDialog("erase")} title="Erase personal data per privacy policy">Erase Data</Button>
        </div>
      </div>
      <ReasonDialog
        open={dialog === "ban"}
        title="Ban This Feedback Source"
        description={`Subsequent feedback from this source fingerprint will be rejected. Hash is irreversible. ${ADMIN?.banNote ?? ""}`}
        danger
        confirmLabel="Ban"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/feedback-bans", { sourceHash: f.source_hash, reason }, { label: "ban", success: "Banned" })) !== null}
      />
      <ReasonDialog
        open={dialog === "email-ban"}
        title="Temporarily Ban Feedback Email"
        description="Feedback from this email will be blocked for 48 hours across networks. Use only upon persistent abuse. Does not affect web browsing."
        danger
        confirmLabel="Ban for 48h"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/feedback-bans", { feedbackId: f.id, reason }, { label: "email-ban", success: "Email temporarily banned for 48h" })) !== null}
      />
      <ReasonDialog
        open={dialog === "erase"}
        title="Erase Submitter Personal Data"
        description="Permanently erases message text, email, page URL, and screenshot, keeping audit resolution status only. Irreversible."
        danger
        confirmLabel="Erase"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/erase`, { reason }, { label: "erase", success: "Data erased" })) !== null}
      />
    </article>
  );
}

export default function FeedbackAdmin({ loaderData }: Route.ComponentProps) {
  const { rows, counts, kinds, ideas, bans, page } = loaderData;
  const [sp] = useSearchParams();
  const { run } = useAdminAction();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <AdminPage title="Feedback" subtitle={ADMIN?.feedbackNote}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <FilterChips
            param="status"
            options={[{ value: "", label: "All", count: total }, ...Object.entries(FEEDBACK_STATUS).map(([k, v]) => ({ value: k, label: v, count: counts[k] ?? 0 }))]}
          />
          <FilterChips
            param="kind"
            resets={["idea"]}
            options={[{ value: "", label: "All Types" }, ...Object.entries(FEEDBACK_KIND).map(([k, v]) => ({ value: k, label: v, count: kinds[k] ?? 0 }))]}
          />
        </div>
        <Form method="get" className="w-full max-w-xs">
          {["status", "kind", "idea"].map((k) => sp.get(k) && <input key={k} type="hidden" name={k} value={sp.get(k)!} />)}
          <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Search text, email, page" aria-label="Search feedback" />
        </Form>
      </div>
      {sp.get("kind") === "suggestion" && ideas.length > 0 && (
        <Card className="mb-4" title="Idea Clusters" right="Sorted by submission count">
          <FilterChips param="idea" options={[{ value: "", label: "All Ideas" }, ...ideas.map((i) => ({ value: i.idea, label: i.idea, count: i.people }))]} />
        </Card>
      )}
      <datalist id={IDEAS_LIST}>{ideas.map((i) => <option key={i.idea} value={i.idea} />)}</datalist>
      <div className="space-y-3">
        {rows.length ? rows.map((f) => <FeedbackCard key={`${f.id}-${f.updated_at}`} f={f} />) : <Card><Empty>No matching feedback</Empty></Card>}
      </div>
      <Pager page={page} hasMore={rows.length === 50} />
      {bans.length > 0 && (
        <Card className="mt-8" title="Feedback Bans">
          <ul className="space-y-2 text-[13px]">
            {bans.map((b) => (
              <li key={b.source_hash} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {b.source_hash.startsWith("email:") ? "Email" : "Source"} · <span className="break-all font-mono text-[12px] text-ink-3">{b.source_hash}</span> · {b.reason} · {b.created_by} · {bj(b.created_at, true)}
                  {b.expires_at && <span> · {bj(b.expires_at, true)} auto-expires</span>}
                </span>
                <Button size="sm" tone="ghost" onClick={() => run("DELETE", `/api/admin/feedback-bans/${encodeURIComponent(b.source_hash)}`, undefined, { label: `unban-${b.source_hash}`, success: "Ban lifted" })}>
                  Lift Ban
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminPage>
  );
}
