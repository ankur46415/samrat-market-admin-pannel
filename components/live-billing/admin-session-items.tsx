"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber, liveSessionItemQuantity } from "@/lib/stock"
import { clampDiscountPercent, lineItemAmount } from "@/lib/billing/line-discount"
import type { LiveBillingLineItem } from "@/lib/features/live_billing_admin/services/live_billing_admin_service"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function AdminSessionItems({
  sessionId,
  status = "active",
}: {
  sessionId: string
  status?: "active" | "completed" | "cancelled"
}) {
  const [items, setItems] = useState<LiveBillingLineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const itemsCol = collection(db, "live_sessions", sessionId, "items")

    const unsubscribe = onSnapshot(
      itemsCol,
      (snapshot) => {
        const nextItems = snapshot.docs
          .map((doc) => {
            const data = doc.data() as Record<string, unknown>
            return {
              barcode: String(data.barcode ?? doc.id),
              name: String(data.name ?? "").trim(),
              price: firestoreNumber(data.price, 0),
              quantity: liveSessionItemQuantity(data),
              discountPercent: clampDiscountPercent(firestoreNumber(data.discountPercent, 0)),
            } satisfies LiveBillingLineItem
          })
          .sort((a, b) => a.name.localeCompare(b.name))

        setItems(nextItems)
        setLoading(false)
      },
      () => {
        setItems([])
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [sessionId])

  const totals = useMemo(() => {
    const lineCount = items.length
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0)
    const grandTotal = items.reduce(
      (sum, i) => sum + lineItemAmount(i.quantity, i.price, i.discountPercent ?? 0),
      0
    )
    return { lineCount, totalQty, grandTotal }
  }, [items])

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
          <span>
            {status === "completed"
              ? "Completed Bill"
              : status === "cancelled"
              ? "Bill Cancelled"
              : "Live Items"}
          </span>
          {loading ? (
            <Badge variant="outline">Loading...</Badge>
          ) : status === "completed" ? (
            <Badge variant="secondary">Completed</Badge>
          ) : status === "cancelled" ? (
            <Badge variant="destructive">Cancelled</Badge>
          ) : (
            <Badge variant={totals.grandTotal > 0 ? "default" : "secondary"}>
              {totals.lineCount} item(s)
            </Badge>
          )}
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          {status === "completed"
            ? "This bill has been moved to completed_bills."
            : status === "cancelled"
            ? "This live session was cancelled and will not be generated."
            : "Updates instantly as the phone app scans items."}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Lines</p>
            <p className="text-lg font-semibold">{totals.lineCount}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Quantity</p>
            <p className="text-lg font-semibold">{totals.totalQty}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Grand Total</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.grandTotal)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No scanned items yet.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[340px] pr-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.barcode}>
                      <TableCell className="font-medium">{it.name || it.barcode}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(it.price * it.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="rounded-lg border p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Summary</p>
                <p className="text-sm font-medium">
                  {totals.totalQty} total units in {totals.lineCount} item line(s)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Grand Total</p>
                <p className="text-xl font-semibold">{formatCurrency(totals.grandTotal)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

