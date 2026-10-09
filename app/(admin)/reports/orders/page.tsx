"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ClipboardList, Search } from "lucide-react"
import { useDraftProducts, useProducts, useSales } from "@/hooks/use-firestore"
import { useOrderManagement } from "@/hooks/use-order-management"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buildOrderReport, listOrders, type OrderSummary } from "@/lib/features/order-management/order-report"
import { cn } from "@/lib/utils"

const ALL = "__all__"

function money(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n)
}

function statusBadge(status: OrderSummary["status"]) {
  if (status === "delivered") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Received</Badge>
  if (status === "pending") return <Badge variant="outline">Pending</Badge>
  return <Badge variant="secondary">Not in Order Management</Badge>
}

function diffCell(diff: number | null) {
  if (diff == null) return <span className="text-muted-foreground">—</span>
  if (diff === 0) return <span className="font-semibold text-emerald-600">OK</span>
  return (
    <span className={cn("font-semibold", diff < 0 ? "text-destructive" : "text-amber-600")}>
      {diff > 0 ? `+${diff}` : diff}
    </span>
  )
}

export default function OrderReportPage() {
  const { groups, loading: groupsLoading } = useOrderManagement()
  const { products, loading: productsLoading } = useProducts()
  const { drafts, loading: draftsLoading } = useDraftProducts()
  const { sales, loading: salesLoading } = useSales()
  const [card, setCard] = useState(ALL)
  const [search, setSearch] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const loading = groupsLoading || productsLoading || draftsLoading || salesLoading

  const orders = useMemo(() => listOrders(groups, products, drafts), [groups, products, drafts])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (card !== ALL && o.groupId !== card) return false
      if (!q) return true
      return o.orderId.toLowerCase().includes(q) || o.groupName.toLowerCase().includes(q)
    })
  }, [orders, card, search])

  const selected = visible.find((o) => o.key === selectedKey) ?? visible[0] ?? null
  const report = useMemo(
    () => (selected ? buildOrderReport(selected, groups, products, drafts, sales) : null),
    [selected, groups, products, drafts, sales]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardList className="h-6 w-6 text-primary" />
            Order report
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Stock and sales for one received order at a time. Fix the products of one order until every line shows
            OK, then move to the next order.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={card} onValueChange={setCard}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All cards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All cards</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search order id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No orders yet. Mark an order as Delivered in Order Management, then pick it on products in Add product
            or Draft Entries.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Orders</CardTitle>
              <CardDescription>{visible.length} orders</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
              {visible.map((o) => {
                const active = o.key === selected?.key
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setSelectedKey(o.key)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold">{o.orderId}</span>
                      <span className="text-xs text-muted-foreground">{o.productCount} products</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                      {o.groupName || "No card"}
                      {o.createdAt ? <span>· {format(o.createdAt, "dd MMM yyyy")}</span> : null}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {report ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="font-mono">{report.orderId}</span>
                      {statusBadge(report.status)}
                    </CardTitle>
                    <CardDescription>
                      {report.groupName || "No card"}
                      {report.createdAt ? ` · ordered ${format(report.createdAt, "dd MMM yyyy")}` : ""}
                      {report.orderAmount ? ` · order value ${money(report.orderAmount)}` : ""}
                    </CardDescription>
                  </div>
                  <Link href="/order-management" className="text-sm text-primary hover:underline">
                    Open Order Management
                  </Link>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Ordered pcs", String(report.orderedPcs)],
                    ["In stock", String(report.totals.stock)],
                    ["Sold", String(report.totals.soldQty)],
                    ["Sales", money(report.totals.soldAmount)],
                    ["Stock value (cost)", money(report.totals.stockValue)],
                    [
                      "Stock + sold vs ordered",
                      report.orderedPcs
                        ? report.totals.difference === 0
                          ? "OK"
                          : report.totals.difference > 0
                            ? `+${report.totals.difference}`
                            : String(report.totals.difference)
                        : "—",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Products in this order</CardTitle>
                  <CardDescription>
                    Sold counts bills for the product barcode from the order date onward. Difference = stock + sold −
                    ordered qty on the order line with the same name.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>List</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">In stock</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No products are tagged with this order yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.rows.map((row) => (
                          <TableRow key={`${row.source}-${row.product.id}`}>
                            <TableCell>
                              <p className="font-medium">{row.product.name}</p>
                              {row.product.barcode ? (
                                <p className="font-mono text-xs text-muted-foreground">{row.product.barcode}</p>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {row.source === "draft" ? (
                                <Badge variant="outline">Draft</Badge>
                              ) : (
                                <Badge variant="secondary">All Products</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.orderedQty ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.stock}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.soldQty}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(row.soldAmount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{diffCell(row.difference)}</TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={
                                  row.source === "draft"
                                    ? `/draft-entries/edit/${row.product.id}`
                                    : `/inventory/edit/${row.product.id}`
                                }
                                className="text-sm text-primary hover:underline"
                              >
                                Fix
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {report.missingLines.length ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order lines with no product</CardTitle>
                    <CardDescription>
                      These items are on the order but no product with the same name is tagged to it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead className="text-right">Ordered</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.missingLines.map((line, index) => (
                          <TableRow key={`${line.name}-${index}`}>
                            <TableCell className="font-medium">{line.name}</TableCell>
                            <TableCell className="text-muted-foreground">{line.brand || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
