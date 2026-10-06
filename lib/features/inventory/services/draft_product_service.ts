import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore"
import { isNoExpiryBatch } from "@/lib/inventory/no-expiry-batch"
import { col } from "@/lib/account-mode"
import {
  InventoryBatchService,
  type ProductWithBatchInput,
} from "@/lib/features/inventory/services/inventory_batch_service"
import { firestoreNumber } from "@/lib/stock"

/** Shown in Generate Bill when a draft row is not Active. */
export const DRAFT_BILLING_BLOCKED_MESSAGE = "Item is still in draft list"

export function isDraftBillableStatus(status: unknown): boolean {
  const v = typeof status === "string" ? status.trim().toLowerCase() : ""
  return v === "active"
}

export type DraftProductInput = ProductWithBatchInput

function expiryFromDraftData(data: Record<string, unknown>): Date | null {
  const raw = data.expiry
  if (raw instanceof Timestamp) {
    const d = raw.toDate()
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw.trim())
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export async function getDraftProductByBarcode(
  db: Firestore,
  barcode: string
): Promise<{ id: string } | null> {
  const q = query(
    collection(db, col("draft_products")),
    where("barcode", "==", barcode.trim()),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id }
}

export async function addDraftProductDoc(
  db: Firestore,
  input: DraftProductInput
): Promise<string> {
  const now = Timestamp.now()
  const payload = {
    ...draftPayloadFromInput(input),
    createdAt: now,
  }

  const ref = await addDoc(collection(db, col("draft_products")), payload)
  return ref.id
}

export async function updateDraftProductStatus(
  db: Firestore,
  draftId: string,
  status: string
): Promise<void> {
  await updateDoc(doc(db, col("draft_products"), draftId), {
    status: status.trim(),
    updatedAt: Timestamp.now(),
  })
}

export async function deleteDraftProduct(db: Firestore, draftId: string): Promise<void> {
  const draftRef = doc(db, col("draft_products"), draftId)
  const snap = await getDoc(draftRef)
  if (!snap.exists()) {
    throw new Error("Draft entry not found")
  }
  await deleteDoc(draftRef)
}

function draftPayloadFromInput(input: DraftProductInput): Record<string, unknown> {
  const unit = input.unit
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    barcode: input.barcode.trim(),
    category: input.category.trim(),
    rack: input.rack.trim(),
    tag: input.tag.trim(),
    status: input.status.trim(),
    price: input.price,
    costPrice: input.costPrice,
    unit,
    units: unit,
    minStock: Math.max(0, Math.floor(Number(input.minStock) || 0)),
    stock: Math.max(0, Math.floor(Number(input.quantity) || 0)),
    updatedAt: Timestamp.now(),
  }
  const ownerTag = input.ownerAccountTag?.trim()
  if (ownerTag) payload.ownerAccountTag = ownerTag.toUpperCase()
  const stock = Math.max(0, Math.floor(Number(input.quantity) || 0))
  const totalCost =
    input.totalCost != null && Number.isFinite(input.totalCost) && input.totalCost >= 0
      ? input.totalCost
      : stock > 0
        ? stock * input.costPrice
        : null
  payload.totalCost = totalCost
  if (input.brand?.trim()) payload.brand = input.brand.trim()
  else payload.brand = null
  if (input.supplierName?.trim()) payload.supplierName = input.supplierName.trim()
  else payload.supplierName = null
  if (input.supplierContact?.trim()) payload.supplierContact = input.supplierContact.trim()
  else payload.supplierContact = null
  if (input.imageUrl?.trim()) payload.imageUrl = input.imageUrl.trim()
  else payload.imageUrl = null
  if (input.mrp != null && input.mrp > 0) payload.mrp = input.mrp
  else payload.mrp = null
  if (input.discountPercent != null && input.discountPercent > 0) {
    payload.discountPercent = input.discountPercent
  } else {
    payload.discountPercent = null
  }
  if (input.gstPercent != null && Number.isFinite(input.gstPercent) && input.gstPercent >= 0) {
    payload.gstPercent = Math.round(input.gstPercent * 10) / 10
  } else {
    payload.gstPercent = null
  }
  if (input.noExpiry) {
    payload.noExpiry = true
    payload.expiry = null
  } else {
    payload.noExpiry = null
    const expiry = input.expiryDate
    if (expiry instanceof Date && !Number.isNaN(expiry.getTime())) {
      payload.expiry = Timestamp.fromDate(expiry)
    } else {
      payload.expiry = null
    }
  }
  return payload
}

