// The word mark (Điểm Tin Công Nghệ: mark + name) and ring mark of the site: Use Wordmark to draw the site name on the page (size is the height, the unit is pixels), RingMark is a small mark, and it is a loading animation when turned around.
// Use the site name for typing here; if you have your own logo, replace Wordmark with your SVG (keep the same parameters).
import { SITE } from "../site.ts";
import logoLockup from "./logo-diem-tin-cong-nghe-master.png";

/** The channel's mark (brand/mark.svg): two gold signal bars and a dot on a navy disc. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <circle cx="80" cy="80" r="80" fill="#13204F" />
      <path d="M52 44v72M108 44v72" stroke="#F49F40" strokeWidth="10" strokeLinecap="round" />
      <circle cx="80" cy="80" r="13" fill="#F49F40" />
      <path d="M52 62h56M52 98h56" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

export function Wordmark({ size = 24, className = "", title = SITE.name }: { size?: number; className?: string; title?: string }) {
  // The brand lockup is one official image (mark + name in gold, transparent background): the header
  // shows the brand exactly once — never the image plus a second, HTML-rendered name beside it.
  return (
    <span className={`inline-flex items-center leading-none ${className}`} aria-label={title} role="img">
      <img src={logoLockup} alt="" style={{ height: size }} className="w-auto shrink-0 select-none" />
    </span>
  );
}

/** The small mark: the channel's mark at rest; spinning, a ring with a dot (the loader). */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  if (!spinning) return <Mark className={className} />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g style={spinning ? { transformOrigin: "12px 12px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="42 15" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
