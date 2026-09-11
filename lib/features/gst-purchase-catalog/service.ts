/**
 * GST Purchase Catalog — Firestore collection: `gst_purchase_catalogs`
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
  type DocumentData,
  type UpdateData,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { GstPurchaseCatalog, GstCatalogProduct } from "./models"
import {
  DEFAULT_GST_PERCENTS,
  DEFAULT_SALE_MARGIN_PERCENTS,
  normalizeGstPercents,
  normalizeSaleMarginPercents,
  normalizeGstSaleRecordPercents,
  sanitizeGstCatalogOrder,
  sanitizeGstCatalogProduct,
  catalogProductGstPercent,
  catalogProductSalePrice,
} from "./models"
import type { GstSaleRecordPercents } from "./models"

function normalizeGstCatalogProduct(p: GstCatalogProduct): GstCatalogProduct {
  const raw = p as GstCatalogProduct & {
    orderTag?: string
    orderId?: string
    order_ID?: string
    gst?: number
    gstPercent?: number
    GST?: number
    salePrice?: number
    selling_price?: number
  }
  return sanitizeGstCatalogProduct({
    ...p,
    order_tag: String(p.order_tag ?? raw.orderTag ?? "").trim() || "NA",
    order_id: String(p.order_id ?? raw.orderId ?? raw.order_ID ?? "").trim() || undefined,
    gst_percent: catalogProductGstPercent(p),
    sale_price: catalogProductSalePrice(p),
  })
}

const COL = "gst_purchase_catalogs"

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  return new Date()
}

function fromFirestore(id: string, data: Record<string, unknown>): GstPurchaseCatalog {
  return {
    id,
    name: (data.name as string) ?? "Unnamed",
    source: (data.source as string) ?? "",
    color: (data.color as string) ?? "#0d9488",
    products: ((data.products as GstCatalogProduct[]) ?? []).map(normalizeGstCatalogProduct),
    orders: ((data.orders as GstPurchaseCatalog["orders"]) ?? [])
      .map((o) => sanitizeGstCatalogOrder(o))
      .filter((o): o is NonNullable<typeof o> => o != null),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function subscribeGstPurchaseCatalogs(
  onData: (catalogs: GstPurchaseCatalog[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, COL), orderBy("createdAt", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      const result: GstPurchaseCatalog[] = snap.docs.map((d) =>
        fromFirestore(d.id, d.data() as Record<string, unknown>)
      )
      onData(result)
    },
    (err) => {
      console.error("GstPurchaseCatalog subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function addGstPurchaseCatalog(
  data: Omit<GstPurchaseCatalog, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    products: (data.products ?? []).map(sanitizeGstCatalogProduct),
    orders: (data.orders ?? []).map(sanitizeGstCatalogOrder).filter((o): o is NonNullable<typeof o> => o != null),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateGstPurchaseCatalog(
  id: string,
  data: Partial<Omit<GstPurchaseCatalog, "id" | "createdAt">>
): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  }
  if (data.products) {
    payload.products = data.products.map(sanitizeGstCatalogProduct)
  }
  if (data.orders) {
    payload.orders = data.orders.map(sanitizeGstCatalogOrder).filter((o): o is NonNullable<typeof o> => o != null)
  }
  await updateDoc(doc(db, COL, id), payload as UpdateData<DocumentData>)
}

export async function deleteGstPurchaseCatalog(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

const SETTINGS_COL = "gst_purchase_catalog_settings"
const GST_DOC = "gst_percents"
const MARGIN_DOC = "sale_margins"

export function subscribeGstPercents(
  onData: (percents: number[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, SETTINGS_COL, GST_DOC),
    (snap) => {
      if (!snap.exists()) {
        onData([...DEFAULT_GST_PERCENTS])
        return
      }
      onData(normalizeGstPercents(snap.data()?.percents))
    },
    (err) => {
      console.error("GST percents subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function saveGstPercents(percents: number[]): Promise<void> {
  await setDoc(
    doc(db, SETTINGS_COL, GST_DOC),
    {
      percents: normalizeGstPercents(percents),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export function subscribeGstSaleMarginPercents(
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
      console.error("GST sale margin percents subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function saveGstSaleMarginPercents(percents: number[]): Promise<void> {
  await setDoc(
    doc(db, SETTINGS_COL, MARGIN_DOC),
    {
      percents: normalizeSaleMarginPercents(percents),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

const SALE_RECORD_DOC = "gst_sale_record"

export function subscribeGstSaleRecordPercents(
  onData: (percents: GstSaleRecordPercents) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, SETTINGS_COL, SALE_RECORD_DOC),
    (snap) => {
      if (!snap.exists()) {
        onData({})
        return
      }
      onData(normalizeGstSaleRecordPercents(snap.data()?.percentsByTag))
    },
    (err) => {
      console.error("GST sale record percents subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function saveGstSaleRecordPercents(percentsByTag: GstSaleRecordPercents): Promise<void> {
  await setDoc(
    doc(db, SETTINGS_COL, SALE_RECORD_DOC),
    {
      percentsByTag: normalizeGstSaleRecordPercents(percentsByTag),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
