/**
 * Purchase Catalog — Firebase Service
 * Firestore collection: `purchase_catalogs`
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { PurchaseCatalog, CatalogProduct } from "./models"

const COL = "purchase_catalogs"

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  return new Date()
}

function fromFirestore(id: string, data: Record<string, unknown>): PurchaseCatalog {
  return {
    id,
    name: (data.name as string) ?? "Unnamed",
    source: (data.source as string) ?? "",
    color: (data.color as string) ?? "#6366f1",
    products: (data.products as CatalogProduct[]) ?? [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function subscribePurchaseCatalogs(
  onData: (catalogs: PurchaseCatalog[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, COL), orderBy("createdAt", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      const result: PurchaseCatalog[] = snap.docs.map((d) =>
        fromFirestore(d.id, d.data() as Record<string, unknown>)
      )
      onData(result)
    },
    (err) => {
      console.error("PurchaseCatalog subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function addPurchaseCatalog(
  data: Omit<PurchaseCatalog, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updatePurchaseCatalog(
  id: string,
  data: Partial<Omit<PurchaseCatalog, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deletePurchaseCatalog(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
