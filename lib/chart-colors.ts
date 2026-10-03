/** Recharts/SVG fills — use `var(--chart-n)` (oklch in globals.css). Never wrap in `hsl()`. */
export const CHART_FILLS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export function chartFillAt(index: number): string {
  return CHART_FILLS[index % CHART_FILLS.length]
}
