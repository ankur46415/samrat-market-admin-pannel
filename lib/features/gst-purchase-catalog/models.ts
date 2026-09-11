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

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function parseSignedMoney(raw: string): number | null {
  const t = String(raw ?? "").trim().replace(/,/g, "").replace(/₹/g, "").replace(/^\+/, "")
  if (t === "") return 0
  if (t === "-" || t === "." || t === "-.") return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return roundMoney(n)
}

export interface GstCatalogOrder {
  order_id: string
  /** Last edited field — used to keep % and off in sync when item totals change */
  discount_mode?: "percent" | "off"
  discount_percent?: number
  discount_off?: number
  /** +/- adjustment after discount, e.g. +0.02 to make 99.98 into 100 */
  round_off?: number
}

export function sanitizeGstCatalogOrder(order: GstCatalogOrder): GstCatalogOrder | null {
  const order_id = String(order.order_id ?? "").trim()
  if (!order_id || order_id === NO_ORDER_ID) return null
  const next: GstCatalogOrder = { order_id }
  const pct = Number(order.discount_percent)
  const off = Number(order.discount_off)
  if (Number.isFinite(pct) && pct > 0) next.discount_percent = roundMoney(Math.min(pct, 100))
  if (Number.isFinite(off) && off > 0) next.discount_off = roundMoney(off)
  const roundOff = Number(order.round_off)
  if (Number.isFinite(roundOff)) next.round_off = roundMoney(roundOff)
  if (order.discount_mode === "off" || order.discount_mode === "percent") next.discount_mode = order.discount_mode
  return next
}

export function itemsTotalForOrder(
  products: GstCatalogProduct[],
  orderId: string,
  incGst = true
): number {
  const id = String(orderId).trim()
  return roundMoney(
    products.reduce((sum, p) => {
      const pid = catalogProductOrderId(p)
      const line = catalogProductLineTotal(p, incGst)
      if (id === NO_ORDER_ID) return pid ? sum : sum + line
      return pid === id ? sum + line : sum
    }, 0)
  )
}

export function percentFromOff(total: number, off: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const o = Math.min(Math.max(Number(off) || 0, 0), total)
  return roundMoney((o / total) * 100)
}

export function offFromPercent(total: number, percent: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const p = Math.min(Math.max(Number(percent) || 0, 0), 100)
  return roundMoney(total * (p / 100))
}

export function resolvedOrderDiscount(
  order: GstCatalogOrder | undefined,
  itemsTotal: number
): { percent: number; off: number; roundOff: number; balance: number } {
  const total = roundMoney(itemsTotal)
  const roundOff = order && Number.isFinite(Number(order.round_off)) ? roundMoney(Number(order.round_off)) : 0
  const applyRound = (afterDiscount: number) => roundMoney(Math.max(0, afterDiscount + roundOff))
  if (total <= 0 || !order) {
    return { percent: 0, off: 0, roundOff, balance: applyRound(total) }
  }
  if (order.discount_mode === "off") {
    const off = Math.min(roundMoney(Number(order.discount_off) || 0), total)
    return { percent: percentFromOff(total, off), off, roundOff, balance: applyRound(total - off) }
  }
  const percent = Math.min(100, Math.max(0, Number(order.discount_percent) || 0))
  const off = offFromPercent(total, percent)
  return { percent, off, roundOff, balance: applyRound(total - off) }
}

export function catalogDiscountedBalance(catalog: GstPurchaseCatalog, incGst = true): number {
  const orderById = new Map((catalog.orders ?? []).map((order) => [order.order_id, order]))
  const totalsByOrder = new Map<string, number>()
  catalog.products.forEach((product) => {
    const id = catalogProductOrderId(product) || NO_ORDER_ID
    totalsByOrder.set(id, (totalsByOrder.get(id) ?? 0) + catalogProductLineTotal(product, incGst))
  })
  return roundMoney(
    [...totalsByOrder.entries()].reduce((sum, [id, total]) => {
      return sum + resolvedOrderDiscount(orderById.get(id), total).balance
    }, 0)
  )
}

export function catalogProductGstPercent(product: GstCatalogProduct): number | undefined {
  const raw = product as GstCatalogProduct & {
    gstPercent?: unknown
    gst?: unknown
    GST?: unknown
    cgst?: unknown
    sgst?: unknown
    CGST?: unknown
    SGST?: unknown
  }
  const n = Number(raw.gst_percent ?? raw.gstPercent ?? raw.gst ?? raw.GST)
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 10) / 10
  const cgst = Number(raw.cgst ?? raw.CGST)
  const sgst = Number(raw.sgst ?? raw.SGST)
  if (Number.isFinite(cgst) && cgst >= 0 && Number.isFinite(sgst) && sgst >= 0) {
    return Math.round((cgst + sgst) * 10) / 10
  }
  return undefined
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

