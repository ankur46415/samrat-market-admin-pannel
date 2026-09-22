"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  writeBatch,
  limit,
  QueryConstraint,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { useAccountModeScope } from "@/components/account-mode-provider"
import type { Product, ProductBatch, Customer, Sale, LedgerEntry, DashboardStats, Order } from "@/lib/types"
import { saleFromFirestoreDoc } from "@/lib/sale-from-firestore"
import { fetchGlobalDashboardStats } from "@/lib/features/dashboard/services/dashboard_aggregate_service"
import { fetchSalesInDateRange } from "@/lib/features/sales/services/sales_query_service"
import { omitUndefinedFields } from "@/lib/utils"
import { InventoryBatchService } from "@/lib/features/inventory/services/inventory_batch_service"
import { isNoExpiryBatch } from "@/lib/inventory/no-expiry-batch"
import { loadCachedProductsAsProduct, saveProductCache } from "@/lib/offline/product-cache"
import {
  coerceProductStockFromFirestore,
  firestoreNumber,
  isLowStockFromFirestoreData,
  minStockThresholdFromFirestore,
  productUnitFromFirestore,
  normalizeProductUnit,
  barcodeValuesFromFirestore,
} from "@/lib/stock"
import { RACK_OPTIONS, RACK_OPTIONS_SET } from "@/lib/rack-options"
import { STATUS_OPTIONS, STATUS_OPTIONS_SET } from "@/lib/status-options"

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return typeof value === "object" && value !== null && "toDate" in value && typeof (value as any).toDate === "function"
}

