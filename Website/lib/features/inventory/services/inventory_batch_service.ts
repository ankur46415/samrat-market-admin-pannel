import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore"
import { col } from "@/lib/account-mode"
import type { BatchModel } from "@/lib/features/inventory/models/batch-model"
import type { ProductModel } from "@/lib/features/inventory/models/product-model"
import { NO_EXPIRY_BATCH_DATE, isNoExpiryBatch } from "@/lib/inventory/no-expiry-batch"
import { normalizeProductUnit } from "@/lib/stock"

/** Fields stored on each `products/{id}` document (aligned with pre-batch inventory docs). */
export type ProductWithBatchInput = {
  name: string
  barcode: string
  rack: string
  tag: string
  status: string
  price: number
  category: string
  costPrice: number
  unit: string
  minStock: number
  brand?: string
  expiryDate?: Date | null
  quantity?: number
  noExpiry?: boolean
  imageUrl?: string
  mrp?: number
  discountPercent?: number
}

export class InventoryBatchService {
  constructor(private readonly db: Firestore) {}

  private async sumBatchQuantities(productId: string): Promise<number> {
    const snap = await getDocs(collection(this.db, col("products"), productId, "batches"))
    return snap.docs.reduce((sum, b) => {
      const q = Number((b.data() as Record<string, unknown>).quantity ?? 0)
      return sum + (Number.isFinite(q) ? q : 0)
    }, 0)
  }

  private productDocPayload(fields: {
    name: string
    barcode: string
    rack: string
    tag: string
    status: string
    price: number
    category: string
    costPrice: number
    unit: string
    minStock: number
    stock: number
    brand?: string
    productExpiry?: Date
    mrp?: number
    discountPercent?: number
    imageUrl?: string
  }): Record<string, unknown> {
    const unitStr = normalizeProductUnit(fields.unit)
    const rack = fields.rack.trim()
    const tag = fields.tag.trim()
    const status = fields.status.trim()
    const d: Record<string, unknown> = {
      name: fields.name.trim(),
      barcode: fields.barcode.trim(),
      price: fields.price,
      category: fields.category.trim(),
      costPrice: fields.costPrice,
      unit: unitStr,
      units: unitStr,
      rack,
      tag,
      status,
      minStock: Math.max(0, Math.floor(Number(fields.minStock) || 0)),
      stock: fields.stock,
      updatedAt: Timestamp.now(),
    }
    if (fields.productExpiry) {
      d.expiry = Timestamp.fromDate(fields.productExpiry)
    }
    if (fields.mrp != null && Number.isFinite(fields.mrp) && fields.mrp > 0) {
      d.mrp = fields.mrp
    }
    const disc = Number(fields.discountPercent)
    if (Number.isFinite(disc) && disc > 0) {
      d.discountPercent = Math.min(100, Math.max(0, Math.round(disc * 100) / 100))
    }
    const b = fields.brand?.trim()
    if (b) d.brand = b
    const imageUrl = fields.imageUrl?.trim()
    if (imageUrl) d.imageUrl = imageUrl
    return d
  }

  private async insertFullProduct(fields: {
    name: string
    barcode: string
    rack: string
    tag: string
    status: string
    price: number
    category: string
    costPrice: number
    unit: string
    minStock: number
    brand?: string
    productExpiry?: Date
    stock: number
    mrp?: number
    discountPercent?: number
    imageUrl?: string
  }): Promise<string> {
    const now = Timestamp.now()
    const ref = await addDoc(collection(this.db, col("products")), {
      ...this.productDocPayload(fields),
      createdAt: now,
    })
    return ref.id
  }

