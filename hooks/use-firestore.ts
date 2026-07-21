"use client"

import { useEffect, useState, useCallback } from "react"
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
import type { Product, ProductBatch, Customer, Sale, LedgerEntry, DashboardStats, Order } from "@/lib/types"
import { saleFromFirestoreDoc } from "@/lib/sale-from-firestore"
import { InventoryBatchService } from "@/lib/features/inventory/services/inventory_batch_service"
import {
  coerceProductStockFromFirestore,
  firestoreNumber,
  isLowStockFromFirestoreData,
  minStockThresholdFromFirestore,
  productUnitFromFirestore,
  normalizeProductUnit,
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
  const batches: ProductBatch[] = Array.isArray(rawBatches)
    ? (rawBatches as ProductBatch[]).map((b) => ({
        id: b.id,
        quantity: Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : 0,
        expiryDate: convertTimestamp(b.expiryDate),
        createdAt: convertTimestamp(b.createdAt),
      }))
    : []
  return {
    id,
    name: trimStr(data.name),
    category: trimStr(data.category),
    rack,
    tag,
    status,
    barcode: optionalBarcode(data.barcode),
    brand: brand.length > 0 ? brand : undefined,
    price: firestoreNumber(data.price, 0),
    costPrice: firestoreNumber(data.costPrice, 0),
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
  const batchService = new InventoryBatchService(db)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Full collection (no orderBy): orderBy("name") omits docs missing `name`, so low-stock counts
    // diverged from dashboard / mobile. Sort client-side instead.
    const unsubscribe = onSnapshot(
      collection(db, "products"),
      async (snapshot) => {
        try {
          const items = await Promise.all(
            snapshot.docs.map(async (doc) => {
              const data = doc.data() as Record<string, unknown>
              try {
                const batchesSnap = await getDocs(collection(db, "products", doc.id, "batches"))
                const batchList: ProductBatch[] = batchesSnap.docs.map((b) => {
                  const bd = b.data() as Record<string, unknown>
                  return {
                    id: b.id,
                    quantity: Number.isFinite(Number(bd.quantity)) ? Number(bd.quantity) : 0,
                    expiryDate: convertTimestamp(bd.expiryDate),
                    createdAt: convertTimestamp(bd.createdAt),
                  }
                })
                batchList.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
                const totalStock = batchList.reduce((sum, b) => sum + b.quantity, 0)
                return productFromData(doc.id, { ...data, __totalStock: totalStock, __batches: batchList })
              } catch (batchErr) {
                // Fallback so one bad batch subquery doesn't keep whole UI in loading state.
                console.error("Batches read error:", batchErr)
                return productFromData(doc.id, data)
              }
            })
          )
          items.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
          )
          setProducts(items)
          setError(null)
        } catch (err) {
          console.error("Products snapshot processing error:", err)
          setError(err instanceof Error ? err.message : "Failed to process products")
          setProducts([])
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        console.error("Products error:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const addProduct = useCallback(async (product: Omit<Product, "id" | "createdAt" | "updatedAt" | "batches">) => {
    const barcode = String(product.barcode ?? "").trim()
    if (!barcode) {
      throw new Error("Barcode is required for batch inventory")
    }
    const rack = String(product.rack ?? "").trim()
    if (!rack || !RACK_OPTIONS_SET.has(rack as (typeof RACK_OPTIONS)[number])) {
      throw new Error("Rack must be one of predefined options")
    }
    const status = String(product.status ?? "").trim()
    if (!status || !STATUS_OPTIONS_SET.has(status as (typeof STATUS_OPTIONS)[number])) {
      throw new Error("Status must be active or deactive")
    }
    const expiryRaw = (product.expiry || "").trim()
    if (!expiryRaw) {
      throw new Error("Expiry Date is required for batch creation")
    }
    const expiryDate = new Date(expiryRaw)
    if (Number.isNaN(expiryDate.getTime())) {
      throw new Error("Invalid Expiry Date")
    }
    const quantity = Number(product.stock ?? 0)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Quantity must be greater than 0")
    }

    const result = await batchService.addOrUpdateProductWithBatch({
      name: product.name || "Unnamed Product",
      barcode,
      category: (product.category ?? "").trim(),
      rack,
      tag: String(product.tag ?? "").trim(),
      status,
      price: Number(product.price ?? 0),
      costPrice: Number(product.costPrice ?? 0),
      unit: normalizeProductUnit(product.unit),
      minStock: Number.isFinite(Number(product.minStock)) ? Number(product.minStock) : 10,
      brand: product.brand?.trim() ? product.brand.trim() : undefined,
      expiryDate,
      quantity: Math.floor(quantity),
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
    await updateDoc(doc(db, "products", id), {
      ...payload,
      updatedAt: Timestamp.now(),
    })
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "products", id))
  }, [])

  const bulkAddProducts = useCallback(async (productsData: Omit<Product, "id" | "createdAt" | "updatedAt" | "batches">[]) => {
    const batch = writeBatch(db)
    productsData.forEach((product) => {
      const docRef = doc(collection(db, "products"))
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

  return { products, loading, error, addProduct, updateProduct, deleteProduct, bulkAddProducts, getProductByBarcode }
}

// Customers Hook
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("name"))
    
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
  }, [])

  const addCustomer = useCallback(async (customer: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, "customers"), {
      ...customer,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  }, [])

  const updateCustomer = useCallback(async (id: string, data: Partial<Customer>) => {
    await updateDoc(doc(db, "customers", id), {
      ...data,
      updatedAt: Timestamp.now(),
    })
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "customers", id))
  }, [])

  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer }
}

