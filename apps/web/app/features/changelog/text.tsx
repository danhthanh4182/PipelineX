import { weekdayShort } from "../../lib/format";

/** Release notes carry a little Markdown: **bold** runs. */
export function Inline({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i} className="font-semibold text-ink-2">{part}</b> : part))}</>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateHeading(date: string): { label: string; weekday: string } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { label: `${MONTHS[m - 1] ?? m} ${d}, ${y}`, weekday: weekdayShort(date) };
}
