import type { Product } from "@/lib/types"
import { idbClear, idbGetAll, idbPut, STORE_PRODUCTS } from "./idb"

export type CachedBillingProduct = {
  id: string
  name: string
  barcode?: string
  price: number
  mrp?: number
  stock: number
  unit: string
  category: string
}

export function productToCached(product: Product): CachedBillingProduct {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
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

export async function saveProductCache(products: Product[]): Promise<void> {
  await idbClear(STORE_PRODUCTS)
  for (const product of products) {
    await idbPut(STORE_PRODUCTS, productToCached(product))
  }
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
