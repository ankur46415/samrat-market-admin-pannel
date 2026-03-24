import { db } from "@/lib/firebase"
import { firestoreNumber } from "@/lib/stock"
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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

export interface CheckoutCustomerInfo {
  customerId?: string
  customerName?: string
  customerPhone?: string
}

export interface CompleteSessionResult {
  completedItems: number
  salesWritten: number
}

/**
 * Complete a live session by writing line-item rows into `sales`
 * and updating live session `status` to "completed".
 * No writes are made to `completed_bills`.
 */
export async function completeLiveBillingSession(
  sessionId: string,
  customer?: CheckoutCustomerInfo
): Promise<CompleteSessionResult> {
  const liveSessionRef = doc(db, "live_sessions", sessionId)
  const liveSnap = await getDoc(liveSessionRef)
  if (!liveSnap.exists()) {
    throw new Error(`Live session not found: ${sessionId}`)
  }

  const liveData = liveSnap.data() as Record<string, unknown>
  const itemsCol = collection(db, "live_sessions", sessionId, "items")
  const itemsSnap = await getDocs(itemsCol)

  const soldAt = new Date().toISOString()
  const salesRows: Record<string, unknown>[] = []
  itemsSnap.forEach((itemDoc) => {
    const itemData = itemDoc.data() as Record<string, unknown>
    const barcode = String(itemData.barcode ?? itemDoc.id)

    const itemPayload: LiveBillingLineItem = {
      barcode,
      name: String(itemData.name ?? "").trim(),
      price: firestoreNumber(itemData.price, 0),
      quantity: firestoreNumber(itemData.quantity, 0),
    }

    // Build line-item sales row for Sales History (same field format as phone app).
    const salePayload: Record<string, unknown> = {
      barcode,
      productId: barcode,
      productName: itemPayload.name,
      pricePerUnit: itemPayload.price,
      quantity: itemPayload.quantity,
      totalAmount: itemPayload.price * itemPayload.quantity,
      soldAt,
      ...(customer?.customerId ? { customerId: customer.customerId } : {}),
      ...(customer?.customerName ? { customerName: customer.customerName } : {}),
      ...(customer?.customerPhone ? { customerPhone: customer.customerPhone } : {}),
    }
    salesRows.push(salePayload)
  })

  await updateDoc(liveSessionRef, {
    status: "completed",
    sessionId: (liveData.sessionId as string) || sessionId,
    ...(customer?.customerId ? { customerId: customer.customerId } : {}),
    ...(customer?.customerName ? { customerName: customer.customerName } : {}),
    ...(customer?.customerPhone ? { customerPhone: customer.customerPhone } : {}),
  })

  // Write sales rows in separate operations so one path failure doesn't block completion flow.
  let salesWritten = 0
  for (const row of salesRows) {
    try {
      const saleRef = await addDoc(collection(db, "sales"), row)
      await setDoc(saleRef, { id: saleRef.id }, { merge: true })
      salesWritten += 1
    } catch (err) {
      console.error("Failed writing sales row:", err)
    }
  }

  return {
    completedItems: salesRows.length,
    salesWritten,
  }
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

