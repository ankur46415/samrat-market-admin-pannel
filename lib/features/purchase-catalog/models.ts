/**
 * Purchase Catalog — Models
 * Ye tab mein agency/dealer se jo items order karte hain unka catalog manage hoga.
 */

/** Ek individual product entry (JSON import format ke saath compatible) */
export interface CatalogProduct {
  product_name: string
  price: number
  moq: number // Minimum Order Quantity
  /** Optional extra fields */
  brand?: string
  unit?: string
  notes?: string
}

/** Ek catalog group — jaise "Sharpeners", "Erasers", "Drawing Boxes" etc. */
export interface PurchaseCatalog {
  id: string
  /** Group/Category name — e.g. "Pencil Sharpeners", "Erasers" */
  name: string
  /** Source — agency/dealer name or supplier info */
  source?: string
  /** Color tag for UI card */
  color?: string
  /** All products under this catalog group */
  products: CatalogProduct[]
  createdAt: Date
  updatedAt: Date
}
