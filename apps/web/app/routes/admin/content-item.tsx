import { SITE } from "@aihot/site";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@aihot/contracts/taxonomy";
import type { Route } from "./+types/content-item";
import type { AdminContentChain, AdminPresentationRefresh } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, money } from "../../features/admin/format";
import { KIND_LABEL, MODE_LABEL, VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, Empty, Field, Input, Json, KV, ReasonDialog, Select, Textarea } from "../../features/admin/ui";


export async function loader({ request, params }: Route.LoaderArgs) {
  return adminGet<AdminContentChain>(request, `/api/admin/content/${encodeURIComponent(params.id)}`);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.publication?.title ?? loaderData?.article.title ?? "Content"} · ${SITE.name} Admin` }];

function Step({ title, meta, children, tone = "accent", last }: { title: ReactNode; meta?: ReactNode; children: ReactNode; tone?: "accent" | "muted" | "bad"; last?: boolean }) {
  const dot = tone === "bad" ? "bg-hot" : tone === "muted" ? "bg-ink-4" : "bg-accent";
  return (
    <li className="relative pl-7">
      {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-line-strong" aria-hidden />}
      <span className={`absolute left-[3px] top-[7px] size-[9px] rounded-full ring-4 ring-bg ${dot}`} aria-hidden />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
        {meta && <div className="text-[12px] text-ink-4">{meta}</div>}
      </div>
      <div className="mt-2 pb-6 text-[13px] text-ink-2">{children}</div>
    </li>
  );
}

type Dialog = null | "visibility" | "seo" | "override" | "analyze" | "extract" | "presentation" | "group" | "detach" | "merge";

export default function ContentItem({ loaderData }: Route.ComponentProps) {
  const c = loaderData;
  const a = c.article;
  const p = c.publication;
  const { run, pending } = useAdminAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [presentation, setPresentation] = useState<AdminPresentationRefresh | null>(null);
  const [visibility, setVisibility] = useState<string>(p?.visibility ?? "public");
  const [fields, setFields] = useState({ title: "", summary: "", reason: "", category: "", tags: "", scoreMode: "", score: "", selected: "", silent: "" });
  const [mergeInto, setMergeInto] = useState("");
  const version = c.override?.version ?? 0;
  const base = `/api/admin/content/${encodeURIComponent(a.id)}`;
  const story = c.membership[0];
  const title = p?.title ?? a.title;

  const openOverride = () => {
    const f = (c.override?.fields ?? {}) as Record<string, unknown>;
    setFields({
      title: String(f.title ?? ""),
      summary: String(f.summary ?? ""),
      reason: String(f.reason ?? ""),
      category: String(f.category ?? ""),
      tags: Array.isArray(f.tags) ? (f.tags as string[]).join(", ") : "",
      scoreMode: f.score === null ? "none" : typeof f.score === "number" ? "value" : "",
      score: typeof f.score === "number" ? String(f.score) : "",
      selected: f.selected === undefined ? "" : String(f.selected),
      silent: f.silent === undefined ? "" : String(f.silent),
    });
    setDialog("override");
  };

  return (
    <AdminPage
      title={<span className="line-clamp-2">{title}</span>}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[12px]">{a.id}</span>
          <span>·</span>
          <Link className="hover:text-accent" to={`/admin/sources/${encodeURIComponent(a.source_id)}`}>{a.source_name}</Link>
          <span>·</span>
          <a className="max-w-[420px] truncate hover:text-accent" href={a.url} target="_blank" rel="noreferrer">{a.url}</a>
          {p?.visibility !== "withdrawn" && p && (
            <>
              <span>·</span>
              <a className="text-accent" href={`/items/${a.id}`} target="_blank" rel="noreferrer">Public Page</a>
            </>
          )}
        </span>
      }
      actions={
        <>
          <Button onClick={() => setDialog("visibility")}>Visibility</Button>
          {p && <Button onClick={() => setDialog("seo")}>{p.indexable ? "Unindex" : "Index for SEO"}</Button>}
          <Button onClick={openOverride}>Override</Button>
          <Button onClick={() => { setPresentation(null); setDialog("presentation"); }}>Refresh Layout</Button>
          <Button onClick={() => setDialog("analyze")}>Re-evaluate</Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1.5">
        {p ? <Badge tone={p.visibility === "public" ? "ok" : "warn"}>{VISIBILITY_LABEL[p.visibility] ?? p.visibility}</Badge> : <Badge>Unpublished</Badge>}
        {p?.selected && <Badge tone="accent">Featured</Badge>}
        {p?.eligible === false && <Badge>Not Published</Badge>}
        {a.backfill && <Badge tone="warn">Backfilled</Badge>}
        <Badge>State: {a.processing_state}</Badge>
        {c.override && <Badge tone="info" title={c.override.reason ?? undefined}>Overridden v{c.override.version}</Badge>}
      </div>
      {a.processing_error && <div className="mb-5 rounded-card bg-hot-soft px-4 py-3 text-[13px] text-hot ring-1 ring-hot/20">{a.processing_error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="Processing Pipeline">
          <ol className="pt-1">
            <Step title="Source" meta={`${KIND_LABEL[a.source_kind] ?? a.source_kind} · ${String(a.tier).replace("_", ".")} · ${MODE_LABEL[a.participation_mode] ?? a.participation_mode}`}>
              <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(a.source_id)}`}>{a.source_name}</Link>
              <span className="text-ink-4"> · On-site text: {a.site_fulltext ? "Allowed" : "Disallowed"} · API syndication: {a.syndicate_fulltext ? "Allowed" : "Disallowed"}</span>
            </Step>
            <Step title="Discovery" meta={`${c.discoveries.length}  times`}>
              <ul className="space-y-1">
                {c.discoveries.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num text-ink-4">{bj(d.discovered_at, true)}</span>
                    <span>{d.via}</span>
                    {d.source_id !== a.source_id && <span className="text-ink-3">via {d.source_id}</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-1.5 text-[12px] text-ink-4">
                Original time: {a.published_at ? bj(a.published_at, true) : "Unknown"}{a.published_at_claim && !a.published_at ? ` (claimed:  ${a.published_at_claim}, unverified)` : ""} · Timeline {bj(a.timeline_at, true)}
              </div>
            </Step>
            <Step title="Text & Revisions" meta={`Rev #${a.revision} · Body ${a.body_status} · ${a.body_chars ?? 0}  chars`}>
              {c.revisions.length ? (
                <ul className="space-y-1">
                  {c.revisions.map((r) => (
                    <li key={r.revision} className="flex gap-2">
                      <span className="num text-ink-4">v{r.revision}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <span className="num shrink-0 text-ink-4">{bj(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">Initial revision only</span>
              )}
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setDialog("extract")}>Re-extract Text</Button>
              </div>
            </Step>
            <Step title="Model Evaluation" meta={`${c.analyses.length} runs`} tone={c.analyses.length ? "accent" : "muted"}>
              {c.analyses.length ? (
                <div className="space-y-3">
                  {c.analyses.map((an) => (
                    <div key={an.id} className="rounded-control bg-bg-sunk/60 p-3 ring-1 ring-line">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        <Badge tone={an.relevance === "pass" ? "ok" : "muted"}>{an.relevance}</Badge>
                        {an.selected && <Badge tone="accent">Selected</Badge>}
                        <Badge tone="info">Score {an.score}</Badge>
                        {an.category && <Badge>{CATEGORY_LABELS[an.category as keyof typeof CATEGORY_LABELS] ?? an.category}</Badge>}
                        <span className="text-ink-4">{an.model} · {an.prompt_version} · Input v{an.input_revision} · {an.origin} · {bj(an.created_at)}</span>
                      </div>
                      {an.title_zh && <div className="mt-2 font-medium text-ink">{an.title_zh}</div>}
                      {an.reason_zh && <div className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{an.reason_zh}</div>}
                      {an.receipts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                          {an.receipts.map((r) => (
                            <span key={r.id} className="num rounded-mark bg-surface px-1.5 py-0.5 text-ink-3 ring-1 ring-line">
                              Receipt #{r.id} · {r.status} · {r.model ?? r.service}{r.cost !== null ? ` · ${money(r.cost)}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-ink-4">{a.participation_mode === "editorial" ? "Pending model evaluation (queued or failed)" : "Heat-only source, no editorial evaluation"}</span>
              )}
            </Step>
            <Step title="Publication" tone={p ? (p.visibility === "withdrawn" ? "bad" : "accent") : "muted"} meta={p ? `Updated at ${bj(p.updated_at, true)}` : undefined}>
              {p ? (
                <KV
                  items={[
                    ["Visibility", VISIBILITY_LABEL[p.visibility] ?? p.visibility],
                    ["Featured", p.selected ? `Yes · Visible at ${p.visible_after ? bj(p.visible_after, true) : "Immediately"}` : "No"],
                    ["Category", p.category ? CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category : null],
                    ["Tags", (p.tags as string[] | null)?.join(", ")],
                    ["Summary", p.summary],
                    ["Reason", p.reason],
                    [
                      "Layout Mode",
                      `${p.body_mode}${p.syndicate ? "  · Syndicate Fulltext" : ""}${
                        p.indexable ? (p.seo_indexed_at ? "  · Indexable (manual)" : "  · Indexable (auto-featured)") : p.seo_excluded_at ? "  · Noindex (manual exclude)" : "  · Noindex"
                      }`,
                    ],
                  ]}
                />
              ) : (
                <span className="text-ink-4">No public publication projection (filtered out or processing)</span>
              )}
              {c.override && (
                <div className="mt-3 rounded-control bg-accent-softer p-3 ring-1 ring-accent/15">
                  <div className="text-[12px] text-ink-3">Override v{c.override.version} · {c.override.updated_by} · {bj(c.override.updated_at, true)}{c.override.reason ? ` · ${c.override.reason}` : ""}</div>
                  <Json value={{ visibility: c.override.visibility, ...c.override.fields }} label="Overridden Fields" collapsed={false} />
                </div>
              )}
            </Step>
            <Step title="Featured Sync Ledger" meta={`${c.ledger.length}  items`} tone={c.ledger.length ? "accent" : "muted"}>
              {c.ledger.length ? (
                <ul className="space-y-1">
                  {c.ledger.map((l) => (
                    <li key={l.seq} className="flex gap-2">
                      <span className="num text-ink-4">#{l.seq}</span>
                      <Badge tone={l.op === "remove" ? "warn" : "ok"}>{l.op}</Badge>
                      <span className="num text-ink-4">Visible {bj(l.visible_at)} · Written {bj(l.changed_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">Has not entered featured sync ledger</span>
              )}
            </Step>
            <Step title="Event Grouping" tone={story ? "accent" : "muted"} meta={a.grouped_at ? `Grouped at ${bj(a.grouped_at, true)}` : "Ungrouped"}>
              {c.membership.map((m) => (
                <div key={m.fact_id} className="mb-2">
                  <div>
                    Fact <span className="font-mono text-[12px]">#{m.fact_id}</span> {m.fact_title} <Badge>{m.role}</Badge> {m.manual && <Badge tone="info">Manual</Badge>}
                  </div>
                  {m.story_public_id && (
                    <div className="mt-0.5">
                      Event <a className="text-accent" href={`/story/${m.story_public_id}`} target="_blank" rel="noreferrer">{m.story_title}</a> <span className="font-mono text-[12px] text-ink-4">#{m.story_id}</span>
                    </div>
                  )}
                </div>
              ))}
              {c.decisions.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12.5px]">
                  {c.decisions.map((d, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span className="num text-ink-4">{bj(d.created_at)}</span>
                      <Badge>{d.verdict}</Badge>
                      {d.fact_id && <span>Fact #{d.fact_id}</span>}
                      {d.receipt_id && <span className="text-ink-4">Receipt #{d.receipt_id}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setDialog("group")}>Re-group</Button>
                {c.membership.length > 0 && <Button size="sm" onClick={() => setDialog("detach")}>Detach from Event</Button>}
                {story?.story_id && <Button size="sm" onClick={() => setDialog("merge")}>Merge this event into...</Button>}
              </div>
            </Step>
            <Step title="Deliveries" last meta={`${c.deliveries.length}  items`} tone={c.deliveries.some((d) => d.status === "unknown") ? "bad" : c.deliveries.length ? "accent" : "muted"}>
              {c.deliveries.length ? (
                <ul className="space-y-1">
                  {c.deliveries.map((d, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span>{d.target_key}</span>
                      <Badge tone={d.status === "sent" ? "ok" : d.status === "unknown" ? "bad" : "muted"}>{d.status}</Badge>
                      <span className="num text-ink-4">{bj(d.created_at)}{d.sent_at ? ` → ${bj(d.sent_at)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-4">No delivery logs</span>
              )}
            </Step>
          </ol>
        </Card>

        <div className="space-y-5">
          <Card title="Raw Ingestion Info">
            <KV
              items={[
                ["Original Title", a.title],
                ["Author", a.author],
                ["Language", a.language],
                ["Identity Key", <span className="break-all font-mono text-[11.5px]">{a.identity_key}</span>],
              ]}
            />
          </Card>
          <Card title="Audit History">
            {c.history.length ? (
              <ul className="space-y-3 text-[12.5px]">
                {c.history.map((h, i) => (
                  <li key={i}>
                    <div className="text-ink-2"><span className="font-medium">{h.action}</span> · {h.actor} · {bj(h.created_at)}</div>
                    {h.reason && <div className="text-ink-3">{h.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No manual operations</Empty>
            )}
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={dialog === "seo"}
        title={p?.indexable ? "Remove SEO Indexing" : "Mark Indexable for SEO"}
        description={
          p?.indexable
            ? "Sets page to noindex and removes from sitemap; prevents auto-indexing even if featured until re-marked."
            : "Pages default to noindex; featured items auto-index. Marking sets index, includes in sitemap and IndexNow submissions. Ideal for standalone value with complete body."
        }
        confirmLabel={p?.indexable ? "Unindex" : "Mark Indexable"}
        busy={pending === "seo"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/seo`, { indexed: !p?.indexable, reason }, { label: "seo", success: p?.indexable ? "Unindexed" : "Marked indexable" })) !== null}
      />

      <ReasonDialog
        open={dialog === "visibility"}
        title="Publication Visibility"
        description="Changes affect Web, API, RSS, MCP, sync ledger, and search index. Verify identity for takedown requests."
        danger={visibility === "withdrawn"}
        confirmLabel="Apply"
        busy={pending === "visibility"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/visibility`, { visibility, reason, version }, { label: "visibility", success: "Visibility updated" })) !== null}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["public", "Public", "Normal visibility"],
            ["summary-only", "Summary Only", "No body text, retains title/summary"],
            ["withdrawn", "Withdrawn", "Removed from all channels, returns 404"],
          ] as const).map(([v, label, hint]) => (
            <label key={v} className={`cursor-pointer rounded-card p-3 ring-1 transition-colors ${visibility === v ? "bg-accent-soft ring-accent" : "ring-line-strong hover:bg-bg-sunk"}`}>
              <input type="radio" name="visibility" className="sr-only" checked={visibility === v} onChange={() => setVisibility(v)} />
              <div className="text-[13.5px] font-medium text-ink">{label}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{hint}</div>
            </label>
          ))}
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "override"}
        title="Manual Override"
        description="Manual overrides take precedence over model outputs and are not overwritten by reprocessing. Empty fields are left untouched or cleared."
        confirmLabel="Save Overrides"
        busy={pending === "override"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          const next: Record<string, unknown> = {};
          const clear: string[] = [];
          for (const k of ["title", "summary", "reason"] as const) {
            if (fields[k].trim()) next[k] = fields[k].trim();
            else if (c.override?.fields[k] !== undefined) clear.push(k);
          }
          if (fields.category) next.category = fields.category;
          else if (c.override?.fields.category !== undefined) clear.push("category");
          if (fields.tags.trim()) next.tags = fields.tags.split(/[,\uff0c]/).map((t) => t.trim()).filter(Boolean);
          else if (c.override?.fields.tags !== undefined) clear.push("tags");
          if (fields.scoreMode === "none") next.score = null;
          else if (fields.scoreMode === "value") next.score = Number(fields.score);
          else if (c.override?.fields.score !== undefined) clear.push("score");
          for (const k of ["selected", "silent"] as const) {
            if (fields[k] === "true" || fields[k] === "false") next[k] = fields[k] === "true";
            else if (c.override?.fields[k] !== undefined) clear.push(k);
          }
          return (await run("POST", `${base}/override`, { fields: next, clear, reason, version }, { label: "override", success: "Overrides saved and republished" })) !== null;
        }}
      >
        <Field label="Title"><Input value={fields.title} placeholder={p?.title ?? ""} onChange={(e) => setFields({ ...fields, title: e.target.value })} /></Field>
        <Field label="Summary"><Textarea rows={3} value={fields.summary} placeholder={p?.summary ?? ""} onChange={(e) => setFields({ ...fields, summary: e.target.value })} /></Field>
        <Field label="Reason"><Textarea rows={2} value={fields.reason} placeholder={p?.reason ?? ""} onChange={(e) => setFields({ ...fields, reason: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value })}>
              <option value="">No Override</option>
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
            </Select>
          </Field>
          <Field label="Tags (comma-separated)"><Input value={fields.tags} onChange={(e) => setFields({ ...fields, tags: e.target.value })} /></Field>
          <Field label="Score">
            <Select value={fields.scoreMode} onChange={(e) => setFields({ ...fields, scoreMode: e.target.value })}>
              <option value="">Use Model</option>
              <option value="none">Clear Score</option>
              <option value="value">Manual Score</option>
            </Select>
          </Field>
          {fields.scoreMode === "value" && <Field label="Score (0–100)"><Input type="number" min={0} max={100} step="any" required value={fields.score} onChange={(e) => setFields({ ...fields, score: e.target.value })} /></Field>}
          <Field label="Featured">
            <Select value={fields.selected} onChange={(e) => setFields({ ...fields, selected: e.target.value })}>
              <option value="">Use Model</option>
              <option value="true">Force Select</option>
              <option value="false">Force Reject</option>
            </Select>
          </Field>
          <Field label="Notification">
            <Select value={fields.silent} onChange={(e) => setFields({ ...fields, silent: e.target.value })}>
              <option value="">Normal</option>
              <option value="true">Silent (do not notify)</option>
              <option value="false">Unsilent</option>
            </Select>
          </Field>
        </div>
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "analyze"}
        title="Re-evaluate Current Revision"
        description="Triggers a fresh model evaluation call (billed and logged in receipts)."
        requireReason={false}
        confirmLabel="Re-evaluate"
        busy={pending === "analyze"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "analyze" }, { label: "analyze", success: "Added to evaluation queue" })) !== null}
      />
      <ReasonDialog
        open={dialog === "presentation"}
        title="Refresh Article Presentation"
        description="Checks original page for updated images, links, and layout. Retains existing summary, translation, and event associations if text is unchanged."
        requireReason={false}
        confirmLabel={presentation?.ready && presentation.changed ? "Apply Layout Updates" : "Preview Changes"}
        busy={pending === "presentation"}
        onClose={() => setDialog(null)}
        onSubmit={async () => {
          const apply = presentation?.ready && presentation.changed;
          const result = await run<AdminPresentationRefresh>("POST", `${base}/rerun`,
            { step: "presentation", ...(apply ? { version: presentation.version } : { preview: true }) },
            { label: "presentation", revalidate: !!apply, ...(apply ? { success: "Presentation updated" } : {}) });
          if (!result) { setPresentation(null); return false; }
          setPresentation(result);
          return result.applied;
        }}
      >
        {presentation && <div className="space-y-2 text-[13px] text-ink-2">
          <p>Images: {presentation.images.before} → {presentation.images.after}, Links: {presentation.links.before} → {presentation.links.after}.</p>
          <p>{presentation.reason ?? (presentation.changed ? "Layout update ready to apply." : "Current layout requires no updates.")}</p>
          {presentation.translation === "reused" && <p>Retains existing text while synchronizing images and links.</p>}
        </div>}
      </ReasonDialog>
      <ReasonDialog
        open={dialog === "extract"}
        title="Re-extract Article Body"
        requireReason={false}
        confirmLabel="Re-extract"
        busy={pending === "extract"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "extract" }, { label: "extract", success: "Added to extraction queue" })) !== null}
      />
      <ReasonDialog
        open={dialog === "group"}
        title="Re-run Event Grouping"
        description="Manual event grouping relationships will not be overwritten."
        requireReason={false}
        confirmLabel="Re-group"
        busy={pending === "group"}
        onClose={() => setDialog(null)}
        onSubmit={async () => (await run("POST", `${base}/rerun`, { step: "group" }, { label: "group", success: "Added to grouping queue" })) !== null}
      />
      <ReasonDialog
        open={dialog === "detach"}
        title="Detach from Event"
        description="This item will appear independently; event timeline will update."
        danger
        confirmLabel="Detach"
        busy={pending === "detach"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/detach`, { reason }, { label: "detach", success: "Detached from event" })) !== null}
      />
      <ReasonDialog
        open={dialog === "merge"}
        title="Merge Event"
        description={`Merge event #${story?.story_id} (${story?.story_title ?? ""}) into another event; old link will redirect.`}
        danger
        confirmLabel="Merge"
        busy={pending === "merge"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          if (!/^\d+$/.test(mergeInto.trim())) return false;
          return (await run("POST", "/api/admin/stories/merge", { from: story!.story_id, into: Number(mergeInto), reason }, { label: "merge", success: "Event merged" })) !== null;
        }}
      >
        <Field label="Target Event ID" hint="Find target #ID on diagnostic page of any item in target event">
          <Input inputMode="numeric" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} placeholder="e.g. 1234" />
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