export async function updateDraftProduct(
  db: Firestore,
  draftId: string,
  input: DraftProductInput
): Promise<void> {
  const barcode = input.barcode.trim()
  if (!barcode) throw new Error("Barcode is required")

  const draftRef = doc(db, col("draft_products"), draftId)
  const existing = await getDoc(draftRef)
  if (!existing.exists()) throw new Error("Draft entry not found")

  const otherDraft = await getDraftProductByBarcode(db, barcode)
  if (otherDraft && otherDraft.id !== draftId) {
    throw new Error("Another draft already uses this barcode")
  }

  const batchService = new InventoryBatchService(db)
  const live = await batchService.getProductByBarcode(barcode)
  if (live) {
    throw new Error("This barcode is already on All Products")
  }

  await updateDoc(draftRef, draftPayloadFromInput(input))
}

export async function approveDraftProduct(
  db: Firestore,
  draftId: string
): Promise<{ productId: string }> {
  const draftRef = doc(db, col("draft_products"), draftId)
  const snap = await getDoc(draftRef)
  if (!snap.exists()) {
    throw new Error("Draft entry not found")
  }
  const data = snap.data() as Record<string, unknown>
  const barcode = String(data.barcode ?? "").trim()
  if (!barcode) {
    throw new Error("Draft is missing barcode")
  }

  const expiryDate = expiryFromDraftData(data)
  const noExpiry = data.noExpiry === true
  const qty = Math.max(0, Math.floor(Number(data.stock ?? 0)))

  const batchInput: DraftProductInput = {
    name: String(data.name ?? "Unnamed Product"),
    barcode,
    rack: String(data.rack ?? ""),
    tag: String(data.tag ?? ""),
    status: String(data.status ?? "deactive"),
    price: Number(data.price ?? 0),
    category: String(data.category ?? ""),
    costPrice: Number(data.costPrice ?? 0),
    totalCost: (() => {
      const tc = Number(data.totalCost ?? NaN)
      if (Number.isFinite(tc) && tc >= 0) return tc
      return qty > 0 ? qty * Number(data.costPrice ?? 0) : undefined
    })(),
    unit: String(data.unit ?? data.units ?? "pcs"),
    minStock: Number(data.minStock ?? 10),
    brand: typeof data.brand === "string" ? data.brand : undefined,
    supplierName:
      typeof data.supplierName === "string" ? data.supplierName.trim() || undefined : undefined,
    supplierContact:
      typeof data.supplierContact === "string"
        ? data.supplierContact.trim() || undefined
        : undefined,
    expiryDate: expiryDate ?? null,
    quantity: qty > 0 ? qty : undefined,
    noExpiry: noExpiry || undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    mrp:
      Number(data.mrp) > 0 && Number.isFinite(Number(data.mrp))
        ? Number(data.mrp)
        : undefined,
    discountPercent:
      Number(data.discountPercent) > 0 && Number.isFinite(Number(data.discountPercent))
        ? Number(data.discountPercent)
        : undefined,
    gstPercent: (() => {
      const raw = data.gstPercent ?? data.gst_percent
      const n = Number(raw ?? NaN)
      if (!Number.isFinite(n) || n < 0) return undefined
      return Math.round(n * 10) / 10
    })(),
  }

  const batchService = new InventoryBatchService(db)
  const result = await batchService.addOrUpdateProductWithBatch(batchInput)
  await deleteDoc(draftRef)
  return { productId: result.productId }
}

