import type { Product, Sale, SaleItem } from "@/lib/types"

/** When product cost is 0 or missing — profit = this × line sell amount. */
export const DEFAULT_PROFIT_MARGIN_NO_COST = 0.05

export type SaleLineProfitDetail = {
  sellAmount: number
  mrpUnit?: number
  sellUnitPrice: number
  quantity: number
  costUnit: number | null
  totalCost: number
  profit: number
  usedDefaultMargin: boolean
}

/** Amount customer paid for this line (sell-time total). */
export function lineSellAmount(item: SaleItem): number {
  const total = Number(item.total)
  if (Number.isFinite(total) && total >= 0) return total
  const price = Number(item.price)
  const qty = Number(item.quantity)
  if (Number.isFinite(price) && Number.isFinite(qty) && qty > 0) return price * qty
  return 0
}

/** MRP at sell time: bill line first, else current product MRP. */
export function lineMrpUnit(item: SaleItem, product: Product | undefined): number | undefined {
  const lineMrp = Number(item.mrp)
  if (Number.isFinite(lineMrp) && lineMrp > 0) return lineMrp
  const productMrp = product?.mrp
  if (productMrp != null && Number.isFinite(productMrp) && productMrp > 0) return productMrp
  return undefined
}

function productCostUnit(product: Product | undefined): number | null {
  if (!product) return null
  const costUnit = Number(product.costPrice)
  if (!Number.isFinite(costUnit) || costUnit < 0) return null
  return costUnit
}

function usesDefaultMargin(product: Product | undefined): boolean {
  const costUnit = productCostUnit(product)
  return costUnit == null || costUnit === 0
}

export function saleItemUsesDefaultMargin(product: Product | undefined): boolean {
  return usesDefaultMargin(product)
}

export function saleLineProfitDetail(
  item: SaleItem,
  product: Product | undefined
): SaleLineProfitDetail {
  const qty = Number(item.quantity)
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0
  const sellAmount = lineSellAmount(item)
  const sellUnitPrice =
    safeQty > 0 ? sellAmount / safeQty : Number.isFinite(Number(item.price)) ? Number(item.price) : 0
  const mrpUnit = lineMrpUnit(item, product)
  const costUnit = productCostUnit(product)

  if (usesDefaultMargin(product)) {
    const profit = sellAmount * DEFAULT_PROFIT_MARGIN_NO_COST
    return {
      sellAmount,
      mrpUnit,
      sellUnitPrice,
      quantity: safeQty,
      costUnit,
      totalCost: sellAmount - profit,
      profit,
      usedDefaultMargin: true,
    }
  }

  const totalCost = costUnit! * safeQty
  return {
    sellAmount,
    mrpUnit,
    sellUnitPrice,
    quantity: safeQty,
    costUnit,
    totalCost,
    profit: sellAmount - totalCost,
    usedDefaultMargin: false,
  }
}

export function saleItemLineCost(item: SaleItem, product: Product | undefined): number {
  return saleLineProfitDetail(item, product).totalCost
}

export function saleItemLineProfit(item: SaleItem, product: Product | undefined): number {
  return saleLineProfitDetail(item, product).profit
}

export function saleGrossProfit(sale: Sale, productById: Map<string, Product>): number {
  return sale.items.reduce((sum, item) => {
    const product = productById.get(item.productId)
    return sum + saleItemLineProfit(item, product)
  }, 0)
}

export function salesGrossProfit(sales: Sale[], products: Product[]): number {
  const productById = new Map(products.map((p) => [p.id, p]))
  return sales.reduce((sum, sale) => sum + saleGrossProfit(sale, productById), 0)
}

export function salesTotalCost(sales: Sale[], products: Product[]): number {
  const productById = new Map(products.map((p) => [p.id, p]))
  return sales.reduce((sum, sale) => {
    const saleCost = sale.items.reduce(
      (itemSum, item) => itemSum + saleItemLineCost(item, productById.get(item.productId)),
      0
    )
    return sum + saleCost
  }, 0)
}
