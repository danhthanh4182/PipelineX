// /admin/lexicon — "Từ điển đọc": the pronunciation dictionary. Rows are edited here; the enabled
// ones are materialized by the API to industry/lexicon.json, which the voice step reads. The page
// mirrors the Studio's dictionary panel (same flows, same rules), styled with the Studio design
// tokens (2026-11-22 package) in this page's content section only: navy-dark #0B1435 ground,
// brand navy #131F4F cards, gold #F4A040 / gold-deep #E88F33 as the one accent, pill chips, and
// the Studio switch. Rules carried over from the Studio: locked rows are never touched by bulk
// operations; enabling a row that has not passed ASR verification always goes through its own
// confirmation; the ASR button only queues a row for the TTS -> ASR loop, it never enables it.
import { useMemo, useRef, useState } from "react";
import { data, useRevalidator, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { toast } from "../../../apps/web/app/features/admin/toast";
import { AdminPage, Button, Card, Field, Input, Select } from "../../../apps/web/app/features/admin/ui";

interface LexiconRow {
  id: number;
  term: string;
  reading: string;
  scope: string;
  category_scope: string;
  enabled: boolean;
  locked: boolean;
  asr_status: string;
  note: string;
  created_at: string;
  updated_at: string;
}

interface LexiconFilters {
  q: string;
  scope: string;
  category_scope: string;
  enabled: string;
  asr: string;
  locked: string;
}

interface LexiconData {
  csrf: string;
  entries: LexiconRow[];
  total: number;
  stats: { total: number; enabled: number };
  filters: LexiconFilters;
}

interface PreviewRow {
  line: number;
  term: string;
  reading: string;
  scope: string;
  category_scope: string;
  note: string;
  enabled?: boolean;
  asr_status?: string;
  status: "new" | "duplicate" | "error";
  error?: string;
  existingId?: number;
}

interface Preview {
  format: string;
  rows: PreviewRow[];
  counts: { total: number; fresh: number; duplicate: number; error: number };
}

const PAGE_SIZE = 1000;
const SCOPES = ["all", "relay", "selfhost"] as const;
const CATEGORIES = ["all", "tech", "finance"] as const;

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const filters: LexiconFilters = {
    q: url.searchParams.get("q") ?? "",
    scope: url.searchParams.get("scope") ?? "",
    category_scope: url.searchParams.get("cat") ?? "",
    enabled: url.searchParams.get("enabled") ?? "",
    asr: url.searchParams.get("asr") ?? "",
    locked: url.searchParams.get("locked") ?? "",
  };
  const params = new URLSearchParams({ page: "1", pageSize: String(PAGE_SIZE) });
  if (filters.q) params.set("q", filters.q);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.category_scope) params.set("category_scope", filters.category_scope);
  if (filters.enabled) params.set("enabled", filters.enabled);
  if (filters.asr) params.set("asr", filters.asr);
  if (filters.locked) params.set("locked", filters.locked);
  const data0 = await adminPageGet<Omit<LexiconData, "filters">>(request, `/api/admin/video/lexicon?${params.toString()}`);
  return data({ ...data0, filters }, { headers: GRAY_HEADERS });
}

export const headers = () => GRAY_HEADERS;

export const meta = () => [{ title: `Từ điển đọc · ${SITE.name} Admin` }];

/** Commands against the lexicon API with the session's CSRF token; resolves with the JSON body. */
function useLexiconApi(csrf: string) {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<string | null>(null);
  const call = async <T,>(label: string, method: string, path: string, body?: unknown): Promise<T | null> => {
    setBusy(label);
    try {
      const res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as ({ detail?: string } & T) | null;
      if (!res.ok) throw new Error(json?.detail ?? `Request failed (${res.status})`);
      return json as T;
    } catch (error) {
      toast((error as Error).message, "error");
      return null;
    } finally {
      setBusy(null);
    }
  };
  const run = async (label: string, method: string, path: string, body: unknown, done: string) => {
    const json = await call(label, method, path, body);
    if (json !== null) {
      toast(done, "ok");
      revalidator.revalidate();
      return true;
    }
    return false;
  };
  return { call, run, busy, revalidate: () => revalidator.revalidate() };
}

