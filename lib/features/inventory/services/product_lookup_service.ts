import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { productFromData } from "@/lib/inventory/product-from-doc"
import type { Product } from "@/lib/types"
import { normalizeScannedBarcode } from "@/lib/stock"
import {
  cachedToProduct,
  loadProductCache,
  lookupProductFromIdb,
} from "@/lib/offline/product-cache"

const LOOKUP_TIMEOUT_MS = 12_000

function withLookupTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () =>
          reject(
            new Error(
              `${label} timed out. Check internet connection, then try again (or use offline cache after an admin has opened inventory once).`
            )
          ),
        LOOKUP_TIMEOUT_MS
      )
    }),
  ])
}

/** Barcode, normalized barcode, or Firestore product document id. Falls back to IndexedDB cache. */
export async function lookupProductByScanCode(code: string): Promise<Product | null> {
  const trimmed = code.trim()
  if (!trimmed) return null
  const normalized = normalizeScannedBarcode(trimmed) || trimmed

  const fromDoc = async (productId: string): Promise<Product | null> => {
    const snap = await getDoc(doc(db, col("products"), productId))
    if (!snap.exists()) return null
    return productFromData(snap.id, snap.data() as Record<string, unknown>)
  }

  const fromBarcodeField = async (value: string): Promise<Product | null> => {
    const q = query(
      collection(db, col("products")),
      where("barcode", "==", value),
      limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]!
    return productFromData(d.id, d.data() as Record<string, unknown>)
  }

  try {
    let product = await withLookupTimeout(fromBarcodeField(normalized), "Product lookup")
    if (product) return product
    if (normalized !== trimmed) {
      product = await withLookupTimeout(fromBarcodeField(trimmed), "Product lookup")
      if (product) return product
    }

    if (/^[a-zA-Z0-9]{10,28}$/.test(trimmed)) {
      product = await withLookupTimeout(fromDoc(trimmed), "Product lookup")
      if (product) return product
    }
  } catch (err) {
    console.warn("lookupProductByScanCode: Firestore failed, trying offline cache", err)
  }

  const cachedRef = await lookupProductFromIdb(trimmed)
  if (!cachedRef?.id) return null
  const rows = await loadProductCache()
  const full = rows.find((row) => row.id === cachedRef.id)
  if (full) return cachedToProduct(full)
  return cachedToProduct({
    id: cachedRef.id,
    name: cachedRef.name,
    barcode: cachedRef.barcode,
    barcodeKeys: cachedRef.barcodeKeys,
    price: cachedRef.price,
    mrp: cachedRef.mrp,
    discountPercent: cachedRef.discountPercent,
    stock: 0,
    unit: "pcs",
    category: "",
  })
}
