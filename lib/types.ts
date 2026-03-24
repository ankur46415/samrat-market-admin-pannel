/**
 * One FEFO batch under `products/{productId}/batches/{batchId}`.
 */
export interface ProductBatch {
  id: string
  quantity: number
  expiryDate: Date
  createdAt: Date
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
  price: number
  costPrice: number
  stock: number
  unit: string
  barcode?: string
  brand?: string
  minStock: number
  expiry?: string
  /** Derived from subcollection; may be empty for legacy docs without batches. */
  batches: ProductBatch[]
  createdAt: Date
  updatedAt: Date
}

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
}

export interface Sale {
  id: string
  billNo: string
  customerId?: string
  customerName?: string
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
