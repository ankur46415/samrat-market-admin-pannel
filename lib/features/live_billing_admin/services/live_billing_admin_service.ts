import { db } from "@/lib/firebase"
import { generateOnlineBillNo } from "@/lib/features/sales/bill-no"
import { firestoreNumber, getBarcodeLookupCandidates, normalizeScannedBarcode, findCachedProductByBarcode, liveSessionItemQuantity, type BarcodeProductRef } from "@/lib/stock"
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
  mrp?: number
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

async function billNoAlreadyExists(billNo: string): Promise<boolean> {
  try {
    const snap = await getDocs(query(collection(db, "sales"), where("billNo", "==", billNo), limit(1)))
    return !snap.empty
  } catch {
    return false
  }
}

async function resolveUniqueBillNo(preferred: string): Promise<string> {
  if (!(await billNoAlreadyExists(preferred))) return preferred
  for (let n = 2; n <= 9; n++) {
    const candidate = `${preferred}-${n}`
    if (!(await billNoAlreadyExists(candidate))) return candidate
  }
  return `${preferred}-${Date.now().toString(36).toUpperCase()}`
}

async function deductStockForLineItem(itemPayload: LiveBillingLineItem): Promise<void> {
  try {
    const productQuery = query(
      collection(db, "products"),
      where("barcode", "==", itemPayload.barcode),
      limit(1)
    )
    const productSnap = await getDocs(productQuery)

    let productDoc = productSnap.empty ? null : productSnap.docs[0]
    if (!productDoc) {
      const directRef = doc(db, "products", itemPayload.barcode)
      const directSnap = await getDoc(directRef)
      if (directSnap.exists()) {
        productDoc = directSnap as typeof productSnap.docs[0]
      }
    }

    if (!productDoc) {
      console.warn(`[StockDeduct] Product NOT FOUND for barcode: "${itemPayload.barcode}". Stock not deducted.`)
      return
    }

    const productId = productDoc.id
    const productData = productDoc.data() as Record<string, unknown>
    const batchesCol = collection(db, "products", productId, "batches")
    const batchesSnap = await getDocs(batchesCol)

    const batchesList = batchesSnap.docs
      .map((d) => {
        const bd = d.data() as Record<string, unknown>
        let expiryDate = new Date()
        if (bd.expiryDate && typeof (bd.expiryDate as { toDate?: () => Date }).toDate === "function") {
          expiryDate = (bd.expiryDate as { toDate: () => Date }).toDate()
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
    await updateDoc(productDoc.ref, {
      stock: newStock,
      updatedAt: Timestamp.now(),
    })
  } catch (stockErr) {
    console.error(`Failed to deduct stock for barcode ${itemPayload.barcode}:`, stockErr)
  }
}

/** Write a sales invoice and deduct stock. Used by live complete and offline sync. */
export async function writeSaleFromLineItems(input: {
  sessionId: string
  lineItems: LiveBillingLineItem[]
  customer?: CheckoutCustomerInfo
  source?: string
  billNo?: string
}): Promise<CompleteSessionResult> {
  const soldAt = new Date().toISOString()
  const resolvedCustomer = await ensureCustomerForBilling(input.customer)
  const customerPhone =
    resolvedCustomer?.customerPhone?.trim() || input.customer?.customerPhone?.trim() || "NA"

  let salesWritten = 0
  let billNo: string | undefined

  if (input.lineItems.length > 0) {
    billNo = await resolveUniqueBillNo(input.billNo || generateOnlineBillNo(input.sessionId))
    const subtotal = input.lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const totalDiscount = input.lineItems.reduce(
      (sum, item) => sum + lineDiscountSaved(item.quantity, item.price, item.discountPercent ?? 0),
      0
    )
    const total = input.lineItems.reduce(
      (sum, item) => sum + lineItemAmount(item.quantity, item.price, item.discountPercent ?? 0),
      0
    )

    const salePayload: Record<string, unknown> = {
      billNo,
      sessionId: input.sessionId,
      items: input.lineItems.map((item) => {
        const unitPrice = discountedUnitPrice(item.price, item.discountPercent ?? 0)
        return {
          productId: item.barcode,
          productName: item.name,
          quantity: item.quantity,
          price: unitPrice,
          total: lineItemAmount(item.quantity, item.price, item.discountPercent ?? 0),
          ...(item.discountPercent ? { discountPercent: item.discountPercent } : {}),
          ...(item.mrp && item.mrp > 0 ? { mrp: item.mrp } : {}),
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
      source: input.source || "admin_billing",
      customerPhone,
      ...(resolvedCustomer?.customerId ? { customerId: resolvedCustomer.customerId } : {}),
      ...(resolvedCustomer?.customerName ? { customerName: resolvedCustomer.customerName } : {}),
    }

    const saleRef = await addDoc(collection(db, "sales"), salePayload)
    await setDoc(saleRef, { id: saleRef.id }, { merge: true })
    salesWritten = 1

    for (const item of input.lineItems) {
      await deductStockForLineItem(item)
    }
  }

  return {
    completedItems: input.lineItems.length,
    salesWritten,
    billNo,
  }
}

/** Reuse one active scanner session per browser tab — avoids duplicate sessions on re-open / Strict Mode. */

function normalizeBillingPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length >= 10) return digits.slice(-10)
  return ""
}

/** Find or create a customers/{id} doc with name + phone only. */
async function ensureCustomerForBilling(
  customer?: CheckoutCustomerInfo
): Promise<CheckoutCustomerInfo | undefined> {
  const phone = normalizeBillingPhone(customer?.customerPhone || "")
  if (!phone) return customer

  if (customer?.customerId) {
    const existing = await getDoc(doc(db, "customers", customer.customerId))
    if (existing.exists()) {
      const data = existing.data() as Record<string, unknown>
      return {
        customerId: existing.id,
        customerName: String(data.name ?? customer.customerName ?? "").trim() || customer.customerName,
        customerPhone: String(data.phone ?? phone),
      }
    }
  }

  const byPhone = await getDocs(query(collection(db, "customers"), where("phone", "==", phone), limit(1)))
  if (!byPhone.empty) {
    const found = byPhone.docs[0]
    const data = found.data() as Record<string, unknown>
    return {
      customerId: found.id,
      customerName: String(data.name ?? customer?.customerName ?? "").trim() || customer?.customerName,
      customerPhone: String(data.phone ?? phone),
    }
  }

  const name = (customer?.customerName || "").trim()
  if (!name) return { ...customer, customerPhone: phone }

  const docRef = await addDoc(collection(db, "customers"), {
    name,
    phone,
    balance: 0,
    totalPurchases: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })

  return {
    customerId: docRef.id,
    customerName: name,
    customerPhone: phone,
  }
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

/** Start a fresh scanner session (clears tab session cache). */
export async function forceNewScannerBillingSession(cashierLabel?: string): Promise<string> {
  clearAdminScanSessionStorage()
  return createScannerBillingSession(cashierLabel)
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
  const itemsSnap = await getDocs(collection(db, "live_sessions", sessionId, "items"))

  const lineItems: LiveBillingLineItem[] = []

  for (const itemDoc of itemsSnap.docs) {
    const itemData = itemDoc.data() as Record<string, unknown>
    const barcode = String(itemData.barcode ?? itemDoc.id)

    const basePrice = firestoreNumber(itemData.price, 0)
    const discountPercent = clampDiscountPercent(firestoreNumber(itemData.discountPercent, 0))
    const mrpRaw = firestoreNumber(itemData.mrp, 0)

    lineItems.push({
      barcode,
      name: String(itemData.name ?? "").trim(),
      price: basePrice,
      quantity: liveSessionItemQuantity(itemData),
      discountPercent,
      ...(mrpRaw > 0 ? { mrp: mrpRaw } : {}),
    })
  }

  const result = await writeSaleFromLineItems({
    sessionId,
    lineItems,
    customer,
    source: "admin_billing",
  })

  const customerPhone = customer?.customerPhone?.trim() || "NA"
  try {
    await updateDoc(liveSessionRef, {
      status: "completed",
      sessionId: (liveData.sessionId as string) || sessionId,
      customerPhone,
      ...(customer?.customerId ? { customerId: customer.customerId } : {}),
      ...(customer?.customerName ? { customerName: customer.customerName } : {}),
    })
  } catch (sessionErr) {
    console.error("Sale written but session status update failed:", sessionErr)
  }

  clearAdminScanSessionStorage()
  return result
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
  scanned: string
): { barcode: string; name: string; price: number; mrp?: number } {
  const storedBarcode = normalizeScannedBarcode(String(data.barcode ?? ""))
  const mrpRaw = firestoreNumber(data.mrp, 0)
  return {
    barcode: storedBarcode || scanned || docId,
    name: String(data.name ?? "").trim() || storedBarcode || scanned || docId,
    price: firestoreNumber(data.price, 0),
    ...(mrpRaw > 0 ? { mrp: mrpRaw } : {}),
  }
}

export async function lookupProductForBilling(
  barcode: string,
  cachedProducts?: BarcodeProductRef[]
): Promise<{ barcode: string; name: string; price: number; mrp?: number } | null> {
  const scanned = normalizeScannedBarcode(barcode)
  if (!scanned) return null

  const cached = cachedProducts ? findCachedProductByBarcode(cachedProducts, scanned) : null
  if (cached) {
    const storedBarcode = normalizeScannedBarcode(cached.barcode ?? "")
    return {
      barcode: storedBarcode || cached.id,
      name: cached.name,
      price: cached.price,
      ...(cached.mrp && cached.mrp > 0 ? { mrp: cached.mrp } : {}),
    }
  }

  const byId = await getDoc(doc(db, "products", scanned))
  if (byId.exists()) {
    return toBillingProduct(byId.id, byId.data() as Record<string, unknown>, scanned)
  }

  const byBarcode = await getDocs(
    query(collection(db, "products"), where("barcode", "==", scanned), limit(1))
  )
  if (!byBarcode.empty) {
    const hit = byBarcode.docs[0]
    return toBillingProduct(hit.id, hit.data() as Record<string, unknown>, scanned)
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
      ...(product.mrp && product.mrp > 0 ? { mrp: product.mrp } : {}),
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
    ...(product.mrp && product.mrp > 0 ? { mrp: product.mrp } : {}),
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

