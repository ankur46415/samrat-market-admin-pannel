export type ReceiptLineItem = {
  name: string
  quantity: number
  price: number
  total: number
}

export type ReceiptData = {
  billNo: string
  date: Date
  customerName?: string
  customerPhone?: string
  items: ReceiptLineItem[]
  subtotal: number
  discount?: number
  tax?: number
  total: number
  paymentMethod?: string
  amountPaid?: number
  change?: number
}

export const LAST_RECEIPT_STORAGE_KEY = "samrat_last_receipt"

export function saveLastReceipt(receipt: ReceiptData): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(
    LAST_RECEIPT_STORAGE_KEY,
    JSON.stringify({ ...receipt, date: receipt.date.toISOString() })
  )
}

export function loadLastReceipt(): ReceiptData | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(LAST_RECEIPT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ReceiptData & { date: string }
    return { ...parsed, date: new Date(parsed.date) }
  } catch {
    return null
  }
}
