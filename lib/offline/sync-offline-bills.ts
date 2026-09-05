import {
  writeSaleFromLineItems,
  type CheckoutCustomerInfo,
  type LiveBillingLineItem,
} from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import {
  buildOfflineBill,
  deleteOfflineBill,
  getOfflineBill,
  listOfflineBills,
  saveOfflineBill,
  type OfflineBill,
} from "./offline-bills"

let syncInFlight: Promise<{ synced: number; failed: number }> | null = null

export async function enqueueOfflineBill(input: {
  items: LiveBillingLineItem[]
  customer?: CheckoutCustomerInfo
  source: OfflineBill["source"]
  liveSessionId?: string
}): Promise<OfflineBill> {
  const bill = buildOfflineBill(input)
  await saveOfflineBill(bill)
  return bill
}

export async function syncOneOfflineBill(id: string): Promise<void> {
  const bill = await getOfflineBill(id)
  if (!bill) return
  if (bill.items.length === 0) {
    await deleteOfflineBill(id)
    return
  }

  await saveOfflineBill({ ...bill, status: "syncing", lastError: undefined })
  try {
    await writeSaleFromLineItems({
      sessionId: bill.liveSessionId || bill.id,
      lineItems: bill.items,
      customer: bill.customer,
      source: "admin_billing_offline",
    })
    await deleteOfflineBill(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    await saveOfflineBill({ ...bill, status: "failed", lastError: message })
    throw error
  }
}

export async function syncAllOfflineBills(): Promise<{ synced: number; failed: number }> {
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    const bills = await listOfflineBills()
    let synced = 0
    let failed = 0
    for (const bill of bills) {
      try {
        await syncOneOfflineBill(bill.id)
        synced += 1
      } catch {
        failed += 1
      }
    }
    return { synced, failed }
  })()

  try {
    return await syncInFlight
  } finally {
    syncInFlight = null
  }
}
