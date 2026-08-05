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
