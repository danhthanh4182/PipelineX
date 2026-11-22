// /admin/voice: the channel's voice configuration — ONE priority list of engine cards (Studio
// "Chuỗi ưu tiên giọng đọc" pattern): every engine carries its chain position, an enable switch
// and its voice picks in one place. The fallback chain is the order of the enabled, in-chain
// engines; the Relay card is marked as its own route. Saved to industry/voice-config.json;
// secrets are referenced by env name only.
import { useState } from "react";
import { data, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { SITE } from "@aihot/site";
import { adminPageGet, GRAY_HEADERS } from "../../../apps/web/app/lib/admin.server";
import { toast } from "../../../apps/web/app/features/admin/toast";
import { AdminPage, Field, Select } from "../../../apps/web/app/features/admin/ui";

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
const DEFAULT_CHAIN = ["vieneu", "relay", "piper"];

/* Studio tokens (design system v3, 2026-11-23) applied to this page's content section. */
const GOLD_BTN = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#F4A040] px-4 py-2 text-[13px] font-semibold text-[#221503] transition hover:bg-[#E88F33] disabled:cursor-not-allowed disabled:opacity-50";
const GOLD_BTN_SM = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#F4A040] px-2 py-1 text-[12px] font-semibold text-[#221503] transition hover:bg-[#E88F33] disabled:cursor-not-allowed disabled:opacity-50";
const NAVY_BTN = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#30428A] bg-[#0B1435] px-3 py-2 text-[13px] font-medium text-[#FFF3E0] transition hover:border-[#F4A040] disabled:cursor-not-allowed disabled:opacity-45";
const NAVY_BTN_SM = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#30428A] bg-[#0B1435] px-2 py-1 text-[12px] font-medium text-[#FFF3E0] transition hover:border-[#F4A040] disabled:cursor-not-allowed disabled:opacity-45";
const CHIP = "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-1 text-[12px] font-medium leading-none";
const CHIP_NEUTRAL = `${CHIP} border-[#5A6B96] bg-[rgba(120,140,190,0.14)] text-[#C9D2E8]`;
const CHIP_WAITING = `${CHIP} border-[#A8742C] bg-[rgba(244,160,64,0.14)] text-[#FFD28A]`;
const CHIP_INFO = `${CHIP} border-[#3D6FB4] bg-[rgba(80,140,230,0.14)] text-[#9CC8FF]`;
const CHIP_GOLD = `${CHIP} border-[#E88F33] bg-[rgba(244,160,64,0.14)] text-[#F4A040]`;
const CHIP_SCOPE = `${CHIP} border-[#30428A] bg-[#131F4F] text-[#FFF3E0]`;

/** The Studio switch: green while the engine is on, navy track while it is off, always labelled. */
function EngineSwitch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="group inline-flex items-center gap-2">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#22C55E]" : "bg-[#263678] group-hover:bg-[#30428A]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className={`text-[13px] ${on ? "text-[#7EE2A0]" : "text-white/60"}`}>{label}</span>
    </button>
  );
}

