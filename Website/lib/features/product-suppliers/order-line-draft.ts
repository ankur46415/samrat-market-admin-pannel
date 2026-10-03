export type OrderLineDraft = {
  product: string
  brand: string
  buyRate: string
  mrp: string
  productId: string
  discountPercent: string
  /** Optional per-line order date (yyyy-mm-dd); falls back to form order date */
  orderDate: string
  deliveredDate: string
  /** Optional per-line tag; falls back to form order tag */
  orderTag: string
}

export const emptyOrderLine = (): OrderLineDraft => ({
  product: "",
  brand: "",
  buyRate: "",
  mrp: "",
  productId: "",
  discountPercent: "0",
  orderDate: "",
  deliveredDate: "",
  orderTag: "",
})