// Helper to convert Firestore timestamp-like values into a safe Date
const convertTimestamp = (timestamp: unknown): Date => {
  if (!timestamp) return new Date()
  if (timestamp instanceof Date) return timestamp
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  if (isTimestampLike(timestamp)) {
    const d = timestamp.toDate()
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const d = new Date(timestamp)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  if (typeof timestamp === "object" && timestamp !== null) {
    const seconds = (timestamp as any).seconds
    const nanoseconds = (timestamp as any).nanoseconds
    if (typeof seconds === "number") {
      const millis = (seconds * 1000) + (typeof nanoseconds === "number" ? Math.floor(nanoseconds / 1_000_000) : 0)
      const d = new Date(millis)
      return Number.isNaN(d.getTime()) ? new Date() : d
    }
  }
  return new Date()
}

/** Map Firestore product doc → Product (matches console: barcode, category, costPrice, minStock, name, price, stock, unit, …) */
function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function optionalBarcode(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = typeof v === "string" ? v.trim() : String(v).trim()
  return s.length > 0 ? s : undefined
}

function expiryFromFirestore(data: Record<string, unknown>): string | undefined {
  const raw = data.expiry
  if (raw instanceof Timestamp) {
    const d = raw.toDate()
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return undefined
  }
  const s = trimStr(raw)
  return s.length > 0 ? s : undefined
}

function productFromData(id: string, data: Record<string, unknown>): Product {
  const brand = trimStr((data as any).brand)
  const expiry = expiryFromFirestore(data)
  const totalStock = Number((data as any).__totalStock ?? NaN)
  const rawBatches = (data as Record<string, unknown>).__batches
  const rack = trimStr((data as any).rack)
  const tag = trimStr((data as any).tag)
  const status = trimStr((data as any).status)
  const barcodeKeys = barcodeValuesFromFirestore(data, id)
  const barcode = optionalBarcode(data.barcode) || optionalBarcode((data as any).productBarcode)
  const batches: ProductBatch[] = Array.isArray(rawBatches)
    ? (rawBatches as ProductBatch[]).map((b) => ({
        id: b.id,
        quantity: Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : 0,
        expiryDate: convertTimestamp(b.expiryDate),
        createdAt: convertTimestamp(b.createdAt),
        ...(b.noExpiry ? { noExpiry: true } : {}),
      }))
    : []
  return {
    id,
    name: trimStr(data.name),
    category: trimStr(data.category),
    rack,
    tag,
    status,
    barcode: barcode || undefined,
    barcodeKeys,
    brand: brand.length > 0 ? brand : undefined,
    imageUrl: (() => {
      const url = trimStr((data as { imageUrl?: unknown }).imageUrl)
      return url.length > 0 ? url : undefined
    })(),
    price: firestoreNumber(data.price, 0),
    costPrice: firestoreNumber(data.costPrice, 0),
    mrp: (() => {
      const n = firestoreNumber((data as any).mrp, NaN)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
    discountPercent: (() => {
      const n = firestoreNumber((data as { discountPercent?: unknown }).discountPercent, NaN)
      if (!Number.isFinite(n) || n <= 0) return undefined
      return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
    })(),
    stock: Number.isFinite(totalStock) ? totalStock : coerceProductStockFromFirestore(data),
    batches,
    minStock: (() => {
      const raw = data.minStock
      if (raw !== undefined && raw !== null) {
        const n = firestoreNumber(raw, NaN)
        if (Number.isFinite(n)) return n
      }
      return minStockThresholdFromFirestore(data)
    })(),
    expiry: expiry && expiry.length > 0 ? expiry : undefined,
    unit: normalizeProductUnit(productUnitFromFirestore(data)),
    createdAt: convertTimestamp(data.createdAt as Timestamp | Date | undefined),
    updatedAt: convertTimestamp(data.updatedAt as Timestamp | Date | undefined),
  }
}

// Products Hook
export function useProducts() {
  const accountMode = useAccountModeScope()
  const batchService = new InventoryBatchService(db)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let fromNetwork = false
    let cancelled = false
    setProducts([])
    setLoading(true)
    setError(null)

    const applyCache = (cached: Product[]) => {
      if (cancelled || fromNetwork || cached.length === 0) return
      setProducts(cached)
      setLoading(false)
    }

    void loadCachedProductsAsProduct().then(applyCache)

    const fallbackTimer = window.setTimeout(() => {
      if (fromNetwork) return
      void loadCachedProductsAsProduct().then(applyCache)
    }, 1500)

    const unsubscribe = onSnapshot(
      collection(db, col("products")),
      (snapshot) => {
        fromNetwork = true
        window.clearTimeout(fallbackTimer)
        try {
          // Billing needs barcode/price immediately. Do not wait on batches subcollection reads.
          const items = snapshot.docs.map((docSnap) =>
            productFromData(docSnap.id, docSnap.data() as Record<string, unknown>)
          )
          items.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
          )
          if (cancelled) return
          setProducts(items)
          setError(null)
          setLoading(false)
          void saveProductCache(items)

          void (async () => {
            try {
              const withBatches = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                  const data = docSnap.data() as Record<string, unknown>
                  try {
                    const batchesSnap = await getDocs(collection(db, col("products"), docSnap.id, "batches"))
                    const batchList: ProductBatch[] = batchesSnap.docs.map((b) => {
                      const bd = b.data() as Record<string, unknown>
                      return {
                        id: b.id,
                        quantity: Number.isFinite(Number(bd.quantity)) ? Number(bd.quantity) : 0,
                        expiryDate: convertTimestamp(bd.expiryDate),
                        createdAt: convertTimestamp(bd.createdAt),
                        ...(isNoExpiryBatch(bd) ? { noExpiry: true } : {}),
                      }
                    })
                    batchList.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
                    const totalStock = batchList.reduce((sum, b) => sum + b.quantity, 0)
                    return productFromData(docSnap.id, { ...data, __totalStock: totalStock, __batches: batchList })
                  } catch {
                    return productFromData(docSnap.id, data)
                  }
                })
              )
              withBatches.sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
              )
              if (cancelled || withBatches.length === 0) return
              setProducts(withBatches)
              void saveProductCache(withBatches)
            } catch (batchErr) {
              console.error("Batch enrichment error:", batchErr)
            }
          })()
        } catch (err) {
          console.error("Products snapshot processing error:", err)
          setError(err instanceof Error ? err.message : "Failed to process products")
          void loadCachedProductsAsProduct().then((cached) => {
            if (cancelled || cached.length === 0) return
            setProducts(cached)
            setError(null)
          }).finally(() => {
            if (!cancelled) setLoading(false)
          })
        }
      },
      (err) => {
        console.error("Products error:", err)
        setError(err.message)
        void loadCachedProductsAsProduct().then((cached) => {
          if (cancelled) return
          if (cached.length > 0) {
            setProducts(cached)
            setError(null)
          }
        }).finally(() => {
          if (!cancelled) setLoading(false)
        })
      }
    )

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      unsubscribe()
    }
  }, [accountMode])

  const addProduct = useCallback(async (
    product: Omit<Product, "id" | "createdAt" | "updatedAt" | "batches"> & { noExpiry?: boolean }
  ) => {
    const barcode = String(product.barcode ?? "").trim()
    if (!barcode) {
      throw new Error("Barcode is required for batch inventory")
    }
    const status = String(product.status ?? "").trim()
    if (!status || !STATUS_OPTIONS_SET.has(status as (typeof STATUS_OPTIONS)[number])) {
      throw new Error("Status must be active or deactive")
    }
    const rack = String(product.rack ?? "").trim()
    if (rack && !RACK_OPTIONS_SET.has(rack as (typeof RACK_OPTIONS)[number])) {
      throw new Error("Rack must be one of predefined options")
    }

    const noExpiry = product.noExpiry === true
    const expiryRaw = noExpiry ? "" : (product.expiry || "").trim()
    let expiryDate: Date | undefined
    if (expiryRaw) {
      expiryDate = new Date(expiryRaw)
      if (Number.isNaN(expiryDate.getTime())) {
        throw new Error("Invalid Expiry Date")
      }
    }

    const quantity = Number(product.stock ?? 0)
    if (expiryRaw && (!Number.isFinite(quantity) || quantity <= 0)) {
      throw new Error("Batch quantity must be greater than 0 when expiry is set")
    }
    if (Number.isFinite(quantity) && quantity > 0 && !expiryRaw && !noExpiry) {
      throw new Error("Select expiry date or choose No expiry when batch quantity is set")
    }

    const price = Number(product.price ?? 0)
    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Selling price is required")
    }

    const costRaw = product.costPrice
    const costPrice =
      costRaw === undefined || costRaw === null || costRaw === ("" as unknown as number)
        ? 0
        : Number(costRaw)
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new Error("Invalid cost price")
    }

    const mrpRaw = product.mrp
    const mrp =
      mrpRaw != null && Number.isFinite(Number(mrpRaw)) && Number(mrpRaw) > 0
        ? Number(mrpRaw)
        : undefined

    const result = await batchService.addOrUpdateProductWithBatch({
      name: product.name || "Unnamed Product",
      barcode,
      category: (product.category ?? "").trim(),
      rack,
      tag: String(product.tag ?? "").trim(),
      status,
      price,
      costPrice,
      unit: normalizeProductUnit(product.unit),
      minStock: Number.isFinite(Number(product.minStock)) ? Number(product.minStock) : 10,
      brand: product.brand?.trim() ? product.brand.trim() : undefined,
      expiryDate: expiryDate ?? null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : undefined,
      noExpiry: noExpiry || undefined,
      mrp,
      discountPercent:
        product.discountPercent != null && Number(product.discountPercent) > 0
          ? Number(product.discountPercent)
          : undefined,
      imageUrl: product.imageUrl?.trim() || undefined,
    })

    return result.productId
  }, [batchService])

  const getProductByBarcode = useCallback(async (barcode: string) => {
    return batchService.getProductByBarcode(barcode)
  }, [batchService])

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    const payload = Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(
        ([key, v]) =>
          v !== undefined &&
          key !== "batches" &&
          key !== "id" &&
          key !== "createdAt" &&
          key !== "updatedAt"
      )
    ) as Record<string, unknown>
    if (typeof payload.unit === "string" || typeof payload.unit === "number") {
      const u = normalizeProductUnit(payload.unit)
      payload.unit = u
      payload.units = u
    }
    await updateDoc(doc(db, col("products"), id), {
      ...payload,
      updatedAt: Timestamp.now(),
    })
  }, [])

  const bulkUpdateProductCategory = useCallback(async (ids: string[], category: string) => {
    const nextCategory = category.trim()
    if (!nextCategory || ids.length === 0) return
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 450) {
      chunks.push(ids.slice(i, i + 450))
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db)
      const now = Timestamp.now()
      for (const id of chunk) {
        batch.update(doc(db, col("products"), id), { category: nextCategory, updatedAt: now })
      }
      await batch.commit()
    }
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(doc(db, col("products"), id))
  }, [])

  const bulkAddProducts = useCallback(async (productsData: Omit<Product, "id" | "createdAt" | "updatedAt" | "batches">[]) => {
    const batch = writeBatch(db)
    productsData.forEach((product) => {
      const docRef = doc(collection(db, col("products")))
      const u = normalizeProductUnit(product.unit)
      batch.set(docRef, {
        ...product,
        unit: u,
        units: u,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    await batch.commit()
  }, [])

  return { products, loading, error, addProduct, updateProduct, bulkUpdateProductCategory, deleteProduct, bulkAddProducts, getProductByBarcode }
}

// Customers Hook
export function useCustomers() {
  const accountMode = useAccountModeScope()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCustomers([])
    setLoading(true)
    const q = query(collection(db, col("customers")), orderBy("name"))
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: convertTimestamp(doc.data().createdAt),
          updatedAt: convertTimestamp(doc.data().updatedAt),
        })) as Customer[]
        setCustomers(items)
        setLoading(false)
      },
      (err) => {
        console.error("Customers error:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [accountMode])

  const addCustomer = useCallback(async (customer: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, col("customers")), {
      ...omitUndefinedFields(customer as Record<string, unknown>),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  }, [])

  const updateCustomer = useCallback(async (id: string, data: Partial<Customer>) => {
    await updateDoc(doc(db, col("customers"), id), {
      ...omitUndefinedFields(data as Record<string, unknown>),
      updatedAt: Timestamp.now(),
    })
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    await deleteDoc(doc(db, col("customers"), id))
  }, [])

  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer }
}