// Sales Hook
export function useSales(constraints?: QueryConstraint[]) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No orderBy("createdAt"): mobile/Flutter docs use `soldAt` (string) only and would be excluded.
    const coll = collection(db, "sales")
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
  }, [constraints])

  return { sales, loading, error }
}

// Ledger Hook
export function useLedger(customerId?: string) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) {
      setEntries([])
      setLoading(false)
      return
    }

    // Equality-only query: no composite index. Sort by createdAt in memory (same as products/sales).
    const q = query(collection(db, "ledger"), where("customerId", "==", customerId))

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
  }, [customerId])

  const addEntry = useCallback(async (entry: Omit<LedgerEntry, "id" | "createdAt">) => {
    await addDoc(collection(db, "ledger"), {
      ...entry,
      createdAt: Timestamp.now(),
    })
  }, [])

  return { entries, loading, addEntry }
}

// Dashboard Stats Hook
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    pendingCredit: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Listen to products for low stock
    const productsUnsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const lowStock = snapshot.docs.filter((doc) =>
        isLowStockFromFirestoreData(doc.data() as Record<string, unknown>)
      ).length
      setStats((prev) => ({ ...prev, lowStockCount: lowStock }))
    })

    // Listen to customers for count and pending credit
    const customersUnsubscribe = onSnapshot(collection(db, "customers"), (snapshot) => {
      const totalCredit = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().balance || 0)
      }, 0)
      setStats((prev) => ({
        ...prev,
        totalCustomers: snapshot.size,
        pendingCredit: totalCredit,
      }))
    })

    const todayEnd = new Date(today)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // All sales: map Flutter line docs + web invoices; filter today client-side (soldAt / createdAt).
    const salesUnsubscribe = onSnapshot(collection(db, "sales"), (snapshot) => {
      let todayTotal = 0
      let revenueTotal = 0
      snapshot.docs.forEach((doc) => {
        const sale = saleFromFirestoreDoc(doc)
        revenueTotal += sale.total
        if (sale.createdAt >= today && sale.createdAt < todayEnd) {
          todayTotal += sale.total
        }
      })
      setStats((prev) => ({ ...prev, todaySales: todayTotal, totalRevenue: revenueTotal }))
      setLoading(false)
    })

    return () => {
      productsUnsubscribe()
      customersUnsubscribe()
      salesUnsubscribe()
    }
  }, [])

  return { stats, loading }
}

// Categories derived from products
export function useCategories() {
  const { products, loading } = useProducts()
  
  const categories = products.reduce((acc, product) => {
    const existing = acc.find((c) => c.name === product.category)
    if (existing) {
      existing.productCount++
    } else {
      acc.push({ id: product.category, name: product.category, productCount: 1 })
    }
    return acc
  }, [] as { id: string; name: string; productCount: number }[])

  return { categories, loading }
}

// Orders Hook
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("orderDate", "desc"))
    
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
  }, [])

  const updateOrderStatus = useCallback(async (id: string, status: string) => {
    await updateDoc(doc(db, "orders", id), {
      status,
    })
  }, [])

  const deleteOrder = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "orders", id))
  }, [])

  return { orders, loading, error, updateOrderStatus, deleteOrder }
}
