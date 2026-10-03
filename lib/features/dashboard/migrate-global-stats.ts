/**
 * ONE-TIME utility — seeds `dashboard_stats/global` from existing `sales` docs.
 * Do NOT call from dashboard UI automatically.
 *
 * Run manually (logged-in admin browser console on /dashboard):
 *   import { migrateGlobalDashboardStatsFromSales } from "@/lib/features/dashboard/migrate-global-stats"
 *   await migrateGlobalDashboardStatsFromSales()
 *
 * Or: node scripts/migrate-dashboard-global-stats.mjs
 */
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { fetchAllSalesForRevenue } from "@/lib/features/sales/services/sales_query_service"
import {
  DASHBOARD_STATS_COLLECTION,
  GLOBAL_DASHBOARD_STATS_DOC_ID,
} from "@/lib/features/dashboard/services/dashboard_aggregate_service"

export type MigrateGlobalStatsResult = {
  totalRevenue: number
  totalSales: number
  skipped: boolean
  message: string
}

/**
 * Sum all sale `total` / mobile `totalAmount` via saleFromFirestoreDoc, write aggregate doc.
 * Skips if `dashboard_stats/global` already exists unless `force` is true.
 */
export async function migrateGlobalDashboardStatsFromSales(options?: {
  force?: boolean
}): Promise<MigrateGlobalStatsResult> {
  const statsRef = doc(db, DASHBOARD_STATS_COLLECTION, GLOBAL_DASHBOARD_STATS_DOC_ID)
  const existing = await getDoc(statsRef)

  if (existing.exists() && !options?.force) {
    const data = existing.data() as Record<string, unknown>
    return {
      totalRevenue: Number(data.totalRevenue ?? 0),
      totalSales: Number(data.totalSales ?? 0),
      skipped: true,
      message:
        "dashboard_stats/global already exists. Pass { force: true } to overwrite from sales collection.",
    }
  }

  const sales = await fetchAllSalesForRevenue()
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const totalSales = sales.length

  await setDoc(statsRef, {
    totalRevenue,
    totalSales,
    updatedAt: Timestamp.now(),
    migratedAt: Timestamp.now(),
    migrationSource: "sales_collection_full_scan",
  })

  return {
    totalRevenue,
    totalSales,
    skipped: false,
    message: `Seeded dashboard_stats/global from ${totalSales} sale documents.`,
  }
}