export type GstSaleRecordPercents = Record<string, Record<string, number>>

export function normalizeGstSaleRecordPercents(raw: unknown): GstSaleRecordPercents {
  if (!raw || typeof raw !== "object") return {}
  const out: GstSaleRecordPercents = {}
  for (const [tag, slabs] of Object.entries(raw as Record<string, unknown>)) {
    if (!slabs || typeof slabs !== "object" || Array.isArray(slabs)) continue
    const next: Record<string, number> = {}
    for (const [key, val] of Object.entries(slabs as Record<string, unknown>)) {
      const n = Number(val)
      if (Number.isFinite(n) && n >= 0) next[key] = Math.round(n * 100) / 100
    }
    if (Object.keys(next).length > 0) out[tag] = next
  }
  return out
}

export function saleAmountFromMrp(baseAmount: number, salePercent: number): number {
  const pct = Number.isFinite(salePercent) && salePercent > 0 ? salePercent : 0
  return roundMoney((Number(baseAmount) || 0) * (pct / 100))
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
  /** Created orders — each has its own persisted discount */
  orders?: GstCatalogOrder[]
  createdAt: Date
  updatedAt: Date
}

export function catalogProductLineTotal(product: GstCatalogProduct, incGst = true): number {
  const qty = Number(product.moq) || 0
  const rate = Number(product.price) || 0
  if (incGst) return roundMoney(rate * qty)
  return roundMoney(qty * priceWithGst(rate, catalogProductGstPercent(product)))
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

/** Sort key for tags like "Aug 2026" — higher is newer. */
export function parseOrderTagSortKey(tag: string): number | null {
  const t = String(tag ?? "").trim()
  let m = t.match(/^([A-Za-z]+)\.?\s*[-/]?\s*(\d{4})$/)
  if (m) {
    const month = MONTH_INDEX[m[1].toLowerCase()]
    const year = Number(m[2])
    if (month != null && Number.isFinite(year)) return year * 12 + month
  }
  m = t.match(/^(\d{4})\s*[-/]\s*(\d{1,2})$/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2]) - 1
    if (Number.isFinite(year) && month >= 0 && month <= 11) return year * 12 + month
  }
  m = t.match(/^(\d{1,2})\s*[-/]\s*(\d{4})$/)
  if (m) {
    const month = Number(m[1]) - 1
    const year = Number(m[2])
    if (Number.isFinite(year) && month >= 0 && month <= 11) return year * 12 + month
  }
  return null
}

export function uniqueCatalogOrderTags(catalogs: GstPurchaseCatalog[]): string[] {
  const tags = new Set<string>()
  catalogs.forEach((catalog) => {
    catalog.products.forEach((product) => tags.add(catalogProductOrderTag(product)))
  })
  return [...tags].sort((a, b) => {
    if (a === "NA" && b !== "NA") return 1
    if (b === "NA" && a !== "NA") return -1
    const ka = parseOrderTagSortKey(a)
    const kb = parseOrderTagSortKey(b)
    if (ka != null && kb != null && ka !== kb) return kb - ka
    if (ka != null && kb == null) return -1
    if (kb != null && ka == null) return 1
    return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
  })
}

export function defaultCatalogOrderTag(tags: string[]): string {
  if (tags.length === 0) return ""
  const now = new Date()
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const current = `${monthNames[now.getMonth()]} ${now.getFullYear()}`
  const match = tags.find((tag) => tag.toLowerCase() === current.toLowerCase())
  if (match) return match
  return tags[0]
}

export interface CatalogGroupPurchaseRow {
  id: string
  name: string
  color: string
  total: number
  items: number
}

export const ALL_ORDER_TAGS = "__all__"
export const ALL_GST_FILTER = "__all_gst__"
export const NO_GST_FILTER = "__none__"

export function gstSlabKey(gst: number | null | undefined): string {
  if (gst == null || !Number.isFinite(gst)) return NO_GST_FILTER
  return String(Math.round(gst * 10) / 10)
}

export function productMatchesGstFilter(product: GstCatalogProduct, gstFilter: string): boolean {
  if (gstFilter === ALL_GST_FILTER) return true
  return gstSlabKey(catalogProductGstPercent(product)) === gstFilter
}

