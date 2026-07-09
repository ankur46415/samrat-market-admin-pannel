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
  query,
  where,
  limit,
  Timestamp,
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
  
  for (const itemDoc of itemsSnap.docs) {
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

    // Deduct stock and batches for the item
    try {
      console.log(`[StockDeduct] Processing barcode: "${itemPayload.barcode}", qty: ${itemPayload.quantity}`)

      // Try matching by barcode field first
      const productQuery = query(
        collection(db, "products"),
        where("barcode", "==", itemPayload.barcode),
        limit(1)
      )
      const productSnap = await getDocs(productQuery)

      // Fallback: try matching by document ID (some products use barcode as doc ID)
      let productDoc = productSnap.empty ? null : productSnap.docs[0]
      if (!productDoc) {
        const directRef = doc(db, "products", itemPayload.barcode)
        const directSnap = await getDoc(directRef)
        if (directSnap.exists()) {
          productDoc = directSnap as any
        }
      }

      if (productDoc) {
        const productId = productDoc.id
        const productData = productDoc.data() as Record<string, unknown>
        console.log(`[StockDeduct] Found product: ${productId}, currentStock: ${productData.stock}`)

        // Fetch batches
        const batchesCol = collection(db, "products", productId, "batches")
        const batchesSnap = await getDocs(batchesCol)
        console.log(`[StockDeduct] Batches found: ${batchesSnap.size}`)

        const batchesList = batchesSnap.docs
          .map((d) => {
            const bd = d.data() as Record<string, unknown>
            let expiryDate = new Date()
            if (bd.expiryDate && typeof (bd.expiryDate as any).toDate === "function") {
              expiryDate = (bd.expiryDate as any).toDate()
            } else if (bd.expiryDate) {
              expiryDate = new Date(String(bd.expiryDate))
            }
            return {
              id: d.id,
              ref: d.ref,
              quantity: Number(bd.quantity ?? 0),
              expiryDate,
            }
          })
          .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())

        let remainingQtyToDeduct = itemPayload.quantity
        for (const batch of batchesList) {
          if (remainingQtyToDeduct <= 0) break
          if (batch.quantity <= remainingQtyToDeduct) {
            remainingQtyToDeduct -= batch.quantity
            await updateDoc(batch.ref, { quantity: 0 })
          } else {
            const nextQty = batch.quantity - remainingQtyToDeduct
            remainingQtyToDeduct = 0
            await updateDoc(batch.ref, { quantity: nextQty })
          }
        }

        const currentStock = firestoreNumber(productData.stock, 0)
        const newStock = Math.max(0, currentStock - itemPayload.quantity)
        console.log(`[StockDeduct] Updating stock: ${currentStock} → ${newStock}`)
        await updateDoc(productDoc.ref, {
          stock: newStock,
          updatedAt: Timestamp.now(),
        })
        console.log(`[StockDeduct] Stock updated successfully for ${productId}`)
      } else {
        console.warn(`[StockDeduct] Product NOT FOUND for barcode: "${itemPayload.barcode}". Stock not deducted.`)
      }
    } catch (stockErr) {
      console.error(`Failed to deduct stock for barcode ${itemPayload.barcode}:`, stockErr)
    }
  }

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

