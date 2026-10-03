export type PaymentEntryType = "purchase" | "payment"

export interface PaymentPayee {
  id: string
  name: string
  phone?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface PaymentLedgerEntry {
  id: string
  payeeId: string
  type: PaymentEntryType
  amount: number
  date: Date
  notes?: string
  createdAt: Date
}

export function payeeRemaining(entries: PaymentLedgerEntry[]): number {
  return entries.reduce((sum, e) => {
    if (e.type === "purchase") return sum + e.amount
    return sum - e.amount
  }, 0)
}

export function payeePurchasesTotal(entries: PaymentLedgerEntry[]): number {
  return entries.filter((e) => e.type === "purchase").reduce((sum, e) => sum + e.amount, 0)
}

export function payeePaymentsTotal(entries: PaymentLedgerEntry[]): number {
  return entries.filter((e) => e.type === "payment").reduce((sum, e) => sum + e.amount, 0)
}
