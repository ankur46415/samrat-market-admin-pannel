/**
 * GST Purchase Catalog — same structure as Purchase Catalog, with GST % on products.
 */

import {
  catalogProductSalePrice as catalogSalePriceFromProduct,
  formatMarginPercent,
  marginPercentFromPrices,
  matchingSaleMarginPercent,
  normalizeSaleMarginPercents as normalizePurchaseSaleMargins,
  salePriceFromMarginPercent,
} from "@/lib/features/purchase-catalog/models"

export interface GstCatalogProduct {
  product_name: string
  price: number
  moq: number
  brand?: string
  unit?: string
  notes?: string
  order_tag?: string
  /** Order ID — grouping / filter key (e.g. PO number) */
  order_id?: string
  /** Selling / sale price shown to customers — same as Purchase Catalog */
  sale_price?: number
  /** GST % chosen from dropdown only */
  gst_percent?: number
}

export {
  formatMarginPercent,
  marginPercentFromPrices,
  matchingSaleMarginPercent,
  salePriceFromMarginPercent,
}

export function catalogProductSalePrice(product: GstCatalogProduct): number | undefined {
  return catalogSalePriceFromProduct(product)
}

export function catalogProductOrderTag(product: GstCatalogProduct): string {
  const tag = String(product.order_tag ?? "").trim()
  return tag || "NA"
}

export function catalogProductOrderId(product: GstCatalogProduct): string {
  return String(product.order_id ?? "").trim()
}

export const NO_ORDER_ID = "none"

export function catalogProductGstPercent(product: GstCatalogProduct): number | undefined {
  const n = Number(product.gst_percent)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function priceWithGst(price: number, gstPercent: number | undefined): number {
  const p = Number(price) || 0
  const g = gstPercent == null || !Number.isFinite(gstPercent) ? 0 : gstPercent
  return Math.round(p * (1 + g / 100) * 100) / 100
}

export function gstLabel(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return "—"
  const rounded = Math.round(percent * 10) / 10
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${label}%`
}

export function sanitizeGstCatalogProduct(product: GstCatalogProduct): GstCatalogProduct {
  const gst = catalogProductGstPercent(product)
  const sale = catalogProductSalePrice(product)
  const next: GstCatalogProduct = {
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
  const orderId = catalogProductOrderId(product)
  if (orderId) next.order_id = orderId
  if (sale != null) next.sale_price = sale
  if (gst != null) next.gst_percent = gst
  return next
}

/** Same slabs as Purchase Catalog sale-price %, including the extra 50–120% options. */
export const DEFAULT_SALE_MARGIN_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]

export function normalizeSaleMarginPercents(raw: unknown): number[] {
  const next = normalizePurchaseSaleMargins(raw)
  if (Array.isArray(raw) && raw.length > 0) return next
  return [...DEFAULT_SALE_MARGIN_PERCENTS]
}

export const DEFAULT_GST_PERCENTS = [0, 5, 12, 18, 28]

export function normalizeGstPercents(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : DEFAULT_GST_PERCENTS
  const nums = source
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    .map((n) => Math.round(n * 10) / 10)
  const unique = [...new Set(nums)].sort((a, b) => a - b)
  return unique.length > 0 ? unique : [...DEFAULT_GST_PERCENTS]
}

export interface GstPurchaseCatalog {
  id: string
  name: string
  source?: string
  color?: string
  products: GstCatalogProduct[]
  createdAt: Date
  updatedAt: Date
}
