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
import type { BatchModel } from "@/lib/features/inventory/models/batch-model"
import type { ProductModel } from "@/lib/features/inventory/models/product-model"
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
  mrp?: number
}

export class InventoryBatchService {
  constructor(private readonly db: Firestore) {}

  private async sumBatchQuantities(productId: string): Promise<number> {
    const snap = await getDocs(collection(this.db, "products", productId, "batches"))
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
    const b = fields.brand?.trim()
    if (b) d.brand = b
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
  }): Promise<string> {
    const now = Timestamp.now()
    const ref = await addDoc(collection(this.db, "products"), {
      ...this.productDocPayload(fields),
      createdAt: now,
    })
    return ref.id
  }

  async getProductByBarcode(barcode: string): Promise<ProductModel | null> {
    const q = query(
      collection(this.db, "products"),
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
    await addDoc(collection(this.db, "products", productId, "batches"), {
      expiryDate: Timestamp.fromDate(batch.expiryDate),
      quantity: batch.quantity,
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
    } = input
    const normalizedBarcode = barcode.trim()
    const qty = Math.max(0, Math.floor(Number(quantity) || 0))
    const hasBatch = expiryDate instanceof Date && !Number.isNaN(expiryDate.getTime()) && qty > 0
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
      productExpiry: hasBatch ? expiryDate! : undefined,
      mrp: input.mrp,
    }

    if (existing?.id) {
      if (hasBatch) {
        await this.addBatch({
          productId: existing.id,
          batch: {
            expiryDate: expiryDate!,
            quantity: qty,
            createdAt: new Date(),
          },
        })
      }
      const totalStock = await this.sumBatchQuantities(existing.id)
      await updateDoc(
        doc(this.db, "products", existing.id),
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

    if (hasBatch) {
      await this.addBatch({
        productId,
        batch: {
          expiryDate: expiryDate!,
          quantity: qty,
          createdAt: new Date(),
        },
      })
    }

    return { existingProduct: false, productId }
  }

  async getBatchesSortedByExpiry(productId: string): Promise<BatchModel[]> {
    const q = query(
      collection(this.db, "products", productId, "batches"),
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
      }
    })
  }
}

