import { format, isValid } from "date-fns"
import Papa from "papaparse"
import type { Product } from "@/lib/types"

/** Batch id on `products_catalog` — required on import rows. */
export const PRODUCTS_CATALOG_LINKED_BATCH = "1fbb06f9-b7b1-47a7-a03e-4fa9dd30e711"

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

export type ProductCatalogExportRow = Record<
  (typeof PRODUCTS_CATALOG_EXPORT_COLUMNS)[number],
  string | number | boolean
>

function formatExpiryForExport(product: Product): string {
  const raw = (product.expiry ?? "").trim()
  if (raw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    const d = new Date(raw)
    if (isValid(d)) return format(d, "yyyy-MM-dd")
    return raw
  }
  const datedBatch = product.batches.find((b) => !b.noExpiry && isValid(b.expiryDate))
  if (datedBatch) return format(datedBatch.expiryDate, "yyyy-MM-dd")
  return ""
}

function statusToExportBoolean(status: string): boolean {
  const s = status.trim().toLowerCase()
  if (s === "deactive" || s === "inactive" || s === "false") return false
  return true
}

export function productToCatalogExportRow(product: Product): ProductCatalogExportRow {
  return {
    product_name: product.name ?? "",
    barcode: product.barcode ?? "",
    brand: product.brand ?? "",
    tag: product.tag ?? "",
    expiry: formatExpiryForExport(product),
    category: product.category ?? "",
    rack: product.rack ?? "",
    status: statusToExportBoolean(product.status),
    unit: product.unit ?? "",
    mrp: product.mrp != null && Number.isFinite(product.mrp) ? product.mrp : "",
    discount_per:
      product.discountPercent != null && Number.isFinite(product.discountPercent)
        ? product.discountPercent
        : "",
    selling_price: Number.isFinite(product.price) ? product.price : 0,
    cost_price: Number.isFinite(product.costPrice) ? product.costPrice : 0,
    total_stock: Number.isFinite(product.stock) ? product.stock : 0,
    minimum_stock_alert: Number.isFinite(product.minStock) ? product.minStock : 0,
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