// Sales Hook
export function useSales(constraints?: QueryConstraint[]) {
  const accountMode = useAccountModeScope()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSales([])
    setLoading(true)
    // No orderBy("createdAt"): mobile/Flutter docs use `soldAt` (string) only and would be excluded.
    const coll = collection(db, col("sales"))
    const q = constraints?.length ? query(coll, ...constraints) : coll

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((doc) => saleFromFirestoreDoc(doc))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        setSales(items)
        setLoading(false)
      },
      (err) => {
        console.error("Sales error:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [accountMode, constraints])

  return { sales, loading, error }
}

// Ledger Hook
export function useLedger(customerId?: string) {
  const accountMode = useAccountModeScope()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setEntries([])
      setLoading(false)
      return
    }

    // Equality-only query: no composite index. Sort by createdAt in memory (same as products/sales).
    const q = query(collection(db, col("ledger")), where("customerId", "==", customerId))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = (
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: convertTimestamp(doc.data().createdAt),
          })) as LedgerEntry[]
        ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        setEntries(items)
        setLoading(false)
      },
      (err) => {
        console.error("Ledger error:", err)
        setEntries([])
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [accountMode, customerId])

  const addEntry = useCallback(async (entry: Omit<LedgerEntry, "id" | "createdAt">) => {
    await addDoc(collection(db, col("ledger")), {
      ...entry,
      createdAt: Timestamp.now(),
    })
  }, [])

  return { entries, loading, addEntry }
}

