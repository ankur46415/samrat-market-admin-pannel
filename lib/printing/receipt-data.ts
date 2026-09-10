export type ReceiptLineItem = {
  name: string
  quantity: number
  price: number
  total: number
  basePrice?: number
  discountPercent?: number
  /** Product MRP when set in inventory */
  mrp?: number
}

export type ReceiptData = {
  billNo: string
  date: Date
  customerName?: string
  customerPhone?: string
  items: ReceiptLineItem[]
  subtotal: number
  discount?: number
  /** Total savings vs MRP across all lines */
  mrpSavings?: number
  tax?: number
  total: number
  paymentMethod?: string
  amountPaid?: number
  change?: number
}

type CatalogMrpRef = { id: string; barcode?: string; mrp?: number }

export function lineYouSaved(item: ReceiptLineItem): number {
  const unit = Number(item.price) || 0
  const qty = Number(item.quantity) || 0
  if (item.mrp && item.mrp > unit) return qty * (item.mrp - unit)
  if (item.basePrice && item.basePrice > unit) return qty * (item.basePrice - unit)
  return 0
}

export function receiptMrpTotal(items: ReceiptLineItem[]): number {
  return items.reduce((sum, item) => {
    if (!item.mrp || item.mrp <= 0) return sum
    return sum + item.quantity * item.mrp
  }, 0)
}

export function receiptYouSaved(items: ReceiptLineItem[]): number {
  return items.reduce((sum, item) => sum + lineYouSaved(item), 0)
}

export function attachCatalogMrp<T extends { barcode?: string; productId?: string; mrp?: number }>(
  items: T[],
  catalog: CatalogMrpRef[]
): T[] {
  if (catalog.length === 0) return items
  return items.map((item) => {
    if (item.mrp && item.mrp > 0) return item
    const code = String(item.barcode || item.productId || "").trim()
    if (!code) return item
    const match = catalog.find(
      (row) => row.id === code || (row.barcode && String(row.barcode).trim() === code)
    )
    if (match?.mrp && match.mrp > 0) return { ...item, mrp: match.mrp }
    return item
  })
}

export function withReceiptSavings(receipt: ReceiptData): ReceiptData {
  const mrpSavings = receiptYouSaved(receipt.items)
  const billDiscount = receipt.discount && receipt.discount > 0 ? receipt.discount : 0
  return {
    ...receipt,
    mrpSavings,
    discount: billDiscount,
  }
}

