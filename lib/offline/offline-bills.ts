import type { CheckoutCustomerInfo, LiveBillingLineItem } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import { lineDiscountSaved, lineItemAmount } from "@/lib/billing/line-discount"
import { idbDelete, idbGet, idbGetAll, idbPut, STORE_PENDING_BILLS } from "./idb"

export type OfflineBillStatus = "pending" | "syncing" | "failed"

export type OfflineBill = {
  id: string
  createdAt: string
  status: OfflineBillStatus
  lastError?: string
  source: "offline_pos" | "complete_failed"
  liveSessionId?: string
  customer?: CheckoutCustomerInfo
  items: LiveBillingLineItem[]
  subtotal: number
  discount: number
  total: number
}

export function buildOfflineBill(input: {
  items: LiveBillingLineItem[]
  customer?: CheckoutCustomerInfo
  source: OfflineBill["source"]
  liveSessionId?: string
}): OfflineBill {
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = input.items.reduce(
    (sum, item) => sum + lineDiscountSaved(item.quantity, item.price, item.discountPercent ?? 0),
    0
  )
  const total = input.items.reduce(
    (sum, item) => sum + lineItemAmount(item.quantity, item.price, item.discountPercent ?? 0),
    0
  )
  return {
    id: `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
    source: input.source,
    liveSessionId: input.liveSessionId,
    customer: input.customer,
    items: input.items,
    subtotal,
    discount,
    total,
  }
}

export async function saveOfflineBill(bill: OfflineBill): Promise<void> {
  await idbPut(STORE_PENDING_BILLS, bill)
}

export async function listOfflineBills(): Promise<OfflineBill[]> {
  const rows = await idbGetAll<OfflineBill>(STORE_PENDING_BILLS)
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getOfflineBill(id: string): Promise<OfflineBill | undefined> {
  return idbGet<OfflineBill>(STORE_PENDING_BILLS, id)
}

export async function deleteOfflineBill(id: string): Promise<void> {
  await idbDelete(STORE_PENDING_BILLS, id)
}

export async function pendingOfflineBillCount(): Promise<number> {
  const rows = await listOfflineBills()
  return rows.filter((b) => b.status !== "syncing").length
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /unavailable|offline|network|failed to fetch|timeout|deadline|ERR_INTERNET|Failed to get document/i.test(
    msg
  )
}
