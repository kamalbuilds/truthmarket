"use client";

import React from "react";

interface ProbabilityGaugeProps {
  /** Integer probability 0–100 for side A (YES) */
  probabilityPct: number;
  /** Optional label to show under percentage, defaults to "YES" */
  sideALabel?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

export function ProbabilityGauge({
  probabilityPct,
  sideALabel = "YES",
  size = "md",
}: ProbabilityGaugeProps) {
  const p = Math.min(Math.max(probabilityPct, 0), 100) / 100;

  // SVG semi-circle: M 8 30 A 22 22 0 0 1 52 30
  // Arc length = π * r = π * 22 ≈ 69.12
  const radius = 22;
  const arcLength = Math.PI * radius;
  const fillLength = arcLength * p;

  const color =
    probabilityPct >= 50
      ? "#22c55e" // green-500
      : probabilityPct >= 30
      ? "#f97316" // orange-500
      : "#ef4444"; // red-500

  const sizeMap = {
    sm: { svgWidth: 60, svgHeight: 35, fontSize: "text-[10px]", wrapper: "w-[60px] h-[35px]" },
    md: { svgWidth: 80, svgHeight: 46, fontSize: "text-[12px]", wrapper: "w-[80px] h-[46px]" },
    lg: { svgWidth: 100, svgHeight: 58, fontSize: "text-[14px]", wrapper: "w-[100px] h-[58px]" },
  };

  const dims = sizeMap[size];

  // Scale the SVG path coordinates for the larger sizes
  const scaleX = dims.svgWidth / 60;
  const scaleY = dims.svgHeight / 35;
  // Keep using a fixed viewBox of 60x35 and scale via width/height
  // so the path coordinates remain the same.

  return (
    <div
      className={`relative flex items-end justify-center ${dims.wrapper}`}
      aria-label={`${sideALabel} probability: ${probabilityPct}%`}
    >
      <svg
        width={dims.svgWidth}
        height={dims.svgHeight}
        viewBox="0 0 60 35"
        aria-hidden="true"
      >
        {/* Background track */}
        <path
          d="M 8 30 A 22 22 0 0 1 52 30"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Colored fill */}
        <path
          d="M 8 30 A 22 22 0 0 1 52 30"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={arcLength - fillLength}
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
        />
        {/* Center needle dot */}
        <circle
          cx="30"
          cy="30"
          r="2.5"
          fill={color}
          style={{ transition: "fill 0.3s ease" }}
        />
      </svg>

      {/* Percentage label at bottom-center */}
      <div
        className={`absolute bottom-1 left-1/2 -translate-x-1/2 ${dims.fontSize} font-bold tabular-nums leading-none`}
        style={{ color: color }}
      >
        {probabilityPct}%
      </div>
    </div>
  );
}

export default ProbabilityGauge;
