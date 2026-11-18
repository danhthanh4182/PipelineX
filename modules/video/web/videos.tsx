// /admin/videos: the stories picked for videos, the videos made from them, and one video's player, script,
// picture credits and log. Commands (make, retry from a step, approve, reject) post to /api/admin/video/*.
import { useEffect, useState } from "react";
import { data, Link, useRevalidator, useSearchParams } from "react-router";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { ago, num } from "../../../apps/web/app/features/admin/format";
import { toast } from "../../../apps/web/app/features/admin/toast";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Select } from "../../../apps/web/app/features/admin/ui";

type Step = "story" | "background" | "dossier" | "script" | "verify" | "assets" | "voice" | "render" | "thumbnail" | "short" | "shortvoice" | "shortrender";
type Status = "queued" | "running" | "ready" | "failed" | "approved" | "rejected";

interface Video {
  id: number;
  story_id: number | null;
  title: string;
  status: Status;
  step: Step | null;
  error: string | null;
  result: Record<string, Record<string, unknown>>;
  cost: string;
  duration_s: string | null;
  created_by: string;
  created_at: string;
  finished_at: string | null;
  updated_at: string;
}

interface Candidate {
  id: number;
  story_id: number;
  title: string;
  heat: string;
  sources: number;
  status: string;
  created_at: string;
  video_id: number | null;
  video_status: Status | null;
}

interface Overview {
  csrf: string;
  auto: boolean;
  modelCalls: boolean;
  steps: Step[];
  candidates: Candidate[];
  videos: Video[];
}

interface Detail {
  video: Video;
  dossier: null | {
    angle: string;
    summary: string;
    facts: number;
    quotes: number;
    conflicts: Array<{ topic: string; versions: Array<{ claim: string; sources: number[] }> }>;
    openQuestions: string[];
  };
  verify: null | {
    summary: Record<string, number>;
    flagged: Array<{ id: string; text: string; verdict: string; note: string }>;
  };
  script: null | {
    title: string;
    description: string;
    sources: Array<{ n: number; name: string; url: string; title: string }>;
    scenes: Array<{ kind: string; kicker: string; headline: string; beats: Array<{ narration: string; visual: string; detail: string }> }>;
  };
  credits: string[];
  log: string;
  hasVideo: boolean;
  history: Array<{ at: string; actor: string; kind: "edit" | "review" | "remake" | "create"; detail: Record<string, any>; note?: string }>;
  hasShort: boolean;
  hasThumbnail: boolean;
  short: null | {
    title: string;
    narration: string[];
    verify: null | { summary: Record<string, number>; flagged: Array<{ id: string; text: string; verdict: string; note: string }> };
  };
}

export async function loader({ request }: { request: Request }) {
  const id = new URL(request.url).searchParams.get("id");
  const [overview, detail] = await Promise.all([
    adminPageGet<Overview>(request, "/api/admin/video/overview"),
    id && /^\d+$/.test(id) ? adminPageGet<Detail>(request, `/api/admin/video/videos/${id}`) : Promise.resolve(null),
  ]);
  return data({ overview, detail }, { headers: GRAY_HEADERS });
}

export const headers = () => GRAY_HEADERS;

export const meta = () => [{ title: `Videos · ${SITE.name} Admin` }];

const STEP_LABEL: Record<Step, string> = { thumbnail: "Thumbnail", short: "Short script", shortvoice: "Short voice", shortrender: "Short render", story: "Story", background: "Background", dossier: "Research", script: "Script", verify: "Fact-check", assets: "Pictures", voice: "Voice", render: "Render" };
const STATUS: Record<Status, { label: string; tone: "ok" | "warn" | "bad" | "muted" | "accent" | "info" }> = {
  queued: { label: "Queued", tone: "muted" },
  running: { label: "Making", tone: "accent" },
  ready: { label: "To review", tone: "warn" },
  failed: { label: "Failed", tone: "bad" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "muted" },
};

const StatusBadge = ({ v }: { v: Pick<Video, "status" | "step"> }) => (
  <Badge tone={STATUS[v.status].tone}>
    {STATUS[v.status].label}
    {(v.status === "running" || v.status === "failed") && v.step ? ` · ${STEP_LABEL[v.step]}` : ""}
  </Badge>
);

const minutes = (s: string | null) => (s ? `${Math.floor(Number(s) / 60)}:${String(Math.round(Number(s) % 60)).padStart(2, "0")}` : "–");
const usd = (s: string) => `$${Number(s).toFixed(3)}`;

