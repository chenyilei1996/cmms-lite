import type { Tone } from "@/lib/constants";

const COLORS: Record<string, string> = {
  accent: "var(--accent)",
  mint: "var(--mint)",
  honey: "var(--honey)",
  danger: "var(--danger)",
  ink: "var(--ink)",
  neutral: "var(--muted)",
};

export function Sparkline({
  points,
  tone = "accent",
  width = 160,
  height = 40,
}: {
  points: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-10 items-center text-[10px] text-muted">
        读数不足，暂无法绘制趋势
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = COLORS[tone] ?? COLORS.accent;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      role="img"
      aria-label={`趋势 ${min} 至 ${max}`}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
