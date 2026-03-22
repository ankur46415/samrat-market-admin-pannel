/**
 * Canonical Firestore `products` document (camelCase, int64 → number in JS SDK):
 * barcode, category, costPrice, createdAt, minStock, name, price, stock, unit, updatedAt
 *
 * Stock / minStock also check alternate keys below for older or mobile docs.
 */

/**
 * Stock quantity fields used by web or mobile (Flutter) in Firestore.
 * First present finite number wins.
 */
const STOCK_FIELD_KEYS = [
  "stock",
  "quantity",
  "qty",
  "currentStock",
  "availableStock",
  "stockQuantity",
] as const

/**
 * Min-threshold fields in Firestore (camelCase / snake_case / synonyms).
 * If none set, default 10 (legacy web behavior).
 */
const MINSTOCK_FIELD_KEYS = [
  "minStock",
  "min_stock",
  "minimumStock",
  "minimum_stock",
  "reorderLevel",
  "reorder_level",
] as const

/** Firestore int64 / number — JS client returns number for typical inventory values */
export function firestoreNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "bigint") return Number(value)
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function firstFiniteNumber(data: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const raw = data[key]
    if (raw === undefined || raw === null) continue
    const n = typeof raw === "number" ? raw : Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** Current stock from Firebase document (any supported field name). */
export function coerceProductStockFromFirestore(data: Record<string, unknown>): number {
  return firstFiniteNumber(data, STOCK_FIELD_KEYS) ?? 0
}

/** @deprecated Prefer coerceProductStockFromFirestore when you have the full doc */
export function coerceProductStock(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Minimum stock threshold from Firebase.
 * Uses 10 only when no threshold field exists — not when value is 0.
 */
export function minStockThresholdFromFirestore(data: Record<string, unknown>): number {
  const found = firstFiniteNumber(data, MINSTOCK_FIELD_KEYS)
  return found ?? 10
}

/** Same rule everywhere: low when stock is not above min threshold (stock <= minStock). */
export function isLowStockProduct(product: { stock: number; minStock: number }): boolean {
  return product.stock <= product.minStock
}

/** Raw Firestore product document — same logic as mapped Product */
export function isLowStockFromFirestoreData(data: Record<string, unknown>): boolean {
  const stock = coerceProductStockFromFirestore(data)
  const minStock = minStockThresholdFromFirestore(data)
  return stock <= minStock
}

/** Avoid divide-by-zero in progress bars when minStock is 0 */
export function minStockDisplayDenominator(minStock: number): number {
  return minStock > 0 ? minStock : 1
}

/**
 * Parse Minimum Stock from form input. `0` is valid (unlike `parseInt(x) || 10`).
 * Empty string uses emptyFallback (e.g. 10 for new products).
 */
export function parseMinStockInput(raw: string, emptyFallback = 10): number {
  const t = raw.trim()
  if (t === "") return emptyFallback
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 ? n : emptyFallback
}
