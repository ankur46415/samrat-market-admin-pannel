import { db } from "@/lib/firebase"
import { firestoreNumber, getBarcodeLookupCandidates, normalizeScannedBarcode, barcodeValuesFromFirestore, findCachedProductByBarcode, liveSessionItemQuantity, type BarcodeProductRef } from "@/lib/stock"
import {
  clampDiscountPercent,
  discountedUnitPrice,
  lineDiscountSaved,
  lineItemAmount,
} from "@/lib/billing/line-discount"
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  increment,
} from "firebase/firestore"
import type { DocumentReference } from "firebase/firestore"

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
  discountPercent?: number
}

export interface CheckoutCustomerInfo {
  customerId?: string
  customerName?: string
  customerPhone?: string
}

export interface CompleteSessionResult {
  completedItems: number
  salesWritten: number
  billNo?: string
}

export const ADMIN_SCAN_SESSION_STORAGE_KEY = "samrat_admin_scan_session_id"

let scannerSessionCreatePromise: Promise<string> | null = null

export function clearAdminScanSessionStorage(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ADMIN_SCAN_SESSION_STORAGE_KEY)
  }
}

function generateBillNo(sessionId: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const shortId = sessionId.slice(-6).toUpperCase()
  return `SM-${datePart}-${shortId}`
}

/** Reuse one active scanner session per browser tab — avoids duplicate sessions on re-open / Strict Mode. */
export async function getOrCreateScannerBillingSession(cashierLabel?: string): Promise<string> {
  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem(ADMIN_SCAN_SESSION_STORAGE_KEY)
    if (stored) {
      const snap = await getDoc(doc(db, "live_sessions", stored))
      if (snap.exists() && String(snap.data()?.status ?? "") === "active") {
        return stored
      }
      sessionStorage.removeItem(ADMIN_SCAN_SESSION_STORAGE_KEY)
    }
  }

  if (!scannerSessionCreatePromise) {
    scannerSessionCreatePromise = createScannerBillingSession(cashierLabel).finally(() => {
      scannerSessionCreatePromise = null
    })
  }

  const id = await scannerSessionCreatePromise

  if (typeof window !== "undefined") {
    sessionStorage.setItem(ADMIN_SCAN_SESSION_STORAGE_KEY, id)
  }

  return id
}

/**
 * Complete a live session by writing one consolidated invoice into `sales`
 * and updating live session `status` to "completed".
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
  const lineItems: LiveBillingLineItem[] = []

  for (const itemDoc of itemsSnap.docs) {
    const itemData = itemDoc.data() as Record<string, unknown>
    const barcode = String(itemData.barcode ?? itemDoc.id)

    const basePrice = firestoreNumber(itemData.price, 0)
    const discountPercent = clampDiscountPercent(firestoreNumber(itemData.discountPercent, 0))

    const itemPayload: LiveBillingLineItem = {
      barcode,
      name: String(itemData.name ?? "").trim(),
      price: basePrice,
      quantity: liveSessionItemQuantity(itemData),
      discountPercent,
    }
    lineItems.push(itemPayload)

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

  clearAdminScanSessionStorage()

  let salesWritten = 0
  let billNo: string | undefined

  if (lineItems.length > 0) {
    billNo = generateBillNo(sessionId)
    const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const totalDiscount = lineItems.reduce(
      (sum, item) => sum + lineDiscountSaved(item.quantity, item.price, item.discountPercent ?? 0),
      0
    )
    const total = lineItems.reduce(
      (sum, item) => sum + lineItemAmount(item.quantity, item.price, item.discountPercent ?? 0),
      0
    )

    const salePayload: Record<string, unknown> = {
      billNo,
      sessionId,
      items: lineItems.map((item) => {
        const unitPrice = discountedUnitPrice(item.price, item.discountPercent ?? 0)
        return {
          productId: item.barcode,
          productName: item.name,
          quantity: item.quantity,
          price: unitPrice,
          total: lineItemAmount(item.quantity, item.price, item.discountPercent ?? 0),
          ...(item.discountPercent ? { discountPercent: item.discountPercent } : {}),
        }
      }),
      subtotal,
      discount: totalDiscount,
      tax: 0,
      total,
      paymentMethod: "cash",
      amountPaid: total,
      change: 0,
      soldAt,
      createdAt: Timestamp.now(),
      source: "admin_billing",
      ...(customer?.customerId ? { customerId: customer.customerId } : {}),
      ...(customer?.customerName ? { customerName: customer.customerName } : {}),
      ...(customer?.customerPhone ? { customerPhone: customer.customerPhone } : {}),
    }

    try {
      const saleRef = await addDoc(collection(db, "sales"), salePayload)
      await setDoc(saleRef, { id: saleRef.id }, { merge: true })
      salesWritten = 1
    } catch (err) {
      console.error("Failed writing consolidated sales bill:", err)
      throw err
    }
  }

  return {
    completedItems: lineItems.length,
    salesWritten,
    billNo,
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
  clearAdminScanSessionStorage()
}

/** Create a live billing session for admin barcode scanner checkout. */
export async function createScannerBillingSession(cashierLabel?: string): Promise<string> {
  const ref = await addDoc(collection(db, "live_sessions"), {
    status: "active",
    createdAt: Timestamp.now(),
    source: "admin_scanner",
    ...(cashierLabel ? { cashierId: cashierLabel } : {}),
  })
  await setDoc(ref, { sessionId: ref.id }, { merge: true })
  return ref.id
}

