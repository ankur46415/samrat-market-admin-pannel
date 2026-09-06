import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  Timestamp,
  updateDoc,
  where,
  type DocumentReference,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber } from "@/lib/stock"

async function findProductDoc(barcode: string) {
  const cleaned = barcode.trim()
  if (!cleaned || cleaned.startsWith("OTHER-")) return null

  const productQuery = query(collection(db, "products"), where("barcode", "==", cleaned), limit(1))
  const productSnap = await getDocs(productQuery)
  if (!productSnap.empty) return productSnap.docs[0]

  const directSnap = await getDoc(doc(db, "products", cleaned))
  if (directSnap.exists()) return directSnap
  return null
}

type BatchRow = {
  ref: DocumentReference
  quantity: number
  expiryDate: Date
}

async function loadBatches(productId: string): Promise<BatchRow[]> {
  const batchesSnap = await getDocs(collection(db, "products", productId, "batches"))
  return batchesSnap.docs
    .map((d) => {
      const bd = d.data() as Record<string, unknown>
      let expiryDate = new Date()
      if (bd.expiryDate && typeof (bd.expiryDate as { toDate?: () => Date }).toDate === "function") {
        expiryDate = (bd.expiryDate as { toDate: () => Date }).toDate()
      } else if (bd.expiryDate) {
        expiryDate = new Date(String(bd.expiryDate))
      }
      return {
        ref: d.ref,
        quantity: Number(bd.quantity ?? 0),
        expiryDate,
      }
    })
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
}

/** qtyDelta > 0 sold extra (deduct). qtyDelta < 0 returned (restore). */
export async function adjustProductStockByBarcode(barcode: string, qtyDelta: number): Promise<void> {
  const qty = Math.trunc(qtyDelta)
  if (!qty) return

  const productDoc = await findProductDoc(barcode)
  if (!productDoc) {
    console.warn(`[StockAdjust] Product not found for barcode: ${barcode}`)
    return
  }

  const productData = productDoc.data() as Record<string, unknown>
  const batches = await loadBatches(productDoc.id)

  if (qty > 0) {
    let remaining = qty
    for (const batch of batches) {
      if (remaining <= 0) break
      if (batch.quantity <= remaining) {
        remaining -= batch.quantity
        await updateDoc(batch.ref, { quantity: 0 })
      } else {
        await updateDoc(batch.ref, { quantity: batch.quantity - remaining })
        remaining = 0
      }
    }
    const currentStock = firestoreNumber(productData.stock, 0)
    await updateDoc(productDoc.ref, {
      stock: Math.max(0, currentStock - qty),
      updatedAt: Timestamp.now(),
    })
    return
  }

  const restore = Math.abs(qty)
  if (batches.length > 0) {
    const target = batches[batches.length - 1]
    await updateDoc(target.ref, { quantity: target.quantity + restore })
  }
  const currentStock = firestoreNumber(productData.stock, 0)
  await updateDoc(productDoc.ref, {
    stock: currentStock + restore,
    updatedAt: Timestamp.now(),
  })
}
