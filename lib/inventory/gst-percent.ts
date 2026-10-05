import {
  DEFAULT_GST_PERCENTS,
  gstLabel,
  priceWithGst,
} from "@/lib/features/gst-purchase-catalog/models"

export { DEFAULT_GST_PERCENTS, gstLabel, priceWithGst }

export function roundGstPercent(n: number): number {
  return Math.round(n * 10) / 10
}

export function gstPercentFromFirestore(data: Record<string, unknown>): number | undefined {
  const raw = data.gstPercent ?? data.gst_percent
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return roundGstPercent(n)
}

export function normalizeProductGstPercent(
  value: number | undefined | null
): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined
  return roundGstPercent(value)
}
