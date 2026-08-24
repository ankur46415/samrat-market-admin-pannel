import type { Sale } from "@/lib/types"

export function salePhone(sale: Pick<Sale, "customerPhone">): string {
  return sale.customerPhone?.trim() || "NA"
}

/** Match bill, customer name, or customer phone (partial digits ok). */
export function saleMatchesSearch(sale: Sale, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const phone = salePhone(sale).toLowerCase()
  const phoneDigits = phone.replace(/\D/g, "")
  const queryDigits = q.replace(/\D/g, "")

  if (queryDigits.length >= 4 && phoneDigits.includes(queryDigits)) return true

  return (
    phone.includes(q) ||
    (sale.billNo || "").toLowerCase().includes(q) ||
    (sale.customerName || "").toLowerCase().includes(q)
  )
}

/** Dedicated phone filter — empty means all. */
export function saleMatchesPhoneFilter(sale: Sale, phoneQuery: string): boolean {
  const digits = phoneQuery.replace(/\D/g, "")
  if (!digits) return true
  return salePhone(sale).replace(/\D/g, "").includes(digits)
}
