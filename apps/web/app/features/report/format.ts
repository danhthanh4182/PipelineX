// Names, dates and grouping for daily, weekly and monthly reports.
import { REPORT_NAMES, type ReportNavigationEntry, type ReportKind } from "@aihot/contracts/site";
import { beijingDate, beijingWeekday, isoWeekLabel, isoWeekRange, monthDay as engineMonthDay } from "@aihot/contracts/time";
import { EDITION_WHEN, REPORTS, SITE, subjectAfter } from "@aihot/site";
import { RELEASE } from "@aihot/industry/taxonomy";
import { monthDay, weekdayShort } from "../../lib/format.ts";

export const KINDS: ReportKind[] = ["daily", "weekly", "monthly"];
export const KIND_PATH: Record<ReportKind, string> = { daily: "/daily", weekly: "/weekly", monthly: "/monthly" };

export function kindFromPath(pathname: string): ReportKind {
  if (pathname.startsWith("/weekly")) return "weekly";
  if (pathname.startsWith("/monthly")) return "monthly";
  return "daily";
}

/** The kind's RSS feed, announced in the page head so a reader given the page finds it. */
export const feedLink = (kind: ReportKind) => ({ tagName: "link", rel: "alternate", type: "application/rss+xml", title: `${SITE.name} ${REPORT_NAMES[kind]}`, href: `/feed/${kind}.xml` }) as const;

