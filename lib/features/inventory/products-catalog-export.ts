import { format, isValid } from "date-fns"
import Papa from "papaparse"
import type { Product } from "@/lib/types"

/** Batch id on `products_catalog` — required on import rows. */
export const PRODUCTS_CATALOG_LINKED_BATCH = "1fbb06f9-b7b1-47a7-a03e-4fa9dd30e711"

/** Used when product has no expiry (Postgres import expects YYYY-MM-DD). */
export const PRODUCTS_CATALOG_DEFAULT_EXPIRY = "2030-11-28"

/** Placeholder for empty string columns in catalog export. */
export const PRODUCTS_CATALOG_DEFAULT_TEXT = "text"

export const PRODUCTS_CATALOG_EXPORT_COLUMNS = [
  "product_name",
  "barcode",
  "brand",
  "tag",
  "expiry",
  "category",
  "rack",
  "status",
  "unit",
  "mrp",
  "discount_per",
  "selling_price",
  "cost_price",
  "total_stock",
  "minimum_stock_alert",
  "linked_batch",
] as const

export type ProductCatalogExportRow = {
  product_name: string
  barcode: string
  brand: string
  tag: string
  expiry: string
  category: string
  rack: string
  status: boolean
  unit: string
  mrp: number
  discount_per: number
  selling_price: number
  cost_price: number
  total_stock: number
  minimum_stock_alert: number
  linked_batch: string
}

function exportText(value: unknown): string {
  if (value == null) return PRODUCTS_CATALOG_DEFAULT_TEXT
  const s = String(value).trim()
  return s.length > 0 ? s : PRODUCTS_CATALOG_DEFAULT_TEXT
}

function exportNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Normalize stored expiry strings to Postgres-friendly YYYY-MM-DD (day-first when ambiguous). */
export function normalizeExpiryForCatalogExport(raw: string): string {
  const s = raw.trim()
  if (!s) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const partsMatch = s.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/)
  if (partsMatch) {
    const a = parseInt(partsMatch[1], 10)
    const b = parseInt(partsMatch[2], 10)
    const c = parseInt(partsMatch[3], 10)

    let year: number
    let month: number
    let day: number

    if (partsMatch[1].length === 4) {
      year = a
      month = b
      day = c
    } else if (partsMatch[3].length === 4) {
      year = c
      day = a
      month = b
    } else {
      return ""
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return ""

    const d = new Date(year, month - 1, day)
    if (
      !isValid(d) ||
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return ""
    }
    return format(d, "yyyy-MM-dd")
  }

  const parsed = new Date(s)
  if (isValid(parsed)) return format(parsed, "yyyy-MM-dd")

  return ""
}

function formatExpiryForExport(product: Product): string {
  const raw = (product.expiry ?? "").trim()
  if (raw) {
    const normalized = normalizeExpiryForCatalogExport(raw)
    if (normalized) return normalized
  }
  const datedBatch = product.batches.find((b) => !b.noExpiry && isValid(b.expiryDate))
  if (datedBatch) return format(datedBatch.expiryDate, "yyyy-MM-dd")
  return PRODUCTS_CATALOG_DEFAULT_EXPIRY
}

function statusToExportBoolean(status: string): boolean {
  const s = status.trim().toLowerCase()
  if (s === "deactive" || s === "inactive" || s === "false") return false
  return true
}

export function productToCatalogExportRow(product: Product): ProductCatalogExportRow {
  const expiry = formatExpiryForExport(product)
  return {
    product_name: exportText(product.name),
    barcode: exportText(product.barcode),
    brand: exportText(product.brand),
    tag: exportText(product.tag),
    expiry: expiry.length > 0 ? expiry : PRODUCTS_CATALOG_DEFAULT_EXPIRY,
    category: exportText(product.category),
    rack: exportText(product.rack),
    status: statusToExportBoolean(product.status),
    unit: exportText(product.unit),
    mrp: exportNumber(product.mrp, 0),
    discount_per: exportNumber(product.discountPercent, 0),
    selling_price: exportNumber(product.price, 0),
    cost_price: exportNumber(product.costPrice, 0),
    total_stock: exportNumber(product.stock, 0),
    minimum_stock_alert: exportNumber(product.minStock, 0),
    linked_batch: PRODUCTS_CATALOG_LINKED_BATCH,
  }
}

export function buildProductsCatalogExportRows(products: Product[]): ProductCatalogExportRow[] {
  return products.map(productToCatalogExportRow)
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** CSV rows for catalog import; file name `products.csv`. */
export function downloadProductsCatalogCsv(products: Product[]) {
  const rows = buildProductsCatalogExportRows(products)
  const csv = Papa.unparse(rows, {
    columns: [...PRODUCTS_CATALOG_EXPORT_COLUMNS],
    header: true,
  })
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  downloadBlob("products.csv", blob)
}

/** JSON array with the same fields (no created_at). */
export function downloadProductsCatalogJson(products: Product[]) {
  const rows = buildProductsCatalogExportRows(products)
  const json = JSON.stringify(rows, null, 2)
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
  downloadBlob("products.json", blob)
}
