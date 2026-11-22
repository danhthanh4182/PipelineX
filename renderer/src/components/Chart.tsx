import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartVisual {
  type: string;
  title?: string;
  unit?: string;
  points?: ChartPoint[];
  source?: string;
  [key: string]: any;
}

export interface ChartProps {
  v: ChartVisual;
  frames?: number;
  isVertical?: boolean;
  accentColor?: string;
  hotColor?: string;
}

const DEFAULT_ACCENT = "#36d399";
const DEFAULT_HOT = "#ff5c5c";
const C_INK = "#f4f6fb";
const C_DIM = "#8b95a8";
const SANS = "'Be Vietnam Pro', Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

export const Chart: React.FC<ChartProps> = ({
  v,
  frames = 120,
  isVertical = false,
  accentColor = DEFAULT_ACCENT,
  hotColor = DEFAULT_HOT,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawPts = Array.isArray(v.points) ? v.points : [];
  const pts: ChartPoint[] = rawPts.map((p) => ({
    label: String(p.label ?? ""),
    value: Number(p.value ?? 0),
  }));

  if (pts.length === 0) {
    return (
      <div style={{ color: C_DIM, fontFamily: SANS, fontSize: 32, textAlign: "center", padding: 40 }}>
        No chart data available
      </div>
    );
  }

  const first = pts[0]!.value;
  const last = pts[pts.length - 1]!.value;
  const isRate = v.unit === "%";
  const change = isRate ? last - first : first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const badgeText = `${change > 0 ? "+" : ""}${isRate ? `${change.toFixed(2)} pts` : `${change.toFixed(1)}%`}`;

  const badgeEnter = spring({ frame: f - 15, fps, config: { damping: 180 } });
  const fmt = (n: number) =>
    `${v.unit === "$" ? "$" : ""}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${v.unit && v.unit !== "$" ? v.unit : ""}`;

  // Dimensions based on orientation
  const W = isVertical ? 920 : 1360;
  const H = isVertical ? 580 : 480;

  const lo = Math.min(...pts.map((p) => p.value));
  const hi = Math.max(...pts.map((p) => p.value));
  const range = hi - lo || Math.abs(hi) || 1;
  const pad = range * 0.2;
  const minVal = lo - pad;
  const maxVal = hi + pad;

  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2);
  const y = (val: number) => H - ((val - minVal) / (maxVal - minVal || 1)) * H;

  // Progressive drawing animation
  const drawProgress = interpolate(f, [6, Math.min(frames * 0.75, 60)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const shownCount = Math.max(1, Math.ceil(drawProgress * (pts.length - 1)) + 1);
  const currentPts = pts.slice(0, shownCount);
  const linePointsStr = currentPts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

  // Gradient area path under the curve
  const areaPathStr = currentPts.length > 1
    ? `M 0,${y(currentPts[0]!.value).toFixed(1)} ` +
      currentPts.map((p, i) => `L ${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ") +
      ` L ${x(currentPts.length - 1).toFixed(1)},${H} L 0,${H} Z`
    : "";

  const activeIdx = Math.min(shownCount - 1, pts.length - 1);
  const activePt = pts[activeIdx]!;
  const every = Math.max(1, Math.ceil(pts.length / (isVertical ? 4 : 6)));

  const isBarMode = pts.length <= 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        fontFamily: SANS,
      }}
    >
      {/* Title & Change Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: isVertical ? 24 : 32,
        }}
      >
        {v.title && (
          <div
            style={{
              color: C_INK,
              fontSize: isVertical ? 42 : 52,
              fontWeight: 800,
              lineHeight: 1.15,
              flex: 1,
            }}
          >
            {v.title}
          </div>
        )}
        <div
          style={{
            opacity: badgeEnter,
            transform: `scale(${0.8 + 0.2 * badgeEnter})`,
            background: change < 0 ? hotColor : accentColor,
            color: "white",
            fontSize: isVertical ? 36 : 46,
            fontWeight: 900,
            padding: isVertical ? "8px 20px" : "10px 26px",
            borderRadius: 14,
            boxShadow: `0 8px 24px ${change < 0 ? hotColor : accentColor}40`,
          }}
        >
          {badgeText}
        </div>
      </div>

      {/* Chart Canvas */}
      {isBarMode ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            height: H,
            padding: "0 20px",
            gap: isVertical ? 16 : 48,
          }}
        >
          {pts.map((p, i) => {
            const barSpring = spring({ frame: f - i * 8, fps, config: { damping: 180 } });
            const heightPct = Math.max(8, Math.min(95, ((p.value - Math.min(0, lo)) / (hi - Math.min(0, lo) || 1)) * 80 * barSpring));
            const isLast = i === pts.length - 1;
            const barColor = isLast && change < 0 ? hotColor : accentColor;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  height: "100%",
                  flex: 1,
                  maxWidth: isVertical ? 140 : 220,
                }}
              >
                <div
                  style={{
                    color: C_INK,
                    fontSize: isVertical ? 32 : 44,
                    fontWeight: 800,
                    opacity: barSpring,
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  {fmt(p.value)}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${heightPct}%`,
                    background: `linear-gradient(180deg, ${barColor}, ${barColor}cc)`,
                    borderRadius: "14px 14px 0 0",
                    boxShadow: `0 0 24px ${barColor}33`,
                    transition: "height 0.1s ease",
                  }}
                />
                <div
                  style={{
                    color: C_DIM,
                    fontSize: isVertical ? 24 : 32,
                    fontWeight: 600,
                    marginTop: 14,
                    textAlign: "center",
                  }}
                >
                  {p.label}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ position: "relative", width: W, height: H + 70, margin: "0 auto" }}>
          <svg width={W} height={H + 70} viewBox={`0 0 ${W} ${H + 70}`} style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.45" />
                <stop offset="85%" stopColor={accentColor} stopOpacity="0.03" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Subtle Gridlines */}
            {[0.2, 0.45, 0.7, 0.95].map((t) => (
              <line
                key={t}
                x1={0}
                x2={W}
                y1={H * t}
                y2={H * t}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 6"
                strokeWidth={1.5}
              />
            ))}

            {/* Gradient Fill under curve */}
            {areaPathStr && <path d={areaPathStr} fill="url(#chartGradient)" />}

            {/* Main Animated Line */}
            <polyline
              points={linePointsStr}
              fill="none"
              stroke={accentColor}
              strokeWidth={isVertical ? 6 : 8}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#glow)"
            />

            {/* Active Endpoint Pulsing Ring & Dot */}
            <circle
              cx={x(activeIdx)}
              cy={y(activePt.value)}
              r={18 + 4 * Math.sin(f / 6)}
              fill={accentColor}
              opacity={0.3}
            />
            <circle cx={x(activeIdx)} cy={y(activePt.value)} r={12} fill="white" stroke={accentColor} strokeWidth={4} />

            {/* Floating Value Callout */}
            <text
              x={Math.min(Math.max(x(activeIdx), 80), W - 80)}
              y={y(activePt.value) - 24}
              fill={C_INK}
              fontSize={isVertical ? 38 : 46}
              fontWeight={800}
              textAnchor="middle"
              filter="drop-shadow(0 4px 10px rgba(0,0,0,0.8))"
            >
              {fmt(activePt.value)}
            </text>

            {/* Starting value reference */}
            <text x={0} y={y(first) - 20} fill={C_DIM} fontSize={isVertical ? 26 : 32} fontWeight={600}>
              {fmt(first)}
            </text>

            {/* Date/Label Axis */}
            {pts.map((p, i) => {
              if (i % every !== 0 && i !== pts.length - 1) return null;
              return (
                <text
                  key={i}
                  x={x(i)}
                  y={H + 46}
                  fill={C_DIM}
                  fontSize={isVertical ? 22 : 28}
                  fontWeight={600}
                  textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
                >
                  {p.label}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {/* Source Attribution */}
      {v.source && (
        <div
          style={{
            marginTop: isVertical ? 20 : 28,
            color: "rgba(255,255,255,0.6)",
            fontSize: isVertical ? 22 : 26,
            fontWeight: 500,
          }}
        >
          Source: {String(v.source)}
        </div>
      )}
    </div>
  );
};
