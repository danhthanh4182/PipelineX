// /admin/voice: the channel's voice configuration — the engine cards (package engines on this
// machine, API engines by model call), each with its voice, and the fallback chain the voice step
// walks per beat. Saved to industry/voice-config.json; secrets are referenced by env name only.
import { useState } from "react";
import { data, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { toast } from "../../../apps/web/app/features/admin/toast";
import { AdminPage, Badge, Button, Card, Field, Select } from "../../../apps/web/app/features/admin/ui";

interface VoiceOption { id: string; label: string; description: string }
interface EngineMeta { name: string; kind: "package" | "api"; role: string; note: string; voices: VoiceOption[] }
interface VoiceEngineConfig { kind: "package" | "api"; enabled: boolean; voice: string; preview_voice?: string; [key: string]: unknown }
interface VoiceConfig { chain: string[]; engines: Record<string, VoiceEngineConfig>; sample_sentence?: string }
interface VoiceData { csrf: string; config: VoiceConfig; catalog: Record<string, EngineMeta>; exists: boolean }

export async function loader({ request }: { request: Request }) {
  const payload = await adminPageGet<VoiceData>(request, "/api/admin/video/voice-config");
  return data(payload, { headers: GRAY_HEADERS });
}

export const headers = () => GRAY_HEADERS;

export const meta = () => [{ title: `Voice · ${SITE.name} Admin` }];

const ENGINE_ORDER = ["vieneu", "relay", "nvidia", "piper", "azure", "edge"];

export default function VoiceAdmin({ loaderData }: { loaderData: VoiceData }) {
  const { t } = useTranslation();
  const { catalog } = loaderData;
  const revalidator = useRevalidator();
  const [config, setConfig] = useState<VoiceConfig>(() => structuredClone(loaderData.config));
  const [busy, setBusy] = useState(false);
  const [addPick, setAddPick] = useState("");

  const setEngine = (name: string, patch: Partial<VoiceEngineConfig>) =>
    setConfig((c) => ({ ...c, engines: { ...c.engines, [name]: { ...c.engines[name], ...patch } } }));

  const move = (index: number, delta: number) =>
    setConfig((c) => {
      const chain = [...c.chain];
      const other = index + delta;
      if (other < 0 || other >= chain.length) return c;
      [chain[index], chain[other]] = [chain[other]!, chain[index]!];
      return { ...c, chain };
    });

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/video/voice-config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": loaderData.csrf },
        body: JSON.stringify(config),
      });
      const json = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(json?.detail ?? `Request failed (${res.status})`);
      toast(t("voice.saved"), "ok");
      revalidator.revalidate();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const addable = ENGINE_ORDER.filter((name) => config.engines[name]?.enabled && !config.chain.includes(name));

  return (
    <AdminPage
      title={t("voice.title")}
      subtitle={t("voice.subtitle")}
      actions={
        <Button tone="primary" busy={busy} onClick={save}>
          {t("voice.save")}
        </Button>
      }
    >
      <Card title={t("voice.chain")} className="mb-5">
        <p className="mb-3 text-[12.5px] text-ink-3">{t("voice.chainHint")}</p>
        <ol className="space-y-1.5">
          {config.chain.map((name, i) => (
            <li key={name} className="flex items-center gap-2">
              <Badge tone="accent">{i + 1}</Badge>
              <span className="min-w-0 flex-1 font-medium">{catalog[name]?.name ?? name}</span>
              <Button size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("voice.up")}>↑</Button>
              <Button size="sm" disabled={i === config.chain.length - 1} onClick={() => move(i, 1)} aria-label={t("voice.down")}>↓</Button>
              <Button
                size="sm"
                tone="ghost"
                disabled={config.chain.length <= 1}
                onClick={() => setConfig((c) => ({ ...c, chain: c.chain.filter((x) => x !== name) }))}
              >
                {t("voice.removeFromChain")}
              </Button>
            </li>
          ))}
        </ol>
        {addable.length > 0 && (
          <div className="mt-3 flex items-end gap-2">
            <Field label={t("voice.addEngine")}>
              <Select value={addPick} onChange={(e) => setAddPick(e.target.value)}>
                <option value="">—</option>
                {addable.map((name) => (
                  <option key={name} value={name}>{catalog[name]?.name ?? name}</option>
                ))}
              </Select>
            </Field>
            <Button
              size="sm"
              disabled={!addPick}
              onClick={() => {
                setConfig((c) => ({ ...c, chain: [...c.chain, addPick] }));
                setAddPick("");
              }}
            >
              {t("voice.addToChain")}
            </Button>
          </div>
        )}
        {config.sample_sentence && (
          <p className="mt-3 text-[12.5px] text-ink-3">
            {t("voice.sample")}: <i>{config.sample_sentence}</i>
          </p>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {ENGINE_ORDER.filter((name) => catalog[name]).map((name) => {
          const meta = catalog[name]!;
          const engine = config.engines[name];
          if (!engine) return null;
          return (
            <Card
              key={name}
              title={
                <>
                  {meta.name}{" "}
                  <Badge tone={meta.kind === "package" ? "info" : "warn"}>{meta.kind === "package" ? t("voice.kindPackage") : t("voice.kindApi")}</Badge>{" "}
                  <Badge tone="muted">{meta.role}</Badge>
                </>
              }
              right={
                <Button size="sm" tone={engine.enabled ? "primary" : "ghost"} onClick={() => setEngine(name, { enabled: !engine.enabled })}>
                  {engine.enabled ? t("voice.enabled") : t("voice.disabled")}
                </Button>
              }
            >
              <p className="mb-3 text-[12.5px] text-ink-3">{meta.note}</p>
              <div className="flex flex-wrap gap-3">
                <Field label={t("voice.voice")}>
                  <Select value={engine.voice} onChange={(e) => setEngine(name, { voice: e.target.value })}>
                    {meta.voices.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("voice.previewVoice")}>
                  <Select value={engine.preview_voice ?? engine.voice} onChange={(e) => setEngine(name, { preview_voice: e.target.value })}>
                    {meta.voices.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {meta.voices.find((option) => option.id === engine.voice)?.description && (
                <p className="mt-2 text-[12.5px] text-ink-3">{meta.voices.find((option) => option.id === engine.voice)?.description}</p>
              )}
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
