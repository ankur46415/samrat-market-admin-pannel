"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrderManagement } from "@/hooks/use-order-management"
import { isReceivedOrder, orderPieceCount, type OrderMgmtGroup, type OrderMgmtOrder } from "@/lib/features/order-management/models"
import type { Product } from "@/lib/types"
import { cn } from "@/lib/utils"

export type OrderRef = {
  orderId?: string
  orderGroupId?: string
  orderGroupName?: string
}

const NONE = "__none__"

export function orderRefText(ref: OrderRef): string {
  const id = ref.orderId?.trim()
  if (!id) return ""
  const card = ref.orderGroupName?.trim()
  return card ? `${card} · ${id}` : id
}

export function receivedOrders(group: OrderMgmtGroup | undefined): OrderMgmtOrder[] {
  if (!group) return []
  return group.orders
    .filter((order) => isReceivedOrder(order))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function orderDate(order: OrderMgmtOrder) {
  const d = new Date(order.createdAt)
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd MMM yyyy")
}

export function OrderRefLabel({ product }: { product: OrderRef }) {
  const id = product.orderId?.trim()
  if (!id) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-mono text-xs font-semibold text-foreground">{id}</span>
      {product.orderGroupName ? (
        <span className="text-xs text-muted-foreground">{product.orderGroupName}</span>
      ) : null}
    </span>
  )
}

/** Pick an Order Management card, then one of its received orders. */
export function OrderPicker({
  value,
  onChange,
  className,
  fieldClassName,
  labelClassName,
  triggerClassName,
  disabled,
}: {
  value: OrderRef
  onChange: (next: OrderRef) => void
  className?: string
  fieldClassName?: string
  labelClassName?: string
  triggerClassName?: string
  disabled?: boolean
}) {
  const { groups, loading } = useOrderManagement()

  const groupId = useMemo(() => {
    if (value.orderGroupId && groups.some((g) => g.id === value.orderGroupId)) return value.orderGroupId
    if (value.orderGroupName) {
      const byName = groups.find((g) => g.name.trim().toLowerCase() === value.orderGroupName!.trim().toLowerCase())
      if (byName) return byName.id
    }
    return value.orderGroupId ?? ""
  }, [groups, value.orderGroupId, value.orderGroupName])

  const group = groups.find((g) => g.id === groupId)
  const orders = receivedOrders(group)
  const currentId = value.orderId?.trim() ?? ""
  const currentListed = !currentId || orders.some((o) => o.id === currentId)

  return (
    <div className={cn("grid gap-6 sm:grid-cols-2", className)}>
      <div className={fieldClassName}>
        <Label className={labelClassName}>Order card</Label>
        <Select
          value={groupId || NONE}
          disabled={disabled || loading}
          onValueChange={(next) => {
            if (next === NONE) {
              onChange({})
              return
            }
            const picked = groups.find((g) => g.id === next)
            onChange({ orderGroupId: next, orderGroupName: picked?.name ?? "", orderId: "" })
          }}
        >
          <SelectTrigger className={cn("w-full", triggerClassName)}>
            <SelectValue placeholder={loading ? "Loading cards…" : "Select card"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No order</SelectItem>
            {groups.map((g) => {
              const count = receivedOrders(g).length
              return (
                <SelectItem key={g.id} value={g.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color || "#0d9488" }} />
                    {g.name}
                    <span className="text-xs text-muted-foreground">
                      ({count} received)
                    </span>
                  </span>
                </SelectItem>
              )
            })}
            {groupId && !group ? (
              <SelectItem value={groupId}>{value.orderGroupName || "Card not found"}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <div className={fieldClassName}>
        <Label className={labelClassName}>Received order</Label>
        <Select
          value={currentId || NONE}
          disabled={disabled || loading || !groupId}
          onValueChange={(next) => {
            if (next === NONE) {
              onChange({ orderGroupId: groupId, orderGroupName: group?.name ?? value.orderGroupName, orderId: "" })
              return
            }
            onChange({ orderGroupId: groupId, orderGroupName: group?.name ?? value.orderGroupName, orderId: next })
          }}
        >
          <SelectTrigger className={cn("w-full", triggerClassName)}>
            <SelectValue placeholder={groupId ? "Select order" : "Pick a card first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No order</SelectItem>
            {orders.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="font-mono">{o.id}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {orderDate(o)} · {orderPieceCount(o)} pcs
                </span>
              </SelectItem>
            ))}
            {!currentListed ? (
              <SelectItem value={currentId}>
                <span className="font-mono">{currentId}</span>
                <span className="ml-2 text-xs text-muted-foreground">(not received)</span>
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {groupId && !loading && orders.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">This card has no received orders yet.</p>
        ) : null}
      </div>
    </div>
  )
}

export function orderRefOf(product: Pick<Product, "orderId" | "orderGroupId" | "orderGroupName">): OrderRef {
  return {
    orderId: product.orderId ?? "",
    orderGroupId: product.orderGroupId ?? "",
    orderGroupName: product.orderGroupName ?? "",
  }
}
