import {
  Timestamp,
  doc,
  getDoc,
  increment,
  runTransaction,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber } from "@/lib/stock"

export const GLOBAL_DASHBOARD_STATS_DOC_ID = "global"
export const DASHBOARD_STATS_COLLECTION = "dashboard_stats"

export type GlobalDashboardStats = {
  totalRevenue: number
  totalSales: number
  updatedAt: Date | null
}

function globalStatsRef() {
  return doc(db, DASHBOARD_STATS_COLLECTION, GLOBAL_DASHBOARD_STATS_DOC_ID)
}

function convertTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return null
}

/** Read all-time revenue counters — exactly 1 document read. */
export async function fetchGlobalDashboardStats(): Promise<GlobalDashboardStats> {
  const snap = await getDoc(globalStatsRef())
  if (!snap.exists()) {
    return { totalRevenue: 0, totalSales: 0, updatedAt: null }
  }
  const data = snap.data() as Record<string, unknown>
  return {
    totalRevenue: firestoreNumber(data.totalRevenue, 0),
    totalSales: firestoreNumber(data.totalSales, 0),
    updatedAt: convertTimestamp(data.updatedAt),
  }
}

/**
 * Atomically increment global revenue/sales once per billing session.
 * Uses live_sessions.globalStatsApplied to prevent double-count on retries.
 * Failures are logged by caller — do not throw into bill finalize path.
 */
export async function applyGlobalDashboardStatsIncrement(
  sessionId: string,
  billTotal: number
): Promise<boolean> {
  const amount = Math.round(Number(billTotal))
  if (!sessionId.trim() || !Number.isFinite(amount) || amount < 0) {
    return false
  }

  const sessionRef = doc(db, "live_sessions", sessionId)
  const statsRef = globalStatsRef()

  try {
    return await runTransaction(db, async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef)
      if (!sessionSnap.exists()) return false

      const sessionData = sessionSnap.data() as Record<string, unknown>
      if (sessionData.globalStatsApplied === true) {
        return false
      }

      transaction.set(
        statsRef,
        {
          totalRevenue: increment(amount),
          totalSales: increment(1),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )

      transaction.update(sessionRef, {
        globalStatsApplied: true,
        globalStatsAppliedAt: Timestamp.now(),
      })

      return true
    })
  } catch (err) {
    console.error("[DashboardAggregate] increment transaction failed:", err)
    throw err
  }
}