export function reportPath(kind: ReportKind, key: string): string {
  return `${KIND_PATH[kind]}/${key}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

const { measure, noun } = REPORTS.entry;
/** "A big thing": what an issue counts its entries in, in the site's words (REPORTS.entry). */
export const ENTRIES_UNIT = `${measure}${noun}`;

/** "4 big AI things this day" / "12 big AI things this week" / "20 big AI things in August" (the subject and REPORTS.entry from site/site.ts). */
export function headline(kind: ReportKind, key: string, count: number): string {
  if (kind === "daily") return `${count} ${measure} of this day`;
  if (kind === "weekly") return `${count} ${measure} of this week`;
  return `${count} ${measure} of Month ${Number(key.slice(5, 7))}`;
}

/** "09.16" for a story inside a week or month. */
export function shortDay(iso: string): string {
  return beijingDate(iso).slice(5).replace("-", ".");
}

export interface ArchiveGroup {
  id: string;
  label: string;
  entries: Array<ReportNavigationEntry & { short: string }>;
}

/**
 * The archive column: days grouped by month, weeks by the month their Monday falls in ("week 2"),
 * months by year. Newest first, as the index comes.
 */
export function archiveGroups(kind: ReportKind, index: ReportNavigationEntry[]): ArchiveGroup[] {
  const groups: ArchiveGroup[] = [];
  const push = (id: string, label: string, e: ReportNavigationEntry & { short: string }) => {
    const g = groups[groups.length - 1];
    if (g && g.id === id) g.entries.push(e);
    else groups.push({ id, label, entries: [e] });
  };
  if (kind === "weekly") {
    const byMonth = new Map<string, string[]>();
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      byMonth.set(m, [...(byMonth.get(m) ?? []), e.key]);
    }
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      const weeks = [...byMonth.get(m)!].sort();
      push(m, `${m.slice(0, 4)}-${m.slice(5)}`, { ...e, short: `W${weeks.indexOf(e.key) + 1}` });
    }
    return groups;
  }
  for (const e of index) {
    if (kind === "daily") push(e.key.slice(0, 7), `${e.key.slice(0, 7)}`, { ...e, short: `Day ${Number(e.key.slice(8, 10))}` });
    else push(e.key.slice(0, 4), `${e.key.slice(0, 4)}`, { ...e, short: `M${Number(e.key.slice(5, 7))}` });
  }
  return groups;
}

/** An issue's mark in the archive column: a large number over a small word (a month's number stands alone). */
export function archiveMark(kind: ReportKind, key: string): { big: string; small: string | null } {
  if (kind === "daily") return { big: key.slice(8, 10), small: weekdayShort(key) };
  if (kind === "weekly") {
    const { start } = isoWeekRange(key)!;
    return { big: key.slice(6), small: `From ${Number(start.slice(5, 7))}.${Number(start.slice(8, 10))}` };
  }
  return { big: key.slice(5, 7), small: null };
}

/** Short chip label for the phone switcher: "Today", "September 26", "Second week of September", "August". */
export function chipLabel(kind: ReportKind, key: string, index: ReportNavigationEntry[], today: string): string {
  if (kind === "daily") return key === today ? "Today" : engineMonthDay(key, today);
  if (kind === "monthly") return `Month ${Number(key.slice(5, 7))}`;
  const group = archiveGroups("weekly", index).find((g) => g.entries.some((e) => e.key === key));
  const entry = group?.entries.find((e) => e.key === key);
  return group && entry ? `M${Number(group.id.slice(5))} ${entry.short}` : key;
}

/**
 * "Issue N": the issue's place in its series as the server counts it over every issue. The navigation
 * index holds only the newest issues, so its length cannot tell.
 */
export function issueNumber(index: ReportNavigationEntry[], key: string): number | null {
  return index.find((e) => e.key === key)?.issueNumber ?? null;
}

/** The masthead's date block: a large figure and two small lines beside it. */
export function dateMark(kind: ReportKind, key: string): { figure: string; top: string; bottom: string } {
  if (kind === "daily") return { figure: key.slice(8, 10), top: `${key.slice(0, 4)}-${key.slice(5, 7)}`, bottom: beijingWeekday(key) };
  if (kind === "weekly") {
    const { start, end } = isoWeekRange(key)!;
    return { figure: key.slice(6), top: `${key.slice(0, 4)} Week ${Number(key.slice(6))}`, bottom: `${start.slice(5).replace("-", ".")} — ${end.slice(5).replace("-", ".")}` };
  }
  return { figure: key.slice(5, 7), top: `${key.slice(0, 4)}`, bottom: `Month ${Number(key.slice(5, 7))}` };
}

/** When each kind comes out, for the masthead (the times are the site's, EDITION_WHEN). */
export const EDITION: Record<ReportKind, string> = { daily: `Published ${EDITION_WHEN.daily}`, weekly: "Published every Monday", monthly: "Published 1st of month" };

/**
 * The masthead's figures, in the order a reader wants them, in the site's words (REPORTS). Releases of the
 * pack's headline launch kind (RELEASE, "a new model" for AI) count only where the pack has one; zero is left out.
 */
const UNITS = REPORTS.metricUnits;
const METRICS: Array<[key: string, unit: string]> = [
  ["totalEvents", ENTRIES_UNIT],
  ["totalStories", ENTRIES_UNIT],
  ["sourcesCount", UNITS.sourcesCount],
  ["firstPartyEvents", UNITS.firstPartyEvents],
  ...(RELEASE ? [["modelsReleased", RELEASE.unit] as [string, string]] : []),
  ["selectedCount", UNITS.selectedCount],
  ["reportsCovered", UNITS.reportsCovered],
];
export function metricItems(metrics: Record<string, number>): Array<{ value: number; unit: string }> {
  return METRICS.filter(([k]) => typeof metrics[k] === "number" && (k !== "modelsReleased" || metrics[k]! > 0)).map(([k, unit]) => ({ value: metrics[k]!, unit }));
}

/** "Previous day · September 25th", "Previous issue · Week 37", "Next issue · July". A day of another year than `now` (Beijing) carries its year. */
export function neighbourLabel(kind: ReportKind, key: string, direction: "prev" | "next", now: number = Date.now()): string {
  if (kind === "daily") return `${direction === "prev" ? "Prev Day" : "Next Day"} · ${monthDay(key, now)}`;
  const which = direction === "prev" ? "Prev Issue" : "Next Issue";
  return kind === "weekly" ? `${which} · Week ${Number(key.slice(6))}` : `${which} · Month ${Number(key.slice(5, 7))}`;
}

const CN = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
/** Page numbers as a Chinese paper prints them: 1 → one, 12 → twelve, 20 → twenty. */
function cnNumber(n: number): string {
  if (n <= 10) return CN[n]!;
  if (n < 20) return String(n);
  return String(n);
}

/** The line above the nameplate: "September 26, 2026 · Saturday", "Week 38, 2026 · 09.14 — 09.20", "August 2026". */
export function dateLine(kind: ReportKind, key: string): string {
  const m = dateMark(kind, key);
  if (kind === "daily") return `${m.top}-${key.slice(8, 10)} · ${m.bottom}`;
  return kind === "weekly" ? `${m.top} · ${m.bottom}` : `${m.top} ${m.bottom}`;
}

/** What each kind is, under its nameplate. */
export const MOTTO: Record<ReportKind, string> = { daily: `${REPORTS.motto} · Daily Highlights`, weekly: `${REPORTS.motto} · Weekly Summary`, monthly: `${REPORTS.motto} · Monthly Review` };

export interface PeriodCell {
  key: string | null;
  /** Hover text: "September 26th · Issue 158". */
  label: string;
  state: "current" | "issue" | "none" | "pad";
}

/**
 * The dot grid beside the date in the masthead: the days of this issue's month (dailies, Monday first),
 * the weeks of its year (weeklies) or the months of its year (monthlies), each marked as this issue,
 * an issue that exists, or none. This issue's own number (`current`) labels it, also when it is older
 * than the navigation.
 */
export function periodGrid(kind: ReportKind, key: string, index: ReportNavigationEntry[], current: number): { title: string; note: string; columns: number; heads: string[] | null; cells: PeriodCell[] } {
  const exists = new Set(index.map((e) => e.key));
  const cell = (k: string, name: string): PeriodCell => {
    const n = k === key ? current : issueNumber(index, k);
    return { key: k, label: n ? `${name} · Issue #${n}` : `${name} · Unpublished`, state: k === key ? "current" : exists.has(k) ? "issue" : "none" };
  };
  const count = (cells: PeriodCell[]) => cells.filter((c) => c.state === "issue" || c.state === "current").length;
  const year = key.slice(0, 4);
  if (kind === "daily") {
    const m = Number(key.slice(5, 7));
    const days = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(Number(year), m - 1, 1)).getUTCDay() + 6) % 7;
    const cells: PeriodCell[] = [
      ...Array.from({ length: lead }, (): PeriodCell => ({ key: null, label: "", state: "pad" })),
      ...Array.from({ length: days }, (_, i) => {
        const day = `${key.slice(0, 7)}-${pad(i + 1)}`;
        return cell(day, monthDay(day));
      }),
    ];
    return { title: `Month ${m}`, note: `${count(cells)} issues`, columns: 7, heads: ["M", "T", "W", "T", "F", "S", "S"], cells };
  }
  if (kind === "weekly") {
    // 28 December always falls in its year's last ISO week.
    const weeks = Number(isoWeekLabel(`${year}-12-28`).slice(6));
    const cells = Array.from({ length: weeks }, (_, i) => {
      const k = `${year}-W${pad(i + 1)}`;
      const { start, end } = isoWeekRange(k)!;
      return cell(k, `Week ${i + 1} (${start.slice(5).replace("-", ".")}—${end.slice(5).replace("-", ".")})`);
    });
    return { title: `${year}`, note: `${count(cells)} issues`, columns: 13, heads: null, cells };
  }
  const cells = Array.from({ length: 12 }, (_, i) => cell(`${year}-${pad(i + 1)}`, `M${i + 1}`));
  return { title: `${year}`, note: `${count(cells)} issues`, columns: 6, heads: null, cells };
}
