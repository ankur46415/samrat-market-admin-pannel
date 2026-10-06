/**
 * One FEFO batch under `products/{productId}/batches/{batchId}`.
 */
export interface ProductBatch {
  id: string
  quantity: number
  expiryDate: Date
  createdAt: Date
  /** True when batch was saved without an expiry date (non-perishable stock). */
  noExpiry?: boolean
}

/**
 * Firestore `products` document fields (camelCase):
 * barcode?, brand?, category, costPrice, createdAt, expiry?, minStock, name, price, stock, unit, updatedAt
 * `batches` is populated client-side from the `batches` subcollection (sorted by expiry, oldest first).
 */
export interface Product {
  id: string
  name: string
  category: string
  /** Rack slot for FEFO/bin allocation (R-1..R-20). Empty string means missing/unknown. */
  rack: string
  /** Optional display tag for merchandising/filtering */
  tag: string
  /** Staff account that added this draft (for multi-account audit). */
  ownerAccountTag?: string
  /** Product status label (e.g. active/inactive) */
  status: string
  price: number
  costPrice: number
  /** Line/purchase total (e.g. qty × unit cost); stored on product doc when set at audit. */
  totalCost?: number
  stock: number
  unit: string
  barcode?: string
  /** Extra lookup keys (sku, ean, padded variants) for POS scan matching */
  barcodeKeys?: string[]
  brand?: string
  /** From Manage Dropdown — supplier name registry */
  supplierName?: string
  /** From Manage Dropdown — supplier contact registry */
  supplierContact?: string
  /** Firebase Storage download URL — optional product photo */
  imageUrl?: string
  /** Maximum retail price (MRP) when set at product creation */
  mrp?: number
  /** MRP discount % from product details (drives selling price). */
  discountPercent?: number
  /** GST % slab (0, 5, 12, 18, 28, etc.) when set at product entry. */
  gstPercent?: number
  minStock: number
  expiry?: string
  /** Derived from subcollection; may be empty for legacy docs without batches. */
  batches: ProductBatch[]
  createdAt: Date
  updatedAt: Date
}

/** Pending field edits from Scan & Edit — approved into live `products`. */
export interface OpenDraftEntry {
  id: string
  productId: string
  barcode: string
  name: string
  category: string
  rack: string
  /** Set to editor account (e.g. EMP01) to track who submitted the change */
  tag: string
  status: string
  brand?: string
  supplierName?: string
  supplierContact?: string
  mrp?: number
  discountPercent?: number
  price: number
  stock: number
  editedBy: string
  editedByEmail: string
  createdAt: Date
  updatedAt: Date
}

export type OpenDraftEntryInput = Pick<
  OpenDraftEntry,
  | "productId"
  | "barcode"
  | "name"
  | "category"
  | "rack"
  | "tag"
  | "status"
  | "brand"
  | "supplierName"
  | "supplierContact"
  | "mrp"
  | "discountPercent"
  | "price"
  | "stock"
  | "editedBy"
  | "editedByEmail"
>

// Customer types
export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  balance: number // Udhaar balance (credit)
  totalPurchases: number
  createdAt: Date
  updatedAt: Date
}

// Sale types — web uses invoice-shaped docs; Flutter may store one line per doc (soldAt, totalAmount, …).
export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  total: number
  mrp?: number
  discountPercent?: number
}

export interface Sale {
  id: string
  billNo: string
  customerId?: string
  customerName?: string
  /** Customer phone on bill; defaults to "NA" for walk-in */
  customerPhone?: string
  items: SaleItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: "cash" | "upi" | "card" | "credit"
  amountPaid: number
  change: number
  createdAt: Date
  createdBy: string
}

// Ledger entry for credit tracking
export interface LedgerEntry {
  id: string
  customerId: string
  type: "credit" | "payment"
  amount: number
  saleId?: string
  notes?: string
  createdAt: Date
}

// Dashboard stats
export interface DashboardStats {
  todaySales: number
  totalRevenue: number
  totalCustomers: number
  lowStockCount: number
  pendingCredit: number
}

// Category for filtering
export interface Category {
  id: string
  name: string
  productCount: number
}

// Order types
export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  address: string
  customerName: string
  customerPhone: string
  items: OrderItem[]
  orderDate: Date
  status: string
  totalAmount: number
}