/** Posts a command with the session's CSRF token; reloads the page's data when it succeeds. */
function useCommand(csrf: string) {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, path: string, body: unknown, done: string) => {
    setBusy(label);
    try {
      const res = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as { detail?: string; video?: Video } | null;
      if (!res.ok) throw new Error(json?.detail ?? `Request failed (${res.status})`);
      toast(done, "ok");
      revalidator.revalidate();
      return json?.video ?? null;
    } catch (error) {
      toast((error as Error).message, "error");
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}

export default function VideosAdmin({ loaderData }: { loaderData: { overview: Overview; detail: Detail | null } }) {
  const { overview: o, detail } = loaderData;
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const { run, busy } = useCommand(o.csrf);
  const working = o.videos.some((v) => v.status === "queued" || v.status === "running");

  // While a video is being made, refresh every 8 s (only when the tab is visible).
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => document.visibilityState === "visible" && revalidator.state === "idle" && revalidator.revalidate(), 8000);
    return () => clearInterval(t);
  }, [working, revalidator]);

  const open = (id: number) => setParams({ id: String(id) }, { preventScrollReset: true });
  const make = async (storyId: number) => {
    const video = await run(`make-${storyId}`, "/api/admin/video/videos", { storyId }, "Video queued");
    if (video) open(video.id);
  };

  return (
    <AdminPage
      title="Videos"
      subtitle={
        <>
          One video per story: background → research → script → fact-check → pictures → voice → render, then thumbnail and a vertical Short. Daily automatic video:{" "}
          <b className={o.auto ? "text-ok" : "text-ink-2"}>{o.auto ? "on" : "off"}</b> (VIDEO_AUTO_ENABLED)
          {!o.modelCalls && <span className="text-hot"> · MODEL_CALLS_ENABLED is off: videos cannot be made</span>}
        </>
      }
    >
      {detail && <VideoDetail d={detail} steps={o.steps} run={run} busy={busy} close={() => setParams({}, { preventScrollReset: true })} />}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Videos" right={<span className="text-[12.5px] text-ink-3">{o.videos.length} latest</span>} pad={false}>
          <DataTable
            rows={o.videos}
            rowKey={(v) => v.id}
            onRowClick={(v) => open(v.id)}
            empty="No videos yet. Pick a story on the right and press Make video."
            columns={[
              { key: "id", label: "#", render: (v) => <span className="tabular-nums text-ink-3">{v.id}</span> },
              { key: "title", label: "Story", render: (v) => <span className={`line-clamp-2 ${Number(params.get("id")) === v.id ? "font-semibold text-ink" : ""}`}>{v.title}</span> },
              { key: "status", label: "Status", render: (v) => <StatusBadge v={v} /> },
              { key: "len", label: "Length", align: "right", render: (v) => <span className="tabular-nums">{minutes(v.duration_s)}</span> },
              { key: "cost", label: "Cost", align: "right", render: (v) => <span className="tabular-nums">{usd(v.cost)}</span> },
              { key: "at", label: "Made", render: (v) => <span className="text-ink-3">{ago(v.created_at)}{v.created_by === "auto" ? " · auto" : ""}</span> },
            ]}
          />
        </Card>

        <Card title="Candidate stories" right={<span className="text-[12.5px] text-ink-3">hot stories with 3+ sources</span>} pad={false}>
          <DataTable
            rows={o.candidates}
            rowKey={(c) => c.id}
            empty="No candidates yet: a story needs reports from 3 or more sources and heat in the last 48 hours."
            columns={[
              { key: "title", label: "Story", render: (c) => <span className="line-clamp-2">{c.title}</span> },
              { key: "src", label: "Sources", align: "right", render: (c) => <span className="tabular-nums">{c.sources}</span> },
              { key: "heat", label: "Heat", align: "right", render: (c) => <span className="tabular-nums">{num(c.heat)}</span> },
              {
                key: "act", label: "",
                render: (c) => c.video_id ? (
                  <button type="button" className="text-[12.5px] text-accent hover:underline" onClick={() => open(c.video_id!)}>
                    Video #{c.video_id} · {STATUS[c.video_status!].label}
                  </button>
                ) : (
                  <Button size="sm" tone="primary" busy={busy === `make-${c.story_id}`} disabled={!o.modelCalls} onClick={() => make(c.story_id)}>Make video</Button>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </AdminPage>
  );
}

function VideoDetail({ d, steps, run, busy, close }: {
  d: Detail;
  steps: Step[];
  run: (label: string, path: string, body: unknown, done: string) => Promise<Video | null>;
  busy: string | null;
  close: () => void;
}) {
  const v = d.video;
  const [from, setFrom] = useState<Step>(v.step ?? "script");
  useEffect(() => setFrom(v.step ?? "script"), [v.id, v.step]);
  const done = v.status !== "queued" && v.status !== "running";
  const reached = v.step ? steps.indexOf(v.step) : steps.length;
  const review = (status: "approved" | "rejected" | "ready", text: string) => run(`review-${status}`, `/api/admin/video/videos/${v.id}/review`, { status }, text);

  return (
    <Card
      className="mb-5"
      title={<span className="flex min-w-0 items-center gap-2"><span className="text-ink-3">#{v.id}</span><span className="truncate">{d.script?.title ?? v.title}</span></span>}
      right={<button type="button" onClick={close} className="text-[13px] text-ink-3 hover:text-ink">Close ✕</button>}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {d.hasVideo ? (
            <video key={v.updated_at} controls preload="metadata" className="aspect-video w-full rounded-control bg-black"
              poster={d.hasThumbnail ? `/api/admin/video/videos/${v.id}/thumbnail.jpg?v=${encodeURIComponent(v.updated_at)}` : undefined}
              src={`/api/admin/video/videos/${v.id}/video.mp4?v=${encodeURIComponent(v.updated_at)}`} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-control bg-bg-sunk text-[13.5px] text-ink-3">
              {done ? "No rendered video" : `Making the video: ${v.step ? STEP_LABEL[v.step] : "waiting in the queue"}…`}
            </div>
          )}
          {d.script?.description && <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{d.script.description}</p>}
          {(d.hasVideo || d.hasThumbnail || d.hasShort) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
              {d.hasVideo && <a className="rounded-control px-2.5 py-1 ring-1 ring-line hover:bg-bg-sunk" href={`/api/admin/video/videos/${v.id}/video.mp4?download=pipelinex-${v.id}.mp4`}>Download video</a>}
              {d.hasThumbnail && <a className="rounded-control px-2.5 py-1 ring-1 ring-line hover:bg-bg-sunk" href={`/api/admin/video/videos/${v.id}/thumbnail.jpg?download=pipelinex-${v.id}-thumbnail.jpg`}>Download thumbnail</a>}
              {d.hasShort && <a className="rounded-control px-2.5 py-1 ring-1 ring-line hover:bg-bg-sunk" href={`/api/admin/video/videos/${v.id}/short.mp4?download=pipelinex-${v.id}-short.mp4`}>Download Short</a>}
            </div>
          )}
          {(d.hasThumbnail || d.hasShort || d.short) && (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {d.hasThumbnail && (
                <figure className="w-[260px]">
                  <img alt="Thumbnail" className="aspect-video w-full rounded-control object-cover ring-1 ring-line" src={`/api/admin/video/videos/${v.id}/thumbnail.jpg?v=${encodeURIComponent(v.updated_at)}`} />
                  <figcaption className="mt-1 text-[12px] text-ink-3">Thumbnail · 1280×720</figcaption>
                </figure>
              )}
              {(d.hasShort || d.short) && (
                <figure className="w-[170px]">
                  {d.hasShort ? (
                    <video key={`short-${v.updated_at}`} controls preload="metadata" className="aspect-[9/16] w-full rounded-control bg-black"
                      src={`/api/admin/video/videos/${v.id}/short.mp4?v=${encodeURIComponent(v.updated_at)}`} />
                  ) : <div className="flex aspect-[9/16] w-full items-center justify-center rounded-control bg-bg-sunk text-[12px] text-ink-3">Short not rendered</div>}
                  <figcaption className="mt-1 text-[12px] text-ink-3">
                    Short{d.short?.verify ? ` · ${d.short.verify.summary.supported ?? 0}/${d.short.verify.summary.sentences ?? 0} supported` : ""}
                  </figcaption>
                </figure>
              )}
              {d.short && (
                <div className="min-w-[220px] flex-1 text-[12.5px] leading-relaxed text-ink-3">
                  <div className="mb-1 font-medium text-ink-2">{d.short.title}</div>
                  <p>{d.short.narration.join(" ")}</p>
                  {d.short.verify?.flagged.map((c) => (
                    <div key={c.id} className="mt-1"><Badge tone={c.verdict === "unsupported" ? "bad" : "warn"}>{c.verdict === "unsupported" ? "Unsupported" : "Partly"}</Badge> {c.text} {c.note && <span>→ {c.note}</span>}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge v={v} />
            <span className="text-[12.5px] text-ink-3">{minutes(v.duration_s)} · {usd(v.cost)} · started {ago(v.created_at)}</span>
          </div>

          <ol className="flex flex-wrap gap-1.5 text-[12px]">
            {steps.map((s, i) => {
              const state = v.status === "failed" && v.step === s ? "bad" : i < reached || (!v.step && done) ? "ok" : v.step === s && v.status === "running" ? "accent" : "muted";
              return <li key={s}><Badge tone={state}>{i + 1}. {STEP_LABEL[s]}</Badge></li>;
            })}
          </ol>

          {v.error && <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-control bg-hot-soft p-3 text-[12px] text-hot">{v.error}</pre>}

          <div className="flex flex-wrap items-center gap-2">
            {(v.status === "ready" || v.status === "rejected") && d.hasVideo && (
              <Button tone="primary" busy={busy === "review-approved"} onClick={() => review("approved", "Approved")}>Approve</Button>
            )}
            {(v.status === "ready" || v.status === "approved") && (
              <Button busy={busy === "review-rejected"} onClick={() => review("rejected", "Rejected")}>Reject</Button>
            )}
            {done && (
              <span className="flex items-center gap-1.5">
                <Select value={from} onChange={(e) => setFrom(e.target.value as Step)} aria-label="Make again from step">
                  {steps.map((s) => <option key={s} value={s}>from {STEP_LABEL[s]}</option>)}
                </Select>
                <Button busy={busy === "retry"} onClick={() => run("retry", `/api/admin/video/videos/${v.id}/retry`, { from }, "Queued again")}>Make again</Button>
              </span>
            )}
          </div>
          <p className="text-[12px] leading-relaxed text-ink-4">
            "From Pictures" keeps the script and finds new pictures; "from Script" writes a new script from the same research (about $0.02).
          </p>

          {d.script && d.script.sources.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Sources</h3>
              <ul className="space-y-1 text-[12.5px]">
                {d.script.sources.map((s) => (
                  <li key={s.n} className="truncate"><span className="text-ink-3">[{s.n}] {s.name}:</span> <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.title}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {d.verify && (
        <div className="mt-5 rounded-control p-3 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-ink-2">Fact-check</span>
            <Badge tone="ok">{d.verify.summary.supported ?? 0} supported</Badge>
            {(d.verify.summary.partial ?? 0) > 0 && <Badge tone="warn">{d.verify.summary.partial} partly</Badge>}
            {(d.verify.summary.unsupported ?? 0) > 0 && <Badge tone="bad">{d.verify.summary.unsupported} unsupported</Badge>}
            <span className="text-[12px] text-ink-4">of {d.verify.summary.sentences} sentences, checked against the reports' full text</span>
          </div>
          {d.verify.flagged.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {d.verify.flagged.map((c) => (
                <li key={c.id} className="text-[13px] leading-relaxed">
                  <Badge tone={c.verdict === "unsupported" ? "bad" : "warn"}>{c.verdict === "unsupported" ? "Unsupported" : "Partly"}</Badge>{" "}
                  <span className="text-ink-2">{c.text}</span>
                  {c.note && <div className="pl-1 text-[12px] text-ink-3">→ {c.note}</div>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12.5px] text-ink-3">No sentence was flagged. The checker is a model too: spot-check names and numbers.</p>}
        </div>
      )}

      {d.dossier && (
        <details className="mt-3 rounded-control ring-1 ring-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2">
            Research · {d.dossier.facts} facts, {d.dossier.quotes} quotes, {d.dossier.conflicts.length} points where reports differ
          </summary>
          <div className="space-y-3 border-t border-line p-3 text-[13px] leading-relaxed">
            <p className="text-ink-2"><b>Angle:</b> {d.dossier.angle}</p>
            {d.video.result.background && (
              <p className="text-[12.5px] text-ink-3">
                <b className="text-ink-2">Background (TinyFish):</b>{" "}
                {d.video.result.background.skipped ? String(d.video.result.background.skipped)
                  : `${d.video.result.background.added ?? 0} page(s) added from ${d.video.result.background.searched ?? 0} searches on trusted sites; ${d.video.result.background.filled ?? 0} short report(s) filled with full text`}
              </p>
            )}
            <p className="text-ink-3">{d.dossier.summary}</p>
            {d.dossier.conflicts.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-ink-2">Reports differ on</div>
                <ul className="space-y-1.5">
                  {d.dossier.conflicts.map((c, i) => (
                    <li key={i}><span className="text-ink-2">{c.topic}:</span> <span className="text-ink-3">{c.versions.map((v) => `${v.claim} [${v.sources.join(", ")}]`).join(" · ")}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {d.dossier.openQuestions.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-ink-2">Open questions</div>
                <ul className="list-disc space-y-1 pl-5 text-ink-3">{d.dossier.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
          </div>
        </details>
      )}

      {d.script && (
        <details className="mt-3 rounded-control ring-1 ring-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2">Script · {d.script.scenes.reduce((n, s) => n + s.beats.length, 0)} beats</summary>
          <div className="space-y-4 border-t border-line p-3">
            {d.script.scenes.map((s, i) => (
              <div key={i}>
                <div className="mb-1 text-[11.5px] font-semibold tracking-[0.12em] text-accent">{s.kicker} · {s.headline}</div>
                {s.beats.map((b, j) => (
                  <div key={j} className="flex gap-3 py-1 text-[13px] leading-relaxed">
                    <span className="w-28 shrink-0 text-[11.5px] text-ink-3" title={b.detail}>{b.visual}{b.detail ? `: ${b.detail}` : ""}</span>
                    <span className="text-ink-2">{b.narration}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {d.credits.length > 0 && (
        <details className="mt-3 rounded-control ring-1 ring-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2">Picture credits · {d.credits.length}</summary>
          <ul className="space-y-1 border-t border-line p-3 text-[12px] text-ink-3">{d.credits.map((c) => <li key={c} className="break-all">{c}</li>)}</ul>
        </details>
      )}

      {d.history.length > 0 && (
        <details className="mt-3 rounded-control ring-1 ring-line" open>
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2">Edit history · {d.history.length}</summary>
          <ul className="space-y-2 border-t border-line p-3 text-[12.5px] leading-relaxed">
            {[...d.history].reverse().map((h, i) => (
              <li key={i}>
                <span className="text-ink-4">{ago(h.at)} · {h.actor} · </span>
                <b className="text-ink-2">{h.kind === "create" ? "started this video" : h.kind === "edit" ? (h.detail.visual ? "changed a picture" : `edited the ${h.detail.variant === "short" ? "Short" : "script"}`) : h.kind === "remake" ? `made again from ${h.detail.from}` : `marked ${h.detail.verdict}`}</b>
                {h.note && <span className="text-ink-3"> — {h.note}</span>}
                {h.kind === "edit" && (h.detail.beats ?? []).map((b: any, j: number) => (
                  <div key={j} className="mt-1 pl-3 text-ink-3">
                    <div className="line-through decoration-hot/60">{b.before}</div>
                    <div className="text-ink-2">{b.after}</div>
                  </div>
                ))}
                {h.kind === "edit" && h.detail.visual && (
                  <div className="mt-1 pl-3 text-ink-3">beat ({h.detail.visual.scene},{h.detail.visual.beat}): {h.detail.visual.before?.type}{h.detail.visual.before?.query ? ` "${h.detail.visual.before.query}"` : ""} → <span className="text-ink-2">{h.detail.visual.after?.type}{h.detail.visual.after?.query ? ` "${h.detail.visual.after.query}"` : ""}</span></div>
                )}
                {h.kind === "edit" && ["title", "description", "thumbnailText"].filter((k) => h.detail[k]).map((k) => (
                  <div key={k} className="mt-1 pl-3 text-ink-3">{k}: <span className="line-through">{String(h.detail[k].before ?? "")}</span> → <span className="text-ink-2">{String(h.detail[k].after)}</span></div>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}

      {d.log && (
        <details className="mt-3 rounded-control ring-1 ring-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink-2">Log</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-line p-3 text-[11.5px] text-ink-3">{d.log}</pre>
        </details>
      )}
      {!d.script && done && v.status !== "failed" && <Empty>No script yet.</Empty>}
      <div className="mt-3 text-right text-[12px]"><Link to="/admin/videos" className="text-ink-4 hover:text-ink-2">All videos</Link></div>
    </Card>
  );
}
