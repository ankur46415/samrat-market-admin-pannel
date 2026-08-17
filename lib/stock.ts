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

/** Live session line item qty — web uses `quantity`, mobile may use `qty` / `count`. */
export function liveSessionItemQuantity(data: Record<string, unknown>): number {
  for (const key of ["quantity", "qty", "count", "itemQty"] as const) {
    const n = firestoreNumber(data[key], NaN)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 0
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

/** Firestore / mobile may use `unit`, `units`, or synonyms — first non-empty wins. */
const UNIT_FIELD_KEYS = ["unit", "units", "unitName", "measurementUnit"] as const

export function productUnitFromFirestore(data: Record<string, unknown>): string {
  for (const key of UNIT_FIELD_KEYS) {
    const raw = data[key]
    if (typeof raw === "string") {
      const t = raw.trim()
      if (t.length > 0) return t
    }
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  }
  return ""
}

/** Normalize unit for writes (never empty; safe if value is number or odd types). */
export function normalizeProductUnit(raw: unknown, fallback = "pcs"): string {
  if (raw == null || raw === "") return fallback
  const s = String(raw).trim()
  return s.length > 0 ? s : fallback
}

/** Clean barcode text from USB/Bluetooth scanner guns (strip control chars, trim). */
export function normalizeScannedBarcode(raw: string): string {
  return raw.replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, "").trim()
}

/** Build lookup keys for the same physical barcode (EAN padding, digits-only, etc.). */
export function getBarcodeLookupCandidates(raw: string): string[] {
  const normalized = normalizeScannedBarcode(raw)
  const candidates = new Set<string>()
  if (normalized) candidates.add(normalized)

  const digitsOnly = normalized.replace(/\D/g, "")
  if (digitsOnly) {
    candidates.add(digitsOnly)
    if (/^\d{12}$/.test(digitsOnly)) candidates.add(`0${digitsOnly}`)
    if (/^0\d{13}$/.test(digitsOnly)) candidates.add(digitsOnly.slice(1))
  }

  return [...candidates]
}

const BARCODE_FIELD_KEYS = [
  "barcode",
  "barCode",
  "BarCode",
  "productBarcode",
  "sku",
  "ean",
  "upc",
  "code",
] as const

/** Collect every barcode-like value from a Firestore product doc (incl. doc id). */
export function barcodeValuesFromFirestore(data: Record<string, unknown>, docId?: string): string[] {
  const values = new Set<string>()

  for (const key of BARCODE_FIELD_KEYS) {
    const raw = data[key]
    if (raw === undefined || raw === null) continue
    for (const candidate of getBarcodeLookupCandidates(String(raw))) {
      values.add(candidate)
    }
  }

  if (docId?.trim()) {
    for (const candidate of getBarcodeLookupCandidates(docId)) {
      values.add(candidate)
    }
  }

  return [...values]
}

/** True when scanned code matches a stored barcode (handles padding / format drift). */
export function barcodesMatch(stored: string, scanned: string): boolean {
  const scannedSet = new Set(getBarcodeLookupCandidates(scanned))
  return getBarcodeLookupCandidates(stored).some((candidate) => scannedSet.has(candidate))
}

export type BarcodeProductRef = {
  id: string
  name: string
  price: number
  barcode?: string
  mrp?: number
}

/** Match a scanned barcode against an in-memory product list (from useProducts). */
export function findCachedProductByBarcode(
  products: BarcodeProductRef[],
  scanned: string
): BarcodeProductRef | null {
  const cleaned = normalizeScannedBarcode(scanned)
  if (!cleaned) return null

  for (const product of products) {
    if (product.barcode && barcodesMatch(product.barcode, cleaned)) return product
    if (barcodesMatch(product.id, cleaned)) return product
  }

  return null
}

