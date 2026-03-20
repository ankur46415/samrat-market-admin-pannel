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
  getDocs,
  Timestamp,
  writeBatch,
  limit,
  QueryConstraint,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product, Customer, Sale, LedgerEntry, DashboardStats } from "@/lib/types"

// Helper to convert Firestore timestamp
const convertTimestamp = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date()
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  return timestamp
}

// Products Hook
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"))
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: convertTimestamp(doc.data().createdAt),
          updatedAt: convertTimestamp(doc.data().updatedAt),
        })) as Product[]
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
    const baseConstraints = [orderBy("createdAt", "desc"), limit(500)]
    const q = query(collection(db, "sales"), ...(constraints || baseConstraints))
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: convertTimestamp(doc.data().createdAt),
        })) as Sale[]
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

    const q = query(
      collection(db, "ledger"),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: convertTimestamp(doc.data().createdAt),
      })) as LedgerEntry[]
      setEntries(items)
      setLoading(false)
    })

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
      const lowStock = snapshot.docs.filter((doc) => {
        const data = doc.data()
        return data.stock <= (data.minStock || 10)
      }).length
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

    // Listen to today's sales
    const salesQuery = query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(today)),
      orderBy("createdAt", "desc")
    )
    const salesUnsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const todayTotal = snapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0)
      setStats((prev) => ({ ...prev, todaySales: todayTotal }))
      setLoading(false)
    })

    // Get total revenue (all time)
    getDocs(collection(db, "sales")).then((snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0)
      setStats((prev) => ({ ...prev, totalRevenue: total }))
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
