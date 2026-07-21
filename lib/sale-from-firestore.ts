import type { QueryDocumentSnapshot } from "firebase/firestore"
import { Timestamp } from "firebase/firestore"
import type { Sale, SaleItem } from "@/lib/types"
import { firestoreNumber } from "@/lib/stock"

function saleDateFromData(data: Record<string, unknown>): Date {
  const soldAt = data.soldAt
  if (typeof soldAt === "string" && soldAt.trim()) {
    const d = new Date(soldAt)
    if (!Number.isNaN(d.getTime())) return d
  }
  const createdAt = data.createdAt
  if (createdAt instanceof Timestamp) return createdAt.toDate()
  if (createdAt instanceof Date) return createdAt
  if (typeof createdAt === "string" && createdAt.trim()) {
    const d = new Date(createdAt)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function normalizePayment(value: unknown): Sale["paymentMethod"] {
  const v = typeof value === "string" ? value.toLowerCase() : ""
  if (v === "cash" || v === "upi" || v === "card" || v === "credit") return v
  return "cash"
}

/** Flutter / mobile: one Firestore doc = one line (soldAt, totalAmount, pricePerUnit, …) */
function isLineItemSale(data: Record<string, unknown>): boolean {
  if (Array.isArray(data.items) && data.items.length > 0) return false
  if (typeof data.soldAt === "string" && data.soldAt.trim()) return true
  if (data.productName != null && (data.totalAmount != null || data.pricePerUnit != null)) return true
  return false
}

function mapSaleItems(raw: unknown): SaleItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((it: Record<string, unknown>) => ({
    productId: String(it.productId ?? ""),
    productName: String(it.productName ?? ""),
    quantity: firestoreNumber(it.quantity, 0),
    price: firestoreNumber(it.price, 0),
    total: firestoreNumber(it.total, 0),
  }))
}

/**
 * Normalize web invoice docs or mobile line-item docs into `Sale`.
 */
export function saleFromFirestoreDoc(doc: QueryDocumentSnapshot): Sale {
  const data = doc.data() as Record<string, unknown>

  if (!isLineItemSale(data)) {
    const items = mapSaleItems(data.items)
    const total = firestoreNumber(data.total, 0)
    const createdAt = saleDateFromData(data)
    return {
      id: doc.id,
      billNo: String(data.billNo ?? doc.id),
      customerId: typeof data.customerId === "string" ? data.customerId : undefined,
      customerName: typeof data.customerName === "string" ? data.customerName.trim() : undefined,
      items,
      subtotal: firestoreNumber(data.subtotal, total),
      discount: firestoreNumber(data.discount, 0),
      tax: firestoreNumber(data.tax, 0),
      total,
      paymentMethod: normalizePayment(data.paymentMethod),
      amountPaid: firestoreNumber(data.amountPaid, total),
      change: firestoreNumber(data.change, 0),
      createdAt,
      createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    }
  }

  const qty = firestoreNumber(data.quantity, 1)
  const price = firestoreNumber(data.pricePerUnit ?? data.price, 0)
  const lineTotal = firestoreNumber(data.totalAmount ?? data.total, qty * price)
  const item: SaleItem = {
    productId: String(data.productId ?? data.barcode ?? ""),
    productName: (typeof data.productName === "string" ? data.productName : "Item").trim() || "Item",
    quantity: qty,
    price,
    total: lineTotal,
  }

  return {
    id: doc.id,
    billNo: String(data.billNo ?? data.id ?? `LINE-${doc.id.slice(0, 8)}`),
    customerId: typeof data.customerId === "string" ? data.customerId : undefined,
    customerName: typeof data.customerName === "string" ? data.customerName.trim() : undefined,
    items: [item],
    subtotal: lineTotal,
    discount: 0,
    tax: 0,
    total: lineTotal,
    paymentMethod: normalizePayment(data.paymentMethod),
    amountPaid: lineTotal,
    change: 0,
    createdAt: saleDateFromData(data),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
  }
}