/* Studio tokens (design package 2026-11-22) applied to this page's content section. */
const GOLD_BTN = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#F4A040] px-4 py-2 text-[13px] font-semibold text-[#221503] transition hover:bg-[#E88F33] disabled:cursor-not-allowed disabled:opacity-50";
const NAVY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#30428A] bg-[#0B1435] px-3 py-2 text-[13px] font-medium text-[#FFF3E0] transition hover:border-[#F4A040] disabled:cursor-not-allowed disabled:opacity-45";
const NAVY_BTN_SM = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#30428A] bg-[#0B1435] px-2 py-1 text-[12px] font-medium text-[#FFF3E0] transition hover:border-[#F4A040] disabled:cursor-not-allowed disabled:opacity-45";
const CHIP = "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-1 text-[12px] font-medium leading-none";

function ScopeChip({ scope }: { scope: string }) {
  const { t } = useTranslation();
  return <span className={`${CHIP} border-[#30428A] bg-[#131F4F] text-[#FFF3E0]`}>{t(`lexicon.scopeName.${scope}`, { defaultValue: scope })}</span>;
}

function AsrChip({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "passed") return <span className={`${CHIP} border-[#2E7D4F] bg-[rgba(46,125,79,0.18)] text-[#7EE2A0]`}>{t("lexicon.asrBadgePassed")}</span>;
  if (status === "failed") return <span className={`${CHIP} border-[#B03A50] bg-[rgba(255,64,92,0.14)] text-[#FF9DB0]`}>{t("lexicon.asrBadgeFailed")}</span>;
  if (status === "queued") return <span className={`${CHIP} border-[#A8742C] bg-[rgba(244,160,64,0.14)] text-[#FFD28A]`}>{t("lexicon.asrBadgeQueued")}</span>;
  if (status === "running") return <span className={`${CHIP} border-[#A8742C] bg-[rgba(244,160,64,0.14)] text-[#FFD28A]`}>{t("lexicon.asrBadgeRunning")}</span>;
  return <span className={`${CHIP} border-[#5A6B96] bg-[rgba(120,140,190,0.14)] text-[#C9D2E8]`}>{t("lexicon.asrBadgeNone")}</span>;
}

/** The Studio switch: green while the reading applies, navy track while it does not. */
function ApplySwitch({ on, disabled, busy, onClick, label }: { on: boolean; disabled?: boolean; busy?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || busy}
      onClick={onClick}
      className="group inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#22C55E]" : "bg-[#263678] group-hover:bg-[#30428A]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className={`text-[13px] ${on ? "text-[#7EE2A0]" : "text-white/60"}`}>{label}</span>
    </button>
  );
}

