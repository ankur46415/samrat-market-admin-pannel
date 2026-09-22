import {
  Timestamp,
  collection,
  getDocs,
  limit,
  query,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Sale } from "@/lib/types"
import { saleFromFirestoreDoc } from "@/lib/sale-from-firestore"

function mergeUniqueSaleDocs(snaps: QueryDocumentSnapshot[]): Sale[] {
  const seen = new Set<string>()
  const sales: Sale[] = []
  for (const d of snaps) {
    if (seen.has(d.id)) continue
    seen.add(d.id)
    sales.push(saleFromFirestoreDoc(d))
  }
  return sales
}

/** Sales within [start, end) using soldAt string + createdAt Timestamp queries (deduped). */
export async function fetchSalesInDateRange(start: Date, end: Date): Promise<Sale[]> {
  const startTs = Timestamp.fromDate(start)
  const soldAtMin = start.toISOString().slice(0, 10)

  const [soldAtSnap, createdAtSnap] = await Promise.all([
    getDocs(query(collection(db, "sales"), where("soldAt", ">=", soldAtMin))),
    getDocs(query(collection(db, "sales"), where("createdAt", ">=", startTs))),
  ])

  const merged = mergeUniqueSaleDocs([...soldAtSnap.docs, ...createdAtSnap.docs])
  return merged
    .filter((sale) => sale.createdAt >= start && sale.createdAt < end)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Recent sales since `since` (both mobile soldAt + web createdAt paths). */
export async function fetchSalesSince(since: Date, maxDocs = 500): Promise<Sale[]> {
  const startTs = Timestamp.fromDate(since)
  const soldAtMin = since.toISOString().slice(0, 10)

  const [soldAtSnap, createdAtSnap] = await Promise.all([
    getDocs(query(collection(db, "sales"), where("soldAt", ">=", soldAtMin), limit(maxDocs))),
    getDocs(query(collection(db, "sales"), where("createdAt", ">=", startTs), limit(maxDocs))),
  ])

  return mergeUniqueSaleDocs([...soldAtSnap.docs, ...createdAtSnap.docs]).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )
}

/** All-time revenue total — reads every sale doc once (required for accurate sum). */
export async function fetchAllSalesForRevenue(): Promise<Sale[]> {
  const snap = await getDocs(collection(db, "sales"))
  return snap.docs.map((d) => saleFromFirestoreDoc(d))
}
