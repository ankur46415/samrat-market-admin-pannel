import type { OrderLineDraft } from "./order-line-draft"

/** Raw JSON object keys we accept (snake_case, camelCase, aliases). */
type JsonRecord = Record<string, unknown>

const ORDER_TAG_KEYS = [
  "order_tag",
  "orderTag",
  "order_no",
  "orderNo",
  "order_number",
  "orderNumber",
  "tag",
  "label",
]

const ITEMS_KEYS = ["items", "products", "lines", "order_items", "orderItems"]

function pickString(obj: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function pickNumber(obj: JsonRecord, keys: string[]): number {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/[,₹\s]/g, ""))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function pickDateString(obj: JsonRecord, keys: string[]): string {
  const raw = pickString(obj, keys)
  if (!raw) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function lineFromRecord(obj: JsonRecord, fallbackOrderTag = ""): OrderLineDraft | null {
  const product = pickString(obj, ["product", "product_name", "productName", "name", "item"])
  if (!product) return null

  const lineOrderTag = pickString(obj, ORDER_TAG_KEYS) || fallbackOrderTag

  return {
    product,
    brand: pickString(obj, ["brand", "manufacturer"]),
    buyRate: String(
      pickNumber(obj, [
        "buy_rate",
        "buyRate",
        "cost_price",
        "costPrice",
        "purchase_rate",
        "purchaseRate",
      ])
    ),
    mrp: String(pickNumber(obj, ["mrp", "MRP", "max_retail_price", "maxRetailPrice"])),
    productId: pickString(obj, ["product_id", "productId", "id", "sku", "barcode", "code"]),
    discountPercent: String(
      pickNumber(obj, ["discount_percent", "discountPercent", "discount", "discount_pct", "discountPct"])
    ),
    orderDate: pickDateString(obj, ["order_date", "orderDate", "ordered_at", "orderedAt"]),
    deliveredDate: pickDateString(obj, [
      "delivered_date",
      "deliveredDate",
      "delivery_date",
      "deliveryDate",
    ]),
    orderTag: lineOrderTag,
  }
}

export type ParseOrderJsonResult =
  | { ok: true; lines: OrderLineDraft[]; skipped: number; orderTag?: string }
  | { ok: false; error: string }

function unwrapJsonPayload(parsed: unknown): { items: JsonRecord[]; orderTag: string } {
  if (Array.isArray(parsed)) {
    return { items: parsed as JsonRecord[], orderTag: "" }
  }
  if (!parsed || typeof parsed !== "object") {
    return { items: [], orderTag: "" }
  }
  const root = parsed as JsonRecord
  const orderTag = pickString(root, ORDER_TAG_KEYS)
  for (const key of ITEMS_KEYS) {
    const raw = root[key]
    if (Array.isArray(raw)) {
      return { items: raw as JsonRecord[], orderTag }
    }
  }
  return { items: [root], orderTag }
}

/**
 * Parse JSON into order line drafts.
 * Supports a plain array or wrapped object: { "order_tag": "TATA", "items": [...] }
 */
export function parseSupplierOrderJson(raw: string): ParseOrderJsonResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Paste a JSON array of products first." }
  }

  try {
    const cleaned = trimmed.replace(/,\s*([\]}])/g, "$1")
    const parsed: unknown = JSON.parse(cleaned)
    const { items: arr, orderTag: wrapperTag } = unwrapJsonPayload(parsed)

    if (arr.length === 0) {
      return {
        ok: false,
        error: 'JSON must be an array or an object with an "items" array.',
      }
    }

    const lines: OrderLineDraft[] = []
    let skipped = 0

    for (const item of arr) {
      if (!item || typeof item !== "object") {
        skipped++
        continue
      }
      const line = lineFromRecord(item as JsonRecord, wrapperTag)
      if (line) lines.push(line)
      else skipped++
    }

    if (lines.length === 0) {
      return {
        ok: false,
        error:
          'No valid items found. Each object needs at least a "product" (or product_name) field.',
      }
    }

    const resolvedTag =
      wrapperTag ||
      lines.find((line) => line.orderTag.trim())?.orderTag.trim() ||
      undefined

    return { ok: true, lines, skipped, orderTag: resolvedTag }
  } catch {
    return { ok: false, error: "Invalid JSON — check brackets, quotes, and commas." }
  }
}

export const SUPPLIER_ORDER_JSON_EXAMPLE = `{
  "order_tag": "TATA",
  "items": [
    {
      "product": "Basmati Rice 1kg",
      "brand": "India Gate",
      "buy_rate": 85,
      "mrp": 120,
      "product_id": "RICE-001",
      "discount_percent": 10
    },
    {
      "product": "Sunflower Oil 1L",
      "brand": "Fortune",
      "buyRate": 145,
      "mrp": 180,
      "productId": "OIL-002",
      "discountPercent": 5
    }
  ]
}`
