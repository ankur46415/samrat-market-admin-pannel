"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firestoreNumber } from "@/lib/stock"
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
              quantity: firestoreNumber(data.quantity, 0),
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
    const grandTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    return { lineCount, totalQty, grandTotal }
  }, [items])

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="space-y-6 pb-6 bg-gradient-to-r from-chart-1/5 via-transparent to-transparent border-b border-border/40">
        <CardTitle className="flex items-center justify-between gap-3 flex-wrap text-xl">
          <span>
            {status === "completed"
              ? "Bill Completed"
              : status === "cancelled"
              ? "Bill Cancelled"
              : "Scanned Items"}
          </span>
          {loading ? (
            <Badge variant="outline">Loading...</Badge>
          ) : status === "completed" ? (
            <Badge variant="secondary">Completed</Badge>
          ) : status === "cancelled" ? (
            <Badge variant="destructive">Cancelled</Badge>
          ) : (
            <Badge variant={totals.grandTotal > 0 ? "default" : "secondary"} className="text-base px-3 py-1">
              {totals.lineCount} item{totals.lineCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>

        <p className="text-sm text-muted-foreground/80 font-medium">
          {status === "completed"
            ? "This bill has been finalized and moved to completed bills."
            : status === "cancelled"
            ? "This live session was cancelled and will not generate a bill."
            : "Updates in real-time as items are scanned from the phone app."}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:bg-muted/30 transition-colors">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Product Lines
            </p>
            <p className="text-2xl font-bold text-foreground">{totals.lineCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:bg-muted/30 transition-colors">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Total Units
            </p>
            <p className="text-2xl font-bold text-foreground">{totals.totalQty}</p>
          </div>
          <div className="rounded-lg border border-chart-1/30 bg-gradient-to-br from-chart-1/10 to-primary/5 p-4 hover:border-chart-1/50 transition-colors">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Grand Total
            </p>
            <p className="text-2xl font-bold text-chart-1">{formatCurrency(totals.grandTotal)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8-4m0 0l8 4m-8-4v10m-8 4l8 4 8-4m-8 4l-8-4m8 4v-10m-8-4l8-4m0 0L3.172 5.172a2 2 0 00-.757 2.828l.6 1.8A2 2 0 005 11v5m0 0l8 4m-8-4l-8-4" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Waiting for items to be scanned...</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[360px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 border-b border-border/40">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-bold text-foreground">Product</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Qty</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Price</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow 
                      key={it.barcode}
                      className="border-border/40 hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-medium text-foreground">{it.name || it.barcode}</TableCell>
                      <TableCell className="text-right font-semibold text-foreground">{it.quantity}</TableCell>
                      <TableCell className="text-right text-chart-1 font-semibold">{formatCurrency(it.price)}</TableCell>
                      <TableCell className="text-right font-bold text-chart-1">
                        {formatCurrency(it.price * it.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="rounded-lg border-t border-border/40 bg-gradient-to-r from-muted/20 via-transparent to-muted/20 p-4 flex items-center justify-between flex-wrap gap-4 mx-0">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Bill Summary
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {totals.totalQty} unit{totals.totalQty !== 1 ? "s" : ""} • {totals.lineCount} line{totals.lineCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Grand Total
                </p>
                <p className="text-2xl font-bold text-chart-1">{formatCurrency(totals.grandTotal)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

