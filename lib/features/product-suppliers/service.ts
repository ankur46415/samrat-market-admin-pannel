import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  computeSaleRate,
  type ProductSupplier,
  type SupplierOrderItem,
  type SupplierOrderItemInput,
} from "./models"

const SUPPLIERS_COL = "product_suppliers"
const ORDER_ITEMS_COL = "supplier_order_items"

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function supplierFromDoc(id: string, data: Record<string, unknown>): ProductSupplier {
  return {
    id,
    name: String(data.name ?? "").trim(),
    phone: data.phone ? String(data.phone).trim() : undefined,
    email: data.email ? String(data.email).trim() : undefined,
    address: data.address ? String(data.address).trim() : undefined,
    notes: data.notes ? String(data.notes).trim() : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function orderItemFromDoc(id: string, data: Record<string, unknown>): SupplierOrderItem {
  const mrp = Number(data.mrp ?? 0)
  const discountPercent = Number(data.discountPercent ?? 0)
  const delivered = data.deliveredDate
  return {
    id,
    supplierId: String(data.supplierId ?? ""),
    supplierName: String(data.supplierName ?? ""),
    orderId: String(data.orderId ?? ""),
    orderTag: String(data.orderTag ?? data.order_tag ?? "").trim(),
    product: String(data.product ?? ""),
    brand: String(data.brand ?? ""),
    buyRate: Number(data.buyRate ?? 0),
    mrp,
    productId: String(data.productId ?? ""),
    discountPercent,
    saleRate: Number.isFinite(Number(data.saleRate))
      ? Number(data.saleRate)
      : computeSaleRate(mrp, discountPercent),
    orderDate: toDate(data.orderDate),
    deliveredDate: delivered ? toDate(delivered) : null,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function subscribeProductSuppliers(
  onData: (suppliers: ProductSupplier[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, SUPPLIERS_COL),
    (snap) => {
      const items = snap.docs
        .map((d) => supplierFromDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      onData(items)
    },
    (err) => onError?.(err)
  )
}

export function subscribeSupplierOrderItems(
  onData: (items: SupplierOrderItem[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, ORDER_ITEMS_COL),
    (snap) => {
      const items = snap.docs.map((d) =>
        orderItemFromDoc(d.id, d.data() as Record<string, unknown>)
      )
      onData(items)
    },
    (err) => onError?.(err)
  )
}

export async function addProductSupplier(input: {
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}) {
  const name = input.name.trim()
  if (!name) throw new Error("Supplier name is required")
  await addDoc(collection(db, SUPPLIERS_COL), {
    name,
    phone: input.phone?.trim() || "",
    email: input.email?.trim() || "",
    address: input.address?.trim() || "",
    notes: input.notes?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateProductSupplier(
  id: string,
  input: Partial<Omit<ProductSupplier, "id" | "createdAt" | "updatedAt">>
) {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.phone !== undefined) payload.phone = input.phone.trim()
  if (input.email !== undefined) payload.email = input.email.trim()
  if (input.address !== undefined) payload.address = input.address.trim()
  if (input.notes !== undefined) payload.notes = input.notes.trim()
  await updateDoc(doc(db, SUPPLIERS_COL, id), payload as Record<string, string | ReturnType<typeof serverTimestamp>>)

  if (input.name !== undefined) {
    const snap = await getDocs(
      query(collection(db, ORDER_ITEMS_COL), where("supplierId", "==", id))
    )
    if (!snap.empty) {
      const batch = writeBatch(db)
      snap.docs.forEach((d) => {
        batch.update(d.ref, { supplierName: input.name!.trim(), updatedAt: serverTimestamp() })
      })
      await batch.commit()
    }
  }
}

export async function deleteProductSupplier(id: string) {
  await deleteDoc(doc(db, SUPPLIERS_COL, id))
}

export async function addSupplierOrderItems(items: SupplierOrderItemInput[]) {
  if (items.length === 0) throw new Error("Add at least one product line")
  const batch = writeBatch(db)
  const col = collection(db, ORDER_ITEMS_COL)

  items.forEach((item) => {
    const ref = doc(col)
    const mrp = Number(item.mrp)
    const discountPercent = Number(item.discountPercent ?? 0)
    batch.set(ref, {
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      orderId: item.orderId,
      orderTag: item.orderTag.trim(),
      product: item.product.trim(),
      brand: item.brand.trim(),
      buyRate: Number(item.buyRate) || 0,
      mrp,
      productId: item.productId.trim(),
      discountPercent,
      saleRate: computeSaleRate(mrp, discountPercent),
      orderDate: Timestamp.fromDate(item.orderDate),
      deliveredDate: item.deliveredDate ? Timestamp.fromDate(item.deliveredDate) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}

export async function updateSupplierOrderItem(
  id: string,
  input: Partial<
    Pick<
      SupplierOrderItem,
      | "product"
      | "brand"
      | "buyRate"
      | "mrp"
      | "productId"
      | "discountPercent"
      | "orderDate"
      | "deliveredDate"
      | "supplierId"
      | "supplierName"
      | "orderTag"
    >
  >
) {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }

  if (input.product !== undefined) payload.product = input.product.trim()
  if (input.brand !== undefined) payload.brand = input.brand.trim()
  if (input.buyRate !== undefined) payload.buyRate = Number(input.buyRate) || 0
  if (input.mrp !== undefined) payload.mrp = Number(input.mrp) || 0
  if (input.productId !== undefined) payload.productId = input.productId.trim()
  if (input.discountPercent !== undefined) payload.discountPercent = Number(input.discountPercent) || 0
  if (input.supplierId !== undefined) payload.supplierId = input.supplierId
  if (input.supplierName !== undefined) payload.supplierName = input.supplierName
  if (input.orderTag !== undefined) payload.orderTag = input.orderTag.trim()
  if (input.orderDate !== undefined) payload.orderDate = Timestamp.fromDate(input.orderDate)
  if (input.deliveredDate !== undefined) {
    payload.deliveredDate = input.deliveredDate ? Timestamp.fromDate(input.deliveredDate) : null
  }

  const mrp = input.mrp !== undefined ? Number(input.mrp) : undefined
  const discount =
    input.discountPercent !== undefined ? Number(input.discountPercent) : undefined
  if (mrp !== undefined || discount !== undefined) {
    const existing = await getDoc(doc(db, ORDER_ITEMS_COL, id))
    const data = existing.data() as Record<string, unknown> | undefined
    const finalMrp = mrp ?? Number(data?.mrp ?? 0)
    const finalDiscount = discount ?? Number(data?.discountPercent ?? 0)
    payload.saleRate = computeSaleRate(finalMrp, finalDiscount)
  }

  await updateDoc(doc(db, ORDER_ITEMS_COL, id), payload as Record<string, unknown>)
}

export async function deleteSupplierOrderItem(id: string) {
  await deleteDoc(doc(db, ORDER_ITEMS_COL, id))
}

export async function deleteSupplierOrderItems(ids: string[]) {
  if (ids.length === 0) return
  const chunkSize = 500
  for (let i = 0; i < ids.length; i += chunkSize) {
    const batch = writeBatch(db)
    ids.slice(i, i + chunkSize).forEach((id) => {
      batch.delete(doc(db, ORDER_ITEMS_COL, id))
    })
    await batch.commit()
  }
}
