import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { omitUndefinedFields } from "@/lib/utils"
import { lineDiscountSaved, lineItemAmount } from "@/lib/billing/line-discount"
import type { Sale, SaleItem } from "@/lib/types"
import { adjustProductStockByBarcode } from "./stock-adjust"

export function normalizeSaleItem(item: SaleItem): SaleItem {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const price = Math.max(0, Number(item.price) || 0)
  const discountPercent = Number(item.discountPercent) || 0
  const total =
    discountPercent > 0 ? lineItemAmount(quantity, price, discountPercent) : Math.round(quantity * price)
  return {
    productId: String(item.productId ?? "").trim(),
    productName: String(item.productName ?? "").trim() || "Item",
    quantity,
    price,
    total,
    ...(item.mrp && item.mrp > 0 ? { mrp: item.mrp } : {}),
    ...(discountPercent > 0 ? { discountPercent } : {}),
  }
}

export function totalsFromItems(items: SaleItem[]) {
  const normalized = items.map(normalizeSaleItem).filter((item) => item.quantity > 0)
  const subtotal = normalized.reduce((sum, item) => {
    const base = item.discountPercent ? item.price : item.price
    return sum + base * item.quantity
  }, 0)
  const discount = normalized.reduce(
    (sum, item) => sum + lineDiscountSaved(item.quantity, item.price, item.discountPercent ?? 0),
    0
  )
  const total = normalized.reduce((sum, item) => sum + item.total, 0)
  return { items: normalized, subtotal: discount > 0 ? subtotal : total, discount, total }
}

function stockKey(item: SaleItem): string | null {
  const id = String(item.productId ?? "").trim()
  if (!id || id.startsWith("OTHER-")) return null
  return id
}

function qtyByStockKey(items: SaleItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = stockKey(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + Math.max(0, item.quantity))
  }
  return map
}

export async function saveEditedSale(input: {
  sale: Sale
  items: SaleItem[]
  reason?: string
}): Promise<void> {
  const next = totalsFromItems(input.items)
  const prevQty = qtyByStockKey(input.sale.items)
  const nextQty = qtyByStockKey(next.items)
  const keys = new Set([...prevQty.keys(), ...nextQty.keys()])

  for (const key of keys) {
    const delta = (nextQty.get(key) ?? 0) - (prevQty.get(key) ?? 0)
    if (delta) await adjustProductStockByBarcode(key, delta)
  }

  const reason = input.reason?.trim()
  await updateDoc(
    doc(db, "sales", input.sale.id),
    omitUndefinedFields({
      items: next.items,
      subtotal: next.subtotal,
      discount: next.discount,
      total: next.total,
      amountPaid: next.total,
      change: 0,
      editedAt: Timestamp.now(),
      editReason: reason || undefined,
    })
  )
}

export async function deleteSale(sale: Sale): Promise<void> {
  const prevQty = qtyByStockKey(sale.items)
  for (const [key, qty] of prevQty) {
    if (qty) await adjustProductStockByBarcode(key, -qty)
  }
  await deleteDoc(doc(db, "sales", sale.id))
}