  async getProductByBarcode(barcode: string): Promise<ProductModel | null> {
    const q = query(
      collection(this.db, col("products")),
      where("barcode", "==", barcode.trim()),
      limit(1)
    )
    const snap = await getDocs(q)
    if (snap.empty) return null

    const d = snap.docs[0]
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      name: String(data.name ?? ""),
      barcode: String(data.barcode ?? ""),
      price: Number(data.price ?? 0),
      createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
    }
  }

  async addBatch({
    productId,
    batch,
  }: {
    productId: string
    batch: BatchModel
  }): Promise<void> {
    await addDoc(collection(this.db, col("products"), productId, "batches"), {
      expiryDate: Timestamp.fromDate(batch.expiryDate),
      quantity: batch.quantity,
      ...(batch.noExpiry ? { noExpiry: true } : {}),
      createdAt: Timestamp.now(),
    })
  }

  async addOrUpdateProductWithBatch(
    input: ProductWithBatchInput
  ): Promise<{ existingProduct: boolean; productId: string }> {
    const {
      name,
      barcode,
      rack,
      tag,
      status,
      price,
      category,
      costPrice,
      unit,
      minStock,
      brand,
      expiryDate,
      quantity,
      noExpiry,
    } = input
    const normalizedBarcode = barcode.trim()
    const qty = Math.max(0, Math.floor(Number(quantity) || 0))
    const hasExpiryDate =
      expiryDate instanceof Date && !Number.isNaN(expiryDate.getTime())
    const hasExpiryBatch = hasExpiryDate && qty > 0
    const hasNoExpiryBatch = noExpiry === true && qty > 0 && !hasExpiryDate
    const hasBatch = hasExpiryBatch || hasNoExpiryBatch
    const existing = await this.getProductByBarcode(normalizedBarcode)

    const payloadFields = {
      name,
      barcode: normalizedBarcode,
      rack: rack.trim(),
      tag,
      status,
      price,
      category,
      costPrice,
      unit,
      minStock,
      brand,
      productExpiry: hasExpiryBatch ? expiryDate! : undefined,
      mrp: input.mrp,
      discountPercent: input.discountPercent,
      imageUrl: input.imageUrl,
    }

    if (existing?.id) {
      if (hasExpiryBatch) {
        await this.addBatch({
          productId: existing.id,
          batch: {
            expiryDate: expiryDate!,
            quantity: qty,
            createdAt: new Date(),
          },
        })
      } else if (hasNoExpiryBatch) {
        await this.addBatch({
          productId: existing.id,
          batch: {
            expiryDate: NO_EXPIRY_BATCH_DATE,
            quantity: qty,
            createdAt: new Date(),
            noExpiry: true,
          },
        })
      }
      const totalStock = await this.sumBatchQuantities(existing.id)
      await updateDoc(
        doc(this.db, col("products"), existing.id),
        {
          ...this.productDocPayload({
            ...payloadFields,
            stock: totalStock,
          }),
        } as DocumentData
      )
      return { existingProduct: true, productId: existing.id }
    }

    const productId = await this.insertFullProduct({
      ...payloadFields,
      stock: hasBatch ? qty : 0,
    })

    if (hasExpiryBatch) {
      await this.addBatch({
        productId,
        batch: {
          expiryDate: expiryDate!,
          quantity: qty,
          createdAt: new Date(),
        },
      })
    } else if (hasNoExpiryBatch) {
      await this.addBatch({
        productId,
        batch: {
          expiryDate: NO_EXPIRY_BATCH_DATE,
          quantity: qty,
          createdAt: new Date(),
          noExpiry: true,
        },
      })
    }

    return { existingProduct: false, productId }
  }

  async getBatchesSortedByExpiry(productId: string): Promise<BatchModel[]> {
    const q = query(
      collection(this.db, col("products"), productId, "batches"),
      orderBy("expiryDate", "asc")
    )
    const snap = await getDocs(q)
    return snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>
      return {
        id: doc.id,
        expiryDate: (data.expiryDate as Timestamp | undefined)?.toDate?.() ?? new Date(),
        quantity: Number(data.quantity ?? 0),
        createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
        ...(isNoExpiryBatch(data) ? { noExpiry: true } : {}),
      }
    })
  }
}

