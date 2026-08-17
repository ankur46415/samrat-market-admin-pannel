/** Preset per-line discount options shown in POS dropdown. */
export const PRESET_LINE_DISCOUNTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const

export function clampDiscountPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100))
}

export function parseDiscountInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/%$/, "")
  if (!trimmed) return 0
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return clampDiscountPercent(n)
}

export function isPresetLineDiscount(value: number): boolean {
  return PRESET_LINE_DISCOUNTS.includes(value as (typeof PRESET_LINE_DISCOUNTS)[number])
}

/** Unit price after line discount (% off base rate). */
export function discountedUnitPrice(basePrice: number, discountPercent = 0): number {
  const pct = clampDiscountPercent(discountPercent)
  return Math.round(basePrice * (1 - pct / 100))
}

/** Line amount = qty × discounted unit price. */
export function lineItemAmount(quantity: number, basePrice: number, discountPercent = 0): number {
  return quantity * discountedUnitPrice(basePrice, discountPercent)
}

export function lineDiscountSaved(quantity: number, basePrice: number, discountPercent = 0): number {
  return quantity * basePrice - lineItemAmount(quantity, basePrice, discountPercent)
}

/** Discount % between MRP and a unit price (inventory or final POS price). */
export function mrpDiscountPercent(mrp: number, unitPrice: number): number {
  if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(unitPrice) || unitPrice >= mrp) return 0
  return clampDiscountPercent(((mrp - unitPrice) / mrp) * 100)
}

/** Customer savings vs MRP for one line (includes optional POS line discount). */
export function mrpLineSaved(
  quantity: number,
  mrp: number,
  sellingPrice: number,
  posDiscountPercent = 0
): number {
  if (!Number.isFinite(mrp) || mrp <= 0) return 0
  const finalUnit = discountedUnitPrice(sellingPrice, posDiscountPercent)
  if (finalUnit >= mrp) return 0
  return quantity * (mrp - finalUnit)
}
