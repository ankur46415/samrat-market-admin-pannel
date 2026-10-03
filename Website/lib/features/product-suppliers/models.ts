/** Firestore collection: `product_suppliers` */
export interface ProductSupplier {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

/** Firestore collection: `supplier_order_items` — one row per product line */
export interface SupplierOrderItem {
  id: string
  supplierId: string
  supplierName: string
  /** Groups line items created in the same order batch */
  orderId: string
  /** User label: order no., brand name, etc. — e.g. "123456", "TATA" */
  orderTag: string
  product: string
  brand: string
  buyRate: number
  mrp: number
  productId: string
  discountPercent: number
  /** MRP after discount % — stored for sorting/search */
  saleRate: number
  orderDate: Date
  deliveredDate?: Date | null
  createdAt: Date
  updatedAt: Date
}

export type SupplierOrderItemInput = Omit<
  SupplierOrderItem,
  "id" | "saleRate" | "createdAt" | "updatedAt"
>

export function computeSaleRate(mrp: number, discountPercent: number): number {
  if (!Number.isFinite(mrp) || mrp <= 0) return 0
  const discount = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(100, discountPercent))
    : 0
  return Math.round(mrp * (1 - discount / 100) * 100) / 100
}