function toBillingProduct(
  docId: string,
  data: Record<string, unknown>,
  fallbackBarcode: string
): { barcode: string; name: string; price: number } {
  const resolvedBarcode =
    barcodeValuesFromFirestore(data, docId).find((value) => /^\d+$/.test(value)) ||
    String(data.barcode ?? fallbackBarcode).trim() ||
    fallbackBarcode

  return {
    barcode: resolvedBarcode,
    name: String(data.name ?? "").trim() || resolvedBarcode,
    price: firestoreNumber(data.price, 0),
  }
}

export async function lookupProductForBilling(
  barcode: string,
  cachedProducts?: BarcodeProductRef[]
): Promise<{ barcode: string; name: string; price: number } | null> {
  const cleaned = normalizeScannedBarcode(barcode)
  if (!cleaned) return null

  const cached = cachedProducts ? findCachedProductByBarcode(cachedProducts, cleaned) : null
  if (cached) {
    return {
      barcode: cached.barcode?.trim() || cleaned,
      name: cached.name,
      price: cached.price,
    }
  }

  const candidates = getBarcodeLookupCandidates(cleaned)

  for (const candidate of candidates) {
    const productQuery = query(
      collection(db, "products"),
      where("barcode", "==", candidate),
      limit(1)
    )
    const productSnap = await getDocs(productQuery)

    let productDoc = productSnap.empty ? null : productSnap.docs[0]
    if (!productDoc) {
      const directRef = doc(db, "products", candidate)
      const directSnap = await getDoc(directRef)
      if (directSnap.exists()) {
        productDoc = directSnap
      }
    }

    if (!productDoc && /^\d+$/.test(candidate)) {
      const asNumber = Number(candidate)
      if (Number.isSafeInteger(asNumber)) {
        const numericQuery = query(
          collection(db, "products"),
          where("barcode", "==", asNumber),
          limit(1)
        )
        const numericSnap = await getDocs(numericQuery)
        if (!numericSnap.empty) productDoc = numericSnap.docs[0]
      }
    }

    if (!productDoc) continue

    return toBillingProduct(productDoc.id, productDoc.data() as Record<string, unknown>, candidate)
  }

  // Fallback: scan loaded products collection (handles alternate field names / legacy docs).
  const allSnap = await getDocs(collection(db, "products"))
  const scannedSet = new Set(candidates)

  for (const productDoc of allSnap.docs) {
    const data = productDoc.data() as Record<string, unknown>
    const knownValues = barcodeValuesFromFirestore(data, productDoc.id)
    if (knownValues.some((value) => scannedSet.has(value))) {
      return toBillingProduct(productDoc.id, data, cleaned)
    }
  }

  return null
}

/** Find existing session line item doc for a barcode (handles phone/admin doc id differences). */
async function findSessionItemRef(
  sessionId: string,
  ...barcodes: string[]
): Promise<DocumentReference | null> {
  const candidates = new Set<string>()
  for (const raw of barcodes) {
    for (const c of getBarcodeLookupCandidates(raw)) candidates.add(c)
  }
  if (candidates.size === 0) return null

  const itemsSnap = await getDocs(collection(db, "live_sessions", sessionId, "items"))

  for (const itemDoc of itemsSnap.docs) {
    const data = itemDoc.data() as Record<string, unknown>
    const barcodesToCheck = [String(data.barcode ?? ""), itemDoc.id]

    for (const raw of barcodesToCheck) {
      if (!raw) continue
      if (getBarcodeLookupCandidates(raw).some((c) => candidates.has(c))) {
        return itemDoc.ref
      }
    }
  }

  return null
}