export function uniqueCatalogGstFilters(catalogs: GstPurchaseCatalog[], orderTag: string): string[] {
  const filters = new Set<string>()
  catalogs.forEach((catalog) => {
    catalog.products.forEach((product) => {
      if (orderTag !== ALL_ORDER_TAGS && catalogProductOrderTag(product) !== orderTag) return
      const gst = catalogProductGstPercent(product)
      filters.add(gstSlabKey(gst))
    })
  })
  return [...filters].sort((a, b) => {
    if (a === NO_GST_FILTER) return 1
    if (b === NO_GST_FILTER) return -1
    return Number(a) - Number(b)
  })
}

export function gstFilterLabel(gstFilter: string): string {
  if (gstFilter === ALL_GST_FILTER) return "All GST"
  if (gstFilter === NO_GST_FILTER) return "No GST"
  return gstLabel(Number(gstFilter))
}

export function purchaseTotalsByCatalogGroup(
  catalogs: GstPurchaseCatalog[],
  orderTag: string,
  gstFilter: string = ALL_GST_FILTER,
  incGst = true
): CatalogGroupPurchaseRow[] {
  return catalogs
    .map((catalog) => {
      const products = catalog.products.filter((product) => {
        const tagOk = orderTag === ALL_ORDER_TAGS || catalogProductOrderTag(product) === orderTag
        return tagOk && productMatchesGstFilter(product, gstFilter)
      })
      return {
        id: catalog.id,
        name: catalog.name,
        color: catalog.color ?? "#0d9488",
        total: roundMoney(products.reduce((sum, product) => sum + catalogProductLineTotal(product, incGst), 0)),
        items: products.length,
      }
    })
    .filter((row) => row.items > 0)
    .sort((a, b) => b.total - a.total)
}

export interface GstWisePurchaseRow {
  gstKey: string
  label: string
  gstPercent: number | null
  items: number
  taxable: number
  gstAmount: number
  total: number
  saleValue: number
}

export interface GstWiseLineItem {
  catalogName: string
  product: GstCatalogProduct
  taxable: number
  gstAmount: number
  total: number
  saleValue: number
}

function gstKeyForProduct(product: GstCatalogProduct): string {
  return gstSlabKey(catalogProductGstPercent(product))
}

function lineSaleValue(product: GstCatalogProduct): number {
  const sale = catalogProductSalePrice(product)
  if (sale == null) return 0
  return roundMoney(sale * (Number(product.moq) || 0))
}

function lineGstAmount(taxable: number, gstPercent: number | undefined): number {
  if (gstPercent == null || !Number.isFinite(gstPercent) || gstPercent <= 0) return 0
  return roundMoney(taxable * (gstPercent / 100))
}

export function gstWiseReportData(
  catalogs: GstPurchaseCatalog[],
  orderTag: string,
  configuredPercents: number[] = DEFAULT_GST_PERCENTS
): { slabs: GstWisePurchaseRow[]; lines: GstWiseLineItem[] } {
  const map = new Map<string, GstWisePurchaseRow>()
  const ensure = (key: string, label: string, gstPercent: number | null) => {
    let row = map.get(key)
    if (!row) {
      row = { gstKey: key, label, gstPercent, items: 0, taxable: 0, gstAmount: 0, total: 0, saleValue: 0 }
      map.set(key, row)
    }
    return row
  }

  for (const percent of configuredPercents) {
    const key = gstSlabKey(percent)
    ensure(key, gstLabel(percent), Math.round(percent * 10) / 10)
  }

  const lines: GstWiseLineItem[] = []
  catalogs.forEach((catalog) => {
    catalog.products.forEach((product) => {
      if (orderTag !== ALL_ORDER_TAGS && catalogProductOrderTag(product) !== orderTag) return
      const gst = catalogProductGstPercent(product)
      const key = gstKeyForProduct(product)
      const row = ensure(key, gst == null ? "No GST" : gstLabel(gst), gst ?? null)
      const taxable = catalogProductLineTotal(product, true)
      const gstAmount = lineGstAmount(taxable, gst)
      const total = roundMoney(taxable + gstAmount)
      const saleValue = lineSaleValue(product)
      row.items += 1
      row.taxable = roundMoney(row.taxable + taxable)
      row.gstAmount = roundMoney(row.gstAmount + gstAmount)
      row.total = roundMoney(row.total + total)
      row.saleValue = roundMoney(row.saleValue + saleValue)
      lines.push({ catalogName: catalog.name, product, taxable, gstAmount, total, saleValue })
    })
  })

  const slabs = [...map.values()].sort((a, b) => {
    if (a.gstKey === NO_GST_FILTER) return 1
    if (b.gstKey === NO_GST_FILTER) return -1
    return (a.gstPercent ?? 0) - (b.gstPercent ?? 0)
  })

  return { slabs, lines }
}
