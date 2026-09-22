import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Customer } from "@/lib/types"
import { firestoreNumber } from "@/lib/stock"

function convertTimestamp(timestamp: unknown): Date {
  if (!timestamp) return new Date()
  if (timestamp instanceof Date) return timestamp
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp) {
    const d = (timestamp as { toDate: () => Date }).toDate()
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const d = new Date(timestamp)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  return new Date()
}

function customerFromDoc(id: string, data: Record<string, unknown>): Customer {
  const email = typeof data.email === "string" ? data.email.trim() : ""
  const address = typeof data.address === "string" ? data.address.trim() : ""
  return {
    id,
    name: String(data.name ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
    email: email.length > 0 ? email : undefined,
    address: address.length > 0 ? address : undefined,
    balance: firestoreNumber(data.balance, 0),
    totalPurchases: firestoreNumber(data.totalPurchases, 0),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
  }
}

/** Exact phone lookup — 1 read when indexed on `phone`. */
export async function fetchCustomerByPhone(phone: string): Promise<Customer | null> {
  const normalized = phone.trim()
  if (!normalized) return null

  const q = query(collection(db, "customers"), where("phone", "==", normalized), limit(1))
  const snap = await getDocs(q)
  if (!snap.empty) {
    const d = snap.docs[0]
    return customerFromDoc(d.id, d.data() as Record<string, unknown>)
  }

  const digitsOnly = normalized.replace(/\D/g, "")
  if (digitsOnly && digitsOnly !== normalized) {
    const altSnap = await getDocs(
      query(collection(db, "customers"), where("phone", "==", digitsOnly), limit(1))
    )
    if (!altSnap.empty) {
      const d = altSnap.docs[0]
      return customerFromDoc(d.id, d.data() as Record<string, unknown>)
    }
  }

  return null
}

/** Create customer — single write, no collection listener. */
export async function createCustomer(
  customer: Omit<Customer, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, "customers"), {
    name: customer.name.trim(),
    phone: customer.phone.trim(),
    ...(customer.email ? { email: customer.email.trim() } : {}),
    ...(customer.address ? { address: customer.address.trim() } : {}),
    balance: customer.balance ?? 0,
    totalPurchases: customer.totalPurchases ?? 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return docRef.id
}

/** Direct customer doc read by id — 1 read. */
export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  const snap = await getDoc(doc(db, "customers", trimmed))
  if (!snap.exists()) return null
  return customerFromDoc(snap.id, snap.data() as Record<string, unknown>)
}