/** Remove from All Products and recreate as an inactive draft row. */
export async function moveProductToDraftList(
  db: Firestore,
  productId: string
): Promise<string> {
  const productRef = doc(db, col("products"), productId)
  const snap = await getDoc(productRef)
  if (!snap.exists()) {
    throw new Error("Product not found")
  }

  const data = snap.data() as Record<string, unknown>
  const barcode = String(data.barcode ?? "").trim()
  if (!barcode) {
    throw new Error("Product has no barcode")
  }

  const existingDraft = await getDraftProductByBarcode(db, barcode)
  if (existingDraft) {
    throw new Error("This barcode is already in Draft Entries")
  }

  const batchesSnap = await getDocs(collection(db, col("products"), productId, "batches"))
  let noExpiry = false
  let expiryDate: Date | null = null

  if (!batchesSnap.empty) {
    const batchData = batchesSnap.docs[0].data() as Record<string, unknown>
    if (isNoExpiryBatch(batchData)) {
      noExpiry = true
    } else if (batchData.expiryDate instanceof Timestamp) {
      expiryDate = batchData.expiryDate.toDate()
    }
  }

  if (!expiryDate && !noExpiry) {
    expiryDate = expiryFromDraftData(data)
  }

  const stock = firestoreNumber(data.stock, 0)
  const disc = firestoreNumber(data.discountPercent, NaN)
  const mrpVal = firestoreNumber(data.mrp, NaN)

  const draftId = await addDraftProductDoc(db, {
    name: String(data.name ?? "Unnamed Product"),
    barcode,
    category: String(data.category ?? ""),
    rack: String(data.rack ?? ""),
    tag: String(data.tag ?? ""),
    status: "deactive",
    price: firestoreNumber(data.price, 0),
    costPrice: firestoreNumber(data.costPrice, 0),
    unit: String(data.unit ?? data.units ?? "pcs"),
    minStock: firestoreNumber(data.minStock, 10),
    brand: typeof data.brand === "string" ? data.brand.trim() || undefined : undefined,
    supplierName:
      typeof data.supplierName === "string" ? data.supplierName.trim() || undefined : undefined,
    supplierContact:
      typeof data.supplierContact === "string"
        ? data.supplierContact.trim() || undefined
        : undefined,
    expiryDate: expiryDate ?? null,
    quantity: stock > 0 ? stock : undefined,
    noExpiry: noExpiry || undefined,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
    mrp: Number.isFinite(mrpVal) && mrpVal > 0 ? mrpVal : undefined,
    discountPercent:
      Number.isFinite(disc) && disc > 0 ? Math.min(100, Math.max(0, disc)) : undefined,
    gstPercent: (() => {
      const raw = data.gstPercent ?? data.gst_percent
      const n = Number(raw ?? NaN)
      if (!Number.isFinite(n) || n < 0) return undefined
      return Math.round(n * 10) / 10
    })(),
  })

  for (const batchDoc of batchesSnap.docs) {
    await deleteDoc(batchDoc.ref)
  }
  await deleteDoc(productRef)

  return draftId
}

export async function deductDraftStockByBarcode(
  db: Firestore,
  barcode: string,
  quantity: number
): Promise<boolean> {
  const q = query(
    collection(db, col("draft_products")),
    where("barcode", "==", barcode.trim()),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return false

  const draftDoc = snap.docs[0]
  const data = draftDoc.data() as Record<string, unknown>
  if (!isDraftBillableStatus(data.status)) return false

  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  if (qty <= 0) return true

  const current = firestoreNumber(data.stock, 0)
  await updateDoc(draftDoc.ref, {
    stock: Math.max(0, current - qty),
    updatedAt: Timestamp.now(),
  })
  return true
}
