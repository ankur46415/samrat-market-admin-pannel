import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import type { OrderMgmtGroup, OrderMgmtItem, OrderMgmtOrder } from "./models"
import { sanitizeItem, sanitizeOrder } from "./models"

const COL = "order_management_groups"

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate()
  if (v instanceof Date) return v
  const d = new Date(String(v ?? ""))
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function fromFirestore(id: string, data: Record<string, unknown>): OrderMgmtGroup {
  return {
    id,
    name: (data.name as string) ?? "Unnamed",
    source: (data.source as string) ?? "",
    color: (data.color as string) ?? "#0d9488",
    items: ((data.items as OrderMgmtItem[]) ?? [])
      .map((item) => sanitizeItem(item as OrderMgmtItem))
      .filter((item): item is OrderMgmtItem => item != null),
    orders: ((data.orders as OrderMgmtOrder[]) ?? [])
      .map((order) => sanitizeOrder(order as OrderMgmtOrder))
      .filter((order): order is OrderMgmtOrder => order != null),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function subscribeOrderMgmtGroups(
  onData: (groups: OrderMgmtGroup[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, col(COL)), orderBy("createdAt", "asc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => fromFirestore(d.id, d.data() as Record<string, unknown>)))
    },
    (err) => {
      console.error("Order management subscribe error:", err)
      onError?.(err)
    }
  )
}

export async function addOrderMgmtGroup(
  data: Omit<OrderMgmtGroup, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, col(COL)), {
    name: data.name,
    source: data.source,
    color: data.color,
    items: (data.items ?? []).map((item) => sanitizeItem(item)).filter((item): item is OrderMgmtItem => item != null),
    orders: (data.orders ?? []).map((order) => sanitizeOrder(order)).filter((order): order is OrderMgmtOrder => order != null),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateOrderMgmtGroup(
  id: string,
  data: Partial<Omit<OrderMgmtGroup, "id" | "createdAt">>
): Promise<void> {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  }
  if (data.items) {
    payload.items = data.items.map((item) => sanitizeItem(item)).filter((item): item is OrderMgmtItem => item != null)
  }
  if (data.orders) {
    payload.orders = data.orders
      .map((order) => sanitizeOrder(order))
      .filter((order): order is OrderMgmtOrder => order != null)
  }
  await updateDoc(doc(db, col(COL), id), payload as UpdateData<DocumentData>)
}

export async function deleteOrderMgmtGroup(id: string): Promise<void> {
  await deleteDoc(doc(db, col(COL), id))
}
