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
  setDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { PurchaseCatalog, CatalogProduct } from "./models"
import { DEFAULT_SALE_MARGIN_PERCENTS, normalizeSaleMarginPercents } from "./models"

function normalizeCatalogProduct(p: CatalogProduct): CatalogProduct {
  const raw = p as CatalogProduct & {
    orderTag?: string
    order_no?: string
    orderNo?: string
    salePrice?: number
    selling_price?: number
  }
  const order_tag =
    String(p.order_tag ?? raw.orderTag ?? raw.order_no ?? raw.orderNo ?? "").trim() || "NA"
  const saleRaw = p.sale_price ?? raw.salePrice ?? raw.selling_price
  const saleNum = Number(saleRaw)
  return {
    ...p,
    order_tag,
    ...(Number.isFinite(saleNum) && saleNum >= 0 ? { sale_price: saleNum } : {}),
  }
}

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
    products: ((data.products as CatalogProduct[]) ?? []).map(normalizeCatalogProduct),
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

const SETTINGS_COL = "purchase_catalog_settings"
const MARGIN_DOC = "sale_margins"

export function subscribeSaleMarginPercents(
  onData: (percents: number[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, SETTINGS_COL, MARGIN_DOC),
    (snap) => {
      if (!snap.exists()) {
        onData([...DEFAULT_SALE_MARGIN_PERCENTS])
        return
      }
      onData(normalizeSaleMarginPercents(snap.data()?.percents))
    },
    (err) => {
      console.error("Sale margin percents subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function saveSaleMarginPercents(percents: number[]): Promise<void> {
  await setDoc(
    doc(db, SETTINGS_COL, MARGIN_DOC),
    {
      percents: normalizeSaleMarginPercents(percents),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
