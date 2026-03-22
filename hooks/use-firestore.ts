"use client"

import { useEffect, useState, useCallback } from "react"
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  writeBatch,
  limit,
  QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product, Customer, Sale, LedgerEntry, DashboardStats } from "@/lib/types"
import { saleFromFirestoreDoc } from "@/lib/sale-from-firestore"
import {
  coerceProductStockFromFirestore,
  firestoreNumber,
  isLowStockFromFirestoreData,
  minStockThresholdFromFirestore,
} from "@/lib/stock"

// Helper to convert Firestore timestamp
const convertTimestamp = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date()
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  return timestamp
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

function productFromFirestoreDoc(doc: QueryDocumentSnapshot): Product {
  const data = doc.data() as Record<string, unknown>
  return {
    id: doc.id,
    name: trimStr(data.name),
    category: trimStr(data.category),
    barcode: optionalBarcode(data.barcode),
    price: firestoreNumber(data.price, 0),
    costPrice: firestoreNumber(data.costPrice, 0),
    stock: coerceProductStockFromFirestore(data),
    minStock: (() => {
      const raw = data.minStock
      if (raw !== undefined && raw !== null) {
        const n = firestoreNumber(raw, NaN)
        if (Number.isFinite(n)) return n
      }
      return minStockThresholdFromFirestore(data)
    })(),
    unit: trimStr(data.unit),
    createdAt: convertTimestamp(data.createdAt as Timestamp | Date | undefined),
    updatedAt: convertTimestamp(data.updatedAt as Timestamp | Date | undefined),
  }
}

// Products Hook
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Full collection (no orderBy): orderBy("name") omits docs missing `name`, so low-stock counts
    // diverged from dashboard / mobile. Sort client-side instead.
    const unsubscribe = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const items = snapshot.docs.map((doc) => productFromFirestoreDoc(doc))
          .sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
          )
        setProducts(items)
        setLoading(false)
      },
      (err) => {
        console.error("Products error:", err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const addProduct = useCallback(async (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, "products"), {
      ...product,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  }, [])

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    await updateDoc(doc(db, "products", id), {
      ...data,
      updatedAt: Timestamp.now(),
    })
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "products", id))
  }, [])

  const bulkAddProducts = useCallback(async (productsData: Omit<Product, "id" | "createdAt" | "updatedAt">[]) => {
    const batch = writeBatch(db)
    productsData.forEach((product) => {
      const docRef = doc(collection(db, "products"))
      batch.set(docRef, {
        ...product,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    await batch.commit()
  }, [])

  return { products, loading, error, addProduct, updateProduct, deleteProduct, bulkAddProducts }
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
