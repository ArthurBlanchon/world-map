import type { ExpressionSpecification } from "maplibre-gl"

export type MapTheme = "light" | "dark"

const ZERO = "#ffffff"
const HIGH = "#08306b"

/** White (0) → dark blue (max), with mid blues for readability. */
const DATA_STOPS = [
  "#ffffff",
  "#c6dbef",
  "#6baed6",
  "#3182bd",
  HIGH,
] as const

const NO_DATA = {
  light: "#e2e8f0",
  dark: "#1e293b",
} as const

export function legendGradient(): string {
  return `linear-gradient(to right, ${ZERO}, ${DATA_STOPS.slice(1).join(", ")})`
}

export function buildFillColorExpression(
  maxCount: number,
  theme: MapTheme,
): ExpressionSpecification {
  const noData = NO_DATA[theme]
  const effectiveMax = Math.max(maxCount, 1)

  const q1 = Math.max(1, effectiveMax * 0.2)
  const q2 = Math.max(q1 + 1, effectiveMax * 0.45)
  const q3 = Math.max(q2 + 1, effectiveMax * 0.7)
  const q4 = effectiveMax

  return [
    "case",
    ["!=", ["coalesce", ["get", "hasCount"], 0], 1],
    noData,
    ["<=", ["coalesce", ["get", "count"], 0], 0],
    ZERO,
    [
      "interpolate",
      ["linear"],
      ["get", "count"],
      1,
      "#deebf7",
      q1,
      DATA_STOPS[1],
      q2,
      DATA_STOPS[2],
      q3,
      DATA_STOPS[3],
      q4,
      DATA_STOPS[4],
    ],
  ]
}

export function buildFillOpacityExpression(): ExpressionSpecification {
  return [
    "case",
    [">", ["coalesce", ["get", "count"], 0], 0],
    0.92,
    0.4,
  ]
}

export function buildOutlineColorExpression(theme: MapTheme): ExpressionSpecification {
  return [
    "case",
    [">", ["coalesce", ["get", "count"], 0], 0],
    "#1e3a5f",
    theme === "dark" ? "#64748b" : "#94a3b8",
  ]
}

export function buildOutlineWidthExpression(): ExpressionSpecification {
  return [
    "case",
    [">", ["coalesce", ["get", "count"], 0], 0],
    1,
    0.5,
  ]
}
