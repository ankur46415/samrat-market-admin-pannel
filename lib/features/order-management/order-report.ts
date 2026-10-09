import type { Product, Sale } from "@/lib/types"
import { normalizeScannedBarcode } from "@/lib/stock"
import {
  isReceivedOrder,
  orderPieceCount,
  parseOrderStatus,
  roundMoney,
  type OrderMgmtGroup,
  type OrderMgmtOrder,
  type OrderMgmtStatus,
} from "./models"

export type OrderKey = string

export function orderKey(groupId: string | undefined, groupName: string | undefined, orderId: string): OrderKey {
  const card = (groupId || groupName || "").trim().toLowerCase()
  return `${card}|${orderId.trim()}`
}

export type OrderReportRow = {
  product: Product
  source: "live" | "draft"
  /** Qty on the matching order line (by name), if any. */
  orderedQty: number | null
  stock: number
  soldQty: number
  soldAmount: number
  /** stock + sold — what this order must have brought in. */
  accountedQty: number
  /** accounted − ordered (null when there is no order line). */
  difference: number | null
  stockValue: number
}

export type OrderSummary = {
  key: OrderKey
  orderId: string
  groupId: string
  groupName: string
  color: string
  status: OrderMgmtStatus | "unknown"
  createdAt: Date | null
  orderedPcs: number
  orderAmount: number
  productCount: number
}

export type OrderReport = OrderSummary & {
  rows: OrderReportRow[]
  /** Order lines with no product tagged to this order. */
  missingLines: { name: string; brand: string; qty: number }[]
  totals: {
    stock: number
    soldQty: number
    soldAmount: number
    stockValue: number
    accounted: number
    difference: number
  }
}

function fold(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function productBarcodes(product: Product): Set<string> {
  const keys = new Set<string>()
  for (const raw of [product.barcode ?? "", ...(product.barcodeKeys ?? [])]) {
    const n = normalizeScannedBarcode(raw)
    if (n) keys.add(n)
  }
  return keys
}

function orderDate(order: OrderMgmtOrder | undefined): Date | null {
  if (!order) return null
  const d = new Date(order.createdAt)
  return Number.isNaN(d.getTime()) ? null : d
}

function findOrder(groups: OrderMgmtGroup[], groupId: string, groupName: string, orderId: string) {
  const group =
    groups.find((g) => g.id === groupId) ??
    groups.find((g) => groupName && g.name.trim().toLowerCase() === groupName.trim().toLowerCase())
  const order = group?.orders.find((o) => o.id === orderId)
  return { group, order }
}

function productInOrder(product: Product, summary: OrderSummary) {
  if (product.orderId?.trim() !== summary.orderId) return false
  if (product.orderGroupId && product.orderGroupId === summary.groupId) return true
  const name = (product.orderGroupName ?? "").trim().toLowerCase()
  if (name) return name === summary.groupName.trim().toLowerCase()
  return !product.orderGroupId && !summary.groupId && !summary.groupName
}

/** Every order that has products tagged, plus received orders with nothing tagged yet. */
export function listOrders(
  groups: OrderMgmtGroup[],
  products: Product[],
  drafts: Product[]
): OrderSummary[] {
  const byKey = new Map<OrderKey, OrderSummary>()

  const ensure = (groupId: string, groupName: string, orderId: string) => {
    const { group, order } = findOrder(groups, groupId, groupName, orderId)
    const key = orderKey(group?.id ?? groupId, group?.name ?? groupName, orderId)
    let summary = byKey.get(key)
    if (!summary) {
      summary = {
        key,
        orderId,
        groupId: group?.id ?? groupId,
        groupName: group?.name ?? groupName,
        color: group?.color || "#0d9488",
        status: order ? parseOrderStatus(order.status) : "unknown",
        createdAt: orderDate(order),
        orderedPcs: order ? orderPieceCount(order) : 0,
        orderAmount: order ? roundMoney(order.lines.reduce((s, l) => s + (Number(l.total) || 0), 0)) : 0,
        productCount: 0,
      }
      byKey.set(key, summary)
    }
    return summary
  }

  for (const product of [...products, ...drafts]) {
    const orderId = product.orderId?.trim()
    if (!orderId) continue
    ensure(product.orderGroupId ?? "", product.orderGroupName ?? "", orderId).productCount += 1
  }
  for (const group of groups) {
    for (const order of group.orders) {
      if (isReceivedOrder(order)) ensure(group.id, group.name, order.id)
    }
  }

  return [...byKey.values()].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) || a.groupName.localeCompare(b.groupName)
  )
}