/** Add or increment a scanned product in a live session. */
export async function scanItemIntoSession(
  sessionId: string,
  barcode: string,
  cachedProducts?: BarcodeProductRef[]
): Promise<LiveBillingLineItem> {
  const cleaned = normalizeScannedBarcode(barcode)
  const product = await lookupProductForBilling(cleaned, cachedProducts)
  if (!product) {
    throw new Error(`Product not found for barcode: ${cleaned || barcode.trim()}`)
  }

  const existingRef = await findSessionItemRef(sessionId, product.barcode, cleaned)
  const itemRef =
    existingRef ?? doc(db, "live_sessions", sessionId, "items", toSessionItemDocId(product.barcode))

  // Atomic server-side increment — avoids stale cache resetting qty to 1.
  await setDoc(
    itemRef,
    {
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      quantity: increment(1),
      qty: increment(1),
    },
    { merge: true }
  )

  let updatedSnap
  try {
    updatedSnap = await getDocFromServer(itemRef)
  } catch {
    updatedSnap = await getDoc(itemRef)
  }

  const qty = liveSessionItemQuantity(updatedSnap.data() as Record<string, unknown>)

  return {
    barcode: product.barcode,
    name: product.name,
    price: product.price,
    quantity: qty > 0 ? qty : 1,
  }
}

export function toSessionItemDocId(barcode: string): string {
  return barcode.replace(/[/\\]/g, "_")
}

function newManualItemDocId(): string {
  return `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.replace(/[/\\]/g, "_")
}

/** Add a custom line item (not from inventory scan) — e.g. misc / other products. */
export async function addManualItemToSession(
  sessionId: string,
  input: { name: string; quantity: number; price: number; discountPercent?: number }
): Promise<LiveBillingLineItem> {
  const name = input.name.trim()
  if (!name) throw new Error("Product name is required")

  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 0))
  const price = Math.max(0, Number(input.price))
  if (!Number.isFinite(price)) throw new Error("Enter a valid price")

  const discountPercent = clampDiscountPercent(input.discountPercent ?? 0)
  const barcode = `OTHER-${Date.now().toString(36).toUpperCase()}`
  const itemRef = doc(db, "live_sessions", sessionId, "items", newManualItemDocId())

  await setDoc(itemRef, {
    barcode,
    name,
    price,
    quantity,
    qty: quantity,
    discountPercent,
    source: "manual",
  })

  return {
    barcode,
    name,
    price,
    quantity,
    discountPercent,
  }
}

/** Remove a product line entirely from an active live session. */
export async function removeItemFromSession(sessionId: string, itemDocId: string): Promise<void> {
  await deleteDoc(doc(db, "live_sessions", sessionId, "items", itemDocId))
}

/** Set line quantity manually (both `quantity` and `qty` for mobile compatibility). Removes line if qty ≤ 0. */
export async function updateSessionItemQuantity(
  sessionId: string,
  itemDocId: string,
  quantity: number
): Promise<void> {
  const nextQty = Math.floor(quantity)
  if (nextQty <= 0) {
    await removeItemFromSession(sessionId, itemDocId)
    return
  }

  await updateDoc(doc(db, "live_sessions", sessionId, "items", itemDocId), {
    quantity: nextQty,
    qty: nextQty,
  })
}

/** Override selling rate for a line item on the active bill. */
export async function updateSessionItemPrice(
  sessionId: string,
  itemDocId: string,
  price: number
): Promise<void> {
  const nextPrice = Math.max(0, Number(price))
  if (!Number.isFinite(nextPrice)) {
    throw new Error("Invalid price")
  }

  await updateDoc(doc(db, "live_sessions", sessionId, "items", itemDocId), {
    price: nextPrice,
  })
}

/** Apply per-line discount % (0–100) on the active bill. */
export async function updateSessionItemDiscount(
  sessionId: string,
  itemDocId: string,
  discountPercent: number
): Promise<void> {
  const next = clampDiscountPercent(discountPercent)
  await updateDoc(doc(db, "live_sessions", sessionId, "items", itemDocId), {
    discountPercent: next,
  })
}

