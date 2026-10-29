import { format } from "date-fns"
import type { Sale } from "@/lib/types"
import { isSendablePhone, openWhatsAppChat } from "@/lib/features/messaging/service"
import type { ReceiptData } from "@/lib/printing/receipt-data"
import { withReceiptSavings } from "@/lib/printing/receipt-data"

export function billPhoneLinked(phone?: string | null): boolean {
  const value = (phone || "").trim()
  if (!value || value.toUpperCase() === "NA") return false
  return isSendablePhone(value)
}

function rupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatBillWhatsAppText(receipt: ReceiptData): string {
  const data = withReceiptSavings(receipt)
  const lines: string[] = [
    "*Samrat Market*",
    `Bill: ${data.billNo}`,
    `Date: ${format(data.date, "dd MMM yyyy, h:mm a")}`,
  ]
  if (data.customerName && data.customerName.toUpperCase() !== "NA") {
    lines.push(`Customer: ${data.customerName}`)
  }
  lines.push("")
  for (const item of data.items) {
    const qty = Number(item.quantity) || 0
    const total = Number(item.total) || qty * (Number(item.price) || 0)
    lines.push(`• ${qty} x ${item.name} — ${rupees(total)}`)
  }
  lines.push("")
  lines.push(`Subtotal: ${rupees(data.subtotal)}`)
  if ((data.mrpSavings || 0) > 0) {
    lines.push(`You saved: ${rupees(data.mrpSavings || 0)}`)
  }
  if ((data.discount || 0) > 0) {
    lines.push(`Discount: ${rupees(data.discount || 0)}`)
  }
  if ((data.tax || 0) > 0) {
    lines.push(`Tax: ${rupees(data.tax || 0)}`)
  }
  lines.push(`*Total: ${rupees(data.total)}*`)
  if (data.paymentMethod) {
    lines.push(`Payment: ${data.paymentMethod.toUpperCase()}`)
  }
  lines.push("")
  lines.push("Thank you for shopping with us.")
  return lines.join("\n")
}

export function receiptFromSale(sale: Sale): ReceiptData {
  return {
    billNo: sale.billNo,
    date: sale.createdAt,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    items: sale.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      mrp: item.mrp,
      discountPercent: item.discountPercent,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.tax,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    amountPaid: sale.amountPaid,
    change: sale.change,
  }
}

export function shareBillOnWhatsApp(receipt: ReceiptData): boolean {
  const phone = receipt.customerPhone || ""
  if (!billPhoneLinked(phone)) return false
  openWhatsAppChat(phone, formatBillWhatsAppText(receipt))
  return true
}

export function shareSaleOnWhatsApp(sale: Sale): boolean {
  return shareBillOnWhatsApp(receiptFromSale(sale))
}
