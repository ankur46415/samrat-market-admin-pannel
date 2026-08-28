/**
 * Purchase Catalog — Models
 * Ye tab mein agency/dealer se jo items order karte hain unka catalog manage hoga.
 */

/** Ek individual product entry (JSON import format ke saath compatible) */
export interface CatalogProduct {
  product_name: string
  price: number
  moq: number // Minimum Order Quantity
  /** Optional extra fields */
  brand?: string
  unit?: string
  notes?: string
  /** Order tag / order no — e.g. "123456" or "TATA" — used to filter products */
  order_tag?: string
  /** Selling / sale price shown to customers */
  sale_price?: number
}

export function catalogProductOrderTag(product: CatalogProduct): string {
  const tag = String(product.order_tag ?? "").trim()
  return tag || "NA"
}

export function catalogProductSalePrice(product: CatalogProduct): number | undefined {
  const n = Number(product.sale_price)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Firestore rejects `undefined` in nested product objects — only write defined fields. */
export function sanitizeCatalogProduct(product: CatalogProduct): CatalogProduct {
  const sale = catalogProductSalePrice(product)
  const next: CatalogProduct = {
    product_name: String(product.product_name ?? "").trim(),
    price: Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
    moq: Number.isFinite(Number(product.moq)) ? Number(product.moq) : 0,
    order_tag: catalogProductOrderTag(product),
  }
  const brand = String(product.brand ?? "").trim()
  const unit = String(product.unit ?? "").trim()
  const notes = String(product.notes ?? "").trim()
  if (brand) next.brand = brand
  if (unit) next.unit = unit
  if (notes) next.notes = notes
  if (sale != null) next.sale_price = sale
  return next
}

export const DEFAULT_SALE_MARGIN_PERCENTS = [5, 10, 15, 20, 25, 30, 40]

export function normalizeSaleMarginPercents(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : DEFAULT_SALE_MARGIN_PERCENTS
  const nums = source
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 500)
    .map((n) => Math.round(n * 10) / 10)
  const unique = [...new Set(nums)].sort((a, b) => a - b)
  return unique.length > 0 ? unique : [...DEFAULT_SALE_MARGIN_PERCENTS]
}

export function marginPercentFromPrices(buyPrice: number, salePrice: number): number | null {
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) return null
  if (!Number.isFinite(salePrice)) return null
  return ((salePrice - buyPrice) / buyPrice) * 100
}

export function formatMarginPercent(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return "—"
  const rounded = Math.round(percent * 10) / 10
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${label}%`
}

export function salePriceFromMarginPercent(buyPrice: number, percent: number): number {
  return Math.round(buyPrice * (1 + percent / 100) * 100) / 100
}

export function matchingSaleMarginPercent(
  buyPrice: number,
  salePrice: number | undefined,
  options: number[]
): number | "" {
  if (salePrice == null) return ""
  const pct = marginPercentFromPrices(buyPrice, salePrice)
  if (pct == null) return ""
  const match = options.find((option) => Math.abs(option - pct) < 0.51)
  return match ?? ""
}

/** Ek catalog group — jaise "Sharpeners", "Erasers", "Drawing Boxes" etc. */
export interface PurchaseCatalog {
  id: string
  /** Group/Category name — e.g. "Pencil Sharpeners", "Erasers" */
  name: string
  /** Source — agency/dealer name or supplier info */
  source?: string
  /** Color tag for UI card */
  color?: string
  /** All products under this catalog group */
  products: CatalogProduct[]
  createdAt: Date
  updatedAt: Date
}