export default function VoiceAdmin({ loaderData }: { loaderData: VoiceData }) {
  const { t } = useTranslation();
  const { catalog } = loaderData;
  const revalidator = useRevalidator();
  const [config, setConfig] = useState<VoiceConfig>(() => structuredClone(loaderData.config));
  const [busy, setBusy] = useState(false);
  const [dragName, setDragName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const known = (name: string) => Boolean(catalog[name] && config.engines[name]);
  const chain = config.chain.filter(known);
  const chainSet = new Set(chain);
  const rest = ENGINE_ORDER.filter((name) => known(name) && !chainSet.has(name));
  const extra = Object.keys(config.engines).filter((name) => known(name) && !chainSet.has(name) && !ENGINE_ORDER.includes(name));
  const ordered = [...chain, ...rest.filter((n) => config.engines[n]!.enabled), ...extra.filter((n) => config.engines[n]!.enabled),
    ...rest.filter((n) => !config.engines[n]!.enabled), ...extra.filter((n) => !config.engines[n]!.enabled)];

  const setEngine = (name: string, patch: Partial<VoiceEngineConfig>) =>
    setConfig((c) => ({ ...c, engines: { ...c.engines, [name]: { ...c.engines[name], ...patch } } }));

  /** Turning an engine off also takes it out of the chain (the backend rejects a disabled
   *  chain member); turning it on never adds it — that stays an explicit choice per engine. */
  const toggleEngine = (name: string, on: boolean) =>
    setConfig((c) => {
      if (!on && c.chain.includes(name) && c.chain.length <= 1) return c;
      return {
        ...c,
        chain: on ? c.chain : c.chain.filter((x) => x !== name),
        engines: { ...c.engines, [name]: { ...c.engines[name], enabled: on } },
      };
    });

  const move = (name: string, delta: number) =>
    setConfig((c) => {
      const next = [...c.chain];
      const index = next.indexOf(name);
      const other = index + delta;
      if (index < 0 || other < 0 || other >= next.length) return c;
      [next[index], next[other]] = [next[other]!, next[index]!];
      return { ...c, chain: next };
    });

  const dropOn = (target: string) => {
    if (!dragName || dragName === target) return;
    setConfig((c) => {
      const from = c.chain.indexOf(dragName);
      const to = c.chain.indexOf(target);
      if (from < 0 || to < 0) return c;
      const next = [...c.chain];
      next.splice(from, 1);
      next.splice(to, 0, dragName);
      return { ...c, chain: next };
    });
    setDragName(null);
    setDragOver(null);
  };

  const restoreDefault = () =>
    setConfig((c) => {
      const next = DEFAULT_CHAIN.filter((name) => c.engines[name]?.enabled && catalog[name]);
      return next.length ? { ...c, chain: next } : c;
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
      const json = (await res.json().catch(() => null)) as { detail?: string; config?: VoiceConfig } | null;
      if (!res.ok) throw new Error(json?.detail ?? `Request failed (${res.status})`);
      // Adopt exactly what the server stored, so the page can never drift from the file.
      if (json?.config) setConfig(structuredClone(json.config));
      toast(t("voice.saved"), "ok");
      revalidator.revalidate();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title={t("voice.title")}
      subtitle={t("voice.subtitle")}
      actions={
        <>
          <button type="button" className={NAVY_BTN} onClick={restoreDefault}>
            ↻ {t("voice.restoreDefault")}
          </button>
          <button type="button" className={GOLD_BTN} disabled={busy} onClick={save}>
            {t("voice.save")}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-[#263678] bg-[#0C1538] p-4">
        <h2 className="text-[16px] font-semibold text-white">{t("voice.priorityTitle")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">{t("voice.priorityHint")}</p>
        {config.sample_sentence && (
          <p className="mt-3 text-[12.5px] text-white/60">
            {t("voice.sample")}: <i className="text-[#FFF3E0]">{config.sample_sentence}</i>
          </p>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {ordered.map((name) => {
          const meta = catalog[name]!;
          const engine = config.engines[name]!;
          const inChain = chainSet.has(name);
          const position = inChain ? chain.indexOf(name) + 1 : 0;
          const description = meta.voices.find((option) => option.id === engine.voice)?.description;
          return (
            <div
              key={name}
              draggable={inChain}
              onDragStart={() => setDragName(name)}
              onDragEnd={() => { setDragName(null); setDragOver(null); }}
              onDragOver={(e) => { if (inChain && dragName) { e.preventDefault(); setDragOver(name); } }}
              onDrop={(e) => { e.preventDefault(); dropOn(name); }}
              className={`rounded-xl border bg-[#0C1538] p-4 transition ${dragOver === name && dragName !== name ? "border-[#F4A040]" : "border-[#263678] hover:border-[#30428A]"} ${engine.enabled ? "" : "opacity-75"}`}
            >
              <div className="flex gap-3">
                <div className="flex w-8 shrink-0 flex-col items-center gap-1.5">
                  <span aria-hidden title={t("voice.drag")} className={`select-none text-[15px] leading-none ${inChain ? "cursor-grab text-white/40" : "text-white/15"}`}>⠿</span>
                  {inChain && (
                    <>
                      <button type="button" className={NAVY_BTN_SM} disabled={position === 1} onClick={() => move(name, -1)} aria-label={t("voice.up")}>↑</button>
                      <button type="button" className={NAVY_BTN_SM} disabled={position === chain.length} onClick={() => move(name, 1)} aria-label={t("voice.down")}>↓</button>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {inChain ? (
                      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#F4A040]">{t("voice.priority", { n: position })}</span>
                    ) : engine.enabled ? (
                      <span className={CHIP_WAITING}>{t("voice.notInChain")}</span>
                    ) : (
                      <span className={CHIP_NEUTRAL}>{t("voice.disabled")}</span>
                    )}
                    <span className="text-[14px] font-semibold text-white">{meta.name}</span>
                    <span className={meta.role === "Chính" ? CHIP_GOLD : CHIP_NEUTRAL}>{meta.role}</span>
                    <span className={CHIP_SCOPE}>{meta.kind === "package" ? t("voice.kindPackage") : t("voice.kindApi")}</span>
                    {name === "relay" && <span className={CHIP_GOLD}>{t("voice.relayRoute")}</span>}
                    <span className="ml-auto">
                      <EngineSwitch on={engine.enabled} label={engine.enabled ? t("voice.enabled") : t("voice.disabled")} onClick={() => toggleEngine(name, !engine.enabled)} />
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">{meta.note}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Field label={t("voice.voice")}>
                      <Select className="bg-[#0B1435]" value={engine.voice} onChange={(e) => setEngine(name, { voice: e.target.value })}>
                        {meta.voices.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("voice.previewVoice")}>
                      <Select className="bg-[#0B1435]" value={engine.preview_voice ?? engine.voice} onChange={(e) => setEngine(name, { preview_voice: e.target.value })}>
                        {meta.voices.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  {description && <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">{description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#263678] pt-3">
                    {inChain ? (
                      <button
                        type="button"
                        className={NAVY_BTN_SM}
                        disabled={chain.length <= 1}
                        onClick={() => setConfig((c) => ({ ...c, chain: c.chain.filter((x) => x !== name) }))}
                      >
                        {t("voice.removeFromChain")}
                      </button>
                    ) : engine.enabled ? (
                      <button
                        type="button"
                        className={GOLD_BTN_SM}
                        onClick={() => setConfig((c) => ({ ...c, chain: [...c.chain, name] }))}
                      >
                        {t("voice.addToChain")}
                      </button>
                    ) : (
                      <span className="text-[12px] text-white/45">{t("voice.enableToAdd")}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AdminPage>
  );
}
