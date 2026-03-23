import { db } from "@/lib/firebase"
import { firestoreNumber } from "@/lib/stock"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore"

export interface LiveBillingSession {
  sessionId: string
  createdAt?: Date
  status: string
  cashierId?: string
}

export interface LiveBillingLineItem {
  barcode: string
  name: string
  price: number
  quantity: number
}

/**
 * Copy/move a live session + its scanned items into completed bills.
 * - live_sessions/{sessionId} -> completed_bills/{sessionId}
 * - live_sessions/{sessionId}/items/{barcode} -> completed_bills/{sessionId}/items/{barcode}
 * - Update live session `status` to "completed"
 */
export async function completeLiveBillingSession(sessionId: string): Promise<void> {
  const liveSessionRef = doc(db, "live_sessions", sessionId)
  const liveSnap = await getDoc(liveSessionRef)
  if (!liveSnap.exists()) {
    throw new Error(`Live session not found: ${sessionId}`)
  }

  const liveData = liveSnap.data() as Record<string, unknown>
  const completedSessionRef = doc(db, "completed_bills", sessionId)

  // Keep `createdAt` as-is (usually Firestore Timestamp) to avoid issues with undefined values.
  const completedSessionPayload: Record<string, unknown> = {
    ...liveData,
    sessionId: (liveData.sessionId as string) || sessionId,
    status: "completed",
  }

  await setDoc(completedSessionRef, completedSessionPayload, { merge: true })

  const itemsCol = collection(db, "live_sessions", sessionId, "items")
  const itemsSnap = await getDocs(itemsCol)

  const batch = writeBatch(db)
  itemsSnap.forEach((itemDoc) => {
    const itemData = itemDoc.data() as Record<string, unknown>
    const barcode = String(itemData.barcode ?? itemDoc.id)

    const itemPayload: LiveBillingLineItem = {
      barcode,
      name: String(itemData.name ?? "").trim(),
      price: firestoreNumber(itemData.price, 0),
      quantity: firestoreNumber(itemData.quantity, 0),
    }

    const completedItemRef = doc(db, "completed_bills", sessionId, "items", barcode)
    batch.set(completedItemRef, itemPayload, { merge: true })
  })
  await batch.commit()

  await updateDoc(liveSessionRef, { status: "completed" })
}

/**
 * Cancel a live session without writing anything to `completed_bills`.
 * Only updates the session `status` to `"cancelled"`.
 */
export async function cancelLiveBillingSession(sessionId: string): Promise<void> {
  const liveSessionRef = doc(db, "live_sessions", sessionId)
  const liveSnap = await getDoc(liveSessionRef)
  if (!liveSnap.exists()) {
    throw new Error(`Live session not found: ${sessionId}`)
  }

  await updateDoc(liveSessionRef, { status: "cancelled" })
}