/**
 * Sold qty counts sale lines for the product's barcode on or after the order date.
 * A barcode restocked by a later order is attributed to the order on the product.
 */
export function buildOrderReport(
  summary: OrderSummary,
  groups: OrderMgmtGroup[],
  products: Product[],
  drafts: Product[],
  sales: Sale[]
): OrderReport {
  const { order } = findOrder(groups, summary.groupId, summary.groupName, summary.orderId)
  const since = summary.createdAt ? new Date(summary.createdAt) : null
  if (since) since.setHours(0, 0, 0, 0)

  const tagged: { product: Product; source: "live" | "draft" }[] = [
    ...products.map((product) => ({ product, source: "live" as const })),
    ...drafts.map((product) => ({ product, source: "draft" as const })),
  ].filter(({ product }) => productInOrder(product, summary))

  const lineQty = new Map<string, number>()
  for (const line of order?.lines ?? []) {
    const k = fold(line.name)
    lineQty.set(k, (lineQty.get(k) ?? 0) + Math.max(0, Math.floor(Number(line.qty) || 0)))
  }
  const usedLines = new Set<string>()

  const relevantSales = since ? sales.filter((s) => s.createdAt >= since) : sales

  const rows: OrderReportRow[] = tagged.map(({ product, source }) => {
    const codes = productBarcodes(product)
    let soldQty = 0
    let soldAmount = 0
    if (codes.size > 0) {
      for (const sale of relevantSales) {
        for (const item of sale.items) {
          if (!codes.has(normalizeScannedBarcode(item.productId))) continue
          soldQty += Number(item.quantity) || 0
          soldAmount += Number(item.total) || 0
        }
      }
    }
    const nameKey = fold(product.name)
    const orderedQty = lineQty.has(nameKey) ? lineQty.get(nameKey)! : null
    if (orderedQty != null) usedLines.add(nameKey)
    const stock = Math.max(0, Number(product.stock) || 0)
    const accountedQty = stock + soldQty
    return {
      product,
      source,
      orderedQty,
      stock,
      soldQty,
      soldAmount: roundMoney(soldAmount),
      accountedQty,
      difference: orderedQty == null ? null : accountedQty - orderedQty,
      stockValue: roundMoney(stock * (Number(product.costPrice) || 0)),
    }
  })
  rows.sort((a, b) => a.product.name.localeCompare(b.product.name))

  const missingLines = (order?.lines ?? [])
    .filter((line) => !usedLines.has(fold(line.name)))
    .map((line) => ({ name: line.name, brand: line.brand, qty: Math.max(0, Math.floor(Number(line.qty) || 0)) }))

  const totals = rows.reduce(
    (acc, row) => {
      acc.stock += row.stock
      acc.soldQty += row.soldQty
      acc.soldAmount += row.soldAmount
      acc.stockValue += row.stockValue
      acc.accounted += row.accountedQty
      return acc
    },
    { stock: 0, soldQty: 0, soldAmount: 0, stockValue: 0, accounted: 0, difference: 0 }
  )
  totals.soldAmount = roundMoney(totals.soldAmount)
  totals.stockValue = roundMoney(totals.stockValue)
  totals.difference = totals.accounted - summary.orderedPcs

  return { ...summary, productCount: rows.length, rows, missingLines, totals }
}
