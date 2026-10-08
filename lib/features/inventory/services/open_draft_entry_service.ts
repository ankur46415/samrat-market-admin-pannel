import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import type { DocumentData, Firestore } from "firebase/firestore"
import { col } from "@/lib/account-mode"
import type { OpenDraftEntry, OpenDraftEntryAdminPatch, OpenDraftEntryInput } from "@/lib/types"

const COL = "open_draft_entries"

function entryFromSnap(id: string, data: Record<string, unknown>): OpenDraftEntry {
  return {
    id,
    productId: String(data.productId ?? ""),
    barcode: String(data.barcode ?? ""),
    name: String(data.name ?? ""),
    category: String(data.category ?? ""),
    rack: String(data.rack ?? ""),
    tag: String(data.tag ?? ""),
    status: String(data.status ?? "active"),
    brand: typeof data.brand === "string" ? data.brand : undefined,
    supplierName: typeof data.supplierName === "string" ? data.supplierName : undefined,
    supplierContact: typeof data.supplierContact === "string" ? data.supplierContact : undefined,
    mrp: typeof data.mrp === "number" && Number.isFinite(data.mrp) ? data.mrp : undefined,
    discountPercent:
      typeof data.discountPercent === "number" && Number.isFinite(data.discountPercent)
        ? data.discountPercent
        : undefined,
    price: Number(data.price ?? 0),
    stock: Number(data.stock ?? 0),
    editedBy: String(data.editedBy ?? ""),
    editedByEmail: String(data.editedByEmail ?? ""),
    pricingReviewed: data.pricingReviewed === true,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt instanceof Date
          ? data.createdAt
          : new Date(),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt instanceof Date
          ? data.updatedAt
          : new Date(),
  }
}

export async function findPendingOpenDraftByProductId(
  db: Firestore,
  productId: string
): Promise<OpenDraftEntry | null> {
  const q = query(collection(db, col(COL)), where("productId", "==", productId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]!
  return entryFromSnap(d.id, d.data() as Record<string, unknown>)
}

export async function submitOpenDraftEntry(
  db: Firestore,
  input: OpenDraftEntryInput
): Promise<string> {
  const productId = input.productId.trim()
  const barcode = input.barcode.trim()
  if (!productId || !barcode) {
    throw new Error("Product id and barcode are required")
  }

  const now = Timestamp.now()
  const payload: Record<string, unknown> = {
    productId,
    barcode,
    name: input.name.trim() || "Unnamed Product",
    category: input.category.trim(),
    rack: input.rack.trim(),
    tag: input.tag.trim(),
    status: input.status.trim() || "active",
    price: input.price,
    stock: input.stock,
    editedBy: input.editedBy.trim(),
    editedByEmail: input.editedByEmail.trim().toLowerCase(),
    pricingReviewed: false,
    reviewedBy: null,
    updatedAt: now,
  }
  if (input.brand?.trim()) payload.brand = input.brand.trim()
  else payload.brand = null
  if (input.supplierName?.trim()) payload.supplierName = input.supplierName.trim()
  else payload.supplierName = null
  if (input.supplierContact?.trim()) payload.supplierContact = input.supplierContact.trim()
  else payload.supplierContact = null
  if (input.mrp != null && input.mrp > 0) payload.mrp = input.mrp
  if (input.discountPercent != null && input.discountPercent >= 0) {
    payload.discountPercent = input.discountPercent
  }

  const existing = await findPendingOpenDraftByProductId(db, productId)
  if (existing) {
    await updateDoc(doc(db, col(COL), existing.id), payload)
    return existing.id
  }

  const ref = doc(collection(db, col(COL)))
  await setDoc(ref, { ...payload, createdAt: now })
  return ref.id
}

export async function approveOpenDraftEntry(
  db: Firestore,
  entryId: string
): Promise<void> {
  const entryRef = doc(db, col(COL), entryId)
  const snap = await getDoc(entryRef)
  if (!snap.exists()) throw new Error("Open draft entry not found")
  const data = snap.data() as Record<string, unknown>
  const productId = String(data.productId ?? "").trim()
  if (!productId) throw new Error("Missing product id on open draft entry")

  const patch: Record<string, unknown> = {
    name: String(data.name ?? "").trim() || "Unnamed Product",
    category: String(data.category ?? "").trim(),
    rack: String(data.rack ?? "").trim(),
    tag: String(data.tag ?? "").trim(),
    status: String(data.status ?? "active").trim() || "active",
    updatedAt: Timestamp.now(),
  }
  if (typeof data.brand === "string" && data.brand.trim()) patch.brand = data.brand.trim()
  else patch.brand = null
  if (typeof data.supplierName === "string" && data.supplierName.trim()) {
    patch.supplierName = data.supplierName.trim()
  } else patch.supplierName = null
  if (typeof data.supplierContact === "string" && data.supplierContact.trim()) {
    patch.supplierContact = data.supplierContact.trim()
  } else patch.supplierContact = null
  if (data.pricingReviewed === true) {
    if (typeof data.mrp === "number" && data.mrp > 0) patch.mrp = data.mrp
    if (typeof data.discountPercent === "number" && data.discountPercent >= 0) {
      patch.discountPercent = data.discountPercent
    }
    if (typeof data.price === "number" && Number.isFinite(data.price) && data.price >= 0) {
      patch.price = data.price
    }
  }

  await updateDoc(doc(db, col("products"), productId), patch)
  await deleteDoc(entryRef)
}

/** Admin correction of a pending entry before approval. Pricing is applied on approve. */
export async function updateOpenDraftEntryByAdmin(
  db: Firestore,
  entryId: string,
  input: OpenDraftEntryAdminPatch,
  reviewer: string
): Promise<void> {
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error("Sale rate must be 0 or more")
  if (input.mrp != null && (!Number.isFinite(input.mrp) || input.mrp < 0)) {
    throw new Error("MRP must be 0 or more")
  }
  if (input.mrp && input.price > input.mrp) throw new Error("Sale rate cannot be more than MRP")
  const patch: DocumentData = {
    name: input.name.trim() || "Unnamed Product",
    category: input.category.trim(),
    rack: input.rack.trim(),
    tag: input.tag.trim(),
    status: input.status.trim() || "active",
    brand: input.brand?.trim() || null,
    price: input.price,
    mrp: input.mrp && input.mrp > 0 ? input.mrp : null,
    discountPercent: input.discountPercent ?? 0,
    pricingReviewed: true,
    reviewedBy: reviewer,
    updatedAt: Timestamp.now(),
  }
  await updateDoc(doc(db, col(COL), entryId), patch)
}

export async function deleteOpenDraftEntry(db: Firestore, entryId: string): Promise<void> {
  const entryRef = doc(db, col(COL), entryId)
  const snap = await getDoc(entryRef)
  if (!snap.exists()) {
    throw new Error("Open draft entry not found")
  }
  await deleteDoc(entryRef)
}

export function mapOpenDraftEntryDoc(id: string, data: Record<string, unknown>): OpenDraftEntry {
  return entryFromSnap(id, data)
}
