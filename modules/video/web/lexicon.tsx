// /admin/lexicon: the pronunciation dictionary. Rows are edited here; the enabled ones are
// materialized by the API to industry/lexicon.json, which the voice step reads. Only ASR-verified
// rows should be enabled — enabling more is the channel owner's call.
import { useState } from "react";
import { data, useRevalidator, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { toast } from "../../../apps/web/app/features/admin/toast";
import { AdminPage, Badge, Button, Card, DataTable, Field, Input, Select } from "../../../apps/web/app/features/admin/ui";

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

interface LexiconData {
  csrf: string;
  entries: LexiconRow[];
  total: number;
  stats: { total: number; enabled: number };
  q: string;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const data0 = await adminPageGet<Omit<LexiconData, "q" | "page" | "pageSize">>(
    request,
    `/api/admin/video/lexicon?q=${encodeURIComponent(q)}&page=${page}&pageSize=${PAGE_SIZE}`,
  );
  return data({ ...data0, q, page, pageSize: PAGE_SIZE }, { headers: GRAY_HEADERS });
}

export const headers = () => GRAY_HEADERS;

export const meta = () => [{ title: `Lexicon · ${SITE.name} Admin` }];

/** Commands against the lexicon API (POST/PATCH/DELETE) with the session's CSRF token. */
function useLexiconCommand(csrf: string) {
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, method: string, path: string, body: unknown, done: string) => {
    setBusy(label);
    try {
      const res = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(json?.detail ?? `Request failed (${res.status})`);
      toast(done, "ok");
      revalidator.revalidate();
      return true;
    } catch (error) {
      toast((error as Error).message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}

const CATEGORIES = ["all", "tech", "finance"] as const;

export default function LexiconAdmin({ loaderData }: { loaderData: LexiconData }) {
  const { t } = useTranslation();
  const d = loaderData;
  const { run, busy } = useLexiconCommand(d.csrf);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(d.q);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ term: string; reading: string; category_scope: string; note: string }>({ term: "", reading: "", category_scope: "all", note: "" });
  const [fresh, setFresh] = useState({ term: "", reading: "", category_scope: "all" });

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { preventScrollReset: true });
  };

  const startEdit = (row: LexiconRow) => {
    setEditing(row.id);
    setDraft({ term: row.term, reading: row.reading, category_scope: row.category_scope, note: row.note });
  };

  const saveEdit = async (row: LexiconRow) => {
    if (await run(`save-${row.id}`, "PATCH", `/api/admin/video/lexicon/${row.id}`, draft, t("lexicon.saved"))) setEditing(null);
  };

  const pages = Math.max(1, Math.ceil(d.total / d.pageSize));

  return (
    <AdminPage
      title={t("lexicon.title")}
      subtitle={
        <>
          {t("lexicon.subtitle")} · <b>{d.stats.total}</b> {t("lexicon.total")} · <b className="text-ok">{d.stats.enabled}</b> {t("lexicon.enabledCount")}
        </>
      }
      actions={
        <Button tone="primary" busy={busy === "import"} onClick={() => run("import", "POST", "/api/admin/video/lexicon/import", {}, t("lexicon.importDone"))}>
          {t("lexicon.import")}
        </Button>
      }
    >
      <Card title={t("lexicon.addTitle")} className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("lexicon.term")}>
            <Input value={fresh.term} onChange={(e) => setFresh({ ...fresh, term: e.target.value })} placeholder="callback" />
          </Field>
          <Field label={t("lexicon.reading")}>
            <Input value={fresh.reading} onChange={(e) => setFresh({ ...fresh, reading: e.target.value })} placeholder="hàm gọi lại" />
          </Field>
          <Field label={t("lexicon.category")}>
            <Select value={fresh.category_scope} onChange={(e) => setFresh({ ...fresh, category_scope: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`lexicon.cat.${c}`)}</option>
              ))}
            </Select>
          </Field>
          <Button
            tone="primary"
            busy={busy === "add"}
            disabled={!fresh.term.trim() || !fresh.reading.trim()}
            onClick={async () => {
              if (await run("add", "POST", "/api/admin/video/lexicon", fresh, t("lexicon.added"))) setFresh({ term: "", reading: "", category_scope: "all" });
            }}
          >
            {t("lexicon.add")}
          </Button>
        </div>
      </Card>

      <Card
        title={t("lexicon.title")}
        pad={false}
        right={
          <form
            className="flex items-center gap-2 pr-3"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: search || null, page: null });
            }}
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("lexicon.search")} className="w-56" />
            <Button size="sm" type="submit">{t("lexicon.searchButton")}</Button>
          </form>
        }
      >
        <DataTable
          rows={d.entries}
          rowKey={(r) => r.id}
          empty={t("lexicon.empty")}
          columns={[
            {
              key: "term",
              label: t("lexicon.term"),
              render: (r) =>
                editing === r.id ? (
                  <Input value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} className="w-44" />
                ) : (
                  <span className="font-medium">{r.term}</span>
                ),
            },
            {
              key: "reading",
              label: t("lexicon.reading"),
              render: (r) =>
                editing === r.id ? (
                  <Input value={draft.reading} onChange={(e) => setDraft({ ...draft, reading: e.target.value })} className="w-52" />
                ) : (
                  <span>{r.reading}</span>
                ),
            },
            {
              key: "category_scope",
              label: t("lexicon.category"),
              render: (r) =>
                editing === r.id ? (
                  <Select value={draft.category_scope} onChange={(e) => setDraft({ ...draft, category_scope: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t(`lexicon.cat.${c}`)}</option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone={r.category_scope === "finance" ? "warn" : "muted"}>{t(`lexicon.cat.${r.category_scope}`, { defaultValue: r.category_scope })}</Badge>
                ),
            },
            {
              key: "asr_status",
              label: t("lexicon.asrStatus"),
              render: (r) => (r.asr_status ? <Badge tone="info">{r.asr_status}</Badge> : <span className="text-ink-3">–</span>),
            },
            {
              key: "enabled",
              label: t("lexicon.enabled"),
              render: (r) => (
                <Button
                  size="sm"
                  tone={r.enabled ? "primary" : "ghost"}
                  busy={busy === `toggle-${r.id}`}
                  onClick={() => run(`toggle-${r.id}`, "POST", "/api/admin/video/lexicon/enabled", { ids: [r.id], enabled: !r.enabled }, r.enabled ? t("lexicon.disabledToast") : t("lexicon.enabledToast"))}
                >
                  {r.enabled ? t("lexicon.on") : t("lexicon.off")}
                </Button>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (r) =>
                editing === r.id ? (
                  <span className="flex gap-1.5">
                    <Button size="sm" tone="primary" busy={busy === `save-${r.id}`} onClick={() => saveEdit(r)}>{t("lexicon.save")}</Button>
                    <Button size="sm" onClick={() => setEditing(null)}>{t("lexicon.cancel")}</Button>
                  </span>
                ) : (
                  <span className="flex gap-1.5">
                    <Button size="sm" disabled={r.locked} onClick={() => startEdit(r)}>{t("lexicon.edit")}</Button>
                    <Button
                      size="sm"
                      tone="ghost"
                      disabled={r.locked}
                      busy={busy === `del-${r.id}`}
                      onClick={() => window.confirm(t("lexicon.confirmDelete")) && run(`del-${r.id}`, "DELETE", `/api/admin/video/lexicon/${r.id}`, undefined, t("lexicon.deleted"))}
                    >
                      {t("lexicon.delete")}
                    </Button>
                  </span>
                ),
            },
          ]}
        />
        <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-ink-3">
          <span>
            {t("lexicon.page")} {d.page}/{pages} · {d.total} {t("lexicon.total")}
          </span>
          <span className="flex gap-1.5">
            <Button size="sm" disabled={d.page <= 1} onClick={() => go({ page: String(d.page - 1) })}>←</Button>
            <Button size="sm" disabled={d.page >= pages} onClick={() => go({ page: String(d.page + 1) })}>→</Button>
          </span>
        </div>
      </Card>
    </AdminPage>
  );
}