const DASHBOARD_STATS_REFRESH_MS = 5 * 60 * 1000

type UseDashboardStatsOptions = {
  /** header = low-stock badge only (products read). full = all dashboard KPIs. */
  scope?: "header" | "full"
}

// Dashboard Stats Hook — one-time reads + periodic refresh (no always-on listeners).
export function useDashboardStats(options?: UseDashboardStatsOptions) {
  const scope = options?.scope ?? "full"
  const accountMode = useAccountModeScope()
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    pendingCredit: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayEnd = new Date(today)
      todayEnd.setDate(todayEnd.getDate() + 1)

      try {
        const productsSnap = await getDocs(collection(db, col("products")))
        if (cancelled) return

        const lowStock = productsSnap.docs.filter((d) =>
          isLowStockFromFirestoreData(d.data() as Record<string, unknown>)
        ).length

        if (scope === "header") {
          setStats((prev) => ({ ...prev, lowStockCount: lowStock }))
          return
        }

        const [customersSnap, globalStats, todaySalesList] = await Promise.all([
          getDocs(collection(db, col("customers"))),
          fetchGlobalDashboardStats(),
          fetchSalesInDateRange(today, todayEnd),
        ])
        if (cancelled) return

        let totalCredit = 0
        customersSnap.docs.forEach((d) => {
          totalCredit += firestoreNumber(d.data().balance, 0)
        })

        const todayTotal = todaySalesList.reduce((sum, sale) => sum + sale.total, 0)

        setStats({
          lowStockCount: lowStock,
          totalCustomers: customersSnap.size,
          pendingCredit: totalCredit,
          todaySales: todayTotal,
          totalRevenue: globalStats.totalRevenue,
        })
      } catch (err) {
        console.error("Dashboard stats load error:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const intervalId = window.setInterval(() => void load(), DASHBOARD_STATS_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [accountMode, scope])

  return { stats, loading }
}

// Categories from `product_categories` plus names already used on products
export function useCategories() {
  const accountMode = useAccountModeScope()
  const { products, loading: productsLoading, bulkUpdateProductCategory } = useProducts()
  const [stored, setStored] = useState<{ id: string; name: string }[]>([])
  const [storedLoading, setStoredLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, col("product_categories")),
      (snapshot) => {
        setStored(
          snapshot.docs
            .map((d) => ({
              id: d.id,
              name: String((d.data() as { name?: unknown }).name ?? "").trim(),
            }))
            .filter((c) => c.name.length > 0)
        )
        setStoredLoading(false)
      },
      (err) => {
        console.error("Categories error:", err)
        setStoredLoading(false)
      }
    )
    return () => unsub()
  }, [accountMode])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products) {
      const name = (product.category ?? "").trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }

    const byName = new Map<string, { id: string; name: string; productCount: number }>()
    for (const row of stored) {
      byName.set(row.name, {
        id: row.id,
        name: row.name,
        productCount: counts.get(row.name) ?? 0,
      })
    }
    for (const [name, productCount] of counts) {
      if (!byName.has(name)) {
        byName.set(name, { id: name, name, productCount })
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [products, stored])

  const hasCategoryName = useCallback(
    (name: string, except?: string) => {
      const n = name.trim().toLowerCase()
      const skip = (except ?? "").trim().toLowerCase()
      return categories.some((c) => c.name.toLowerCase() === n && c.name.toLowerCase() !== skip)
    },
    [categories]
  )

  const addCategory = useCallback(
    async (name: string) => {
      const next = name.trim()
      if (!next) throw new Error("Category name is required")
      if (hasCategoryName(next)) throw new Error("That category already exists")
      await addDoc(collection(db, col("product_categories")), {
        name: next,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    },
    [hasCategoryName]
  )

  const renameCategory = useCallback(
    async (oldName: string, newName: string) => {
      const from = oldName.trim()
      const to = newName.trim()
      if (!from) throw new Error("Category not found")
      if (!to) throw new Error("Category name is required")
      if (from.toLowerCase() !== to.toLowerCase() && hasCategoryName(to, from)) {
        throw new Error("That category already exists")
      }
      if (from === to) return

      const productIds = products.filter((p) => (p.category ?? "").trim() === from).map((p) => p.id)
      if (productIds.length > 0) {
        await bulkUpdateProductCategory(productIds, to)
      }

      const matchingDocs = stored.filter((c) => c.name === from)
      if (matchingDocs.length > 0) {
        const now = Timestamp.now()
        await Promise.all(
          matchingDocs.map((c) =>
            updateDoc(doc(db, col("product_categories"), c.id), { name: to, updatedAt: now })
          )
        )
      } else {
        await addDoc(collection(db, col("product_categories")), {
          name: to,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      }
    },
    [bulkUpdateProductCategory, hasCategoryName, products, stored]
  )

  return {
    categories,
    loading: productsLoading || storedLoading,
    addCategory,
    renameCategory,
  }
}

// Orders Hook
export function useOrders() {
  const accountMode = useAccountModeScope()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, col("orders")), orderBy("orderDate", "desc"))
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            orderDate: convertTimestamp(data.orderDate),
          }
        }) as Order[]
        setOrders(items)
        setLoading(false)
      },
      (err) => {
        console.error("Orders error:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [accountMode])

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
    await updateDoc(doc(db, col("orders"), id), {
      status,
    })
  }, [])

  const deleteOrder = useCallback(async (id: string) => {
    await deleteDoc(doc(db, col("orders"), id))
  }, [])

  return { orders, loading, error, updateOrderStatus, deleteOrder }
}
