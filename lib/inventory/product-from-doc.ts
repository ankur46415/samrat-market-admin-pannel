import { Timestamp } from "firebase/firestore"
import type { Product, ProductBatch } from "@/lib/types"
import { gstPercentFromFirestore } from "@/lib/inventory/gst-percent"
import {
  barcodeValuesFromFirestore,
  coerceProductStockFromFirestore,
  firestoreNumber,
  minStockThresholdFromFirestore,
  normalizeProductUnit,
  productUnitFromFirestore,
} from "@/lib/stock"

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  )
}

export function convertTimestamp(timestamp: unknown): Date {
  if (!timestamp) return new Date()
  if (timestamp instanceof Date) return timestamp
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  if (isTimestampLike(timestamp)) {
    const d = timestamp.toDate()
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  if (typeof timestamp === "string" || typeof timestamp === "number") {
    const d = new Date(timestamp)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }
  if (typeof timestamp === "object" && timestamp !== null) {
    const seconds = (timestamp as { seconds?: number }).seconds
    const nanoseconds = (timestamp as { nanoseconds?: number }).nanoseconds
    if (typeof seconds === "number") {
      const millis =
        seconds * 1000 + (typeof nanoseconds === "number" ? Math.floor(nanoseconds / 1_000_000) : 0)
      const d = new Date(millis)
      return Number.isNaN(d.getTime()) ? new Date() : d
    }
  }
  return new Date()
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function optionalBarcode(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = typeof v === "string" ? v.trim() : String(v).trim()
  return s.length > 0 ? s : undefined
}

function expiryFromFirestore(data: Record<string, unknown>): string | undefined {
  const raw = data.expiry
  if (raw instanceof Timestamp) {
    const d = raw.toDate()
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return undefined
  }
  const s = trimStr(raw)
  return s.length > 0 ? s : undefined
}

/** Map Firestore product doc → Product */
export function productFromData(id: string, data: Record<string, unknown>): Product {
  const brand = trimStr(data.brand)
  const supplierName = trimStr(data.supplierName)
  const supplierContact = trimStr(data.supplierContact)
  const expiry = expiryFromFirestore(data)
  const totalStock = Number(data.__totalStock ?? NaN)
  const rawBatches = data.__batches
  const rack = trimStr(data.rack)
  const tag = trimStr(data.tag)
  const ownerAccountTagRaw = trimStr(data.ownerAccountTag)
  const ownerAccountTag =
    ownerAccountTagRaw.length > 0 ? ownerAccountTagRaw.toUpperCase() : undefined
  const status = trimStr(data.status)
  const barcodeKeys = barcodeValuesFromFirestore(data, id)
  const barcode = optionalBarcode(data.barcode) || optionalBarcode(data.productBarcode)
  const batches: ProductBatch[] = Array.isArray(rawBatches)
    ? (rawBatches as ProductBatch[]).map((b) => ({
        id: b.id,
        quantity: Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : 0,
        expiryDate: convertTimestamp(b.expiryDate),
        createdAt: convertTimestamp(b.createdAt),
        ...(b.noExpiry ? { noExpiry: true } : {}),
      }))
    : []
  return {
    id,
    name: trimStr(data.name),
    category: trimStr(data.category),
    rack,
    tag,
    ownerAccountTag,
    status,
    barcode: barcode || undefined,
    barcodeKeys,
    brand: brand.length > 0 ? brand : undefined,
    supplierName: supplierName.length > 0 ? supplierName : undefined,
    supplierContact: supplierContact.length > 0 ? supplierContact : undefined,
    imageUrl: (() => {
      const url = trimStr(data.imageUrl)
      return url.length > 0 ? url : undefined
    })(),
    price: firestoreNumber(data.price, 0),
    costPrice: firestoreNumber(data.costPrice, 0),
    totalCost: (() => {
      const n = firestoreNumber(data.totalCost, NaN)
      return Number.isFinite(n) && n >= 0 ? n : undefined
    })(),
    mrp: (() => {
      const n = firestoreNumber(data.mrp, NaN)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
    discountPercent: (() => {
      const n = firestoreNumber(data.discountPercent, NaN)
      if (!Number.isFinite(n) || n <= 0) return undefined
      return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
    })(),
    gstPercent: gstPercentFromFirestore(data),
    stock: Number.isFinite(totalStock) ? totalStock : coerceProductStockFromFirestore(data),
    batches,
    minStock: (() => {
      const raw = data.minStock
      if (raw !== undefined && raw !== null) {
        const n = firestoreNumber(raw, NaN)
        if (Number.isFinite(n)) return n
      }
      return minStockThresholdFromFirestore(data)
    })(),
    expiry: expiry && expiry.length > 0 ? expiry : undefined,
    unit: normalizeProductUnit(productUnitFromFirestore(data)),
    createdAt: convertTimestamp(data.createdAt as Timestamp | Date | undefined),
    updatedAt: convertTimestamp(data.updatedAt as Timestamp | Date | undefined),
  }
}
