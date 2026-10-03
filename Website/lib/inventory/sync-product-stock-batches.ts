import type { Firestore } from "firebase/firestore"
import { doc, updateDoc } from "firebase/firestore"
import type { ProductBatch } from "@/lib/types"

/** Distribute batch quantities so their sum equals `target` (FEFO: trim from latest expiry first). */
export function batchQuantitiesForTarget(
  batches: ProductBatch[],
  target: number
): Map<string, number> {
  const sorted = [...batches].sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
  const quantities = new Map(sorted.map((b) => [b.id, b.quantity]))
  const safeTarget = Number.isFinite(target) && target >= 0 ? Math.floor(target) : 0
  const currentTotal = sorted.reduce((s, b) => s + b.quantity, 0)
  let delta = safeTarget - currentTotal

  if (delta === 0 || sorted.length === 0) {
    return quantities
  }

  if (delta > 0) {
    const last = sorted[sorted.length - 1]
    quantities.set(last.id, (quantities.get(last.id) ?? 0) + delta)
    return quantities
  }

  let need = -delta
  for (let i = sorted.length - 1; i >= 0 && need > 0; i--) {
    const b = sorted[i]
    const q = quantities.get(b.id) ?? 0
    const take = Math.min(q, need)
    quantities.set(b.id, q - take)
    need -= take
  }

  return quantities
}

export async function syncProductStockWithBatches(
  db: Firestore,
  productId: string,
  batches: ProductBatch[],
  target: number,
  productsCollectionPath: string
): Promise<number> {
  const safeTarget = Number.isFinite(target) && target >= 0 ? Math.floor(target) : 0

  if (batches.length === 0) {
    return safeTarget
  }

  const quantities = batchQuantitiesForTarget(batches, safeTarget)
  await Promise.all(
    batches.map((b) =>
      updateDoc(doc(db, productsCollectionPath, productId, "batches", b.id), {
        quantity: quantities.get(b.id) ?? 0,
      })
    )
  )

  return safeTarget
}