export default function LexiconAdmin({ loaderData }: { loaderData: LexiconData }) {
  const { t } = useTranslation();
  const d = loaderData;
  const f = d.filters;
  const { call, run, busy, revalidate } = useLexiconApi(d.csrf);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(f.q);
  const [selected, setSelected] = useState<number[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ term: "", reading: "", scope: "all", category_scope: "all", note: "" });
  const [fresh, setFresh] = useState({ term: "", reading: "", scope: "all", category_scope: "all" });
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [dupMode, setDupMode] = useState<"skip" | "overwrite">("skip");
  const [batchState, setBatchState] = useState<"keep" | "on" | "off">("keep");
  const fileRef = useRef<HTMLInputElement>(null);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { preventScrollReset: true });
  };

  const byId = useMemo(() => new Map(d.entries.map((r) => [r.id, r])), [d.entries]);
  const selectedRows = selected.map((id) => byId.get(id)).filter((r): r is LexiconRow => !!r);
  const visibleIds = d.entries.map((r) => r.id);

  /** Enabling rows that never passed ASR is the owner's explicit call: confirm first (Studio rule). */
  const confirmEnable = (rows: LexiconRow[]): boolean => {
    const unverified = rows.filter((r) => !r.enabled && r.asr_status !== "passed");
    if (!unverified.length) return true;
    return window.confirm(t("lexicon.confirmEnableUnverified", { count: unverified.length }));
  };

  const bulkEnabled = async (ids: number[], enabled: boolean) => {
    if (!ids.length) return;
    if (enabled && !confirmEnable(ids.map((id) => byId.get(id)).filter((r): r is LexiconRow => !!r))) return;
    const res = await call<{ updated: number; skippedLocked: number; enabledUnverified: number }>("bulk-enabled", "POST", "/api/admin/video/lexicon/enabled", { ids, enabled });
    if (res) {
      toast(t("lexicon.bulkDone", { count: res.updated }) + (res.skippedLocked ? ` · ${t("lexicon.bulkSkippedLocked", { count: res.skippedLocked })}` : ""), "ok");
      setSelected([]);
      revalidate();
    }
  };

  const bulkLocked = async (ids: number[], locked: boolean) => {
    if (!ids.length) return;
    const res = await call<{ updated: number }>("bulk-locked", "POST", "/api/admin/video/lexicon/locked", { ids, locked });
    if (res) {
      toast(t("lexicon.bulkDone", { count: res.updated }), "ok");
      setSelected([]);
      revalidate();
    }
  };

  const bulkAsr = async (ids: number[]) => {
    if (!ids.length) return;
    const res = await call<{ queued: number; skippedLocked: number; skippedBusy: number }>("bulk-asr", "POST", "/api/admin/video/lexicon/asr-queue", { ids });
    if (res) {
      const extra = [
        res.skippedBusy ? t("lexicon.asrBusyNote", { count: res.skippedBusy }) : "",
        res.skippedLocked ? t("lexicon.bulkSkippedLocked", { count: res.skippedLocked }) : "",
      ].filter(Boolean).join(" · ");
      toast(t("lexicon.asrDone", { count: res.queued }) + (extra ? ` · ${extra}` : ""), "ok");
      setSelected([]);
      revalidate();
    }
  };

  const toggleRow = async (row: LexiconRow) => {
    if (!row.enabled && row.asr_status !== "passed" && !window.confirm(t("lexicon.confirmEnableOne"))) return;
    await bulkEnabled([row.id], !row.enabled);
  };

  const startEdit = (row: LexiconRow) => {
    setEditing(row.id);
    setDraft({ term: row.term, reading: row.reading, scope: row.scope, category_scope: row.category_scope, note: row.note });
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setPreviewName(file.name);
    const res = await call<Preview>("import-preview", "POST", "/api/admin/video/lexicon/import/preview", { name: file.name, text });
    if (res) setPreview(res);
  };

  const applyImport = async () => {
    if (!preview) return;
    const entries = preview.rows
      .filter((r) => r.status !== "error")
      .map((r) => ({ term: r.term, reading: r.reading, scope: r.scope, category_scope: r.category_scope, note: r.note, enabled: r.enabled, asr_status: r.asr_status }));
    const res = await call<{ result: { inserted: number; overwritten: number; skipped: number; skippedLocked: number; invalid: number } }>(
      "import-apply", "POST", "/api/admin/video/lexicon/import/apply",
      { entries, onDuplicate: dupMode, batchEnabled: batchState === "keep" ? null : batchState === "on" },
    );
    if (res) {
      toast(t("lexicon.importDoneCounts", { inserted: res.result.inserted, overwritten: res.result.overwritten, skipped: res.result.skipped + res.result.skippedLocked + res.result.invalid }), "ok");
      setPreview(null);
      setImportOpen(false);
      setSelected([]);
      revalidate();
    }
  };

  const groups = useMemo(() => {
    if (!groupBy) return [{ key: "", label: "", rows: d.entries }];
    const labelOf = (r: LexiconRow): string => {
      if (groupBy === "scope") return t(`lexicon.scopeName.${r.scope}`, { defaultValue: r.scope });
      if (groupBy === "category_scope") return t(`lexicon.cat.${r.category_scope}`, { defaultValue: r.category_scope });
      if (groupBy === "asr_status") {
        if (r.asr_status === "passed") return t("lexicon.asrBadgePassed");
        if (r.asr_status === "failed") return t("lexicon.asrBadgeFailed");
        if (r.asr_status === "queued") return t("lexicon.asrBadgeQueued");
        if (r.asr_status === "running") return t("lexicon.asrBadgeRunning");
        return t("lexicon.asrBadgeNone");
      }
      if (groupBy === "enabled") return r.enabled ? t("lexicon.enabledOn") : t("lexicon.enabledOff");
      return r.locked ? t("lexicon.lockedYes") : t("lexicon.lockedNo");
    };
    const buckets = new Map<string, LexiconRow[]>();
    for (const r of d.entries) {
      const key = labelOf(r);
      buckets.set(key, [...(buckets.get(key) ?? []), r]);
    }
    return [...buckets.entries()].map(([label, rows]) => ({ key: label, label, rows }));
  }, [d.entries, groupBy, t]);

  const filterSelect = (label: string, value: string, param: string, options: Array<[string, string]>) => (
    <Field label={label}>
      <Select value={value} onChange={(e) => go({ [param]: e.target.value || null })} className="bg-[#0B1435]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </Select>
    </Field>
  );

  const renderRow = (r: LexiconRow) => {
    const isEditing = editing === r.id;
    return (
      <div key={r.id} className="rounded-xl border border-[#263678] bg-[#0C1538] p-4 transition hover:border-[#30428A]">
        <div className="flex flex-wrap items-start gap-3">
          <input
            type="checkbox"
            aria-label={r.term}
            checked={selected.includes(r.id)}
            onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id))}
            className="mt-1 h-4 w-4 shrink-0 accent-[#F4A040]"
          />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t("lexicon.term")}>
                  <Input value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} className="w-44 bg-[#0B1435]" />
                </Field>
                <Field label={t("lexicon.reading")}>
                  <Input value={draft.reading} onChange={(e) => setDraft({ ...draft, reading: e.target.value })} className="w-56 bg-[#0B1435]" />
                </Field>
                <Field label={t("lexicon.scope")}>
                  <Select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} className="bg-[#0B1435]">
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>{t(`lexicon.scopeName.${s}`)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("lexicon.category")}>
                  <Select value={draft.category_scope} onChange={(e) => setDraft({ ...draft, category_scope: e.target.value })} className="bg-[#0B1435]">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t(`lexicon.cat.${c}`)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("lexicon.note")}>
                  <Input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="w-64 bg-[#0B1435]" />
                </Field>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-white">{r.term}</span>
                  <span className="text-white/60">→ {t("lexicon.readAs")} <span className="font-medium text-white">{r.reading}</span></span>
                  <ScopeChip scope={r.scope} />
                  <span className={`${CHIP} border-[#30428A] bg-transparent text-white/75`}>{t(`lexicon.cat.${r.category_scope}`, { defaultValue: r.category_scope })}</span>
                  {r.enabled
                    ? <span className={`${CHIP} border-[#2E7D4F] bg-[rgba(46,125,79,0.18)] text-[#7EE2A0]`}>{t("lexicon.enabledOn")}</span>
                    : <span className={`${CHIP} border-[#5A6B96] bg-[rgba(120,140,190,0.14)] text-[#C9D2E8]`}>{t("lexicon.enabledOff")}</span>}
                  <AsrChip status={r.asr_status} />
                  {r.locked && <span className={`${CHIP} border-[#E88F33] bg-[#F4A040]/10 text-[#F4A040]`}>{t("lexicon.lockedBadge")}</span>}
                </div>
                {r.note && <p className="mt-2 text-[13px] leading-relaxed text-white/60">{r.note}</p>}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#263678] pt-3">
          {isEditing ? (
            <>
              <button type="button" className={GOLD_BTN} disabled={busy === `save-${r.id}`}
                onClick={async () => { if (await run(`save-${r.id}`, "PATCH", `/api/admin/video/lexicon/${r.id}`, draft, t("lexicon.saved"))) setEditing(null); }}>
                {t("lexicon.save")}
              </button>
              <button type="button" className={NAVY_BTN} onClick={() => setEditing(null)}>{t("lexicon.cancel")}</button>
            </>
          ) : (
            <>
              <ApplySwitch on={r.enabled} disabled={r.locked} busy={busy === "bulk-enabled"} onClick={() => toggleRow(r)} label={t("lexicon.applyReading")} />
              <span className="mx-1 h-5 w-px bg-[#263678]" />
              <button type="button" className={NAVY_BTN_SM} disabled={busy === "bulk-locked"}
                onClick={() => bulkLocked([r.id], !r.locked)}>
                {r.locked ? t("lexicon.unlock") : t("lexicon.lock")}
              </button>
              {r.asr_status === "queued" || r.asr_status === "running" ? (
                <button type="button" className={NAVY_BTN_SM} disabled>{t("lexicon.asrQueuedState")}</button>
              ) : (
                <button type="button" className={NAVY_BTN_SM} disabled={r.locked || busy === "bulk-asr"} onClick={() => bulkAsr([r.id])}>
                  {t("lexicon.asrQueue")}
                </button>
              )}
              <span className="flex-1" />
              <button type="button" className={NAVY_BTN_SM} disabled={r.locked} onClick={() => startEdit(r)}>{t("lexicon.edit")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={r.locked || busy === `del-${r.id}`}
                onClick={() => window.confirm(t("lexicon.confirmDelete")) && run(`del-${r.id}`, "DELETE", `/api/admin/video/lexicon/${r.id}`, undefined, t("lexicon.deleted"))}>
                {t("lexicon.delete")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminPage
      title={t("lexicon.title")}
      subtitle={
        <>
          {t("lexicon.subtitle")} · <b>{d.stats.total}</b> {t("lexicon.total")} · <b className="text-ok">{d.stats.enabled}</b> {t("lexicon.enabledCount")}
        </>
      }
      actions={
        <>
          <button type="button" className={GOLD_BTN} onClick={() => setImportOpen(!importOpen)}>{t("lexicon.importBulk")}</button>
          <a className={NAVY_BTN} href="/api/admin/video/lexicon/export?format=json" download>{t("lexicon.exportJson")}</a>
          <a className={NAVY_BTN} href="/api/admin/video/lexicon/export?format=csv" download>{t("lexicon.exportCsv")}</a>
          <Button busy={busy === "import-file"} onClick={() => run("import-file", "POST", "/api/admin/video/lexicon/import", {}, t("lexicon.importDone"))}>
            {t("lexicon.import")}
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-[#263678] bg-[#0B1435] p-4 sm:p-6">
        <p className="mb-6 max-w-[1100px] text-[13px] leading-relaxed text-white/60">{t("lexicon.intro")}</p>

        {importOpen && (
          <Card title={t("lexicon.importTitle")} className="mb-6 border-[#263678] bg-[#131F4F]">
            <p className="mb-3 text-[13px] leading-relaxed text-white/60">{t("lexicon.importHint")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept=".json,.csv,.txt" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
              <button type="button" className={GOLD_BTN} disabled={busy === "import-preview"} onClick={() => fileRef.current?.click()}>
                {t("lexicon.importChooseFile")}
              </button>
              {previewName && <span className="text-[13px] text-[#FFF3E0]">{previewName}</span>}
            </div>
            {preview && (
              <div className="mt-4 space-y-3">
                <p className="text-[14px] font-semibold text-white">
                  {t("lexicon.importPreviewCounts", { fresh: preview.counts.fresh, duplicate: preview.counts.duplicate, error: preview.counts.error, total: preview.counts.total })}
                </p>
                {preview.rows.some((r) => r.status === "error") && (
                  <div className="rounded-lg border border-[#B03A50] bg-[rgba(255,64,92,0.14)] p-3">
                    <p className="mb-2 text-[13px] font-semibold text-[#FF9DB0]">{t("lexicon.importErrorsTitle")}</p>
                    <ul className="max-h-40 space-y-1 overflow-auto text-[13px] text-[#FF9DB0]">
                      {preview.rows.filter((r) => r.status === "error").map((r) => (
                        <li key={r.line}>{t("lexicon.importLine", { line: r.line })}: <b>{r.term || "—"}</b> — {r.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.rows.some((r) => r.status === "duplicate") && (
                  <details className="rounded-lg border border-[#263678] bg-[#0B1435] p-3">
                    <summary className="cursor-pointer text-[13px] font-medium text-[#FFF3E0]">{t("lexicon.importDupTitle")} ({preview.counts.duplicate})</summary>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/60">{preview.rows.filter((r) => r.status === "duplicate").map((r) => r.term).join(", ")}</p>
                  </details>
                )}
                <div className="flex flex-wrap items-end gap-4">
                  <Field label={t("lexicon.importDupLabel")}>
                    <Select value={dupMode} onChange={(e) => setDupMode(e.target.value as "skip" | "overwrite")} className="bg-[#0B1435]">
                      <option value="skip">{t("lexicon.importDupSkip")}</option>
                      <option value="overwrite">{t("lexicon.importDupOverwrite")}</option>
                    </Select>
                  </Field>
                  <Field label={t("lexicon.importBatchLabel")}>
                    <Select value={batchState} onChange={(e) => setBatchState(e.target.value as "keep" | "on" | "off")} className="bg-[#0B1435]">
                      <option value="keep">{t("lexicon.importBatchKeep")}</option>
                      <option value="on">{t("lexicon.importBatchOn")}</option>
                      <option value="off">{t("lexicon.importBatchOff")}</option>
                    </Select>
                  </Field>
                  <button type="button" className={GOLD_BTN} disabled={busy === "import-apply" || preview.counts.fresh + preview.counts.duplicate === 0} onClick={applyImport}>
                    {t("lexicon.importConfirm")}
                  </button>
                  <button type="button" className={NAVY_BTN} onClick={() => setPreview(null)}>{t("lexicon.importCancel")}</button>
                </div>
              </div>
            )}
          </Card>
        )}

        <Card title={t("lexicon.addTitle")} className="mb-6 border-[#263678] bg-[#131F4F]">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("lexicon.term")}>
              <Input value={fresh.term} onChange={(e) => setFresh({ ...fresh, term: e.target.value })} placeholder="callback" className="bg-[#0B1435]" />
            </Field>
            <Field label={t("lexicon.reading")}>
              <Input value={fresh.reading} onChange={(e) => setFresh({ ...fresh, reading: e.target.value })} placeholder="hàm gọi lại" className="bg-[#0B1435]" />
            </Field>
            <Field label={t("lexicon.scope")}>
              <Select value={fresh.scope} onChange={(e) => setFresh({ ...fresh, scope: e.target.value })} className="bg-[#0B1435]">
                {SCOPES.map((s) => (
                  <option key={s} value={s}>{t(`lexicon.scopeName.${s}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("lexicon.category")}>
              <Select value={fresh.category_scope} onChange={(e) => setFresh({ ...fresh, category_scope: e.target.value })} className="bg-[#0B1435]">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`lexicon.cat.${c}`)}</option>
                ))}
              </Select>
            </Field>
            <button
              type="button"
              className={GOLD_BTN}
              disabled={!fresh.term.trim() || !fresh.reading.trim() || busy === "add"}
              onClick={async () => { if (await run("add", "POST", "/api/admin/video/lexicon", fresh, t("lexicon.added"))) setFresh({ term: "", reading: "", scope: "all", category_scope: "all" }); }}
            >
              {t("lexicon.add")}
            </button>
          </div>
        </Card>

        <Card title={t("lexicon.title")} pad={false} className="border-[#263678] bg-[#131F4F]">
          <form
            className="flex flex-wrap items-end gap-3 border-b border-[#263678] p-4"
            onSubmit={(e) => { e.preventDefault(); go({ q: search || null }); }}
          >
            <Field label={t("lexicon.searchButton")}>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("lexicon.search")} className="w-64 bg-[#0B1435]" />
            </Field>
            {filterSelect(t("lexicon.scope"), f.scope, "scope", [["", t("lexicon.scopeAll")], ...SCOPES.map((s) => [s, t(`lexicon.scopeName.${s}`)] as [string, string])])}
            {filterSelect(t("lexicon.category"), f.category_scope, "cat", [["", t("lexicon.catAll")], ...CATEGORIES.map((c) => [c, t(`lexicon.cat.${c}`)] as [string, string])])}
            {filterSelect(t("lexicon.enabledFilter"), f.enabled, "enabled", [["", t("lexicon.enabledAll")], ["true", t("lexicon.enabledOn")], ["false", t("lexicon.enabledOff")]])}
            {filterSelect(t("lexicon.asrFilter"), f.asr, "asr", [["", t("lexicon.asrAll")], ["none", t("lexicon.asrBadgeNone")], ["queued", t("lexicon.asrBadgeQueued")], ["running", t("lexicon.asrBadgeRunning")], ["passed", t("lexicon.asrBadgePassed")], ["failed", t("lexicon.asrBadgeFailed")]])}
            {filterSelect(t("lexicon.lockedFilter"), f.locked, "locked", [["", t("lexicon.lockedAll")], ["true", t("lexicon.lockedYes")], ["false", t("lexicon.lockedNo")]])}
            <Field label={t("lexicon.groupBy")}>
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="bg-[#0B1435]">
                <option value="">{t("lexicon.groupNone")}</option>
                <option value="scope">{t("lexicon.scope")}</option>
                <option value="category_scope">{t("lexicon.category")}</option>
                <option value="asr_status">{t("lexicon.asrFilter")}</option>
                <option value="enabled">{t("lexicon.enabledFilter")}</option>
                <option value="locked">{t("lexicon.lockedFilter")}</option>
              </Select>
            </Field>
            <Button type="submit" tone="primary">{t("lexicon.searchButton")}</Button>
          </form>

          <div className="border-b border-[#263678] px-4 py-3">
            <p className="mb-3 text-[12px] text-white/60">{t("lexicon.showing", { shown: d.entries.length, total: d.total })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] font-medium text-[#FFF3E0]">{t("lexicon.selected", { count: selectedRows.length })}</span>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length || busy === "bulk-enabled"} onClick={() => bulkEnabled(selected, true)}>{t("lexicon.bulkEnable")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length || busy === "bulk-enabled"} onClick={() => bulkEnabled(selected, false)}>{t("lexicon.bulkDisable")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length || busy === "bulk-locked"} onClick={() => bulkLocked(selected, true)}>{t("lexicon.bulkLock")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length || busy === "bulk-locked"} onClick={() => bulkLocked(selected, false)}>{t("lexicon.bulkUnlock")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length || busy === "bulk-asr"} onClick={() => bulkAsr(selected)}>{t("lexicon.bulkAsr")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!selectedRows.length} onClick={() => setSelected([])}>{t("lexicon.clearSelection")}</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className={NAVY_BTN_SM} disabled={!visibleIds.length} onClick={() => setSelected(visibleIds)}>{t("lexicon.selectAllVisible")}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!visibleIds.length || busy === "bulk-enabled"} onClick={() => bulkEnabled(visibleIds, true)}>{t("lexicon.enableAllVisible", { count: visibleIds.length })}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!visibleIds.length || busy === "bulk-enabled"} onClick={() => bulkEnabled(visibleIds, false)}>{t("lexicon.disableAllVisible", { count: visibleIds.length })}</button>
              <button type="button" className={NAVY_BTN_SM} disabled={!visibleIds.length || busy === "bulk-asr"} onClick={() => bulkAsr(visibleIds)}>{t("lexicon.asrAllVisible", { count: visibleIds.length })}</button>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#263678] bg-[#0C1538] px-4 py-2.5">
            <input
              type="checkbox"
              aria-label={t("lexicon.selectAllVisible")}
              checked={visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id))}
              onChange={(e) => setSelected(e.target.checked ? visibleIds : [])}
              className="h-4 w-4 shrink-0 accent-[#F4A040]"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">{t("lexicon.columnHeader")}</span>
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">{t("lexicon.actions")}</span>
          </div>

          <div className="space-y-6 overflow-y-auto p-4" style={{ maxHeight: "70vh", scrollbarGutter: "stable" }}>
            {d.entries.length === 0 && <p className="py-6 text-center text-[13px] text-white/60">{t("lexicon.emptyFiltered")}</p>}
            {groups.map((g) => (
              <div key={g.key || "all"}>
                {g.label && (
                  <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#F4A040]">
                    {g.label} <span className="text-white/50">({g.rows.length})</span>
                  </h3>
                )}
                <div className="space-y-3">{g.rows.map(renderRow)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminPage>
  );
}
