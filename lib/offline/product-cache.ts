import type { Product } from "@/lib/types"
import { barcodeValuesFromFirestore, findCachedProductByBarcode, normalizeScannedBarcode, type BarcodeProductRef } from "@/lib/stock"
import { idbGet, idbGetAll, idbReplaceAll, STORE_PRODUCTS } from "./idb"

export type CachedBillingProduct = {
  id: string
  name: string
  barcode?: string
  barcodeKeys?: string[]
  price: number
  mrp?: number
  stock: number
  unit: string
  category: string
}

export function productToCached(product: Product): CachedBillingProduct {
  const barcodeKeys = Array.from(
    new Set(
      [
        ...(product.barcodeKeys ?? []),
        product.barcode,
        product.id,
      ].filter((value): value is string => Boolean(value && String(value).trim()))
    )
  )
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    barcodeKeys,
    price: product.price,
    mrp: product.mrp,
    stock: product.stock,
    unit: product.unit,
    category: product.category,
  }
}

export function cachedToProduct(cached: CachedBillingProduct): Product {
  return {
    id: cached.id,
    name: cached.name,
    barcode: cached.barcode,
    barcodeKeys: cached.barcodeKeys,
    price: cached.price,
    mrp: cached.mrp,
    stock: cached.stock,
    unit: cached.unit || "pcs",
    category: cached.category || "",
    rack: "",
    tag: "",
    status: "active",
    costPrice: 0,
    minStock: 0,
    batches: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function cachedToBarcodeRef(cached: CachedBillingProduct): BarcodeProductRef {
  return {
    id: cached.id,
    name: cached.name,
    price: cached.price,
    barcode: cached.barcode,
    mrp: cached.mrp,
    barcodeKeys: cached.barcodeKeys,
  }
}

export async function saveProductCache(products: Product[]): Promise<void> {
  if (products.length === 0) return
  const rows = products
    .filter((product) => product.id)
    .map(productToCached)
  await idbReplaceAll(STORE_PRODUCTS, rows)
}

export async function loadProductCache(): Promise<CachedBillingProduct[]> {
  try {
    return await idbGetAll<CachedBillingProduct>(STORE_PRODUCTS)
  } catch {
    return []
  }
}

export async function loadCachedProductsAsProduct(): Promise<Product[]> {
  const rows = await loadProductCache()
  return rows.map(cachedToProduct)
}

export async function lookupProductFromIdb(scanned: string): Promise<BarcodeProductRef | null> {
  const code = normalizeScannedBarcode(scanned)
  if (!code) return null
  const byId = await idbGet<CachedBillingProduct>(STORE_PRODUCTS, code)
  if (byId?.id) return cachedToBarcodeRef(byId)
  const rows = await loadProductCache()
  return findCachedProductByBarcode(rows.map(cachedToBarcodeRef), code)
}

export function barcodeKeysFromProductDoc(id: string, data: Record<string, unknown>): string[] {
  return barcodeValuesFromFirestore(data, id)
}
