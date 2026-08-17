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
