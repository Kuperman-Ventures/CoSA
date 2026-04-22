"use client";

import { cn } from "@/lib/utils";

// Tiny dependency-free sparkline. Spec §14: "motion is signal, not decoration"
// — animation is opt-in via `animate`.
export function Sparkline({
  data,
  width = 96,
  height = 28,
  className,
  stroke = "currentColor",
  fill = "none",
  animate = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: string;
  animate?: boolean;
}) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pad = 2;
  const h = height - pad * 2;
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(pad + h - ((v - min) / span) * h).toFixed(2)}`)
    .join(" ");

  const path = `M ${points.replaceAll(" ", " L ")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={
          animate
            ? {
                strokeDasharray: 1000,
                strokeDashoffset: 1000,
                animation: "jos-spark 700ms ease-out forwards",
              }
            : undefined
        }
      />
      <style>{`@keyframes jos-spark { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
