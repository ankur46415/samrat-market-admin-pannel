export type OrderMgmtStatus = "pending" | "delivered"

export interface OrderMgmtItem {
  id: string
  name: string
  brand: string
  buyRate: number
  saleRate: number
}

export interface OrderMgmtOrderLine {
  itemId: string
  name: string
  brand: string
  buyRate: number
  saleRate: number
  qty: number
  total: number
}

export interface OrderMgmtOrder {
  id: string
  status: OrderMgmtStatus
  createdAt: string
  lines: OrderMgmtOrderLine[]
}

export interface OrderMgmtGroup {
  id: string
  name: string
  source: string
  color: string
  items: OrderMgmtItem[]
  orders: OrderMgmtOrder[]
  createdAt: Date
  updatedAt: Date
}

export type OrderTableColumn = "id" | "name" | "brand" | "buyRate" | "saleRate" | "qty" | "total"

export const ORDER_TABLE_COLUMNS: { key: OrderTableColumn; label: string; numeric?: boolean }[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "buyRate", label: "Buy rate", numeric: true },
  { key: "saleRate", label: "Sale rate", numeric: true },
  { key: "qty", label: "Qty", numeric: true },
  { key: "total", label: "Total", numeric: true },
]

export const CATALOG_TABLE_COLUMNS = ORDER_TABLE_COLUMNS.filter(
  (col) => col.key !== "qty" && col.key !== "total"
)

export const DEFAULT_ORDER_COLUMNS: OrderTableColumn[] = ORDER_TABLE_COLUMNS.map((c) => c.key)
export const DEFAULT_CATALOG_COLUMNS: OrderTableColumn[] = CATALOG_TABLE_COLUMNS.map((c) => c.key)

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function formatPcs(qty: number): string {
  const n = Math.max(0, Math.floor(Number(qty) || 0))
  return n === 1 ? "1 Pc" : `${n} Pcs`
}

export function lineTotal(buyRate: number, qty: number): number {
  return roundMoney(Math.max(0, Number(buyRate) || 0) * Math.max(0, Number(qty) || 0))
}

export function orderPieceCount(order: OrderMgmtOrder): number {
  return order.lines.reduce((sum, line) => sum + Math.max(0, Math.floor(Number(line.qty) || 0)), 0)
}

export function orderAmount(order: OrderMgmtOrder): number {
  return roundMoney(order.lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0))
}

export function allOrdersAmount(orders: OrderMgmtOrder[]): number {
  return roundMoney(orders.reduce((sum, order) => sum + orderAmount(order), 0))
}

export function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Order ID from date: DDMMYYYY, with -2, -3… if the same day already exists. */
export function nextOrderId(existingIds: string[], at = new Date()): string {
  const dd = String(at.getDate()).padStart(2, "0")
  const mm = String(at.getMonth() + 1).padStart(2, "0")
  const yyyy = String(at.getFullYear())
  const base = `${dd}${mm}${yyyy}`
  if (!existingIds.includes(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!existingIds.includes(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

export function sanitizeItem(raw: Partial<OrderMgmtItem> & Record<string, unknown>): OrderMgmtItem | null {
  const name = String(raw.name ?? raw.product_name ?? raw.productName ?? "").trim()
  if (!name) return null
  const buyRate = Number(raw.buyRate ?? raw.buy_rate ?? raw.price ?? 0)
  const saleRate = Number(raw.saleRate ?? raw.sale_rate ?? raw.sale_price ?? 0)
  return {
    id: String(raw.id ?? "").trim() || newItemId(),
    name,
    brand: String(raw.brand ?? "").trim(),
    buyRate: Number.isFinite(buyRate) ? roundMoney(buyRate) : 0,
    saleRate: Number.isFinite(saleRate) ? roundMoney(saleRate) : 0,
  }
}

export function sanitizeOrderLine(raw: Partial<OrderMgmtOrderLine> & Record<string, unknown>): OrderMgmtOrderLine | null {
  const name = String(raw.name ?? "").trim()
  if (!name) return null
  const qty = Math.max(0, Math.floor(Number(raw.qty) || 0))
  const buyRate = roundMoney(Number(raw.buyRate ?? raw.buy_rate ?? 0) || 0)
  return {
    itemId: String(raw.itemId ?? raw.item_id ?? "").trim(),
    name,
    brand: String(raw.brand ?? "").trim(),
    buyRate,
    saleRate: roundMoney(Number(raw.saleRate ?? raw.sale_rate ?? 0) || 0),
    qty,
    total: lineTotal(buyRate, qty),
  }
}

export function sanitizeOrder(raw: Partial<OrderMgmtOrder> & Record<string, unknown>): OrderMgmtOrder | null {
  const id = String(raw.id ?? raw.order_id ?? "").trim()
  if (!id) return null
  const status: OrderMgmtStatus = raw.status === "delivered" ? "delivered" : "pending"
  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map((line) => sanitizeOrderLine(line as OrderMgmtOrderLine))
        .filter((line): line is OrderMgmtOrderLine => line != null)
    : []
  return {
    id,
    status,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    lines,
  }
}
